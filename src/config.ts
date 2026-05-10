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
			label: 'About this module',
			width: 12,
			value:
				'Plays Elgato Marketplace screensavers across your Stream Deck after an idle period. Three steps to set up: (1) configure the pages and library below, (2) run the "Install screensaver from zip" action to import an Elgato pack, (3) run the "Generate page setup file" action and import the resulting .companionconfig in Settings → Import.',
		},
		{
			type: 'static-text',
			id: 'pagesHeader',
			label: '1. Pages & timing',
			width: 12,
			value: 'Pick how long to wait before the screensaver kicks in, which page to take over, and which page to return to when it exits.',
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
			label: 'Screensaver page (taken over while active)',
			width: 4,
			min: 1,
			max: 99,
			default: 99,
		},
		{
			type: 'number',
			id: 'returnPage',
			label: 'Return page (switch back here when exiting)',
			width: 4,
			min: 1,
			max: 99,
			default: 1,
		},
		{
			type: 'textinput',
			id: 'surfaceIds',
			label: 'Stream Deck surface IDs (comma-separated)',
			width: 12,
			default: '',
			tooltip:
				'Find these in Companion → Surfaces (e.g. "streamdeck:A00SA4442O4IRG"). When set, the generated .companionconfig will include ready-to-go page-switch triggers for each listed surface. Leave blank to add those triggers manually.',
		},
		{
			type: 'static-text',
			id: 'libraryHeader',
			label: '2. Screensaver library',
			width: 12,
			value:
				'The library is a folder of installed screensavers. Download a `.zip` from the Elgato Marketplace (https://marketplace.elgato.com → Stream Deck → Screensavers), save it anywhere you like, then trigger the "Install screensaver from zip" action with that path. The module unpacks it into the library folder below — pick it from the "Active screensaver" dropdown afterwards.',
		},
		{
			type: 'textinput',
			id: 'screensaverLibraryPath',
			label: 'Library folder path (auto-created if missing)',
			width: 8,
			default: '',
			tooltip: 'Default: ~/Documents/CompanionScreensavers',
		},
		{
			type: 'textinput',
			id: 'incomingZipFolder',
			label: 'Incoming zip folder (auto-installed in the background)',
			width: 12,
			default: '~/Downloads',
			tooltip:
				'Drop Elgato Marketplace .zip files here and they will be auto-installed within ~30s. The "Install screensaver from zip" action also pulls its dropdown of choices from this folder.',
		},
		{
			type: 'dropdown',
			id: 'deckSize',
			label: 'Deck size (controls which tile resolution is loaded)',
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
			width: 12,
			default: '',
			choices: screensaverChoices,
			tooltip: 'Empty until you install at least one screensaver via the "Install screensaver from zip" action',
		},
		{
			type: 'static-text',
			id: 'advancedHeader',
			label: '3. Advanced',
			width: 12,
			value: 'Most users can ignore these. Animation FPS controls refresh rate — lower if you see stutter on slower machines. Legacy tile folder path is for direct-folder use if you don\'t want the library workflow.',
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
			label: 'Legacy: raw tile folder path (overrides library + active screensaver if set)',
			width: 12,
			default: '',
		},
	]
}
