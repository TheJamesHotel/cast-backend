import express from "express";
import QRCode from "qrcode";
import db from "../db/database.js";
import { cleanupExpiredRecords } from "../services/cleanupService.js";

const router = express.Router();

router.get("/display", async (req, res) => {
  cleanupExpiredRecords();

  const { deviceId } = req.query;

  if (!deviceId) {
    return res.status(400).send("Missing deviceId");
  }

  const tv = db.prepare(`
    SELECT * FROM tvs WHERE device_id = ?
  `).get(deviceId);

  if (!tv) {
    return res.status(404).send("TV not found");
  }

  const activeSession = db.prepare(`
    SELECT * FROM sessions
    WHERE device_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(deviceId);

  let activeCode = null;

  if (!activeSession) {
    activeCode = db.prepare(`
      SELECT * FROM pair_codes
      WHERE device_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(deviceId);
  }

  let qrImage = "";
  const pairUrl = `${process.env.PAIR_BASE_URL}/pair?room=${tv.room_id}`;

  if (activeCode) {
    qrImage = await QRCode.toDataURL(pairUrl);
  }

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${tv.display_name}</title>
    <meta http-equiv="refresh" content="10">
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #0f0f0f;
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }
      .card {
        width: 90%;
        max-width: 900px;
        background: #1b1b1b;
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        text-align: center;
      }
      .room {
        color: #b1926c;
        font-size: 22px;
        margin-bottom: 12px;
      }
      h1 {
        font-size: 42px;
        margin: 0 0 16px;
      }
      .subtitle {
        color: #d0d0d0;
        font-size: 20px;
        margin-bottom: 30px;
      }
      .code {
        font-size: 72px;
        font-weight: bold;
        letter-spacing: 8px;
        margin: 24px 0;
        color: #b1926c;
      }
      .qr {
        margin-top: 24px;
      }
      .qr img {
        width: 220px;
        height: 220px;
        background: white;
        padding: 12px;
        border-radius: 16px;
      }
      .url {
        margin-top: 16px;
        font-size: 16px;
        color: #aaa;
        word-break: break-word;
      }
      .status {
        margin-top: 24px;
        font-size: 24px;
        font-weight: bold;
      }
      .connected {
        color: #75d67d;
      }
      .waiting {
        color: #b1926c;
      }
      .details {
        margin-top: 14px;
        color: #ddd;
        font-size: 18px;
      }
      .small {
        margin-top: 12px;
        font-size: 14px;
        color: #999;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="room">Room ${tv.room_id}</div>
      <h1>${tv.display_name}</h1>

      ${
        activeSession
          ? `
            <div class="status connected">Phone connected</div>
            <div class="details">${activeSession.guest_label || "Guest device"}</div>
            <div class="details">Valid until: ${activeSession.valid_until}</div>
            <div class="small">This page refreshes automatically every 10 seconds.</div>
          `
          : activeCode
          ? `
            <div class="subtitle">Scan the QR code or visit the link and enter the code shown below.</div>
            <div class="code">${activeCode.pair_code}</div>
            <div class="qr">
              <img src="${qrImage}" alt="QR Code" />
            </div>
            <div class="url">${pairUrl}</div>
            <div class="status waiting">Waiting for connection</div>
            <div class="details">Code valid until: ${activeCode.expires_at}</div>
            <div class="small">This page refreshes automatically every 10 seconds.</div>
          `
          : `
            <div class="subtitle">No active pairing code found for this TV.</div>
            <div class="status waiting">Idle</div>
            <div class="small">Create a new pairing code first.</div>
          `
      }
    </div>
  </body>
  </html>
  `;

  res.send(html);
});

export default router;