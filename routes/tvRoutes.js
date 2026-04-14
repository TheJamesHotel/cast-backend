import express from "express";
import {
  buildRegisterResponse,
  disconnectTv,
  ensureTv,
  getBaseUrl,
  getDisplayUrl,
  getTv
} from "../lib/castStore.js";

const router = express.Router();

/**
 * POST /api/tv/register
 */
router.post("/register", (req, res) => {
  try {
    const { deviceId, roomId, displayName } = req.body || {};

    if (!deviceId || !roomId) {
      return res.status(400).json({
        error: "deviceId and roomId are required"
      });
    }

    const baseUrl = getBaseUrl(req);

    const tv = ensureTv({
      baseUrl,
      deviceId,
      roomId,
      displayName: displayName || "Google TV"
    });

    return res.json(buildRegisterResponse(baseUrl, tv));
  } catch (error) {
    console.error("TV register error:", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /api/tv/:deviceId
 */
router.get("/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const tv = getTv(deviceId);

  if (!tv) {
    return res.status(404).json({ error: "tv_not_found" });
  }

  const baseUrl = getBaseUrl(req);

  return res.json({
    deviceId: tv.deviceId,
    roomId: tv.roomId,
    displayName: tv.displayName,
    tvName: tv.tvName,
    pairingCode: tv.pairingCode,
    pairingUrl: tv.pairingUrl,
    displayUrl: getDisplayUrl(baseUrl, tv.pairingCode),
    status: tv.activeSession ? "active" : "waiting",
    activeSession: tv.activeSession,
    updatedAt: tv.updatedAt
  });
});

/**
 * POST /api/tv/:deviceId/disconnect
 */
router.post("/:deviceId/disconnect", (req, res) => {
  const { deviceId } = req.params;
  const tv = getTv(deviceId);

  if (!tv) {
    return res.status(404).json({ error: "tv_not_found" });
  }

  const baseUrl = getBaseUrl(req);
  disconnectTv(tv);

  return res.json({
    ok: true,
    ...buildRegisterResponse(baseUrl, tv)
  });
});

export default router;