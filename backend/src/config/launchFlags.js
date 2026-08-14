const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

const FLAG_DEFINITIONS = {
  registration: {
    env: "ENABLE_REGISTRATION",
    defaultEnabled: true,
  },
  payments: {
    env: "ENABLE_PAYMENTS",
    defaultEnabled: true,
  },
  studyRoom: {
    env: "ENABLE_STUDY_ROOM",
    defaultEnabled: false,
  },
  ai: {
    env: "ENABLE_AI",
    defaultEnabled: true,
  },
  marketplace: {
    env: "ENABLE_MARKETPLACE",
    defaultEnabled: true,
  },
};

function parseFlagValue(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") return fallback;

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return fallback;
}

function isFeatureEnabled(feature) {
  const definition = FLAG_DEFINITIONS[feature];
  if (!definition) return false;

  return parseFlagValue(process.env[definition.env], definition.defaultEnabled);
}

function getPublicLaunchFlags() {
  return {
    registration: isFeatureEnabled("registration"),
    payments: isFeatureEnabled("payments"),
    studyRoom: isFeatureEnabled("studyRoom"),
    ai: isFeatureEnabled("ai"),
    marketplace: isFeatureEnabled("marketplace"),
  };
}

module.exports = {
  FLAG_DEFINITIONS,
  isFeatureEnabled,
  getPublicLaunchFlags,
};
