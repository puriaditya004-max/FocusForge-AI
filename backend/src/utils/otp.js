const crypto = require("crypto");
const dns = require("dns").promises;
const logger = require("./logger");
let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null; // package not installed yet — dev-log fallback still works
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function verifyOtpHash(code, codeHash) {
  return hashOtp(code) === codeHash;
}

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.RENDER === "true";
}

function deliveryNotConfigured(message) {
  const err = new Error(message);
  err.status = 503;
  return err;
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
  if (!response.ok || data?.type === "error" || (data?.type && data.type !== "success")) {
    throw new Error(data?.message || "MSG91 failed to send OTP SMS.");
  }
  logger.info("MSG91 OTP SMS accepted", {
    target: mobile.replace(/^(\d{2})\d+(\d{2})$/, "$1******$2"),
    providerMessage: data?.message,
    providerType: data?.type,
  });
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
  if (isProduction()) {
    throw deliveryNotConfigured("SMS OTP delivery is not configured on this server.");
  }
  logger.info(`DEV OTP MOBILE ${target}: ${code}`);
}

async function deliverOtp({ channel, target, code }) {
  if (channel === "MOBILE") {
    return deliverSms(target, code);
  }

  // EMAIL channel
  return deliverEmail(target, code);
}

// ---------------------------------------------------------
// Real email delivery via SMTP (Nodemailer). Works with Gmail,
// Brevo, Zoho, or any SMTP provider — just set env vars:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
// Falls back to a webhook (if EMAIL_OTP_WEBHOOK_URL is set),
// then to a dev-only console log if nothing is configured.
// ---------------------------------------------------------
let cachedTransporter = null;
async function resolveSmtpHost(host) {
  try {
    const [ipv4] = await dns.resolve4(host);
    if (ipv4) return ipv4;
  } catch (err) {
    logger.warn("SMTP IPv4 DNS lookup failed; falling back to hostname", {
      host,
      error: err.message,
    });
  }
  return host;
}

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!nodemailer || !process.env.SMTP_HOST) return null;

  const smtpHost = process.env.SMTP_HOST;
  const resolvedHost = await resolveSmtpHost(smtpHost);

  cachedTransporter = nodemailer.createTransport({
    host: resolvedHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for 587/others
    family: 4, // Render can fail Gmail's IPv6 route; force IPv4 for SMTP.
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      servername: smtpHost,
    },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

async function deliverEmail(target, code) {
  const transporter = await getTransporter();

  if (transporter) {
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
      from: `FocusForge AI <${fromAddress}>`,
      to: target,
      subject: `${code} is your FocusForge AI verification code`,
      text: `Your FocusForge AI verification code is ${code}. It expires in 10 minutes. Do not share this code with anyone.`,
      html: `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background: #0e0e18; border-radius: 16px; color: #e5e7eb;">
          <p style="font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: #a78bfa; margin: 0 0 4px;">FocusForge AI</p>
          <h1 style="font-size: 20px; margin: 0 0 16px; color: #fff;">Verify your email</h1>
          <p style="font-size: 14px; color: #9ca3af; margin: 0 0 24px;">Enter this code in the app to verify your email address:</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #fff; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.3); border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
            ${code}
          </div>
          <p style="font-size: 12px; color: #6b7280; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    return;
  }

  if (process.env.EMAIL_OTP_WEBHOOK_URL) {
    await fetch(process.env.EMAIL_OTP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: target, code, product: "FocusForge AI" }),
    });
    return;
  }

  // No provider configured — dev mode, log only.
  if (isProduction()) {
    throw deliveryNotConfigured("Email OTP delivery is not configured on this server.");
  }
  logger.info(`DEV OTP EMAIL ${target}: ${code}`);
}

module.exports = { generateOtp, hashOtp, verifyOtpHash, deliverOtp };
