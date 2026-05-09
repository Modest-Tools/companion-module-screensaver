import * as PImage from 'pureimage'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FONT_FAMILY = 'Roboto'

let fontReady: Promise<void> | null = null

export function ensureFontsLoaded(): Promise<void> {
	if (fontReady) return fontReady
	// Resolve from a candidate list so we work in: dev (src/../assets/fonts/),
	// bundled module (sibling to main.js — extraFiles flattens), and any tests.
	const candidates = [
		path.join(__dirname, 'Roboto-Regular.ttf'), // bundled package layout
		path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Regular.ttf'), // dev layout
	]
	const dir = candidates.map((p) => path.dirname(p)).find((d) => existsSync(path.join(d, 'Roboto-Regular.ttf')))
	if (!dir) {
		fontReady = Promise.reject(new Error('Roboto-Regular.ttf not found in any expected location'))
		return fontReady
	}
	const regular = PImage.registerFont(path.join(dir, 'Roboto-Regular.ttf'), FONT_FAMILY, 400, 'normal')
	const bold = PImage.registerFont(path.join(dir, 'Roboto-Bold.ttf'), FONT_FAMILY, 700, 'normal')
	fontReady = Promise.all([regular.load(), bold.load()]).then(() => undefined)
	return fontReady
}

export type MosaicOptions = {
	quote: string
	author: string
	gridCols: number
	gridRows: number
	tileWidth: number
	tileHeight: number
	quoteWordsRevealed?: number
	authorWordsRevealed?: number
	textColor?: string
	authorColor?: string
	bgColor?: string | null
	padding?: number
	/**
	 * Layout strategy:
	 * - 'row-snap' (default): each line of text fits entirely inside one button row,
	 *   text starts at the top row. Most legible across button bezels.
	 * - 'centered': original behavior — wrap freely, vertically center the block.
	 */
	layout?: 'row-snap' | 'centered'
}

export type MosaicResult = {
	tilesBySlot: Map<number, Buffer>
	width: number
	height: number
	tileWidth: number
	tileHeight: number
}

export function renderMosaic(opts: MosaicOptions): MosaicResult {
	const {
		quote,
		author,
		gridCols,
		gridRows,
		tileWidth,
		tileHeight,
		textColor = '#ffffff',
		authorColor = '#9ae6ff',
		bgColor = '#000000',
		padding = 12,
	} = opts

	const canvasW = gridCols * tileWidth
	const canvasH = gridRows * tileHeight
	const bitmap = PImage.make(canvasW, canvasH)
	const ctx = bitmap.getContext('2d')

	if (bgColor) {
		ctx.fillStyle = bgColor
		ctx.fillRect(0, 0, canvasW, canvasH)
	}
	// pureimage backgrounds default to transparent black; if bgColor is null we leave alpha=0

	const innerW = canvasW - padding * 2
	const innerH = canvasH - padding * 2

	const quoteWords = splitWords(quote)
	const authorWords = splitWords(author)
	const qReveal = opts.quoteWordsRevealed ?? quoteWords.length
	const aReveal = opts.authorWordsRevealed ?? authorWords.length
	const qShown = quoteWords.slice(0, Math.max(0, qReveal)).join(' ')
	const aShown = authorWords.slice(0, Math.max(0, aReveal)).join(' ')
	const authorLine = aShown ? `— ${aShown}` : ''

	const layoutMode = opts.layout ?? 'row-snap'

	if (layoutMode === 'row-snap') {
		drawRowSnapped({
			ctx,
			quote: qShown,
			author: authorLine,
			gridRows,
			tileWidth,
			tileHeight,
			canvasW,
			padding,
			textColor,
			authorColor,
		})
	} else {
		const layout = layoutText({
			ctx,
			quote: qShown,
			author: authorLine,
			maxWidth: innerW,
			maxHeight: innerH,
		})
		const totalH = layout.lines.reduce((acc, l) => acc + l.height, 0)
		let y = padding + Math.max(0, (innerH - totalH) / 2)
		for (const line of layout.lines) {
			ctx.font = line.font
			ctx.fillStyle = line.isAuthor ? authorColor : textColor
			ctx.textBaseline = 'top'
			const textW = PImage.measureText(ctx, line.text).width
			const x = padding + Math.max(0, (innerW - textW) / 2)
			if (line.text) ctx.fillText(line.text, x, y)
			y += line.height
		}
	}

	const tilesBySlot = sliceBitmapToTiles(bitmap, gridCols, gridRows, tileWidth, tileHeight)
	return { tilesBySlot, width: canvasW, height: canvasH, tileWidth, tileHeight }
}

function splitWords(s: string): string[] {
	return s.split(/\s+/).filter((w) => w.length > 0)
}

/**
 * Row-snapped layout: each line of text fits inside a single button row, so
 * lines never straddle the bezels between rows of the deck. Top-aligned, with
 * the author (if present) reserved for the bottom row when the quote needs
 * fewer rows than are available.
 */
function drawRowSnapped(args: {
	ctx: ReturnType<ReturnType<typeof PImage.make>['getContext']>
	quote: string
	author: string
	gridRows: number
	tileWidth: number
	tileHeight: number
	canvasW: number
	padding: number
	textColor: string
	authorColor: string
}): void {
	const { ctx, quote, author, gridRows, tileHeight, canvasW, padding, textColor, authorColor } = args
	const horizontalPadding = padding
	const usableWidth = canvasW - horizontalPadding * 2
	// Reserve last row for the author if there's an author and more than one row.
	const authorRowReserved = !!author && gridRows > 1
	const quoteRowsAvailable = authorRowReserved ? gridRows - 1 : gridRows

	// Pick the largest font size where the quote fits in <= quoteRowsAvailable rows
	// AND each line fits horizontally.
	let chosen: { fontSize: number; lines: string[] } | null = null
	for (let fontSize = Math.floor(tileHeight * 0.85); fontSize >= 14; fontSize -= 2) {
		const font = `${fontSize}pt ${FONT_FAMILY}`
		ctx.font = font
		const lines = wrapLine(ctx, quote, usableWidth)
		if (lines.length <= quoteRowsAvailable) {
			chosen = { fontSize, lines }
			break
		}
	}
	if (!chosen) {
		// Fallback: smallest size, allow overflow
		ctx.font = `14pt ${FONT_FAMILY}`
		chosen = { fontSize: 14, lines: wrapLine(ctx, quote, usableWidth).slice(0, quoteRowsAvailable) }
	}

	// Draw quote: each line vertically centered inside its row.
	ctx.font = `${chosen.fontSize}pt ${FONT_FAMILY}`
	ctx.fillStyle = textColor
	ctx.textBaseline = 'middle'
	for (let i = 0; i < chosen.lines.length; i++) {
		const text = chosen.lines[i]
		const rowTop = i * tileHeight
		const yMid = rowTop + tileHeight / 2
		const textW = PImage.measureText(ctx, text).width
		const x = horizontalPadding + Math.max(0, (usableWidth - textW) / 2)
		ctx.fillText(text, x, yMid)
	}

	// Draw author into the last row if reserved.
	if (authorRowReserved) {
		// Pick author font size: aim for ~half the tile height
		let authorFontSize = Math.floor(tileHeight * 0.45)
		for (; authorFontSize >= 10; authorFontSize -= 1) {
			ctx.font = `${authorFontSize}pt ${FONT_FAMILY}`
			if (PImage.measureText(ctx, author).width <= usableWidth) break
		}
		ctx.font = `${authorFontSize}pt ${FONT_FAMILY}`
		ctx.fillStyle = authorColor
		ctx.textBaseline = 'middle'
		const rowTop = (gridRows - 1) * tileHeight
		const yMid = rowTop + tileHeight / 2
		const textW = PImage.measureText(ctx, author).width
		const x = horizontalPadding + Math.max(0, (usableWidth - textW) / 2)
		ctx.fillText(author, x, yMid)
	}
}

type Line = { text: string; font: string; height: number; isAuthor: boolean }

function layoutText(args: {
	ctx: ReturnType<ReturnType<typeof PImage.make>['getContext']>
	quote: string
	author: string
	maxWidth: number
	maxHeight: number
}): { lines: Line[] } {
	const { ctx, quote, author, maxWidth, maxHeight } = args

	for (let fontSize = 56; fontSize >= 12; fontSize -= 2) {
		const quoteFont = `${fontSize}pt ${FONT_FAMILY}`
		const lineHeight = Math.round(fontSize * 1.15)

		const authorFontSize = Math.max(10, Math.round(fontSize * 0.55))
		const authorFont = `${authorFontSize}pt ${FONT_FAMILY}`
		const authorLineHeight = Math.round(authorFontSize * 1.2)

		ctx.font = quoteFont
		const quoteLines = wrapLine(ctx, quote, maxWidth)

		ctx.font = authorFont
		const authorLines = author ? wrapLine(ctx, author, maxWidth) : []

		const totalH =
			quoteLines.length * lineHeight + (authorLines.length ? authorLines.length * authorLineHeight + 8 : 0)

		if (totalH <= maxHeight) {
			const lines: Line[] = []
			for (const t of quoteLines) lines.push({ text: t, font: quoteFont, height: lineHeight, isAuthor: false })
			if (authorLines.length) {
				lines.push({ text: '', font: authorFont, height: 8, isAuthor: false })
				for (const t of authorLines) lines.push({ text: t, font: authorFont, height: authorLineHeight, isAuthor: true })
			}
			return { lines }
		}
	}

	// Fallback
	const fontSize = 12
	const quoteFont = `${fontSize}pt ${FONT_FAMILY}`
	ctx.font = quoteFont
	return {
		lines: wrapLine(ctx, quote, maxWidth).map((t) => ({
			text: t,
			font: quoteFont,
			height: 14,
			isAuthor: false,
		})),
	}
}

function wrapLine(
	ctx: ReturnType<ReturnType<typeof PImage.make>['getContext']>,
	text: string,
	maxWidth: number,
): string[] {
	if (!text) return []
	const words = text.split(/\s+/)
	const lines: string[] = []
	let current = ''
	for (const word of words) {
		const trial = current ? current + ' ' + word : word
		if (PImage.measureText(ctx, trial).width <= maxWidth) {
			current = trial
		} else {
			if (current) lines.push(current)
			if (PImage.measureText(ctx, word).width > maxWidth) {
				let chunk = ''
				for (const ch of word) {
					if (PImage.measureText(ctx, chunk + ch).width <= maxWidth) chunk += ch
					else {
						if (chunk) lines.push(chunk)
						chunk = ch
					}
				}
				current = chunk
			} else {
				current = word
			}
		}
	}
	if (current) lines.push(current)
	return lines
}

function sliceBitmapToTiles(
	bitmap: ReturnType<typeof PImage.make>,
	cols: number,
	rows: number,
	tileW: number,
	tileH: number,
): Map<number, Buffer> {
	const out = new Map<number, Buffer>()
	const totalW = bitmap.width
	const src = bitmap.data
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const slot = r * cols + c
			const tileBuf = Buffer.alloc(tileW * tileH * 4)
			for (let y = 0; y < tileH; y++) {
				const srcOff = ((r * tileH + y) * totalW + c * tileW) * 4
				const dstOff = y * tileW * 4
				tileBuf.set(src.subarray(srcOff, srcOff + tileW * 4), dstOff)
			}
			out.set(slot, tileBuf)
		}
	}
	return out
}
