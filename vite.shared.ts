import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";

const WASM_SOURCE = fileURLToPath(new URL("./src/core/tlottie.wasm", import.meta.url));
const WASM_SHARED_DIR = fileURLToPath(new URL("./dist", import.meta.url));

/** Keep configuration, warmup, and player classes in one package runtime. */
export function sharedCorePlugin(): Plugin {
	const shared = new Set(["src/main/TLottie.ts", "src/main/initialize.ts", "src/main/shimmer.ts", "src/core/types.ts", "src/worker/pool.ts"].map(path => fileURLToPath(new URL(`./${path}`, import.meta.url))));
	return {
		name: "tlottie-shared-core",
		apply: "build",
		enforce: "pre",
		resolveId(source, importer) {
			if (importer && source.startsWith(".") && shared.has(resolve(dirname(importer), source)))
				return { id: "tlottie", external: true };
		},
	};
}

/**
 * Copies tlottie.wasm to `dist/tlottie.wasm`, one level up from
 * `dist/bin/lottie-to-outline.js` — the CLI reads it straight off disk (see
 * src/bin/lottie-to-outline.ts), so it needs a real file at a fixed path
 * rather than the browser asset URL. Only the shared core browser build
 * emits a browser WASM copy; adapters import that runtime. This plugin
 * supplies the CLI/custom-hosting copy and is wired into the bin build.
 */
export function copyWasmPlugin(): Plugin {
	return {
		name: "tlottie-copy-wasm",
		apply: "build",
		writeBundle() {
			mkdirSync(WASM_SHARED_DIR, { recursive: true });
			copyFileSync(WASM_SOURCE, `${WASM_SHARED_DIR}/tlottie.wasm`);
		},
	};
}

/**
 * Same idea as copyWasmPlugin, but for single-target builds (the demo app)
 * where there's no cross-config sharing concern — copies straight into
 * whatever outDir this specific build actually resolves to.
 */
export function copyWasmToOutDirPlugin(): Plugin {
	return {
		name: "tlottie-copy-wasm-to-outdir",
		apply: "build",
		writeBundle(options) {
			const outDir = options.dir ?? "dist";
			mkdirSync(outDir, { recursive: true });
			copyFileSync(WASM_SOURCE, `${outDir}/tlottie.wasm`);
		},
	};
}

/**
 * vite-plugin-dts emits declaration files with the source's own
 * `./foo.ts`-style specifiers (needed in source under
 * `allowImportingTsExtensions`) instead of rewriting them to match the
 * emitted `.d.ts` tree, which breaks resolution for consumers. Strips the
 * `.ts` extension from every relative import/export specifier in every
 * emitted `.d.ts` file, closeBundle runs after dts's own writeBundle.
 */
export function fixDtsExtensionsPlugin(outDir: string): Plugin {
	return {
		name: "tlottie-fix-dts-extensions",
		apply: "build",
		async closeBundle() {
			if (outDir === "dist/svelte") {
				const { emitDts } = await import("svelte2tsx");
				await emitDts({
					declarationDir: fileURLToPath(new URL(`./${outDir}`, import.meta.url)),
					libRoot: fileURLToPath(new URL("./src", import.meta.url)),
					tsconfig: fileURLToPath(new URL("./tsconfig.svelte.json", import.meta.url)),
					svelteShimsPath: fileURLToPath(import.meta.resolve("svelte2tsx/svelte-shims-v4.d.ts")),
				});
			}
			walk(outDir);
			if (outDir !== "dist/core") {
				// Re-export the canonical declarations too: private pool fields
				// otherwise make core pools incompatible with adapter props.
				for (const directory of ["main", "worker", "core"]) {
					const path = `${outDir}/${directory}`;
					const source = `dist/core/${directory}`;
					if (!existsSync(source)) continue;
					mkdirSync(path, { recursive: true });
					for (const file of readdirSync(source)) {
						if (file.endsWith(".d.ts") && existsSync(`dist/core/${directory}/${file}`)) writeFileSync(`${path}/${file}`, `export * from "../../core/${directory}/${file.slice(0, -5)}";\n`);
					}
				}
			}
			const adapter = outDir.split("/").at(-1);
			if (existsSync(`${outDir}/${adapter}/index.d.ts`)) {
				writeFileSync(`${outDir}/index.d.ts`, `export * from "./${adapter}/index";\n`);
			}
		},
	};
}

function walk(dir: string): void {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir)) {
		const full = `${dir}/${entry}`;
		const stat = statSync(full);
		if (stat.isDirectory()) {
			walk(full);
		} else if (entry.endsWith(".d.ts")) {
			const content = readFileSync(full, "utf8");
			const fixed = content
				.replace(/(from\s+["'][^"']+?)\.tsx?(["'])/g, "$1$2")
				.replace(/^import\s+["'][^"']+\.(?:scss|css)["'];?\s*$/gm, "");
			if (fixed !== content) writeFileSync(full, fixed);
		}
	}
}
