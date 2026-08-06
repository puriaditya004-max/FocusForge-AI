const crypto = require("crypto");
const logger = require("./logger");

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function verifyOtpHash(code, codeHash) {
  return hashOtp(code) === codeHash;
}

// ---------------------------------------------------------
// SMS providers — real delivery for the MOBILE channel.
// Selected via OTP_SMS_PROVIDER env var: "msg91" | "twilio" | "webhook".
// If unset, falls back to SMS_OTP_WEBHOOK_URL (legacy), then dev log.
// We generate/hash/store the OTP ourselves (see requestOtp/verifyOtp
// in auth.controller.js) — these providers are only asked to deliver
// the code as an SMS, not to manage OTP state themselves.
// ---------------------------------------------------------

// MSG91 "Send OTP" API — built for exactly this: you pass the OTP you
// already generated and it sends the DLT-approved template SMS.
// Docs: https://docs.msg91.com/otp/authentication/send-otp
async function sendViaMsg91(target, code) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authKey || !templateId) {
    const err = new Error("MSG91_AUTH_KEY / MSG91_OTP_TEMPLATE_ID not configured.");
    err.status = 503;
    throw err;
  }

  const mobile = target.replace(/^\+/, ""); // MSG91 expects country code without "+"
  const params = new URLSearchParams({
    otp: code,
    mobile,
    template_id: templateId,
    authkey: authKey,
  });

  const response = await fetch(`https://control.msg91.com/api/v5/otp?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.type === "error") {
    throw new Error(data?.message || "MSG91 failed to send OTP SMS.");
  }
}

// Twilio Messages API — plain SMS send (not Twilio Verify, since we
// already own OTP generation/verification on our side).
// Docs: https://www.twilio.com/docs/sms/send-messages
async function sendViaTwilio(target, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    const err = new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER not configured.");
    err.status = 503;
    throw err;
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({
    To: target,
    From: fromNumber,
    Body: `Your FocusForge AI verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || "Twilio failed to send OTP SMS.");
  }
}

async function deliverSms(target, code) {
  const provider = (process.env.OTP_SMS_PROVIDER || "").toLowerCase();

  if (provider === "msg91") return sendViaMsg91(target, code);
  if (provider === "twilio") return sendViaTwilio(target, code);

  if (provider === "webhook" || (!provider && process.env.SMS_OTP_WEBHOOK_URL)) {
    if (!process.env.SMS_OTP_WEBHOOK_URL) {
      const err = new Error("SMS_OTP_WEBHOOK_URL not configured.");
      err.status = 503;
      throw err;
    }
    await fetch(process.env.SMS_OTP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: target, code, product: "FocusForge AI" }),
    });
    return;
  }

  // No provider configured — dev mode, log only.
  logger.info(`DEV OTP MOBILE ${target}: ${code}`);
}

async function deliverOtp({ channel, target, code }) {
  if (channel === "MOBILE") {
    return deliverSms(target, code);
  }

  // EMAIL channel — unchanged: webhook if configured, else dev log.
  if (channel === "EMAIL" && process.env.EMAIL_OTP_WEBHOOK_URL) {
    await fetch(process.env.EMAIL_OTP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: target, code, product: "FocusForge AI" }),
    });
    return;
  }

  logger.info(`DEV OTP ${channel} ${target}: ${code}`);
}

module.exports = { generateOtp, hashOtp, verifyOtpHash, deliverOtp };