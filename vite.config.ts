import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths, so the build works under any path, e.g. https://<user>.github.io/<repo>/.
  base: "./",
  plugins: [react()],
});
