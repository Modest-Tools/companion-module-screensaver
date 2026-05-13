import type { SomeCompanionConfigField } from '@companion-module/base'

export type DeckSize = 'mini' | 'standard' | 'xl' | 'plus'

export type ModuleConfig = {
	idleMinutes: number
	targetPage: number
	returnPage: number
	surfaceIds: string
	screensaverLibraryPath: string
	incomingZipFolder: string
	screensaverId: string
	deckSize: DeckSize
	gridCols: number
	gridRows: number
	tileFps: number
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
			label: 'Setup',
			width: 12,
			value: 'Drop an Elgato Marketplace screensaver .zip into your Incoming folder (default ~/Downloads). It auto-installs within 30s. Pick it from "Active screensaver" below, then run the "Generate page setup file" action and import the resulting .companionconfig via Settings → Import.',
		},
		{
			type: 'number',
			id: 'idleMinutes',
			label: 'Idle minutes before activation',
			width: 4,
			min: 1,
			max: 1440,
			default: 10,
		},
		{
			type: 'number',
			id: 'targetPage',
			label: 'Screensaver page',
			width: 4,
			min: 1,
			max: 99,
			default: 99,
			tooltip: 'The page the screensaver takes over while active. Default 99 keeps it out of your main pages.',
		},
		{
			type: 'number',
			id: 'returnPage',
			label: 'Return page',
			width: 4,
			min: 1,
			max: 99,
			default: 1,
			tooltip: 'The page to switch back to when the screensaver exits.',
		},
		{
			type: 'dropdown',
			id: 'deckSize',
			label: 'Deck size',
			width: 4,
			default: 'standard',
			choices: [
				{ id: 'mini', label: 'Mini (6 buttons, 3×2)' },
				{ id: 'standard', label: 'Standard / MK.2 (15 buttons, 5×3)' },
				{ id: 'xl', label: 'XL (32 buttons, 8×4)' },
				{ id: 'plus', label: 'Plus (8 buttons + dial, 4×2)' },
			],
		},
		{
			type: 'dropdown',
			id: 'screensaverId',
			label: 'Active screensaver',
			width: 8,
			default: '',
			choices: screensaverChoices,
			tooltip: 'Empty until you install at least one screensaver — drop a .zip in the Incoming folder or use the "Install screensaver from zip" action.',
		},
		{
			type: 'textinput',
			id: 'surfaceIds',
			label: 'Stream Deck surface IDs',
			width: 12,
			default: '',
			tooltip: 'Optional. Comma-separated list (find in Companion → Surfaces, e.g. "streamdeck:A00SA4442O4IRG"). When set, the generated .companionconfig auto-embeds page-switch triggers for these decks.',
		},
		{
			type: 'textinput',
			id: 'incomingZipFolder',
			label: 'Incoming zip folder (auto-install watcher)',
			width: 6,
			default: '~/Downloads',
			tooltip: 'Elgato Marketplace .zip files dropped here are auto-installed within ~30s.',
		},
		{
			type: 'textinput',
			id: 'screensaverLibraryPath',
			label: 'Library folder',
			width: 6,
			default: '',
			tooltip: 'Where installed screensavers live. Default: ~/Documents/CompanionScreensavers (auto-created).',
		},
		{
			type: 'number',
			id: 'tileFps',
			label: 'Animation FPS',
			width: 6,
			min: 1,
			max: 30,
			default: 15,
			tooltip: 'Stream Deck USB pipe caps around 30 fps regardless. Lower if you see action timeouts in the log.',
		},
	]
}
