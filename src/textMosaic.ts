import * as PImage from 'pureimage'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FONT_FAMILY = 'Roboto'

let fontReady: Promise<void> | null = null

export function ensureFontsLoaded(): Promise<void> {
	if (fontReady) return fontReady
	const regularPath = path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Regular.ttf')
	const boldPath = path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Bold.ttf')
	const regular = PImage.registerFont(regularPath, FONT_FAMILY, 400, 'normal')
	const bold = PImage.registerFont(boldPath, FONT_FAMILY, 700, 'normal')
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

	const tilesBySlot = sliceBitmapToTiles(bitmap, gridCols, gridRows, tileWidth, tileHeight)
	return { tilesBySlot, width: canvasW, height: canvasH, tileWidth, tileHeight }
}

function splitWords(s: string): string[] {
	return s.split(/\s+/).filter((w) => w.length > 0)
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
