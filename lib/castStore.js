const tvStore = new Map();       // deviceId -> tv object
const pairingStore = new Map();  // pairingCode -> deviceId
const commandStore = new Map();  // commandId -> command object

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

export function getDisplayUrl(baseUrl, pairingCode) {
  return `${baseUrl}/display?code=${encodeURIComponent(pairingCode)}`;
}

export function getPairingUrl(baseUrl, pairingCode) {
  return `${baseUrl}/pair?code=${encodeURIComponent(pairingCode)}`;
}

export function getTv(deviceId) {
  return tvStore.get(deviceId) || null;
}

export function getDeviceIdByPairingCode(pairingCode) {
  if (!pairingCode) return null;
  return pairingStore.get(String(pairingCode).trim().toUpperCase()) || null;
}

export function getTvByPairingCode(pairingCode) {
  const deviceId = getDeviceIdByPairingCode(pairingCode);
  if (!deviceId) return null;
  return getTv(deviceId);
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
      pairingUrl: getPairingUrl(baseUrl, pairingCode),
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
  tv.pairingUrl = getPairingUrl(baseUrl, tv.pairingCode);
  tv.updatedAt = Date.now();

  return tv;
}

export function buildRegisterResponse(baseUrl, tv) {
  return {
    status: tv.activeSession ? "active" : "waiting",
    tvName: tv.tvName,
    pairingCode: tv.pairingCode,
    pairingUrl: tv.pairingUrl,
    displayUrl: getDisplayUrl(baseUrl, tv.pairingCode)
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

export function queueDeviceCommand({ action, deviceId = null, roomId = null, source = "dashboard", note = null }) {
  const id = crypto.randomUUID();
  const command = {
    id,
    action,
    deviceId,
    roomId,
    source,
    note,
    createdAt: Date.now(),
    deliveredAt: null,
    acknowledgedAt: null,
  };

  commandStore.set(id, command);
  return command;
}

export function getNextPendingCommand({ deviceId = null, roomId = null }) {
  for (const command of commandStore.values()) {
    if (command.acknowledgedAt || command.deliveredAt) continue;

    const matchesDevice = deviceId && command.deviceId === deviceId;
    const matchesRoom = roomId && command.roomId === roomId;

    if (!matchesDevice && !matchesRoom) continue;

    command.deliveredAt = Date.now();
    return command;
  }

  return null;
}

export function acknowledgeCommand(commandId) {
  const command = commandStore.get(commandId);
  if (!command) return null;

  command.acknowledgedAt = Date.now();
  return command;
}
