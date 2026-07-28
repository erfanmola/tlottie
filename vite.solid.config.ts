import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import solid from "vite-plugin-solid";
import { copyWasmPlugin, fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	build: {
		outDir: "dist/solid",
		emptyOutDir: true,
		target: "esnext",
		lib: {
			entry: "src/solid/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
		rollupOptions: {
			external: ["solid-js", "solid-js/web", "solid-js/store"],
		},
	},
	plugins: [
		solid(),
		copyWasmPlugin(),
		dts({
			tsconfigPath: "tsconfig.solid.json",
			include: ["src/solid/**/*.tsx", "src/solid/**/*.ts", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
		}),
		fixDtsExtensionsPlugin("dist/solid"),
	],
});
