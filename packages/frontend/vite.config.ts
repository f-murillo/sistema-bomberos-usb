import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bomberos-usb/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
})