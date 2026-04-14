import express from "express";
import {
  activateTvSession,
  getDeviceIdByPairingCode,
  getTv
} from "../lib/castStore.js";

const router = express.Router();

/**
 * GET /pair?code=...
 */
router.get("/pair", (req, res) => {
  const { code } = req.query;
  const deviceId = getDeviceIdByPairingCode(code);

  if (!deviceId) {
    return res.status(404).send(`
      <html>
        <body style="font-family:Arial;padding:40px;background:#111;color:#fff;">
          <h1>Ongeldige code</h1>
          <p>Deze koppelcode bestaat niet of is verlopen.</p>
        </body>
      </html>
    `);
  }

  return res.redirect(`/pair/${encodeURIComponent(deviceId)}`);
});

/**
 * GET /pair/:deviceId
 */
router.get("/pair/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const tv = getTv(deviceId);

  if (!tv) {
    return res.status(404).send(`
      <html>
        <body style="font-family:Arial;padding:40px;background:#111;color:#fff;">
          <h1>TV niet gevonden</h1>
        </body>
      </html>
    `);
  }

  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pair with TV</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #111;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            width: 100%;
            max-width: 520px;
            background: #1a1a1a;
            border-radius: 20px;
            padding: 32px;
            box-sizing: border-box;
            text-align: center;
          }
          h1 { margin-top: 0; }
          .muted { color: #b0b0b0; }
          .code {
            font-size: 42px;
            letter-spacing: 8px;
            color: #e7c45a;
            font-weight: bold;
            margin: 20px 0;
          }
          button {
            background: #e7c45a;
            color: black;
            border: 0;
            border-radius: 12px;
            padding: 14px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
          }
          input {
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            border: 1px solid #333;
            background: #101010;
            color: white;
            margin-top: 14px;
            margin-bottom: 16px;
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Koppel met ${tv.tvName}</h1>
          <p class="muted">Kamer ${tv.roomId}</p>
          <div class="code">${tv.pairingCode}</div>
          <p class="muted">Bevestig hieronder om deze TV te koppelen.</p>

          <form method="POST" action="/pair/${encodeURIComponent(deviceId)}/confirm">
            <input
              type="text"
              name="guestName"
              placeholder="Naam gast (optioneel)"
            />
            <button type="submit">Koppelen</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

/**
 * POST /pair/:deviceId/confirm
 */
router.post("/pair/:deviceId/confirm", (req, res) => {
  const { deviceId } = req.params;
  const tv = getTv(deviceId);

  if (!tv) {
    return res.status(404).send("TV niet gevonden");
  }

  const guestName =
    typeof req.body?.guestName === "string" ? req.body.guestName.trim() : "";

  activateTvSession(tv, guestName || "Gast");

  return res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #111;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            width: 100%;
            max-width: 520px;
            background: #1a1a1a;
            border-radius: 20px;
            padding: 32px;
            box-sizing: border-box;
            text-align: center;
          }
          a {
            color: #e7c45a;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>TV gekoppeld</h1>
          <p>${tv.tvName} is nu verbonden.</p>
          <p><a href="/display?code=${encodeURIComponent(tv.pairingCode)}">Open TV display</a></p>
        </div>
      </body>
    </html>
  `);
});

export default router;
