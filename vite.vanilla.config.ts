import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	base: "./",
	build: {
		outDir: "dist/vanilla",
		emptyOutDir: true,
		lib: {
			entry: "src/vanilla/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
	},
	plugins: [
		dts({
			tsconfigPath: "tsconfig.json",
			include: ["src/vanilla/**/*.ts", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
		}),
		fixDtsExtensionsPlugin("dist/vanilla"),
	],
});
