import path from 'node:path'
import os from 'node:os'
import { stat, readdir } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
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
	sanitizeFolderName,
	isScreensaverZip,
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

function expandHome(p: string): string {
	if (!p) return p
	if (p === '~') return os.homedir()
	if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
	return p
}

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
	private incomingScanInterval: NodeJS.Timeout | null = null
	private tiles: TileSet | null = null
	private tileLoadStartedAt = 0
	private library: InstalledScreensaver[] = []
	private failedAutoInstalls = new Set<string>()
	private skipNonScreensaverZips = new Set<string>()

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
			await this.scanIncomingZips()
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
		if (this.config.incomingZipFolder !== old?.incomingZipFolder) {
			this.failedAutoInstalls.clear()
			this.skipNonScreensaverZips.clear()
			await this.scanIncomingZips()
			this.updateActions()
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
			surfaceIds: String(c.surfaceIds ?? ''),
			screensaverLibraryPath: String(c.screensaverLibraryPath ?? defaultLibraryPath()),
			incomingZipFolder: String(c.incomingZipFolder ?? '~/Downloads'),
			screensaverId: String(c.screensaverId ?? ''),
			deckSize,
			gridCols: Number(c.gridCols ?? gridFromDeck.cols),
			gridRows: Number(c.gridRows ?? gridFromDeck.rows),
			tileFps: Number(c.tileFps ?? 15),
			tileFolder: String(c.tileFolder ?? ''),
		}
	}

	private getIncomingFolder(): string {
		return expandHome(this.config?.incomingZipFolder?.trim() || '~/Downloads')
	}

	private getLibraryPath(): string {
		return expandHome(this.config?.screensaverLibraryPath?.trim() || defaultLibraryPath())
	}

	listIncomingZips(): string[] {
		const folder = this.getIncomingFolder()
		try {
			return readdirSync(folder)
				.filter((name) => name.toLowerCase().endsWith('.zip') && !name.startsWith('.'))
				.sort()
		} catch {
			return []
		}
	}

	resolveIncomingZip(filename: string): string {
		return path.join(this.getIncomingFolder(), filename)
	}

	private async scanIncomingZips(): Promise<void> {
		const folder = this.getIncomingFolder()
		const libPath = this.getLibraryPath()

		if (path.resolve(folder) === path.resolve(libPath)) {
			this.log(
				'warn',
				`Auto-install disabled: incoming folder ("${folder}") is the same as the library folder. Set them to different paths to re-enable.`,
			)
			return
		}

		let names: string[]
		try {
			names = (await readdir(folder)).filter((n) => n.toLowerCase().endsWith('.zip') && !n.startsWith('.'))
		} catch {
			return
		}

		const installedIds = new Set(this.library.map((s) => s.id))
		let newlyInstalled = 0

		for (const name of names) {
			const full = path.join(folder, name)
			const baseName = path.basename(name, path.extname(name))
			const safeName = sanitizeFolderName(baseName)
			if (installedIds.has(safeName)) continue
			if (this.failedAutoInstalls.has(full)) continue
			if (this.skipNonScreensaverZips.has(full)) continue

			if (!isScreensaverZip(full)) {
				this.skipNonScreensaverZips.add(full)
				this.log('debug', `Skipping ${name}: doesn't look like an Elgato screensaver zip.`)
				continue
			}

			this.log('info', `Auto-installing zip from incoming folder: ${name}`)
			try {
				const result = await installScreensaverFromZip(full, libPath, undefined)
				this.log('info', `✓ Auto-installed "${result.screensaverId}" from ${name}`)
				newlyInstalled++
			} catch (err) {
				this.log('warn', `Auto-install failed for ${name}: ${(err as Error).message}`)
				this.failedAutoInstalls.add(full)
			}
		}

		if (newlyInstalled > 0) {
			await this.refreshLibrary()
			this.updateActions()
		}
	}

	private async refreshLibrary(): Promise<void> {
		const libPath = this.getLibraryPath()
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
		const libPath = this.getLibraryPath()
		const expandedZip = expandHome(opts.zipPath)
		const ts = new Date().toISOString().slice(11, 19)

		this.log('info', `Installing screensaver from ${expandedZip} → ${libPath}`)
		this.setVariableValues({ last_install_result: `Installing ${path.basename(expandedZip)}…`, last_install_at: ts })
		this.updateStatus(InstanceStatus.Connecting, 'Installing zip…')

		try {
			let st
			try {
				st = await stat(expandedZip)
			} catch {
				const msg = `Zip not found at "${expandedZip}". Use ~/ for your home folder or paste the absolute path to a .zip file.`
				this.log('error', msg)
				this.setVariableValues({ last_install_result: `✗ ${msg}`, last_install_at: ts })
				this.updateStatus(InstanceStatus.Ok)
				return
			}
			if (st.isDirectory()) {
				const msg = `"${expandedZip}" is a folder, not a .zip file. Pick a specific file (or drop the .zip into the connection's "Incoming zip folder" for auto-install).`
				this.log('error', msg)
				this.setVariableValues({ last_install_result: `✗ ${msg}`, last_install_at: ts })
				this.updateStatus(InstanceStatus.Ok)
				return
			}

			const result = await installScreensaverFromZip(expandedZip, libPath, opts.displayName)
			this.log('info', `✓ Installed "${result.screensaverId}" to ${result.installedTo}`)
			this.setVariableValues({
				last_install_result: `✓ Installed "${result.screensaverId}"`,
				last_install_at: ts,
			})
			await this.refreshLibrary()
			this.log('info', `Library now contains ${this.library.length} screensaver(s). Pick yours in the connection's "Active screensaver" dropdown.`)
			this.updateStatus(InstanceStatus.Ok)
		} catch (err) {
			const msg = (err as Error).message
			this.log('error', `Failed to install screensaver from zip: ${msg}`)
			this.setVariableValues({ last_install_result: `✗ ${msg}`, last_install_at: ts })
			this.updateStatus(InstanceStatus.Ok)
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
			const result = await generateSetupFile({
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
			const lines: string[] = [
				`Setup file written: ${result.finalPath}`,
				``,
				`Next step: Companion → Settings → Import / Export → Import → drop this file.`,
				`The screensaver page will be installed at page ${t}, plus ${result.embeddedTriggers.length} ready-to-go trigger(s):`,
			]
			for (const tr of result.embeddedTriggers) lines.push(`  • ${tr.name}`)

			if (result.missingTriggers.length > 0) {
				lines.push(
					``,
					`Skipped (no Stream Deck surface IDs in connection config — fill in "Stream Deck surface IDs" and re-run to embed these too):`,
				)
				for (const tr of result.missingTriggers) {
					if (tr.name === 'Screensaver: switch to billboard') {
						lines.push(
							`  • ${tr.name}`,
							`     Event: Variable: Variable value changes → variable "${label}: screensaver_active"`,
							`     Condition: variable equals "1"`,
							`     Action: internal → Surface: Set to page → surface = (your deck) → page = ${t}`,
						)
					} else if (tr.name === 'Screensaver: return to main') {
						lines.push(
							`  • ${tr.name}`,
							`     Event: Variable: Variable value changes → variable "${label}: screensaver_active"`,
							`     Condition: variable equals "0"`,
							`     Action: internal → Surface: Set to page → surface = (your deck) → page = ${r}`,
						)
					}
				}
			}

			lines.push(
				``,
				`After ${this.config.idleMinutes} minutes of inactivity the deck will switch to page ${t} and play the screensaver. Any button press will exit and return to page ${r}.`,
			)

			this.log('info', lines.join('\n'))
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
		this.incomingScanInterval = setInterval(() => {
			void this.scanIncomingZips()
		}, 30_000)
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
		if (this.incomingScanInterval) clearInterval(this.incomingScanInterval)
		this.idleCheckInterval = null
		this.heartbeatInterval = null
		this.tileInterval = null
		this.incomingScanInterval = null
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
			vals['last_install_result'] = '(no install yet this session)'
			vals['last_install_at'] = ''
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
