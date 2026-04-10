import express from "express";
import db from "../db/database.js";
import { cleanupExpiredRecords } from "../services/cleanupService.js";

const router = express.Router();

router.post("/register", (req, res) => {
  cleanupExpiredRecords();

  const { deviceId, roomId, displayName } = req.body;

  if (!deviceId || !roomId || !displayName) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST"
    });
  }

  const now = new Date().toISOString();

  const existing = db.prepare(`
    SELECT * FROM tvs WHERE device_id = ?
  `).get(deviceId);

  if (existing) {
    db.prepare(`
      UPDATE tvs
      SET room_id = ?, display_name = ?, status = 'idle', last_seen_at = ?, updated_at = ?
      WHERE device_id = ?
    `).run(roomId, displayName, now, now, deviceId);
  } else {
    db.prepare(`
      INSERT INTO tvs (device_id, room_id, display_name, status, last_seen_at, created_at, updated_at)
      VALUES (?, ?, ?, 'idle', ?, ?, ?)
    `).run(deviceId, roomId, displayName, now, now, now);
  }

  const tv = db.prepare(`
    SELECT device_id, room_id, display_name, status
    FROM tvs
    WHERE device_id = ?
  `).get(deviceId);

  res.json({
    success: true,
    tv: {
      deviceId: tv.device_id,
      roomId: tv.room_id,
      displayName: tv.display_name,
      status: tv.status
    }
  });
});

router.get("/status", (req, res) => {
  cleanupExpiredRecords();

  const { deviceId } = req.query;

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
    ORDER BY created_at DESC
    LIMIT 1
  `).get(deviceId);

  if (activeSession) {
    return res.json({
      success: true,
      status: "paired",
      roomId: tv.room_id,
      displayName: tv.display_name,
      pairedDevice: {
        guestLabel: activeSession.guest_label,
        validUntil: activeSession.valid_until
      }
    });
  }

  const activeCode = db.prepare(`
    SELECT * FROM pair_codes
    WHERE device_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(deviceId);

  if (activeCode) {
    return res.json({
      success: true,
      status: "code_active",
      roomId: tv.room_id,
      displayName: tv.display_name,
      pairing: {
        pairCode: activeCode.pair_code,
        expiresAt: activeCode.expires_at
      }
    });
  }

  return res.json({
    success: true,
    status: "idle",
    roomId: tv.room_id,
    displayName: tv.display_name
  });
});

export default router;