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

function parseSurfaceIds(raw: string): string[] {
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
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

function setPageAction(surfaceId: string, page: number): Record<string, unknown> {
	return {
		id: nano(),
		definitionId: 'set_page',
		connectionId: 'internal',
		options: {
			surfaceId: { value: surfaceId, isExpression: false },
			page: { value: page, isExpression: false },
		},
		type: 'action',
		children: {},
	}
}

function variableValueCondition(variableId: string, value: string): Record<string, unknown> {
	// Companion v4 expects each option value wrapped in { value, isExpression }
	// rather than a raw string — without the wrap, the trigger editor shows the
	// fields as empty and the condition never matches.
	return {
		id: nano(),
		type: 'feedback',
		definitionId: 'variable_value',
		connectionId: 'internal',
		options: {
			variable: { value: variableId, isExpression: false },
			op: { value: 'eq', isExpression: false },
			value: { value, isExpression: false },
		},
		upgradeIndex: -1,
		isInverted: { isExpression: false, value: false },
		style: {},
		children: {},
	}
}

function makePageSwitchTrigger(opts: {
	name: string
	sortOrder: number
	variableId: string
	expectedValue: string
	surfaceIds: string[]
	page: number
}): Record<string, unknown> {
	return {
		type: 'trigger',
		options: { name: opts.name, enabled: true, sortOrder: opts.sortOrder },
		events: [
			{
				id: nano(),
				type: 'variable_changed',
				enabled: true,
				options: { variableId: opts.variableId },
			},
		],
		condition: [variableValueCondition(opts.variableId, opts.expectedValue)],
		actions: opts.surfaceIds.map((sid) => setPageAction(sid, opts.page)),
		localVariables: [],
	}
}

function makeResetIdleTrigger(connectionId: string): Record<string, unknown> {
	return {
		type: 'trigger',
		options: { name: 'Screensaver: reset idle on any press', enabled: true, sortOrder: 2 },
		events: [{ id: nano(), type: 'button_press', enabled: true, options: {} }],
		condition: [],
		actions: [
			{
				id: nano(),
				definitionId: 'reset_idle_timer',
				connectionId,
				options: {},
				type: 'action',
				upgradeIndex: -1,
				children: {},
			},
		],
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

export type GenerateResult = {
	finalPath: string
	embeddedTriggers: { name: string }[]
	missingTriggers: { name: string; reason: string }[]
}

export async function generateSetupFile(opts: GenerateOpts): Promise<GenerateResult> {
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

	const pageObj = {
		id: nano(),
		name: 'Screensaver',
		controls,
		gridSize: { minColumn: 0, maxColumn: cols - 1, minRow: 0, maxRow: rows - 1 },
	}

	const surfaceIds = parseSurfaceIds(cfg.surfaceIds)
	const variableId = `${opts.connectionLabel}:screensaver_active`

	const triggers: Record<string, Record<string, unknown>> = {}
	const embeddedTriggers: { name: string }[] = []
	const missingTriggers: { name: string; reason: string }[] = []

	if (surfaceIds.length > 0) {
		triggers[nano()] = makePageSwitchTrigger({
			name: 'Screensaver: switch to billboard',
			sortOrder: 0,
			variableId,
			expectedValue: '1',
			surfaceIds,
			page: cfg.targetPage,
		})
		embeddedTriggers.push({ name: 'Screensaver: switch to billboard' })

		triggers[nano()] = makePageSwitchTrigger({
			name: 'Screensaver: return to main',
			sortOrder: 1,
			variableId,
			expectedValue: '0',
			surfaceIds,
			page: cfg.returnPage,
		})
		embeddedTriggers.push({ name: 'Screensaver: return to main' })
	} else {
		missingTriggers.push({
			name: 'Screensaver: switch to billboard',
			reason: 'no surface IDs configured',
		})
		missingTriggers.push({
			name: 'Screensaver: return to main',
			reason: 'no surface IDs configured',
		})
	}

	triggers[nano()] = makeResetIdleTrigger(opts.connectionId)
	embeddedTriggers.push({ name: 'Screensaver: reset idle on any press' })

	const exportObj = {
		version: 12,
		type: 'full',
		companionBuild: 'screensaver-module-setup',
		pages: { [String(cfg.targetPage)]: pageObj },
		triggers,
		triggerCollections: [],
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
	}

	const json = JSON.stringify(exportObj, null, '\t')
	const compressed = await gzip(Buffer.from(json, 'utf-8'))

	const finalPath = expandPath(opts.outputPath)
	await mkdir(path.dirname(finalPath), { recursive: true })
	await writeFile(finalPath, compressed)
	return { finalPath, embeddedTriggers, missingTriggers }
}
