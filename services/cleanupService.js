import db from "../db/database.js";

export function cleanupExpiredRecords() {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE pair_codes
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < ?
  `).run(now);

  db.prepare(`
    UPDATE sessions
    SET status = 'expired'
    WHERE status = 'active' AND valid_until < ?
  `).run(now);
}