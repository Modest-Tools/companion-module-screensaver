import { readFile } from 'node:fs/promises'
import { GifReader } from 'omggif'

export type DecodedTile = {
	width: number
	height: number
	frameDelaysMs: number[]
	totalDurationMs: number
	frames: string[] // base64-encoded RGBA buffers, one per frame
}

/**
 * Load and decode a single animated GIF. Returns base64 RGBA pixel buffers
 * (Companion's expected `imageBuffer` format) for each frame, plus per-frame
 * delays in milliseconds.
 *
 * Handles GIF disposal correctly by maintaining a running canvas across frames.
 */
export async function loadGifTile(path: string): Promise<DecodedTile> {
	const buf = await readFile(path)
	const reader = new GifReader(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))
	const w = reader.width
	const h = reader.height
	const numFrames = reader.numFrames()

	if (numFrames === 0) throw new Error(`GIF has no frames: ${path}`)

	const canvas = new Uint8Array(w * h * 4) // running RGBA canvas
	const frames: string[] = []
	const delays: number[] = []
	let totalMs = 0

	for (let i = 0; i < numFrames; i++) {
		const info = reader.frameInfo(i)
		// blit modifies canvas in-place starting at frame's (x,y)
		// disposal handling: omggif's blit takes care of compositing within frame bounds,
		// but we manually clear if disposal === 2 (restore to background) before next blit.
		reader.decodeAndBlitFrameRGBA(i, canvas)

		// Snapshot the canvas as base64
		frames.push(Buffer.from(canvas).toString('base64'))

		// Frame delay is in centiseconds (1/100s); 0 means "as fast as possible" — clamp to 50ms
		const delayMs = Math.max(20, info.delay * 10 || 100)
		delays.push(delayMs)
		totalMs += delayMs

		// Disposal 2 = restore to background color (transparent). Clear region for next frame.
		if (info.disposal === 2) {
			for (let y = info.y; y < info.y + info.height; y++) {
				const start = (y * w + info.x) * 4
				canvas.fill(0, start, start + info.width * 4)
			}
		}
		// disposal 0,1 = leave as-is (composite); 3 = restore previous (rare; we ignore)
	}

	return {
		width: w,
		height: h,
		frameDelaysMs: delays,
		totalDurationMs: totalMs,
		frames,
	}
}

/**
 * For a given playback time (ms since loop start), return the index of the
 * frame that should be displayed.
 */
export function frameAtTime(tile: DecodedTile, elapsedMs: number): number {
	if (tile.frames.length === 0) return 0
	if (tile.totalDurationMs === 0) return 0
	const t = ((elapsedMs % tile.totalDurationMs) + tile.totalDurationMs) % tile.totalDurationMs
	let acc = 0
	for (let i = 0; i < tile.frameDelaysMs.length; i++) {
		acc += tile.frameDelaysMs[i]
		if (t < acc) return i
	}
	return tile.frames.length - 1
}
