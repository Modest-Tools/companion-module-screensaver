import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { loadGifTile, frameAtTime, type DecodedTile } from './gifFrames.js'

export type TileSet = {
	tilesBySlot: Map<number, DecodedTile>
	width: number
	height: number
	slotCount: number
	gridCols: number
	gridRows: number
}

/**
 * Load a folder of pre-sliced GIF tiles. Expects filenames containing a number
 * (e.g. "Standard Pad 1.gif", "Pad 1.gif", "tile_1.gif"). Numbers are 1-based;
 * we map slot 0 = "Pad 1" so it matches Elgato's naming.
 *
 * Layout convention: the first row is filled left-to-right, then the second
 * row, etc. For a 5x3 deck (15 tiles), pad 1..5 = row 0, pad 6..10 = row 1,
 * pad 11..15 = row 2.
 */
export async function loadTileFolder(
	folderPath: string,
	gridCols: number,
	gridRows: number,
): Promise<TileSet> {
	const expected = gridCols * gridRows
	const entries = await readdir(folderPath)
	const gifs = entries
		.filter((e) => e.toLowerCase().endsWith('.gif') || e.toLowerCase().endsWith('.webp'))
		.filter((e) => /\d+/.test(e))

	// Build map: padNumber (1-based) -> file path
	const padToPath = new Map<number, string>()
	for (const file of gifs) {
		const m = file.match(/(\d+)(?!.*\d)/) // last number in the filename
		if (!m) continue
		const padNum = parseInt(m[1], 10)
		if (padNum >= 1 && padNum <= expected && !padToPath.has(padNum)) {
			padToPath.set(padNum, path.join(folderPath, file))
		}
	}

	if (padToPath.size === 0) {
		throw new Error(`No numbered GIF/WebP tiles found in ${folderPath}`)
	}

	const tilesBySlot = new Map<number, DecodedTile>()
	let firstWidth = 0
	let firstHeight = 0

	for (let pad = 1; pad <= expected; pad++) {
		const file = padToPath.get(pad)
		if (!file) continue
		try {
			const tile = await loadGifTile(file)
			if (firstWidth === 0) {
				firstWidth = tile.width
				firstHeight = tile.height
			}
			tilesBySlot.set(pad - 1, tile) // slot is 0-based
		} catch (err) {
			throw new Error(`Failed to decode ${file}: ${(err as Error).message}`)
		}
	}

	return {
		tilesBySlot,
		width: firstWidth,
		height: firstHeight,
		slotCount: tilesBySlot.size,
		gridCols,
		gridRows,
	}
}

export function tileFrame(set: TileSet, slot: number, elapsedMs: number): string | null {
	const tile = set.tilesBySlot.get(slot)
	if (!tile) return null
	const idx = frameAtTime(tile, elapsedMs)
	return tile.frames[idx] ?? null
}
