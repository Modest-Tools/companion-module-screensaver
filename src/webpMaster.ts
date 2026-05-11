import WebP from 'node-webpmux'
import { computeTileDims, type MasterDeck } from './masterDeck.js'

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

export async function loadWebpMaster(filePath: string, gridCols: number, gridRows: number): Promise<MasterDeck> {
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

	const dims = computeTileDims(image.width, image.height, gridCols, gridRows)

	return {
		sourcePath: filePath,
		sourceFormat: 'webp',
		frames,
		totalDuration: cumulative || 1,
		width: image.width,
		height: image.height,
		gridCols,
		gridRows,
		...dims,
		async getFrameRgba(idx: number): Promise<Uint8Array> {
			return (await image.getFrameData(idx)) as unknown as Uint8Array
		},
	}
}
