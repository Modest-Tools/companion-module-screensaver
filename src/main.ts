import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { IdleTracker } from './idleTracker.js'
import { loadTileFolder, tileFrame, type TileSet } from './screensaverImage.js'
import { generateSetupFile } from './setupFile.js'
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
	private active = false

	private idleCheckInterval: NodeJS.Timeout | null = null
	private heartbeatInterval: NodeJS.Timeout | null = null
	private tileInterval: NodeJS.Timeout | null = null
	private tiles: TileSet | null = null
	private tileLoadStartedAt = 0
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
			this.updateFeedbacks()
			this.updateVariableDefinitions()
			UpdatePresets(this)
			this.resetVariables()

			await this.refreshLibrary()
			await this.loadTilesFromConfig()
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
			targetPage: Number(c.targetPage ?? 99),
			returnPage: Number(c.returnPage ?? 1),
			screensaverLibraryPath: String(c.screensaverLibraryPath ?? defaultLibraryPath()),
			screensaverId: String(c.screensaverId ?? ''),
			deckSize,
			gridCols: Number(c.gridCols ?? gridFromDeck.cols),
			gridRows: Number(c.gridRows ?? gridFromDeck.rows),
			tileFps: Number(c.tileFps ?? 15),
			tileFolder: String(c.tileFolder ?? ''),
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
			this.checkFeedbacks('screensaver_tile')
		} catch (err) {
			this.log('warn', `Failed to load tile folder: ${(err as Error).message}`)
			this.tiles = null
		}
	}

	async generateSetupFile(opts: { outputPath: string }): Promise<void> {
		try {
			const finalPath = await generateSetupFile({
				connectionId: this.id,
				connectionLabel: this.label,
				connectionVersionId: 'dev',
				moduleId: 'screensaver',
				config: this.config,
				outputPath: opts.outputPath,
			})
			const t = this.config.targetPage
			const r = this.config.returnPage
			const label = this.label
			this.log(
				'info',
				[
					`Setup file written: ${finalPath}`,
					``,
					`Next steps:`,
					`  1. Companion → Settings → Import / Export → Import → drop this file → pick page ${t}.`,
					`     Your screensaver page is now installed at page ${t}.`,
					``,
					`  2. Add 3 Triggers (Triggers tab → New Trigger) so the deck switches pages automatically:`,
					``,
					`     Trigger A — "Screensaver: switch to billboard"`,
					`       Event: Variable: Variable value changes → variable "${label}: screensaver_active" → equals → "1"`,
					`       Action: internal → Surface: Set to page → surface = (your deck) → page = ${t}`,
					``,
					`     Trigger B — "Screensaver: return to main"`,
					`       Event: Variable: Variable value changes → variable "${label}: screensaver_active" → equals → "0"`,
					`       Action: internal → Surface: Set to page → surface = (your deck) → page = ${r}`,
					``,
					`     Trigger C — "Screensaver: reset idle on any press"`,
					`       Event: Button → On any button press`,
					`       Action: ${label} → Reset idle timer`,
					``,
					`  3. After ${this.config.idleMinutes} minutes of inactivity the deck will switch to page ${t} and play the screensaver. Any button press will exit and return to page ${r}.`,
				].join('\n'),
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
		if (!this.tiles) return null
		const elapsed = Date.now() - this.tileLoadStartedAt
		const buf = tileFrame(this.tiles, slot, elapsed)
		if (!buf) return null
		return {
			imageBuffer: buf,
			imageBufferEncoding: { pixelFormat: 'RGBA' },
			imageBufferPosition: { x: 0, y: 0, width: this.tiles.width, height: this.tiles.height },
		}
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
		if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
		if (this.tileInterval) clearInterval(this.tileInterval)
		this.idleCheckInterval = null
		this.heartbeatInterval = null
		this.tileInterval = null
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
		if (!opts.keepActive) {
			vals['screensaver_active'] = '0'
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
		this.checkFeedbacks('screensaver_active', 'screensaver_tile')
	}

	stopScreensaver(reason: 'manual' | 'button'): void {
		if (!this.active) return
		this.active = false
		this.log('info', `Stopping screensaver (${reason})`)
		this.setVariableValues({ screensaver_active: '0' })
		this.checkFeedbacks('screensaver_active', 'screensaver_idle_warning', 'screensaver_tile')
	}
}

export default ScreensaverInstance
