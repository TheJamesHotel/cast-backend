import crypto from "crypto";
import db from "../db/database.js";

const PAIR_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIR_CODE_LENGTH = 4;
const PAIR_CODE_VALIDITY_DAYS = 365;
const SESSION_VALIDITY_DAYS = 365;

function nowIso() {
  return new Date().toISOString();
}

function futureIso(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeRoomId(roomId) {
  const value = String(roomId ?? "").trim();
  if (!value) return "";
  if (/^\d{1,4}$/.test(value)) return value.padStart(4, "0");
  return value;
}

function buildCommandRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    action: row.action,
    deviceId: row.device_id,
    roomId: row.room_id,
    source: row.source,
    note: row.note,
    createdAt: Date.parse(row.created_at),
    availableAt: Date.parse(row.available_at),
    deliveredAt: row.delivered_at ? Date.parse(row.delivered_at) : null,
    acknowledgedAt: row.acknowledged_at ? Date.parse(row.acknowledged_at) : null,
  };
}

function getActiveSession(deviceId) {
  const row = db.prepare(`
    SELECT guest_label, created_at
    FROM sessions
    WHERE device_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(deviceId);

  if (!row) return null;

  return {
    guestName: row.guest_label || "Gast",
    pairedAt: Date.parse(row.created_at),
    status: "connected",
  };
}

function getActivePairCode(deviceId) {
  const now = nowIso();
  return db.prepare(`
    SELECT pair_code, expires_at
    FROM pair_codes
    WHERE device_id = ? AND status = 'active' AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(deviceId, now);
}

function randomPairingCode() {
  let out = "";
  for (let i = 0; i < PAIR_CODE_LENGTH; i += 1) {
    out += PAIR_CODE_ALPHABET[Math.floor(Math.random() * PAIR_CODE_ALPHABET.length)];
  }
  return out;
}

export function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
}

export function generateUniquePairingCode() {
  let code = randomPairingCode();

  while (
    db.prepare(`
      SELECT 1
      FROM pair_codes
      WHERE pair_code = ? AND status = 'active' AND expires_at > ?
      LIMIT 1
    `).get(code, nowIso())
  ) {
    code = randomPairingCode();
  }

  return code;
}

export function buildTvName(roomId) {
  return `James TV ${normalizeRoomId(roomId)}`;
}

export function getDisplayUrl(baseUrl, pairingCode) {
  return `${baseUrl}/display?code=${encodeURIComponent(pairingCode)}`;
}

export function getPairingUrl(baseUrl, pairingCode) {
  return `${baseUrl}/pair?code=${encodeURIComponent(pairingCode)}`;
}

export function getTv(deviceId) {
  const tv = db.prepare(`
    SELECT device_id, room_id, display_name, created_at, updated_at
    FROM tvs
    WHERE device_id = ?
    LIMIT 1
  `).get(deviceId);

  if (!tv) return null;

  let pairCode = getActivePairCode(deviceId);
  if (!pairCode) {
    const code = generateUniquePairingCode();
    const now = nowIso();
    db.prepare(`
      INSERT INTO pair_codes (device_id, room_id, pair_code, status, expires_at, created_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run(deviceId, tv.room_id, code, futureIso(PAIR_CODE_VALIDITY_DAYS), now);
    pairCode = { pair_code: code };
  }

  return {
    deviceId: tv.device_id,
    roomId: tv.room_id,
    displayName: tv.display_name,
    tvName: buildTvName(tv.room_id),
    pairingCode: pairCode.pair_code,
    pairingUrl: getPairingUrl(process.env.BASE_URL || "", pairCode.pair_code),
    activeSession: getActiveSession(deviceId),
    createdAt: tv.created_at,
    updatedAt: tv.updated_at,
  };
}

export function getDeviceIdByPairingCode(pairingCode) {
  if (!pairingCode) return null;
  const row = db.prepare(`
    SELECT device_id
    FROM pair_codes
    WHERE pair_code = ? AND status = 'active' AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(String(pairingCode).trim().toUpperCase(), nowIso());
  return row?.device_id || null;
}

export function getTvByPairingCode(pairingCode) {
  const deviceId = getDeviceIdByPairingCode(pairingCode);
  if (!deviceId) return null;
  return getTv(deviceId);
}

export function ensureTv({ baseUrl, deviceId, roomId, displayName }) {
  const normalizedRoomId = normalizeRoomId(roomId);
  const now = nowIso();

  db.prepare(`
    INSERT INTO tvs (device_id, room_id, display_name, status, last_seen_at, created_at, updated_at)
    VALUES (?, ?, ?, 'idle', ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      room_id = excluded.room_id,
      display_name = excluded.display_name,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `).run(deviceId, normalizedRoomId, displayName, now, now, now);

  const pairCode = getActivePairCode(deviceId);
  if (!pairCode) {
    const code = generateUniquePairingCode();
    db.prepare(`
      INSERT INTO pair_codes (device_id, room_id, pair_code, status, expires_at, created_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run(deviceId, normalizedRoomId, code, futureIso(PAIR_CODE_VALIDITY_DAYS), now);
  } else if (pairCode.expires_at !== futureIso(PAIR_CODE_VALIDITY_DAYS)) {
    db.prepare(`
      UPDATE pair_codes
      SET room_id = ?, expires_at = ?
      WHERE device_id = ? AND pair_code = ? AND status = 'active'
    `).run(normalizedRoomId, futureIso(PAIR_CODE_VALIDITY_DAYS), deviceId, pairCode.pair_code);
  }

  const tv = getTv(deviceId);
  if (!tv) return null;

  return {
    ...tv,
    pairingUrl: getPairingUrl(baseUrl, tv.pairingCode),
  };
}

export function buildRegisterResponse(baseUrl, tv) {
  return {
    status: tv.activeSession ? "active" : "waiting",
    tvName: tv.tvName,
    pairingCode: tv.pairingCode,
    pairingUrl: getPairingUrl(baseUrl, tv.pairingCode),
    displayUrl: getDisplayUrl(baseUrl, tv.pairingCode),
  };
}

export function activateTvSession(tv, guestName = "Gast") {
  const now = nowIso();

  db.prepare(`
    UPDATE sessions
    SET status = 'disconnected', disconnected_at = ?, updated_at = ?
    WHERE device_id = ? AND status = 'active'
  `).run(now, now, tv.deviceId);

  db.prepare(`
    INSERT INTO sessions (
      session_token,
      device_id,
      room_id,
      guest_label,
      status,
      valid_until,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    tv.deviceId,
    tv.roomId,
    guestName,
    futureIso(SESSION_VALIDITY_DAYS),
    now,
    now
  );

  db.prepare(`
    UPDATE tvs
    SET status = 'active', updated_at = ?
    WHERE device_id = ?
  `).run(now, tv.deviceId);

  return getTv(tv.deviceId);
}

export function disconnectTv(tv) {
  const now = nowIso();

  db.prepare(`
    UPDATE sessions
    SET status = 'disconnected', disconnected_at = ?, updated_at = ?
    WHERE device_id = ? AND status = 'active'
  `).run(now, now, tv.deviceId);

  db.prepare(`
    UPDATE tvs
    SET status = 'idle', updated_at = ?
    WHERE device_id = ?
  `).run(now, tv.deviceId);

  return getTv(tv.deviceId);
}

export function queueDeviceCommand({
  action,
  deviceId = null,
  roomId = null,
  source = "dashboard",
  note = null,
  availableAt = null,
  delayMs = null,
}) {
  const id = crypto.randomUUID();
  const createdAt = new Date();
  const normalizedRoomId = roomId ? normalizeRoomId(roomId) : null;
  const normalizedAvailableAt =
    typeof availableAt === "number" && Number.isFinite(availableAt)
      ? new Date(availableAt)
      : new Date(
          createdAt.getTime() +
            (typeof delayMs === "number" && Number.isFinite(delayMs) && delayMs > 0
              ? Math.round(delayMs)
              : 0)
        );

  db.prepare(`
    INSERT INTO tv_commands (
      id, action, device_id, room_id, source, note, created_at, available_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    action,
    deviceId,
    normalizedRoomId,
    source,
    note,
    createdAt.toISOString(),
    normalizedAvailableAt.toISOString()
  );

  return buildCommandRecord(
    db.prepare(`SELECT * FROM tv_commands WHERE id = ?`).get(id)
  );
}

export function getNextPendingCommand({ deviceId = null, roomId = null }) {
  const normalizedRoomId = roomId ? normalizeRoomId(roomId) : null;
  const now = nowIso();

  const row = db.prepare(`
    SELECT *
    FROM tv_commands
    WHERE acknowledged_at IS NULL
      AND delivered_at IS NULL
      AND available_at <= ?
      AND (
        (? IS NOT NULL AND device_id = ?)
        OR
        (? IS NOT NULL AND room_id = ?)
      )
    ORDER BY created_at ASC
    LIMIT 1
  `).get(now, deviceId, deviceId, normalizedRoomId, normalizedRoomId);

  if (!row) return null;

  db.prepare(`
    UPDATE tv_commands
    SET delivered_at = ?
    WHERE id = ?
  `).run(now, row.id);

  return buildCommandRecord(
    db.prepare(`SELECT * FROM tv_commands WHERE id = ?`).get(row.id)
  );
}

export function acknowledgeCommand(commandId) {
  const now = nowIso();
  const result = db.prepare(`
    UPDATE tv_commands
    SET acknowledged_at = ?
    WHERE id = ?
  `).run(now, commandId);

  if (!result.changes) return null;

  return buildCommandRecord(
    db.prepare(`SELECT * FROM tv_commands WHERE id = ?`).get(commandId)
  );
}

export function listTvs() {
  const rows = db.prepare(`
    SELECT device_id
    FROM tvs
    ORDER BY updated_at DESC
  `).all();

  return rows
    .map((row) => getTv(row.device_id))
    .filter(Boolean);
}

export function listCommands() {
  return db.prepare(`
    SELECT *
    FROM tv_commands
    ORDER BY created_at DESC
  `).all().map(buildCommandRecord);
}
