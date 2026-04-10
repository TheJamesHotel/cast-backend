import express from "express";
import db from "../db/database.js";
import { cleanupExpiredRecords } from "../services/cleanupService.js";
import { generatePairCode, generateSessionToken } from "../services/codeService.js";

const router = express.Router();

router.post("/start", (req, res) => {
  cleanupExpiredRecords();

  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST"
    });
  }

  const tv = db.prepare(`
    SELECT * FROM tvs WHERE device_id = ?
  `).get(deviceId);

  if (!tv) {
    return res.status(404).json({
      success: false,
      error: "TV_NOT_FOUND"
    });
  }

  const activeSession = db.prepare(`
    SELECT * FROM sessions
    WHERE device_id = ? AND status = 'active'
    LIMIT 1
  `).get(deviceId);

  if (activeSession) {
    return res.status(409).json({
      success: false,
      error: "SESSION_ALREADY_ACTIVE"
    });
  }

  db.prepare(`
    UPDATE pair_codes
    SET status = 'cancelled'
    WHERE device_id = ? AND status = 'active'
  `).run(deviceId);

  const pairCode = generatePairCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO pair_codes (device_id, room_id, pair_code, status, expires_at, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `).run(deviceId, tv.room_id, pairCode, expiresAt, now.toISOString());

  res.json({
    success: true,
    pairing: {
      roomId: tv.room_id,
      pairCode,
      expiresAt,
      pairUrl: `${process.env.PAIR_BASE_URL}/pair?room=${tv.room_id}`
    }
  });
});

router.post("/verify", (req, res) => {
  cleanupExpiredRecords();

  const { roomId, pairCode, guestLabel } = req.body;

  if (!roomId || !pairCode) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST"
    });
  }

  if (!/^\d{6}$/.test(pairCode)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST"
    });
  }

  const code = db.prepare(`
    SELECT * FROM pair_codes
    WHERE room_id = ? AND pair_code = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(roomId, pairCode);

  if (!code) {
    return res.status(400).json({
      success: false,
      error: "INVALID_OR_EXPIRED_CODE"
    });
  }

  const existingSession = db.prepare(`
    SELECT * FROM sessions
    WHERE device_id = ? AND status = 'active'
    LIMIT 1
  `).get(code.device_id);

  if (existingSession) {
    return res.status(409).json({
      success: false,
      error: "SESSION_ALREADY_ACTIVE"
    });
  }

  const now = new Date();
  const validUntil = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const sessionToken = generateSessionToken();

  db.prepare(`
    INSERT INTO sessions (
      session_token, device_id, room_id, guest_label,
      ip_address, user_agent, status, valid_until, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    sessionToken,
    code.device_id,
    roomId,
    guestLabel || "Guest device",
    req.ip || null,
    req.get("user-agent") || null,
    validUntil,
    now.toISOString(),
    now.toISOString()
  );

  db.prepare(`
    UPDATE pair_codes
    SET status = 'used', used_at = ?
    WHERE id = ?
  `).run(now.toISOString(), code.id);

  db.prepare(`
    UPDATE tvs
    SET status = 'paired', updated_at = ?
    WHERE device_id = ?
  `).run(now.toISOString(), code.device_id);

  const tv = db.prepare(`
    SELECT * FROM tvs WHERE device_id = ?
  `).get(code.device_id);

  res.json({
    success: true,
    session: {
      sessionToken,
      roomId,
      deviceId: code.device_id,
      guestLabel: guestLabel || "Guest device",
      validUntil,
      castTargetName: tv.display_name
    }
  });
});

router.post("/disconnect", (req, res) => {
  cleanupExpiredRecords();

  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST"
    });
  }

  const activeSession = db.prepare(`
    SELECT * FROM sessions
    WHERE device_id = ? AND status = 'active'
    LIMIT 1
  `).get(deviceId);

  if (!activeSession) {
    return res.status(404).json({
      success: false,
      error: "NO_ACTIVE_SESSION"
    });
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE sessions
    SET status = 'disconnected', disconnected_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, activeSession.id);

  db.prepare(`
    UPDATE tvs
    SET status = 'idle', updated_at = ?
    WHERE device_id = ?
  `).run(now, deviceId);

  db.prepare(`
    UPDATE pair_codes
    SET status = 'cancelled'
    WHERE device_id = ? AND status = 'active'
  `).run(deviceId);

  res.json({
    success: true,
    message: "Session disconnected"
  });
});

export default router;