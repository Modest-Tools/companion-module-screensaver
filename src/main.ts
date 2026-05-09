import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { chunkText, padOrTruncate } from './chunker.js'
import { QuoteSource, type Quote } from './quoteSource.js'
import { IdleTracker } from './idleTracker.js'
import { loadTileFolder, tileFrame, type TileSet } from './screensaverImage.js'
import { generateSetupFile } from './setupFile.js'
import { renderMosaic, ensureFontsLoaded, type MosaicResult } from './textMosaic.js'
import {
	scanLibrary,
	installScreensaverFromZip,
	pickResolutionFolder,
	defaultLibraryPath,
	ensureLibraryExists,
	type InstalledScreensaver,
} from './screensaverLibrary.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

function gridForDeckSize(size: 'mini' | 'standard' | 'xl' | 'plus'): { cols: number; rows: number } {
	switch (size) {
		case 'mini':
			return { cols: 3, rows: 2 }
		case 'xl':
			return { cols: 8, rows: 4 }
		case 'plus':
			return { cols: 4, rows: 2 }
		case 'standard':
		default:
			return { cols: 5, rows: 3 }
	}
}

class ScreensaverInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig

	private idle = new IdleTracker()
	private quotes = new QuoteSource()
	private active = false

	private idleCheckInterval: NodeJS.Timeout | null = null
	private refreshInterval: NodeJS.Timeout | null = null
	private revealTimeouts = new Set<NodeJS.Timeout>()
	private heartbeatInterval: NodeJS.Timeout | null = null
	private tileInterval: NodeJS.Timeout | null = null
	private tiles: TileSet | null = null
	private tileLoadStartedAt = 0
	private mosaic: MosaicResult | null = null
	private currentQuote: { quote: string; author: string } | null = null
	private mosaicWordsRevealed = 0
	private mosaicAuthorWordsRevealed = 0
	private library: InstalledScreensaver[] = []

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		try {
			this.log('info', `init starting with config keys: ${Object.keys(config ?? {}).join(',')}`)
			this.config = this.applyDefaults(config)
			this.idle.markActivity()

			this.updateActions()
			this.log('info', 'actions updated')
			this.updateFeedbacks()
			this.log('info', 'feedbacks updated')
			this.updateVariableDefinitions()
			this.log('info', `variable definitions updated (quoteSlots=${this.config.quoteSlots}, authorSlots=${this.config.authorSlots})`)
			UpdatePresets(this)
			this.log('info', 'presets updated')
			this.resetVariables()
			this.log('info', 'variables reset')

			await this.refreshLibrary()
			await this.loadTilesFromConfig()
			try {
				await ensureFontsLoaded()
				this.log('info', 'mosaic fonts loaded')
			} catch (err) {
				this.log('warn', `Mosaic fonts failed to load (text-mosaic mode disabled): ${(err as Error).message}`)
			}
			this.startTimers()
			this.updateStatus(InstanceStatus.Ok)
			this.log('info', 'init complete')
		} catch (err) {
			this.log('error', `init failed: ${(err as Error).stack ?? err}`)
			this.updateStatus(InstanceStatus.UnknownError, (err as Error).message)
			throw err
		}
	}

	async destroy(): Promise<void> {
		this.clearAllTimers()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const old = this.config
		this.config = this.applyDefaults(config)
		this.updateVariableDefinitions()
		UpdatePresets(this)
		this.resetVariables({ keepActive: true })
		if (this.config.screensaverLibraryPath !== old?.screensaverLibraryPath) {
			await this.refreshLibrary()
		}
		const tileSourceChanged =
			this.config.tileFolder !== old?.tileFolder ||
			this.config.screensaverId !== old?.screensaverId ||
			this.config.deckSize !== old?.deckSize
		if (tileSourceChanged) {
			await this.loadTilesFromConfig()
		}
		if (this.active && this.currentQuote) {
			this.renderMosaicNow()
			this.checkFeedbacks('screensaver_tile')
		}
		this.startTimers()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields({
			availableScreensavers: this.library.map((s) => ({ id: s.id, name: s.name })),
		})
	}

	updateActions(): void {
		UpdateActions(this)
	}
	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}
	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	private applyDefaults(c: Partial<ModuleConfig>): ModuleConfig {
		const deckSize = (c.deckSize as ModuleConfig['deckSize']) ?? 'standard'
		const gridFromDeck = gridForDeckSize(deckSize)
		return {
			idleMinutes: Number(c.idleMinutes ?? 10),
			refreshSeconds: Number(c.refreshSeconds ?? 180),
			targetPage: Number(c.targetPage ?? 1),
			quoteSource: (c.quoteSource as ModuleConfig['quoteSource']) ?? 'built-in',
			customQuoteUrl: String(c.customQuoteUrl ?? ''),
			maxCharsPerChunk: Number(c.maxCharsPerChunk ?? 12),
			quoteRevealDelayMs: Number(c.quoteRevealDelayMs ?? 1000),
			authorRevealDelayMs: Number(c.authorRevealDelayMs ?? 1000),
			authorStartDelayMs: Number(c.authorStartDelayMs ?? 2000),
			quoteSlots: Number(c.quoteSlots ?? 10),
			authorSlots: Number(c.authorSlots ?? 5),
			tileFolder: String(c.tileFolder ?? ''),
			gridCols: Number(c.gridCols ?? gridFromDeck.cols),
			gridRows: Number(c.gridRows ?? gridFromDeck.rows),
			tileFps: Number(c.tileFps ?? 15),
			displayMode: (c.displayMode as ModuleConfig['displayMode']) ?? 'text-mosaic',
			tilePixelSize: Number(c.tilePixelSize ?? 72),
			mosaicTextColor: String(c.mosaicTextColor ?? '#ffffff'),
			mosaicAuthorColor: String(c.mosaicAuthorColor ?? '#9ae6ff'),
			mosaicBgColor: String(c.mosaicBgColor ?? '#000000'),
			mosaicWordRevealMs: Number(c.mosaicWordRevealMs ?? 220),
			mosaicLayout: (c.mosaicLayout as ModuleConfig['mosaicLayout']) ?? 'row-snap',
			screensaverLibraryPath: String(c.screensaverLibraryPath ?? defaultLibraryPath()),
			screensaverId: String(c.screensaverId ?? ''),
			deckSize: (c.deckSize as ModuleConfig['deckSize']) ?? 'standard',
		}
	}

	private async refreshLibrary(): Promise<void> {
		const libPath = this.config.screensaverLibraryPath?.trim() || defaultLibraryPath()
		try {
			await ensureLibraryExists(libPath)
			this.library = await scanLibrary(libPath)
			this.log('info', `Library scan: ${this.library.length} screensaver(s) found at ${libPath}`)
		} catch (err) {
			this.log('warn', `Library scan failed at ${libPath}: ${(err as Error).message}`)
			this.library = []
		}
	}

	private resolveTileFolder(): string | null {
		const legacy = this.config.tileFolder?.trim()
		if (legacy) return legacy
		const id = this.config.screensaverId?.trim()
		if (!id) return null
		const ss = this.library.find((s) => s.id === id)
		if (!ss) return null
		const { folder, chosenSize } = pickResolutionFolder(ss, this.config.deckSize)
		if (folder && chosenSize !== this.config.deckSize) {
			this.log('info', `No "${this.config.deckSize}" tiles in "${ss.name}"; using "${chosenSize}" instead.`)
		}
		return folder
	}

	async installScreensaverZip(opts: { zipPath: string; displayName?: string }): Promise<void> {
		const libPath = this.config.screensaverLibraryPath?.trim() || defaultLibraryPath()
		try {
			const result = await installScreensaverFromZip(opts.zipPath, libPath, opts.displayName)
			this.log('info', `Installed screensaver "${result.screensaverId}" to ${result.installedTo}`)
			await this.refreshLibrary()
		} catch (err) {
			this.log('error', `Failed to install screensaver from zip: ${(err as Error).message}`)
		}
	}

	private async loadTilesFromConfig(): Promise<void> {
		const folder = this.resolveTileFolder()
		if (!folder) {
			this.tiles = null
			return
		}
		try {
			this.log('info', `Loading screensaver tiles from ${folder}`)
			this.tiles = await loadTileFolder(folder, this.config.gridCols, this.config.gridRows)
			this.tileLoadStartedAt = Date.now()
			this.log(
				'info',
				`Loaded ${this.tiles.slotCount} tiles (${this.tiles.width}x${this.tiles.height})`,
			)
			this.checkFeedbacks('screensaver_tile')
		} catch (err) {
			this.log('warn', `Failed to load tile folder: ${(err as Error).message}`)
			this.tiles = null
		}
	}

	async generateSetupFile(opts: { outputPath: string; includeRefreshButton: boolean }): Promise<void> {
		try {
			const finalPath = await generateSetupFile({
				connectionId: this.id,
				connectionLabel: this.label,
				connectionVersionId: 'dev',
				moduleId: 'screensaver',
				config: this.config,
				outputPath: opts.outputPath,
				includeRefreshButton: opts.includeRefreshButton,
			})
			this.log(
				'info',
				`Setup file written: ${finalPath}\n` +
					`In Companion: Settings → Import / Export → Import → drop this file → pick page ${this.config.targetPage}.`,
			)
		} catch (err) {
			this.log('error', `Failed to generate setup file: ${(err as Error).message}`)
		}
	}

	getTileImageBuffer(
		slot: number,
		_image?: { readonly width: number; readonly height: number },
	): {
		imageBuffer: string | Buffer
		imageBufferEncoding: { pixelFormat: 'RGBA' }
		imageBufferPosition?: { x: number; y: number; width: number; height: number }
	} | null {
		const mode = this.config.displayMode

		if (mode === 'text-over-gif' && this.mosaic && this.tiles) {
			const composed = this.compositeMosaicOverGifTile(slot)
			if (composed) {
				return {
					imageBuffer: composed,
					imageBufferEncoding: { pixelFormat: 'RGBA' },
					imageBufferPosition: { x: 0, y: 0, width: this.tiles.width, height: this.tiles.height },
				}
			}
		}

		if ((mode === 'text-mosaic' || mode === 'text-over-gif') && this.mosaic) {
			const tileBuf = this.mosaic.tilesBySlot.get(slot)
			if (tileBuf) {
				return {
					imageBuffer: tileBuf,
					imageBufferEncoding: { pixelFormat: 'RGBA' },
					imageBufferPosition: { x: 0, y: 0, width: this.mosaic.tileWidth, height: this.mosaic.tileHeight },
				}
			}
		}

		if ((mode === 'gif-only' || mode === 'text-over-gif') && this.tiles) {
			const elapsed = Date.now() - this.tileLoadStartedAt
			const buf = tileFrame(this.tiles, slot, elapsed)
			if (!buf) return null
			return {
				imageBuffer: buf,
				imageBufferEncoding: { pixelFormat: 'RGBA' },
				imageBufferPosition: { x: 0, y: 0, width: this.tiles.width, height: this.tiles.height },
			}
		}

		return null
	}

	private renderMosaicNow(): void {
		if (!this.currentQuote) {
			this.mosaic = null
			return
		}
		const overGif = this.config.displayMode === 'text-over-gif' && !!this.tiles
		const tileW = overGif ? this.tiles!.width : Math.max(32, this.config.tilePixelSize || 72)
		const tileH = overGif ? this.tiles!.height : Math.max(32, this.config.tilePixelSize || 72)
		const bg = overGif ? null : this.config.mosaicBgColor
		this.mosaic = renderMosaic({
			quote: this.currentQuote.quote,
			author: this.currentQuote.author,
			gridCols: this.config.gridCols,
			gridRows: this.config.gridRows,
			tileWidth: tileW,
			tileHeight: tileH,
			quoteWordsRevealed: this.mosaicWordsRevealed,
			authorWordsRevealed: this.mosaicAuthorWordsRevealed,
			textColor: this.config.mosaicTextColor,
			authorColor: this.config.mosaicAuthorColor,
			bgColor: bg,
			layout: this.config.mosaicLayout,
		})
	}

	private compositeMosaicOverGifTile(slot: number): Buffer | null {
		if (!this.mosaic || !this.tiles) return null
		const mosaicTile = this.mosaic.tilesBySlot.get(slot)
		if (!mosaicTile) return null
		const elapsed = Date.now() - this.tileLoadStartedAt
		const gifFrame = tileFrame(this.tiles, slot, elapsed)
		if (!gifFrame) return Buffer.from(mosaicTile)
		const gifBuf = Buffer.from(gifFrame, 'base64')
		// Both buffers must be same byte length
		if (gifBuf.length !== mosaicTile.length) return Buffer.from(mosaicTile)
		const out = Buffer.alloc(gifBuf.length)
		for (let i = 0; i < gifBuf.length; i += 4) {
			const sa = mosaicTile[i + 3] / 255
			const ia = 1 - sa
			out[i] = Math.round(mosaicTile[i] * sa + gifBuf[i] * ia)
			out[i + 1] = Math.round(mosaicTile[i + 1] * sa + gifBuf[i + 1] * ia)
			out[i + 2] = Math.round(mosaicTile[i + 2] * sa + gifBuf[i + 2] * ia)
			out[i + 3] = 255
		}
		return out
	}

	private startTimers(): void {
		this.clearAllTimers()
		this.idleCheckInterval = setInterval(() => this.tickIdleCheck(), 1000)
		this.heartbeatInterval = setInterval(() => this.tickHeartbeat(), 1000)
		this.startTileTicker()
	}

	private startTileTicker(): void {
		if (this.tileInterval) clearInterval(this.tileInterval)
		this.tileInterval = null
		if (!this.tiles) return
		const fps = Math.max(1, Math.min(30, this.config.tileFps || 15))
		const periodMs = Math.round(1000 / fps)
		this.tileInterval = setInterval(() => {
			this.checkFeedbacks('screensaver_tile')
		}, periodMs)
	}

	private clearAllTimers(): void {
		if (this.idleCheckInterval) clearInterval(this.idleCheckInterval)
		if (this.refreshInterval) clearInterval(this.refreshInterval)
		if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
		if (this.tileInterval) clearInterval(this.tileInterval)
		this.idleCheckInterval = null
		this.refreshInterval = null
		this.heartbeatInterval = null
		this.tileInterval = null
		this.clearRevealTimeouts()
	}

	private clearRevealTimeouts(): void {
		for (const t of this.revealTimeouts) clearTimeout(t)
		this.revealTimeouts.clear()
	}

	private scheduleReveal(fn: () => void, ms: number): void {
		const t = setTimeout(() => {
			this.revealTimeouts.delete(t)
			fn()
		}, ms)
		this.revealTimeouts.add(t)
	}

	private tickIdleCheck(): void {
		if (!this.active && this.idle.hasExceeded(this.config.idleMinutes)) {
			void this.startScreensaver('idle')
		}
		this.checkFeedbacks('screensaver_idle_warning', 'screensaver_active')
	}

	private tickHeartbeat(): void {
		this.setVariableValues({
			seconds_since_last_press: String(this.idle.secondsSinceLastInput()),
		})
	}

	private resetVariables(opts: { keepActive?: boolean } = {}): void {
		const vals: Record<string, string> = {}
		for (let i = 1; i <= this.config.quoteSlots; i++) vals[`quote_chunk_${i}`] = ''
		for (let i = 1; i <= this.config.authorSlots; i++) vals[`author_chunk_${i}`] = ''
		if (!opts.keepActive) {
			vals['screensaver_active'] = '0'
			vals['current_quote'] = ''
			vals['current_author'] = ''
			vals['last_quote_fetched_at'] = ''
		}
		vals['seconds_since_last_press'] = String(this.idle.secondsSinceLastInput())
		this.setVariableValues(vals)
	}

	// === Public API used by actions/feedbacks ===

	isScreensaverActive(): boolean {
		return this.active
	}

	idleSecondsRemaining(): number | null {
		if (this.active) return null
		return this.idle.secondsRemaining(this.config.idleMinutes)
	}

	markActivity(): void {
		this.idle.markActivity()
		if (this.active) this.stopScreensaver('button')
	}

	async startScreensaver(reason: 'idle' | 'manual'): Promise<void> {
		if (this.active) return
		this.active = true
		this.log('info', `Starting screensaver (${reason})`)
		this.setVariableValues({ screensaver_active: '1' })
		this.checkFeedbacks('screensaver_active')

		await this.refreshQuoteAndReveal()

		if (this.refreshInterval) clearInterval(this.refreshInterval)
		this.refreshInterval = setInterval(
			() => {
				void this.refreshQuoteAndReveal()
			},
			Math.max(10, this.config.refreshSeconds) * 1000,
		)
	}

	stopScreensaver(reason: 'manual' | 'button'): void {
		if (!this.active) return
		this.active = false
		this.log('info', `Stopping screensaver (${reason})`)
		this.clearRevealTimeouts()
		if (this.refreshInterval) clearInterval(this.refreshInterval)
		this.refreshInterval = null
		this.mosaic = null
		this.currentQuote = null
		this.mosaicWordsRevealed = 0
		this.mosaicAuthorWordsRevealed = 0
		this.setVariableValues({ screensaver_active: '0' })
		this.checkFeedbacks('screensaver_active', 'screensaver_idle_warning', 'screensaver_tile')
	}

	async refreshQuoteAndReveal(): Promise<void> {
		let q: Quote
		try {
			if (this.config.quoteSource === 'custom-url' && this.config.customQuoteUrl.trim()) {
				q = await this.quotes.fetchFromUrl(this.config.customQuoteUrl.trim())
			} else {
				q = this.quotes.pickBuiltIn()
			}
		} catch (err) {
			this.log('warn', `Failed to fetch quote, falling back to built-in: ${(err as Error).message}`)
			q = this.quotes.pickBuiltIn()
		}
		this.runRevealSequence(q)
	}

	private runRevealSequence(q: Quote): void {
		this.clearRevealTimeouts()
		this.currentQuote = { quote: q.quote, author: q.author }

		// Always update the always-on variables so user expressions still work
		const baseVars: Record<string, string> = {
			current_quote: q.quote,
			current_author: q.author,
			last_quote_fetched_at: new Date().toISOString(),
		}
		for (let i = 1; i <= this.config.quoteSlots; i++) baseVars[`quote_chunk_${i}`] = ''
		for (let i = 1; i <= this.config.authorSlots; i++) baseVars[`author_chunk_${i}`] = ''
		this.setVariableValues(baseVars)

		const mode = this.config.displayMode
		if (mode === 'text-mosaic' || mode === 'text-over-gif') {
			this.runMosaicReveal(q)
		} else if (mode === 'text-vars') {
			this.runVariableReveal(q)
		}
		// gif-only: nothing text-related to reveal
	}

	private runMosaicReveal(q: Quote): void {
		const quoteWords = q.quote.split(/\s+/).filter(Boolean)
		const authorWords = q.author.split(/\s+/).filter(Boolean)
		const stepMs = Math.max(0, this.config.mosaicWordRevealMs)

		// Reset reveal counters
		this.mosaicWordsRevealed = stepMs === 0 ? quoteWords.length : 0
		this.mosaicAuthorWordsRevealed = stepMs === 0 ? authorWords.length : 0
		this.renderMosaicNow()
		this.checkFeedbacks('screensaver_tile')

		if (stepMs === 0) return

		for (let i = 1; i <= quoteWords.length; i++) {
			const n = i
			this.scheduleReveal(() => {
				this.mosaicWordsRevealed = n
				this.renderMosaicNow()
				this.checkFeedbacks('screensaver_tile')
			}, stepMs * n)
		}

		const authorBase = stepMs * quoteWords.length + this.config.authorStartDelayMs
		for (let i = 1; i <= authorWords.length; i++) {
			const n = i
			this.scheduleReveal(() => {
				this.mosaicAuthorWordsRevealed = n
				this.renderMosaicNow()
				this.checkFeedbacks('screensaver_tile')
			}, authorBase + stepMs * n)
		}
	}

	private runVariableReveal(q: Quote): void {
		const quoteChunks = padOrTruncate(chunkText(q.quote, this.config.maxCharsPerChunk), this.config.quoteSlots)
		const authorChunks = padOrTruncate(chunkText(q.author, this.config.maxCharsPerChunk), this.config.authorSlots)
		const realQuoteCount = Math.min(chunkText(q.quote, this.config.maxCharsPerChunk).length, this.config.quoteSlots)
		const realAuthorCount = Math.min(
			chunkText(q.author, this.config.maxCharsPerChunk).length,
			this.config.authorSlots,
		)

		for (let i = 0; i < realQuoteCount; i++) {
			const slot = i + 1
			const chunk = quoteChunks[i]
			this.scheduleReveal(() => {
				this.setVariableValues({ [`quote_chunk_${slot}`]: chunk })
			}, this.config.quoteRevealDelayMs * (i + 1))
		}

		const authorBaseDelay =
			this.config.quoteRevealDelayMs * realQuoteCount + this.config.authorStartDelayMs

		for (let i = 0; i < realAuthorCount; i++) {
			const slot = i + 1
			const chunk = authorChunks[i]
			this.scheduleReveal(() => {
				this.setVariableValues({ [`author_chunk_${slot}`]: chunk })
			}, authorBaseDelay + this.config.authorRevealDelayMs * (i + 1))
		}
	}
}

export default ScreensaverInstance
