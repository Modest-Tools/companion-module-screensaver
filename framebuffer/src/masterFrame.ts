/**
 * "Master format" animation source — a single full-deck animation (WebP or GIF)
 * that the framebuffer module pushes to Companion-core's page overlay at the
 * configured fps. The per-format loaders (`gifMaster.ts`, `webpMaster.ts`)
 * return a `MasterSource`; the renderer doesn't care which underlying codec
 * produced the RGBA frames.
 *
 * Note: unlike the side-load module's `MasterDeck` (in src/masterDeck.ts),
 * there's no per-tile slicing machinery here. Companion-core does the slicing
 * once the framebuffer API lands — see `framebuffer/PROPOSAL.md`.
 */
export type MasterSource = {
	sourcePath: string
	sourceFormat: 'webp' | 'gif'
	frames: { delay: number; cumulative: number }[]
	totalDuration: number
	width: number
	height: number
	/** Returns full-frame RGBA pixels (width × height × 4) for the requested frame. */
	getFrameRgba(idx: number): Promise<Uint8Array>
}

/**
 * Given a wall-clock elapsed time (ms), return the frame index that should be
 * displayed right now, looping the animation forever via modulo. Binary search
 * over the cumulative delay table is O(log frames).
 */
export function frameIndexAtTime(master: MasterSource, elapsedMs: number): number {
	if (master.frames.length <= 1) return 0
	const t = ((elapsedMs % master.totalDuration) + master.totalDuration) % master.totalDuration
	let lo = 0
	let hi = master.frames.length - 1
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (master.frames[mid].cumulative <= t) lo = mid + 1
		else hi = mid
	}
	return lo
}
