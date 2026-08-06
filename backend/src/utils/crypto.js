// ---------------------------------------------------------
// crypto.js — AES-256-GCM encrypt/decrypt for secrets we
// store at rest (currently just User.mentorApiKey, the
// student's own Claude API key for AI Mentor BYOK).
//
// Requires ENCRYPTION_KEY in .env — a 32-byte key, base64
// encoded. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Stored format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
// ---------------------------------------------------------
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM

function getKey() {
  const keyB64 = process.env.ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error(
      "ENCRYPTION_KEY missing in .env — generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).");
  }
  return key;
}

// Encrypts a plaintext string. Returns null if input is falsy
// (so clearing a key stays clean — no ciphertext of an empty string).
function encrypt(plainText) {
  if (!plainText) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// Decrypts a value produced by encrypt(). Returns null on any
// failure (corrupt data, wrong key, or a legacy plaintext value
// from before this migration) instead of throwing — callers
// treat null the same as "no key saved" and fall back safely.
function decrypt(stored) {
  if (!stored) return null;
  try {
    const [ivHex, authTagHex, dataHex] = stored.split(":");
    if (!ivHex || !authTagHex || !dataHex) return null; // not our format (e.g. legacy plaintext)
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    return null;
  }
}

// For display purposes only — never send the full key back to the client.
function mask(plainText) {
  if (!plainText) return null;
  const last4 = plainText.slice(-4);
  return `${plainText.slice(0, 7)}...${last4}`;
}

module.exports = { encrypt, decrypt, mask };
