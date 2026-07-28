import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { copyWasmPlugin, fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	build: {
		outDir: "dist/webcomponent",
		emptyOutDir: true,
		lib: {
			entry: "src/webcomponent/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
	},
	plugins: [
		copyWasmPlugin(),
		dts({
			tsconfigPath: "tsconfig.json",
			include: ["src/webcomponent/**/*.ts", "src/vanilla/**/*.ts", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
		}),
		fixDtsExtensionsPlugin("dist/webcomponent"),
	],
});
