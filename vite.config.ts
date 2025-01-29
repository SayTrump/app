import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
    plugins: [react(), tailwindcss(), svgr()],
    assetsInclude: ["**/*.mp4"],
    server: {
        proxy: {
            "/api/ipfs": {
                target: "https://pump.fun",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/ipfs/, "/api/ipfs"),
            },
        },
    },
});
