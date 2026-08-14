const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

function readBoolean(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export const launchFlags = {
  studyRoom: readBoolean(import.meta.env.VITE_ENABLE_STUDY_ROOM, false),
};
