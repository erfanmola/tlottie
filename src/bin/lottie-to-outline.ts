#!/usr/bin/env node
// CLI: traces a Lottie/TGS animation's silhouette at a given frame into an
// outline SVG, for use as the `outline` prop (loading-skeleton mask) in
// every framework adapter. Reuses this package's own wasm renderer and
// gzip decoder instead of a separate thorvg+pako toolchain.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
	ColorMode,
	Hierarchical,
	optimize,
	PathSimplifyMode,
	vectorizeRaw,
} from "@neplex/vectorizer";
import { decodeAnimationBytes } from "../core/gzip.ts";
import { TLottieInstance } from "../core/instance.ts";
import type { TLottieWasmExports } from "../core/wasm.ts";

const DEFAULT_SIZE = 512;

interface CliOptions {
	input: string;
	output: string;
	frame: number;
	size: number;
}

function printUsageAndExit(message?: string): never {
	if (message) console.error(`error: ${message}\n`);
	console.error(
		[
			"Usage: tlottie-outline --input <file.json|file.tgs> [--output <file.svg>] [--frame <n>] [--size <px>]",
			"",
			"  -i, --input   Path to a Lottie JSON or .tgs (gzipped) file. Required.",
			"  -o, --output  Path to write the outline SVG. Defaults to <input-without-extension>-outline.svg.",
			`  -f, --frame   Frame number to trace. Defaults to 0.`,
			`  -s, --size    Raster size (px, square) used for tracing — higher is more accurate and slower. Defaults to ${DEFAULT_SIZE}.`,
		].join("\n"),
	);
	process.exit(message ? 1 : 0);
}

function parseCliOptions(): CliOptions {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			input: { type: "string", short: "i" },
			output: { type: "string", short: "o" },
			frame: { type: "string", short: "f" },
			size: { type: "string", short: "s" },
			help: { type: "boolean", short: "h" },
		},
		strict: true,
	});

	if (values.help) printUsageAndExit();
	if (!values.input) printUsageAndExit("--input is required");

	const input = values.input;
	const output =
		values.output ?? `${input.replace(/\.(json|tgs)$/i, "")}-outline.svg`;
	const frame = values.frame !== undefined ? Number(values.frame) : 0;
	const size = values.size !== undefined ? Number(values.size) : DEFAULT_SIZE;

	if (!Number.isFinite(frame) || frame < 0)
		printUsageAndExit("--frame must be a non-negative number");
	if (!Number.isFinite(size) || size <= 0)
		printUsageAndExit("--size must be a positive number");

	return { input, output, frame, size };
}

async function loadWasm(): Promise<TLottieWasmExports> {
	// Node has no fetch(file://) support, so this bypasses core/wasm.ts's
	// fetch-based loader and reads the bundled binary straight off disk.
	// Built (dist/bin/lottie-to-outline.js) sits next to dist/tlottie.wasm's
	// parent, same depth as every browser target — see vite.shared.ts. Run
	// straight from source (bun run src/bin/lottie-to-outline.ts, the "outline"
	// dev script) it's a sibling of src/core/ instead — try both.
	for (const candidate of ["../tlottie.wasm", "../core/tlottie.wasm"]) {
		const wasmPath = fileURLToPath(new URL(candidate, import.meta.url));
		try {
			const bytes = readFileSync(wasmPath);
			const { instance } = await WebAssembly.instantiate(bytes, {});
			return instance.exports as unknown as TLottieWasmExports;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	throw new Error("couldn't locate tlottie.wasm next to this script");
}

async function main(): Promise<void> {
	const { input, output, frame, size } = parseCliOptions();

	let animationBytes: Uint8Array;
	try {
		const raw = readFileSync(input);
		animationBytes = await decodeAnimationBytes(new Uint8Array(raw));
	} catch (error) {
		printUsageAndExit(
			`couldn't read "${input}": ${error instanceof Error ? error.message : error}`,
		);
	}

	const exports = await loadWasm();
	const instance = TLottieInstance.create(exports, animationBytes);
	if (!instance)
		printUsageAndExit(`tlottie rejected "${input}" — not valid Lottie JSON`);

	const pixels = instance.render(frame, size, size, {
		antialias: true,
		curveTolerance: 0.125,
	});
	if (!pixels)
		printUsageAndExit(`render failed for "${input}" at frame ${frame}`);

	// Silhouette: keep alpha as-is, flatten every visible pixel to solid
	// black — the vectorizer then traces this into a single filled shape,
	// exactly what the CSS mask-image shimmer needs.
	const silhouette = Buffer.from(
		pixels.buffer,
		pixels.byteOffset,
		pixels.byteLength,
	);
	for (let i = 0; i < silhouette.length; i += 4) {
		if (silhouette[i + 3] !== 0) {
			silhouette[i] = 0;
			silhouette[i + 1] = 0;
			silhouette[i + 2] = 0;
		}
	}

	const svg = await vectorizeRaw(
		silhouette,
		{ width: size, height: size },
		{
			colorMode: ColorMode.Color,
			hierarchical: Hierarchical.Stacked,
			filterSpeckle: 0,
			colorPrecision: 1,
			layerDifference: 0,
			mode: PathSimplifyMode.Polygon,
			cornerThreshold: 0,
			lengthThreshold: 0,
			maxIterations: 0,
			spliceThreshold: 0,
			pathPrecision: 0,
		},
	);

	const optimized = await optimize(svg, { multipass: true });
	// Strip any fixed pixel width/height so the SVG stays scalable as a CSS
	// mask, and make sure a viewBox matching the traced raster is present.
	const finalSvg = optimized
		.replace(/\s+width="[^"]*"/, "")
		.replace(/\s+height="[^"]*"/, "")
		.replace(/<svg(?![^>]*viewBox)/, `<svg viewBox="0 0 ${size} ${size}"`);

	writeFileSync(output, finalSvg);
	instance.drop();

	console.log(`Wrote ${output} (${(finalSvg.length / 1024).toFixed(2)}KB)`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
