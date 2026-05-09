import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import type { ModuleConfig } from './config.js'

const gzip = promisify(zlib.gzip)

function nano(n = 21): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
	let id = ''
	for (let i = 0; i < n; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)]
	return id
}

function expandPath(p: string): string {
	if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
	return p
}

function makeChunkButton(
	connectionId: string,
	slot: number,
	textExpression: string,
): Record<string, unknown> {
	return {
		type: 'button',
		style: {
			text: textExpression,
			textExpression: true,
			size: 'auto',
			png64: null,
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: 0xffffff,
			bgcolor: 0,
			show_topbar: false,
		},
		options: { stepProgression: 'auto', stepExpression: '', rotaryActions: false },
		feedbacks: [
			{
				type: 'feedback',
				id: nano(),
				definitionId: 'screensaver_tile',
				connectionId,
				options: { slot: { isExpression: false, value: slot } },
				upgradeIndex: -1,
				style: {},
				isInverted: { isExpression: false, value: false },
			},
		],
		steps: {
			'0': {
				action_sets: {
					down: [
						{
							type: 'action',
							id: nano(),
							definitionId: 'reset_idle_timer',
							connectionId,
							options: {},
							upgradeIndex: -1,
							children: {},
						},
					],
					up: [],
				},
				options: { runWhileHeld: [] },
			},
		},
		localVariables: [],
	}
}

function makeRefreshButton(connectionId: string): Record<string, unknown> {
	return {
		type: 'button',
		style: {
			text: 'REFRESH\\nQUOTE',
			textExpression: false,
			size: 'auto',
			png64: null,
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: 0xffffff,
			bgcolor: 0x505050,
			show_topbar: false,
		},
		options: { stepProgression: 'auto', stepExpression: '', rotaryActions: false },
		feedbacks: [],
		steps: {
			'0': {
				action_sets: {
					down: [
						{
							type: 'action',
							id: nano(),
							definitionId: 'refresh_quote',
							connectionId,
							options: {},
							upgradeIndex: -1,
							children: {},
						},
					],
					up: [],
				},
				options: { runWhileHeld: [] },
			},
		},
		localVariables: [],
	}
}

function textForSlot(slot: number, quoteSlots: number): string {
	if (slot < quoteSlots) return `$(Screensaver:quote_chunk_${slot + 1})`
	return `$(Screensaver:author_chunk_${slot - quoteSlots + 1})`
}

export type GenerateOpts = {
	connectionId: string
	connectionLabel: string
	connectionVersionId: string
	moduleId: string
	config: ModuleConfig
	outputPath: string
	includeRefreshButton: boolean
}

export async function generateSetupFile(opts: GenerateOpts): Promise<string> {
	const cfg = opts.config
	const cols = cfg.gridCols
	const rows = cfg.gridRows
	const totalSlots = Math.min(cfg.quoteSlots + cfg.authorSlots, cols * rows)

	const controls: Record<string, Record<string, Record<string, unknown>>> = {}
	for (let r = 0; r < rows; r++) controls[String(r)] = {}

	for (let slot = 0; slot < totalSlots; slot++) {
		const r = Math.floor(slot / cols)
		const c = slot % cols
		controls[String(r)][String(c)] = makeChunkButton(
			opts.connectionId,
			slot,
			textForSlot(slot, cfg.quoteSlots),
		)
	}

	if (opts.includeRefreshButton) {
		// Place refresh button at first empty cell on row 0, or row 0 col cols-1 if grid full
		const row0 = controls['0']
		let placed = false
		for (let c = 0; c < cols + 1; c++) {
			if (!row0[String(c)]) {
				row0[String(c)] = makeRefreshButton(opts.connectionId)
				placed = true
				break
			}
		}
		if (!placed) {
			// Grid full; put it just outside as col=cols
			row0[String(cols)] = makeRefreshButton(opts.connectionId)
		}
	}

	const exportObj = {
		version: 12,
		type: 'page',
		companionBuild: 'screensaver-module-setup',
		page: {
			id: nano(),
			name: 'Screensaver',
			controls,
			gridSize: { minColumn: 0, maxColumn: cols, minRow: 0, maxRow: rows },
		},
		instances: {
			[opts.connectionId]: {
				moduleInstanceType: 'connection',
				moduleId: opts.moduleId,
				moduleVersionId: opts.connectionVersionId,
				updatePolicy: 'stable',
				sortOrder: 0,
				label: opts.connectionLabel,
				isFirstInit: false,
				config: cfg as unknown as Record<string, unknown>,
				secrets: {},
				lastUpgradeIndex: -1,
				enabled: true,
			},
		},
		connectionCollections: [],
		oldPageNumber: cfg.targetPage,
	}

	const json = JSON.stringify(exportObj, null, '\t')
	const compressed = await gzip(Buffer.from(json, 'utf-8'))

	const finalPath = expandPath(opts.outputPath)
	await mkdir(path.dirname(finalPath), { recursive: true })
	await writeFile(finalPath, compressed)
	return finalPath
}
