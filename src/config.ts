import type { SomeCompanionConfigField } from '@companion-module/base'

export type DeckSize = 'mini' | 'standard' | 'xl' | 'plus'

export type ModuleConfig = {
	idleMinutes: number
	targetPage: number
	screensaverLibraryPath: string
	screensaverId: string
	deckSize: DeckSize
	gridCols: number
	gridRows: number
	tileFps: number
	/** @deprecated Legacy: raw tile folder path. If set, overrides library + screensaverId. */
	tileFolder: string
}

export type ConfigContext = {
	availableScreensavers: { id: string; name: string }[]
}

export function GetConfigFields(ctx: ConfigContext = { availableScreensavers: [] }): SomeCompanionConfigField[] {
	const screensaverChoices = [
		{ id: '', label: 'None (no screensaver loaded)' },
		...ctx.availableScreensavers.map((s) => ({ id: s.id, label: s.name })),
	]
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'About',
			width: 12,
			value:
				'Plays an Elgato-style animated screensaver across all buttons of your Stream Deck after an idle period. Install screensavers from Elgato Marketplace .zip files using the "Install screensaver from zip" action.',
		},
		{
			type: 'number',
			id: 'idleMinutes',
			label: 'Idle minutes before activation',
			width: 6,
			min: 1,
			max: 1440,
			default: 10,
		},
		{
			type: 'number',
			id: 'targetPage',
			label: 'Target billboard page',
			width: 6,
			min: 1,
			max: 99,
			default: 1,
		},
		{
			type: 'static-text',
			id: 'libraryHeader',
			label: 'Screensaver library',
			width: 12,
			value:
				'Library is a folder of installed screensavers. Use the "Install screensaver from zip" action to import an Elgato Marketplace pack, then pick it from the dropdown below.',
		},
		{
			type: 'textinput',
			id: 'screensaverLibraryPath',
			label: 'Library folder path',
			width: 8,
			default: '',
		},
		{
			type: 'dropdown',
			id: 'deckSize',
			label: 'Deck size',
			width: 4,
			default: 'standard',
			choices: [
				{ id: 'mini', label: 'Mini (6 buttons)' },
				{ id: 'standard', label: 'Standard / MK.2 (15 buttons)' },
				{ id: 'xl', label: 'XL (32 buttons)' },
				{ id: 'plus', label: 'Plus (8 buttons + dial)' },
			],
		},
		{
			type: 'dropdown',
			id: 'screensaverId',
			label: 'Active screensaver',
			width: 12,
			default: '',
			choices: screensaverChoices,
		},
		{
			type: 'number',
			id: 'tileFps',
			label: 'Animation FPS (refresh rate cap)',
			width: 6,
			min: 1,
			max: 30,
			default: 15,
		},
		{
			type: 'textinput',
			id: 'tileFolder',
			label: 'Legacy: raw tile folder path (overrides library if set)',
			width: 12,
			default: '',
		},
	]
}
