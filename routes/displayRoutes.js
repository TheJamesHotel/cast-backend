import express from "express";
import { getTv } from "../lib/castStore.js";

const router = express.Router();

/**
 * GET /display?deviceId=...
 */
router.get("/display", (req, res) => {
  const { deviceId } = req.query;
  const tv = getTv(deviceId);

  if (!tv) {
    return res.status(404).send(`
      <html>
        <body style="margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
          <div style="text-align:center;">
            <h1>Unknown TV</h1>
          </div>
        </body>
      </html>
    `);
  }

  if (!tv.activeSession) {
    const qrUrl = tv.pairingUrl;

    return res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${tv.tvName}</title>
          <style>
            body {
              margin: 0;
              background: linear-gradient(180deg, #111, #000);
              color: white;
              font-family: Arial, sans-serif;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .wrap {
              width: 100%;
              max-width: 1100px;
              display: flex;
              gap: 50px;
              align-items: center;
              justify-content: center;
              padding: 40px;
              box-sizing: border-box;
            }
            .qrbox {
              background: white;
              border-radius: 24px;
              padding: 20px;
              width: 360px;
              height: 360px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
            }
            .info {
              max-width: 420px;
            }
            .eyebrow {
              color: #bbb;
              font-size: 20px;
              margin-bottom: 12px;
            }
            h1 {
              font-size: 46px;
              margin: 0 0 14px 0;
            }
            .code-label {
              color: #aaa;
              font-size: 20px;
              margin-top: 28px;
            }
            .code {
              display: inline-block;
              margin-top: 12px;
              padding: 16px 26px;
              background: #1b1b1b;
              border-radius: 18px;
              color: #e7c45a;
              font-size: 56px;
              font-weight: bold;
              letter-spacing: 10px;
            }
            .muted {
              margin-top: 24px;
              color: #aaa;
              font-size: 20px;
              line-height: 1.5;
            }
            img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="qrbox">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrUrl)}"
                alt="QR"
              />
            </div>

            <div class="info">
              <div class="eyebrow">The James Hotel</div>
              <h1>Koppel met ${tv.tvName}</h1>
              <div class="eyebrow">Kamer ${tv.roomId}</div>

              <div class="code-label">Code</div>
              <div class="code">${tv.pairingCode}</div>

              <div class="muted">
                Scan de QR-code of gebruik de code om je apparaat met deze TV te koppelen.
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  }

  return res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${tv.tvName}</title>
        <style>
          body {
            margin: 0;
            background: #000;
            color: white;
            font-family: Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .card {
            text-align: center;
            background: #111;
            padding: 40px;
            border-radius: 24px;
            min-width: 520px;
          }
          h1 { margin-top: 0; }
          .gold { color: #e7c45a; }
          .muted { color: #aaa; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1 class="gold">Verbonden</h1>
          <p>${tv.tvName}</p>
          <p class="muted">Kamer ${tv.roomId}</p>
          <p>Gast: ${tv.activeSession.guestName || "Gast"}</p>
          <p class="muted">TV is succesvol gekoppeld.</p>
        </div>
      </body>
    </html>
  `);
});

export default router;