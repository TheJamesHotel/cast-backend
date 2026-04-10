const tvStore = new Map();       // deviceId -> tv object
const pairingStore = new Map();  // pairingCode -> deviceId

export function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function randomPairingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateUniquePairingCode() {
  let code = randomPairingCode();
  while (pairingStore.has(code)) {
    code = randomPairingCode();
  }
  return code;
}

export function buildTvName(roomId) {
  return `James TV ${roomId}`;
}

export function getDisplayUrl(baseUrl, deviceId) {
  return `${baseUrl}/display?deviceId=${encodeURIComponent(deviceId)}`;
}

export function getPairingUrl(baseUrl, deviceId) {
  return `${baseUrl}/pair/${encodeURIComponent(deviceId)}`;
}

export function getTv(deviceId) {
  return tvStore.get(deviceId);
}

export function getDeviceIdByPairingCode(pairingCode) {
  return pairingStore.get(String(pairingCode).trim().toUpperCase());
}

export function ensureTv({ baseUrl, deviceId, roomId, displayName }) {
  let tv = tvStore.get(deviceId);

  if (!tv) {
    const pairingCode = generateUniquePairingCode();

    tv = {
      deviceId,
      roomId,
      displayName,
      tvName: buildTvName(roomId),
      pairingCode,
      pairingUrl: getPairingUrl(baseUrl, deviceId),
      activeSession: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    tvStore.set(deviceId, tv);
    pairingStore.set(pairingCode, deviceId);
    return tv;
  }

  if (!tv.pairingCode || !pairingStore.has(tv.pairingCode)) {
    const newCode = generateUniquePairingCode();
    tv.pairingCode = newCode;
    pairingStore.set(newCode, deviceId);
  }

  tv.roomId = roomId;
  tv.displayName = displayName;
  tv.tvName = buildTvName(roomId);
  tv.pairingUrl = getPairingUrl(baseUrl, deviceId);
  tv.updatedAt = Date.now();

  return tv;
}

export function buildRegisterResponse(baseUrl, tv) {
  return {
    status: tv.activeSession ? "active" : "waiting",
    tvName: tv.tvName,
    pairingCode: tv.pairingCode,
    pairingUrl: tv.pairingUrl,
    displayUrl: getDisplayUrl(baseUrl, tv.deviceId)
  };
}

export function activateTvSession(tv, guestName = "Gast") {
  tv.activeSession = {
    guestName,
    pairedAt: Date.now(),
    status: "connected"
  };
  tv.updatedAt = Date.now();
  return tv;
}

export function disconnectTv(tv) {
  tv.activeSession = null;
  tv.updatedAt = Date.now();
  return tv;
}