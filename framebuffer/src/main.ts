/**
 * Framebuffer-mode screensaver module — entry point STUB.
 *
 * Most of the file is intentionally undefined. The module's render path
 * depends on a Companion-core API (`PageOverlayLayer` or similar) that
 * doesn't exist yet — see `framebuffer/PROPOSAL.md` and the maintainer
 * conversation on bitfocus/companion#428.
 *
 * What's wired below is the input side (decoder + library scanner + idle
 * tracker) and a sketch of the playback loop. The output side — how we ship
 * pixels to Companion — is left as TODOs marked `[awaiting API]`.
 *
 * When haakonnessjoen's response lands, the TODOs become concrete and we
 * scaffold the rest (manifest.json, package.json, dist build, etc.) and move
 * this into a separate repo per the porting notes in framebuffer/README.md.
 */

import path from 'node:path'
import os from 'node:os'

import { loadGifMaster } from './gifMaster.js'
import { loadWebpMaster } from './webpMaster.js'
import { frameIndexAtTime, type MasterSource } from './masterFrame.js'
import {
	type InstalledScreensaver,
	scanLibrary,
	ensureLibraryExists,
} from './library.js'
import { IdleTracker } from './idle.js'

// --- module state ---------------------------------------------------------

export type FramebufferConfig = {
	/** Library folder containing installed screensavers. */
	libraryPath: string
	/** ID (folder name) of the active screensaver, or empty for none. */
	screensaverId: string
	/** Frames per second pushed to the page overlay. Stream Deck USB pipe
	 * caps around 30 fps; default 15. */
	fps: number
	/** Optional: if the maintainer keeps activation module-driven, the
	 * idle threshold lives here. If core-driven, drop this field. */
	idleMinutes?: number
}

class FramebufferScreensaver {
	private config: FramebufferConfig
	private library: InstalledScreensaver[] = []
	private master: MasterSource | null = null
	private active = false
	private tileLoadStartedAt = 0
	private renderInterval: NodeJS.Timeout | null = null
	private readonly idle = new IdleTracker()

	constructor(config: FramebufferConfig) {
		this.config = config
	}

	async init(): Promise<void> {
		await ensureLibraryExists(this.config.libraryPath)
		this.library = await scanLibrary(this.config.libraryPath)
		await this.loadActiveScreensaver()
	}

	private resolveActive(): InstalledScreensaver | null {
		if (!this.config.screensaverId) return null
		return this.library.find((s) => s.id === this.config.screensaverId) ?? null
	}

	private async loadActiveScreensaver(): Promise<void> {
		this.master = null
		const ss = this.resolveActive()
		if (!ss || ss.format !== 'master') return
		// Framebuffer mode consumes master format only. Tile-folder shapes
		// (per-deck-size pre-tiled GIFs) require a separate conversion step
		// that's not part of the prototype.
		const filePath = ss.masterFiles[0]
		if (!filePath) return
		this.master = filePath.toLowerCase().endsWith('.gif')
			? await loadGifMaster(filePath)
			: await loadWebpMaster(filePath)
		this.tileLoadStartedAt = Date.now()
	}

	// --- activation lifecycle --------------------------------------------

	start(): void {
		if (this.active || !this.master) return
		this.active = true
		this.tileLoadStartedAt = Date.now()
		this.startRenderLoop()
		// [awaiting API] Tell Companion to install our page overlay so it
		// starts compositing under the buttons. Shape TBD — could be:
		//   await this.host.setPageOverlay(targetPage, { ... })
	}

	stop(): void {
		if (!this.active) return
		this.active = false
		this.stopRenderLoop()
		// [awaiting API] Tell Companion to clear our page overlay so the
		// page renders without the underlay again.
	}

	// --- render loop -----------------------------------------------------

	private startRenderLoop(): void {
		this.stopRenderLoop()
		const fps = Math.max(1, Math.min(30, this.config.fps || 15))
		const periodMs = Math.round(1000 / fps)
		this.renderInterval = setInterval(() => {
			void this.pushFrame()
		}, periodMs)
	}

	private stopRenderLoop(): void {
		if (this.renderInterval) clearInterval(this.renderInterval)
		this.renderInterval = null
	}

	private async pushFrame(): Promise<void> {
		if (!this.master || !this.active) return
		const idx = frameIndexAtTime(this.master, Date.now() - this.tileLoadStartedAt)
		const rgba = await this.master.getFrameRgba(idx)
		void rgba // [awaiting API] ship `rgba` to Companion's page overlay
		// Likely shape, given PR #4098's element model:
		//   this.host.updatePageOverlay(targetPage, {
		//     elements: [{ type: 'canvas', width, height, pixels: rgba }],
		//   })
	}

	// --- input from Companion -------------------------------------------

	onButtonPress(): void {
		// "Reset idle on any press" — if activation stays module-driven, a
		// button press dismisses the screensaver. Core-driven activation
		// would do this in core and just notify modules via an event.
		this.idle.markActivity()
		if (this.active) this.stop()
	}

	tickIdle(): void {
		if (this.active) return
		if (this.config.idleMinutes && this.idle.hasExceeded(this.config.idleMinutes)) {
			this.start()
		}
	}
}

// Default library path mirrors the side-load module's convention.
export function defaultLibraryPath(): string {
	return path.join(os.homedir(), 'Documents', 'CompanionScreensavers')
}

export { FramebufferScreensaver }
