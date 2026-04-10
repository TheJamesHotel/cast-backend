import crypto from "crypto";

export function generatePairCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateSessionToken() {
  return "sess_" + crypto.randomBytes(12).toString("hex");
}