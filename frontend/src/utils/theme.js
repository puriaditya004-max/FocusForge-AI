const STORAGE_KEY = "focusforge-theme";
const THEMES = ["bright", "dark", "purple"];

export function normalizeTheme(theme) {
  const value = String(theme || "dark").toLowerCase();
  if (value === "light") return "bright";
  return THEMES.includes(value) ? value : "dark";
}

export function applyTheme(theme) {
  const normalized = normalizeTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = normalized;
  root.classList.remove("theme-bright", "theme-dark", "theme-purple");
  root.classList.add(`theme-${normalized}`);
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function getStoredTheme() {
  return normalizeTheme(localStorage.getItem(STORAGE_KEY) || "dark");
}
