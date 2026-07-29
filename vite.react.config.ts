import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { copyWasmPlugin, fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	base: "./",
	build: {
		outDir: "dist/react",
		emptyOutDir: true,
		lib: {
			entry: "src/react/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
		rollupOptions: {
			external: ["react", "react-dom", "react/jsx-runtime"],
		},
	},
	plugins: [
		react(),
		copyWasmPlugin(),
		dts({
			tsconfigPath: "tsconfig.react.json",
			include: ["src/react/**/*.tsx", "src/react/**/*.ts", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
		}),
		fixDtsExtensionsPlugin("dist/react"),
	],
});
