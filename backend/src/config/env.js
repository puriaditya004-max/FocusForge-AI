const logger = require("../utils/logger");

const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "JWT_SECRET",
];

const OPTIONAL_PRODUCTION_GROUPS = [
  {
    name: "Trusted frontend origins",
    keys: ["CLIENT_URL", "ADMIN_URL"],
    impact: "Missing origins can break browser auth cookies, admin access, CORS, or Socket.IO connections.",
  },
  {
    name: "Encryption",
    keys: ["ENCRYPTION_KEY"],
    impact: "Features that encrypt/decrypt saved mentor API keys need a 32-byte base64 ENCRYPTION_KEY.",
  },
  {
    name: "Gemini AI",
    keys: ["GEMINI_API_KEY"],
    impact: "AI mentor, roadmap generation, and quiz generation will return service errors without it.",
  },
  {
    name: "Razorpay",
    keys: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
    impact: "Paid course checkout, subscriptions, refunds, and webhook verification need these values.",
  },
  {
    name: "MSG91 Email OTP",
    keys: ["MSG91_AUTH_KEY", "MSG91_EMAIL_TEMPLATE_ID", "MSG91_EMAIL_FROM", "MSG91_EMAIL_DOMAIN"],
    impact: "Signup, login verification, and forgot-password email OTP delivery need these values.",
    onlyWhen: () => String(process.env.OTP_EMAIL_PROVIDER || "").toLowerCase() === "msg91",
  },
  {
    name: "MSG91 OTP SMS",
    keys: ["MSG91_AUTH_KEY", "MSG91_OTP_TEMPLATE_ID"],
    impact: "Mobile OTP delivery will fail when OTP_SMS_PROVIDER=msg91 and these values are missing.",
    onlyWhen: () => String(process.env.OTP_SMS_PROVIDER || "").toLowerCase() === "msg91",
  },
];

function hasValue(key) {
  return typeof process.env[key] === "string" && process.env[key].trim().length > 0;
}

function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const missingRequired = REQUIRED_PRODUCTION_ENV.filter((key) => !hasValue(key));
  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required production env vars: ${missingRequired.join(", ")}. ` +
        "Set them in Render before starting the backend."
    );
  }

  OPTIONAL_PRODUCTION_GROUPS.forEach((group) => {
    if (group.onlyWhen && !group.onlyWhen()) return;
    if (group.alternative && hasValue(group.alternative)) return;

    const missing = group.keys.filter((key) => !hasValue(key));
    if (missing.length > 0) {
      logger.warn(`Production env incomplete for ${group.name}.`, {
        missing,
        impact: group.impact,
      });
    }
  });
}

module.exports = { validateProductionEnv };
