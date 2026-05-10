import WebP from 'node-webpmux'

export type WebpMasterDeck = {
	webpPath: string
	image: WebpImage
	frames: { delay: number; cumulative: number }[]
	totalDuration: number
	width: number
	height: number
	gridCols: number
	gridRows: number
	/** Source-pixel tile size before downsample (= width/cols × height/rows). */
	srcTileWidth: number
	srcTileHeight: number
	/** Output tile size shipped to Companion (downsampled to keep IPC light). */
	tileWidth: number
	tileHeight: number
}

const MAX_TILE_DIM = 96

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

export async function loadWebpMaster(filePath: string, gridCols: number, gridRows: number): Promise<WebpMasterDeck> {
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

	const srcTileWidth = Math.floor(image.width / gridCols)
	const srcTileHeight = Math.floor(image.height / gridRows)

	// Downsample so Companion's IPC isn't shoveling 500KB+ per tile per frame.
	// Cap the longer dimension at MAX_TILE_DIM, preserve aspect.
	const longer = Math.max(srcTileWidth, srcTileHeight)
	const scale = longer > MAX_TILE_DIM ? MAX_TILE_DIM / longer : 1
	const tileWidth = Math.max(1, Math.floor(srcTileWidth * scale))
	const tileHeight = Math.max(1, Math.floor(srcTileHeight * scale))

	return {
		webpPath: filePath,
		image,
		frames,
		totalDuration: cumulative || 1,
		width: image.width,
		height: image.height,
		gridCols,
		gridRows,
		srcTileWidth,
		srcTileHeight,
		tileWidth,
		tileHeight,
	}
}

export function frameIndexAtTime(master: WebpMasterDeck, elapsedMs: number): number {
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

/**
 * Slice an RGBA buffer into per-tile RGBA buffers based on the deck grid.
 * Source dimensions match master.width × master.height. Each tile is
 * master.tileWidth × master.tileHeight; the bottom/right edges are dropped if
 * width/height isn't evenly divisible by gridCols/gridRows.
 */
export function sliceFrame(master: WebpMasterDeck, rgba: Uint8Array): Map<number, Buffer> {
	const { width, gridCols, gridRows, srcTileWidth, srcTileHeight, tileWidth, tileHeight } = master
	const out = new Map<number, Buffer>()
	const srcStride = width * 4
	const dstStride = tileWidth * 4

	// Precompute src→dst pixel sample indices for each output pixel.
	const sxFor = new Int32Array(tileWidth)
	for (let x = 0; x < tileWidth; x++) sxFor[x] = Math.floor((x * srcTileWidth) / tileWidth)
	const syFor = new Int32Array(tileHeight)
	for (let y = 0; y < tileHeight; y++) syFor[y] = Math.floor((y * srcTileHeight) / tileHeight)

	for (let r = 0; r < gridRows; r++) {
		for (let c = 0; c < gridCols; c++) {
			const slot = r * gridCols + c
			const tileBuf = Buffer.alloc(tileWidth * tileHeight * 4)
			const tileOriginX = c * srcTileWidth
			const tileOriginY = r * srcTileHeight

			for (let y = 0; y < tileHeight; y++) {
				const srcRow = (tileOriginY + syFor[y]) * srcStride
				const dstRow = y * dstStride
				for (let x = 0; x < tileWidth; x++) {
					const srcOff = srcRow + (tileOriginX + sxFor[x]) * 4
					const dstOff = dstRow + x * 4
					tileBuf[dstOff] = rgba[srcOff]
					tileBuf[dstOff + 1] = rgba[srcOff + 1]
					tileBuf[dstOff + 2] = rgba[srcOff + 2]
					tileBuf[dstOff + 3] = rgba[srcOff + 3]
				}
			}
			out.set(slot, tileBuf)
		}
	}

	return out
}

export async function decodeAndSliceFrame(master: WebpMasterDeck, frameIdx: number): Promise<Map<number, Buffer>> {
	const rgba = (await master.image.getFrameData(frameIdx)) as unknown as Uint8Array
	return sliceFrame(master, rgba)
}
