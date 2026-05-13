import WebP from 'node-webpmux'
import type { MasterSource } from './masterFrame.js'

type WebpImage = {
	width: number
	height: number
	hasAnim: boolean
	frames?: Array<{ width: number; height: number; delay: number }>
	getFrameData(idx: number): Promise<Buffer>
	getImageData(): Promise<Buffer>
	load(path: string): Promise<void>
}

let libInited = false

async function ensureLibInited(): Promise<void> {
	if (libInited) return
	const Image = (WebP as unknown as { Image: { initLib(): Promise<void> } }).Image
	await Image.initLib()
	libInited = true
}

/**
 * Load an animated WebP as a framebuffer master source. Frames are decoded
 * on-demand (one at a time) rather than pre-decoded, because some Elgato WebP
 * packs are huge (Matrix Code is 1532 frames × 1920×1080 — 12.7 GB if
 * pre-decoded). Caller decides how to throttle frame requests.
 */
export async function loadWebpMaster(filePath: string): Promise<MasterSource> {
	await ensureLibInited()
	const ImageCtor = (WebP as unknown as { Image: new () => WebpImage }).Image
	const image = new ImageCtor()
	await image.load(filePath)

	const animatedFrames = image.frames ?? []
	const sourceFrames =
		animatedFrames.length > 0
			? animatedFrames
			: [{ width: image.width, height: image.height, delay: 1000 }]

	const frames: { delay: number; cumulative: number }[] = []
	let cumulative = 0
	for (const f of sourceFrames) {
		const delay = f.delay > 0 ? f.delay : 33
		cumulative += delay
		frames.push({ delay, cumulative })
	}

	return {
		sourcePath: filePath,
		sourceFormat: 'webp',
		frames,
		totalDuration: cumulative || 1,
		width: image.width,
		height: image.height,
		async getFrameRgba(idx: number): Promise<Uint8Array> {
			return (await image.getFrameData(idx)) as unknown as Uint8Array
		},
	}
}
