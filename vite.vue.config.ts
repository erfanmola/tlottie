import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	base: "./",
	build: {
		outDir: "dist/vue",
		emptyOutDir: true,
		lib: {
			entry: "src/vue/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
		rollupOptions: {
			external: ["vue"],
		},
	},
	plugins: [
		vue(),
		// LottiePlayer.vue itself isn't scanned here — full .vue declaration
		// generation needs vue-tsc; consumers get its runtime export
		// untyped (still fully functional) while everything else re-exported
		// from this entry stays fully typed.
		dts({
			tsconfigPath: "tsconfig.vue.json",
			include: ["src/vue/index.ts", "src/vue/shims.d.ts", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
			exclude: ["**/*.vue"],
			insertTypesEntry: false,
		}),
		fixDtsExtensionsPlugin("dist/vue"),
	],
});
