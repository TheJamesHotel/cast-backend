const tvStore = new Map();       // deviceId -> tv object
const pairingStore = new Map();  // pairingCode -> deviceId
const commandStore = new Map();  // commandId -> command object

function normalizeRoomId(roomId) {
  const value = String(roomId ?? "").trim();
  if (!value) return "";

  if (/^\d{1,4}$/.test(value)) {
    return value.padStart(4, "0");
  }

  return value;
}

export function listTvs() {
  return Array.from(tvStore.values()).map((tv) => ({ ...tv }));
}

export function listCommands() {
  return Array.from(commandStore.values()).map((command) => ({ ...command }));
}

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
  const normalizedRoomId = normalizeRoomId(roomId);
  let tv = tvStore.get(deviceId);

  if (!tv) {
    const pairingCode = generateUniquePairingCode();

    tv = {
      deviceId,
      roomId: normalizedRoomId,
      displayName,
      tvName: buildTvName(normalizedRoomId),
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

  tv.roomId = normalizedRoomId;
  tv.displayName = displayName;
  tv.tvName = buildTvName(normalizedRoomId);
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

export function queueDeviceCommand({
  action,
  deviceId = null,
  roomId = null,
  source = "dashboard",
  note = null,
  availableAt = null,
  delayMs = null
}) {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const normalizedRoomId = roomId ? normalizeRoomId(roomId) : null;
  const normalizedDelayMs =
    typeof delayMs === "number" && Number.isFinite(delayMs) && delayMs > 0
      ? Math.round(delayMs)
      : 0;
  const normalizedAvailableAt =
    typeof availableAt === "number" && Number.isFinite(availableAt)
      ? Math.round(availableAt)
      : createdAt + normalizedDelayMs;
  const command = {
    id,
    action,
    deviceId,
    roomId: normalizedRoomId,
    source,
    note,
    createdAt,
    availableAt: normalizedAvailableAt,
    deliveredAt: null,
    acknowledgedAt: null,
  };

  commandStore.set(id, command);
  return command;
}

export function getNextPendingCommand({ deviceId = null, roomId = null }) {
  const now = Date.now();
  const normalizedRoomId = roomId ? normalizeRoomId(roomId) : null;

  for (const command of commandStore.values()) {
    if (command.acknowledgedAt || command.deliveredAt) continue;
    if (command.availableAt && command.availableAt > now) continue;

    const matchesDevice = deviceId && command.deviceId === deviceId;
    const matchesRoom = normalizedRoomId && command.roomId === normalizedRoomId;

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
