const crypto = require("crypto");
const logger = require("./logger");

const EMAIL_ENDPOINT = "https://control.msg91.com/api/v5/email/send";
const OTP_TTL_MS = 10 * 60 * 1000;
const DELIVERY_TIMEOUT_MS = Number(process.env.OTP_DELIVERY_TIMEOUT_MS || 15000);

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

function maskEmail(email) {
  const [name = "", domain = ""] = String(email || "").split("@");
  if (!domain) return "***";
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

function maskMobile(mobile) {
  return String(mobile || "").replace(/^(\+?\d{2})\d+(\d{2})$/, "$1******$2");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      const timeoutError = new Error("OTP delivery provider timed out.");
      timeoutError.status = 503;
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readProviderResponse(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}

async function sendViaMsg91Sms(target, code) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authKey || !templateId) {
    throw deliveryNotConfigured("MSG91 SMS OTP delivery is not configured.");
  }

  const mobile = target.replace(/^\+/, "");
  const params = new URLSearchParams({
    otp: code,
    mobile,
    template_id: templateId,
    authkey: authKey,
  });

  const response = await fetchWithTimeout(`https://control.msg91.com/api/v5/otp?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await readProviderResponse(response);

  if (!response.ok || data?.type === "error" || (data?.type && data.type !== "success")) {
    const err = new Error(data?.message || "MSG91 failed to send OTP SMS.");
    err.status = response.status >= 500 ? 503 : 400;
    throw err;
  }

  logger.info("MSG91 OTP SMS accepted", {
    target: maskMobile(mobile),
    providerType: data?.type,
  });
}

async function sendViaTwilio(target, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    throw deliveryNotConfigured("Twilio SMS OTP delivery is not configured.");
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({
    To: target,
    From: fromNumber,
    Body: `Your FocusForge AI verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
  });

  const response = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = await readProviderResponse(response);
  if (!response.ok) {
    const err = new Error(data?.message || "Twilio failed to send OTP SMS.");
    err.status = response.status >= 500 ? 503 : 400;
    throw err;
  }
}

async function deliverSms(target, code) {
  const provider = (process.env.OTP_SMS_PROVIDER || "").toLowerCase();

  if (provider === "msg91") return sendViaMsg91Sms(target, code);
  if (provider === "twilio") return sendViaTwilio(target, code);

  if (provider === "webhook" || (!provider && process.env.SMS_OTP_WEBHOOK_URL)) {
    if (!process.env.SMS_OTP_WEBHOOK_URL) {
      throw deliveryNotConfigured("SMS OTP webhook is not configured.");
    }
    await fetchWithTimeout(process.env.SMS_OTP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: target, code, product: "FocusForge AI" }),
    });
    return;
  }

  if (isProduction()) {
    throw deliveryNotConfigured("SMS OTP delivery is not configured on this server.");
  }
  logger.info("DEV OTP MOBILE", { target: maskMobile(target), code });
}

async function deliverMsg91Email(target, code, recipientName) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_EMAIL_TEMPLATE_ID;
  const fromEmail = process.env.MSG91_EMAIL_FROM;
  const domain = process.env.MSG91_EMAIL_DOMAIN;

  if (!authKey || !templateId || !fromEmail || !domain) {
    throw deliveryNotConfigured("MSG91 Email OTP delivery is not configured.");
  }

  const body = {
    recipients: [
      {
        to: [{ name: recipientName || "FocusForge User", email: target }],
        variables: {
          company_name: "FocusForge AI",
          otp: code,
        },
      },
    ],
    from: { name: "FocusForge AI", email: fromEmail },
    domain,
    template_id: templateId,
  };

  const response = await fetchWithTimeout(EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: authKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await readProviderResponse(response);

  if (!response.ok || data?.type === "error" || data?.status === "fail") {
    const err = new Error(data?.message || data?.error || "MSG91 failed to send OTP email.");
    err.status = response.status >= 500 ? 503 : 400;
    throw err;
  }

  logger.info("MSG91 OTP email accepted", {
    target: maskEmail(target),
    providerType: data?.type || data?.status || "accepted",
  });
}

async function deliverEmail(target, code, recipientName) {
  const provider = (process.env.OTP_EMAIL_PROVIDER || "").toLowerCase();

  if (provider === "msg91" || process.env.MSG91_EMAIL_TEMPLATE_ID) {
    return deliverMsg91Email(target, code, recipientName);
  }

  if (isProduction()) {
    throw deliveryNotConfigured("Email OTP delivery is not configured on this server.");
  }
  logger.info("DEV OTP EMAIL", { target: maskEmail(target), code });
}

async function deliverOtp({ channel, target, code, recipientName }) {
  if (channel === "MOBILE") {
    return deliverSms(target, code);
  }
  return deliverEmail(target, code, recipientName);
}

module.exports = { OTP_TTL_MS, generateOtp, hashOtp, verifyOtpHash, deliverOtp };
