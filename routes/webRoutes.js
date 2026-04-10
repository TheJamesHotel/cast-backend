import express from "express";
import fs from "fs";
import path from "path";
import db from "../db/database.js";
import { cleanupExpiredRecords } from "../services/cleanupService.js";
import { generateSessionToken } from "../services/codeService.js";

const router = express.Router();

function loadView(filename) {
  const filePath = path.join(process.cwd(), "views", filename);
  return fs.readFileSync(filePath, "utf8");
}

router.get("/pair", (req, res) => {
  cleanupExpiredRecords();

  const roomId = req.query.room || "";

  let html = loadView("pairForm.html");
  html = html.replaceAll("__ROOM_ID__", roomId);

  res.send(html);
});

router.post("/pair", (req, res) => {
  cleanupExpiredRecords();

  const { roomId, pairCode, guestLabel } = req.body;

  if (!roomId || !pairCode || !/^\d{6}$/.test(pairCode)) {
    let html = loadView("pairError.html");
    html = html.replace("__ERROR_MESSAGE__", "The code is invalid. Please check the TV screen and try again.");
    html = html.replace("__RETRY_URL__", `/pair?room=${encodeURIComponent(roomId || "")}`);
    return res.status(400).send(html);
  }

  const code = db.prepare(`
    SELECT * FROM pair_codes
    WHERE room_id = ? AND pair_code = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(roomId, pairCode);

  if (!code) {
    let html = loadView("pairError.html");
    html = html.replace("__ERROR_MESSAGE__", "This code is incorrect or has expired.");
    html = html.replace("__RETRY_URL__", `/pair?room=${encodeURIComponent(roomId)}`);
    return res.status(400).send(html);
  }

  const existingSession = db.prepare(`
    SELECT * FROM sessions
    WHERE device_id = ? AND status = 'active'
    LIMIT 1
  `).get(code.device_id);

  if (existingSession) {
    let html = loadView("pairError.html");
    html = html.replace("__ERROR_MESSAGE__", "This TV already has an active connection.");
    html = html.replace("__RETRY_URL__", `/pair?room=${encodeURIComponent(roomId)}`);
    return res.status(409).send(html);
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

  let html = loadView("pairSuccess.html");
  html = html.replace("__CAST_TARGET__", tv.display_name);

  res.send(html);
});

export default router;