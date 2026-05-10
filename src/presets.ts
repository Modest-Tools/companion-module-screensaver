import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'
import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'

function rowColLabel(slot: number, gridCols: number): string {
	const row = Math.floor(slot / gridCols)
	const col = slot % gridCols
	return `row ${row}, col ${col}`
}

export function UpdatePresets(self: ModuleInstance): void {
	const cfg = self.config
	const gridCols = cfg?.gridCols ?? 5
	const gridRows = cfg?.gridRows ?? 3
	const totalSlots = gridCols * gridRows

	const presets: CompanionPresetDefinitions<ModuleSchema> = {}

	for (let slot = 0; slot < totalSlots; slot++) {
		const id = `slot_${slot}`
		presets[id] = {
			type: 'simple',
			name: `Slot ${slot} (${rowColLabel(slot, gridCols)})`,
			keywords: ['screensaver', 'tile', `slot${slot}`],
			style: {
				text: '',
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
			name: 'Billboard slots',
			definitions: [
				{
					id: 'slot_grid',
					name: 'Slot grid (drop one on each cell)',
					description:
						'Drag one preset onto each cell of the billboard page. The slot number determines which Elgato pad tile that cell shows. Slot 0 = top-left, increases left-to-right then top-to-bottom.',
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
					description: 'Manual triggers for installing screensavers and generating setup files.',
					type: 'simple',
					presets: [generateId],
				},
			],
		},
	]

	self.setPresetDefinitions(structure, presets)
}
