import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  envDir: "../",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Deduplicate React & Convex — prevents duplicate instance issues when
      // the library (linked via file:..) has its own node_modules copies.
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(
        __dirname,
        "./node_modules/react/jsx-runtime"
      ),
      "react/jsx-dev-runtime": path.resolve(
        __dirname,
        "./node_modules/react/jsx-dev-runtime"
      ),
      convex: path.resolve(__dirname, "./node_modules/convex"),
    },
    conditions: ["@convex-dev/component-source"],
  },
});
