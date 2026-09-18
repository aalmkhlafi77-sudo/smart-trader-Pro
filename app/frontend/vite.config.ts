import nodeCrypto from "node:crypto";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// بيئة Node 20.11 تفتقد crypto.hash (أُضيفت في 20.12) التي يستدعيها Vite 7 في بناء الإنتاج؛ polyfill محلي.
if (typeof (nodeCrypto as { hash?: unknown }).hash !== "function") {
  (
    nodeCrypto as unknown as {
      hash: (
        algorithm: string,
        data: string | Uint8Array,
        outputEncoding: BufferEncoding
      ) => string;
    }
  ).hash = (algorithm, data, outputEncoding) =>
    nodeCrypto.createHash(algorithm).update(data).digest(outputEncoding);
}

// نسخة مستقلة: React + Tailwind فقط، دون تخزين خارجي أو مراقبة أو وقت تشغيل خاص بالمنصة.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
