// Module-level cache shared by every adapter (vanilla/react/solid/vue/svelte
// all import this same module) — a src URL is only ever fetched once no
// matter how many players reference it, and callers can check isCached()
// to skip showing a loading shimmer for an already-warm source.
const cache = new Map<string, Promise<Uint8Array>>();

export function fetchAnimationBytes(src: string): Promise<Uint8Array> {
	let pending = cache.get(src);
	if (!pending) {
		pending = fetch(src, { cache: "force-cache" })
			.then((res) => {
				if (!res.ok)
					throw new Error(`tlottie: fetch failed for "${src}" (${res.status})`);
				return res.arrayBuffer();
			})
			.then((buffer) => new Uint8Array(buffer));
		// A failed fetch must not poison the cache — let the next load() retry.
		pending.catch(() => cache.delete(src));
		cache.set(src, pending);
	}
	return pending;
}

export function isAnimationCached(src: string): boolean {
	return cache.has(src);
}
