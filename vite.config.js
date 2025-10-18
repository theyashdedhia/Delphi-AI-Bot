import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: isDev
    ? {
        https: (fs.existsSync("./localhost.pem") && fs.existsSync("./localhost-key.pem"))
  ? {
      key: fs.readFileSync("./localhost-key.pem"),
      cert: fs.readFileSync("./localhost.pem"),
    }
  : false,

        host: "localhost",
        port: 3000,
        strictPort: true,
        open: true,
      }
    : {}, // no server config needed in prod
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
    css: true,
    coverage: { reporter: ["text", "json", "html"] },
  },
});
