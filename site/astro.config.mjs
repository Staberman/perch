// @ts-check
import { defineConfig } from "astro/config";

const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export default defineConfig({
  site: vercelUrl ? `https://${vercelUrl}` : "http://localhost:4321",
  vite: {
    // The creature templates live in the Swift package, outside this project.
    server: { fs: { allow: [".."] } },
  },
});
