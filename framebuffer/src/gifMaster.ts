import { readFile } from 'node:fs/promises'
import { GifReader } from 'omggif'
import type { MasterSource } from './masterFrame.js'

/**
 * Load a full-deck animated GIF as a framebuffer master source. Pre-decodes
 * all frames into RGBA buffers using the running-canvas disposal handling
 * pattern, so `getFrameRgba` is an O(1) lookup at playback time. Memory cost:
 * width × height × 4 × numFrames bytes — fine for the full-deck animation
 * sizes Elgato ships (typically <50 MB resident).
 */
export async function loadGifMaster(filePath: string): Promise<MasterSource> {
	const buf = await readFile(filePath)
	const reader = new GifReader(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))
	const width = reader.width
	const height = reader.height
	const numFrames = reader.numFrames()

	if (numFrames === 0) throw new Error(`GIF has no frames: ${filePath}`)

	const canvas = new Uint8Array(width * height * 4)
	const frameRgbas: Uint8Array[] = []
	const frames: { delay: number; cumulative: number }[] = []
	let cumulative = 0

	for (let i = 0; i < numFrames; i++) {
		const info = reader.frameInfo(i)
		reader.decodeAndBlitFrameRGBA(i, canvas)

		// Snapshot canvas — must copy because the next iteration mutates it.
		frameRgbas.push(new Uint8Array(canvas))

		// GIF frame delay is in centiseconds; 0 means "as fast as possible" — clamp.
		const delayMs = Math.max(20, info.delay * 10 || 100)
		cumulative += delayMs
		frames.push({ delay: delayMs, cumulative })

		// Disposal 2 = restore to background (transparent) — clear region before next composite.
		if (info.disposal === 2) {
			for (let y = info.y; y < info.y + info.height; y++) {
				const start = (y * width + info.x) * 4
				canvas.fill(0, start, start + info.width * 4)
			}
		}
	}

	return {
		sourcePath: filePath,
		sourceFormat: 'gif',
		frames,
		totalDuration: cumulative || 1,
		width,
		height,
		async getFrameRgba(idx: number): Promise<Uint8Array> {
			return frameRgbas[idx] ?? frameRgbas[0]
		},
	}
}
