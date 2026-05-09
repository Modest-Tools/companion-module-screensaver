import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'
import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'

/**
 * For slot N, decide which variable's text to display.
 * Slots [0 .. quoteSlots-1] -> quote_chunk_1..N
 * Slots [quoteSlots .. quoteSlots+authorSlots-1] -> author_chunk_1..M
 */
function textExpressionForSlot(slot: number, quoteSlots: number): string {
	if (slot < quoteSlots) {
		return `$(Screensaver:quote_chunk_${slot + 1})`
	}
	const authorSlot = slot - quoteSlots + 1
	return `$(Screensaver:author_chunk_${authorSlot})`
}

function rowColLabel(slot: number, gridCols: number): string {
	const row = Math.floor(slot / gridCols)
	const col = slot % gridCols
	return `row ${row}, col ${col}`
}

export function UpdatePresets(self: ModuleInstance): void {
	const cfg = self.config
	const totalSlots = (cfg?.quoteSlots ?? 10) + (cfg?.authorSlots ?? 5)
	const gridCols = cfg?.gridCols ?? 5

	const presets: CompanionPresetDefinitions<ModuleSchema> = {}

	for (let slot = 0; slot < totalSlots; slot++) {
		const id = `slot_${slot}`
		presets[id] = {
			type: 'simple',
			name: `Slot ${slot} (${rowColLabel(slot, gridCols)})`,
			keywords: ['screensaver', 'tile', `slot${slot}`],
			style: {
				text: textExpressionForSlot(slot, cfg?.quoteSlots ?? 10),
				size: 'auto',
				color: 0xffffff,
				bgcolor: 0x000000,
				show_topbar: false,
			},
			feedbacks: [
				{
					feedbackId: 'screensaver_tile',
					options: { slot },
				},
			],
			steps: [
				{
					down: [{ actionId: 'reset_idle_timer', options: {} }],
					up: [],
				},
			],
		}
	}

	const refreshId = 'manual_refresh'
	presets[refreshId] = {
		type: 'simple',
		name: 'Manual refresh quote',
		keywords: ['screensaver', 'refresh', 'quote'],
		style: {
			text: 'REFRESH\\nQUOTE',
			size: 'auto',
			color: 0xffffff,
			bgcolor: 0x505050,
			show_topbar: false,
		},
		feedbacks: [],
		steps: [
			{
				down: [{ actionId: 'refresh_quote', options: {} }],
				up: [],
			},
		],
	}

	const generateId = 'generate_setup_file'
	presets[generateId] = {
		type: 'simple',
		name: 'Generate page setup file',
		keywords: ['screensaver', 'setup', 'install', 'generate', 'export'],
		style: {
			text: 'GEN\\nSETUP',
			size: 'auto',
			color: 0xffffff,
			bgcolor: 0x0066aa,
			show_topbar: false,
		},
		feedbacks: [],
		steps: [
			{
				down: [
					{
						actionId: 'generate_setup_file',
						options: {
							outputPath: '~/Downloads/screensaver-setup.companionconfig',
							includeRefreshButton: true,
						},
					},
				],
				up: [],
			},
		],
	}

	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'slots',
			name: 'Slot buttons',
			definitions: [
				{
					id: 'slot_grid',
					name: 'Slot grid (drop one on each cell)',
					description:
						'Drag one preset onto each cell of the billboard page. The slot number determines which chunk text and animation tile that cell shows. Slot 0 = top-left, increases left-to-right then top-to-bottom.',
					type: 'simple',
					presets: Array.from({ length: totalSlots }, (_, i) => `slot_${i}`),
				},
			],
		},
		{
			id: 'utility',
			name: 'Utility',
			definitions: [
				{
					id: 'utility_buttons',
					name: 'Utility buttons',
					description: 'Manual triggers for testing and control.',
					type: 'simple',
					presets: [generateId, refreshId],
				},
			],
		},
	]

	self.setPresetDefinitions(structure, presets)
}
