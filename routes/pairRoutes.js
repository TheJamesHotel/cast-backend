import express from "express";
import {
  activateTvSession,
  getBaseUrl,
  getDeviceIdByPairingCode,
  getDisplayUrl,
  getTv
} from "../lib/castStore.js";

const router = express.Router();

/**
 * POST /api/pair/by-code
 * Body: { pairingCode, guestName }
 */
router.post("/by-code", (req, res) => {
  try {
    const { pairingCode, guestName } = req.body || {};

    if (!pairingCode) {
      return res.status(400).json({ error: "pairingCode is required" });
    }

    const deviceId = getDeviceIdByPairingCode(pairingCode);

    if (!deviceId) {
      return res.status(404).json({ error: "invalid_pairing_code" });
    }

    const tv = getTv(deviceId);

    if (!tv) {
      return res.status(404).json({ error: "tv_not_found" });
    }

    activateTvSession(tv, guestName?.trim?.() || "Gast");

    const baseUrl = getBaseUrl(req);

    return res.json({
      ok: true,
      status: "active",
      deviceId: tv.deviceId,
      tvName: tv.tvName,
      roomId: tv.roomId,
      displayUrl: getDisplayUrl(baseUrl, tv.deviceId)
    });
  } catch (error) {
    console.error("Pair by code error:", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;