import { afterEach, expect, mock, test } from "bun:test";
import { loadWasmModule } from "../src/core/wasm.ts";

const originalFetch = globalThis.fetch;
// A valid empty WASM module is sufficient to exercise fetching/instantiation.
const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("reports the failing URL/status and retries after a failed download", async () => {
	const fetcher = mock(async () => new Response("missing", { status: 404 }));
	globalThis.fetch = fetcher as unknown as typeof fetch;
	await expect(
		loadWasmModule("https://example.test/retry.wasm"),
	).rejects.toThrow(
		"WASM request failed (404) at https://example.test/retry.wasm",
	);
	fetcher.mockImplementation(
		async () =>
			new Response(bytes, { headers: { "Content-Type": "application/wasm" } }),
	);
	await loadWasmModule("https://example.test/retry.wasm");
	expect(fetcher).toHaveBeenCalledTimes(2);
});

test("falls back on incorrect MIME without downloading twice and shares concurrent loads", async () => {
	const fetcher = mock(
		async () =>
			new Response(bytes, {
				headers: { "Content-Type": "application/octet-stream" },
			}),
	);
	globalThis.fetch = fetcher as unknown as typeof fetch;
	const [first, second] = await Promise.all([
		loadWasmModule("https://example.test/mime.wasm"),
		loadWasmModule("https://example.test/mime.wasm"),
	]);
	expect(first).toBe(second);
	expect(fetcher).toHaveBeenCalledTimes(1);
});

test("does not reuse another URL's cached module", async () => {
	const fetcher = mock(async () => new Response(bytes));
	globalThis.fetch = fetcher as unknown as typeof fetch;
	await loadWasmModule("https://example.test/one.wasm");
	await loadWasmModule("https://example.test/two.wasm");
	expect(fetcher).toHaveBeenCalledTimes(2);
});
