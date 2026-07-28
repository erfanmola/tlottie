import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { copyWasmPlugin, fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	build: {
		outDir: "dist/core",
		emptyOutDir: true,
		lib: {
			entry: "src/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
	},
	plugins: [
		copyWasmPlugin(),
		dts({
			tsconfigPath: "tsconfig.json",
			include: ["src/index.ts", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
		}),
		fixDtsExtensionsPlugin("dist/core"),
	],
});
