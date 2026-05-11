/**
 * Shared "master format" abstraction. A master screensaver is a single
 * full-deck animation (WebP or GIF) that gets sliced into per-button tiles
 * at runtime. The per-format loaders (`webpMaster.ts`, `gifMaster.ts`)
 * return a `MasterDeck`; the slicer + frame-timing logic here doesn't care
 * which underlying codec produced the RGBA frames.
 */

export type MasterDeck = {
	sourcePath: string
	sourceFormat: 'webp' | 'gif'
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
	/** Returns full-deck RGBA pixels (width × height × 4) for the requested frame. */
	getFrameRgba(idx: number): Promise<Uint8Array>
}

export const MAX_TILE_DIM = 96

export function computeTileDims(width: number, height: number, gridCols: number, gridRows: number): {
	srcTileWidth: number
	srcTileHeight: number
	tileWidth: number
	tileHeight: number
} {
	const srcTileWidth = Math.floor(width / gridCols)
	const srcTileHeight = Math.floor(height / gridRows)
	const longer = Math.max(srcTileWidth, srcTileHeight)
	const scale = longer > MAX_TILE_DIM ? MAX_TILE_DIM / longer : 1
	const tileWidth = Math.max(1, Math.floor(srcTileWidth * scale))
	const tileHeight = Math.max(1, Math.floor(srcTileHeight * scale))
	return { srcTileWidth, srcTileHeight, tileWidth, tileHeight }
}

export function frameIndexAtTime(master: MasterDeck, elapsedMs: number): number {
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
export function sliceFrame(master: MasterDeck, rgba: Uint8Array): Map<number, Buffer> {
	const { width, gridCols, gridRows, srcTileWidth, srcTileHeight, tileWidth, tileHeight } = master
	const out = new Map<number, Buffer>()
	const srcStride = width * 4
	const dstStride = tileWidth * 4

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

export async function decodeAndSliceFrame(master: MasterDeck, frameIdx: number): Promise<Map<number, Buffer>> {
	const rgba = await master.getFrameRgba(frameIdx)
	return sliceFrame(master, rgba)
}
