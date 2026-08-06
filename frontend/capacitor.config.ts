import type { CapacitorConfig } from "@capacitor/cli";

// Wraps the existing FocusForge AI React (Vite) build into a
// real Android + iOS app shell.
const config: CapacitorConfig = {
  appId: "com.focusforge.ai",
  appName: "FocusForge AI",
  webDir: "dist", // vite build output folder
  server: {
    androidScheme: "https", // avoids mixed-content/cookie issues with httpOnly JWT
  },
};

export default config;