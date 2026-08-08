import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone admin app — deliberately its own Vite project (not a route
// inside frontend/), so this JS bundle never ships to a student/teacher/
// parent browser. Runs on a different port locally (5174) so `npm run dev`
// in frontend/ and here can be running side by side without a clash.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
});
