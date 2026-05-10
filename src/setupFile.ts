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

function makeTileButton(connectionId: string, slot: number): Record<string, unknown> {
	return {
		type: 'button',
		style: {
			text: '',
			textExpression: false,
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

export type GenerateOpts = {
	connectionId: string
	connectionLabel: string
	connectionVersionId: string
	moduleId: string
	config: ModuleConfig
	outputPath: string
}

export async function generateSetupFile(opts: GenerateOpts): Promise<string> {
	const cfg = opts.config
	const cols = cfg.gridCols
	const rows = cfg.gridRows
	const totalSlots = cols * rows

	const controls: Record<string, Record<string, Record<string, unknown>>> = {}
	for (let r = 0; r < rows; r++) controls[String(r)] = {}

	for (let slot = 0; slot < totalSlots; slot++) {
		const r = Math.floor(slot / cols)
		const c = slot % cols
		controls[String(r)][String(c)] = makeTileButton(opts.connectionId, slot)
	}

	const exportObj = {
		version: 12,
		type: 'page',
		companionBuild: 'screensaver-module-setup',
		page: {
			id: nano(),
			name: 'Screensaver',
			controls,
			gridSize: { minColumn: 0, maxColumn: cols - 1, minRow: 0, maxRow: rows - 1 },
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
