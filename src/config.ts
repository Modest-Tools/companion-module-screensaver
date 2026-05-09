import type { SomeCompanionConfigField } from '@companion-module/base'

export type DisplayMode = 'text-vars' | 'text-mosaic' | 'gif-only' | 'text-over-gif'
export type DeckSize = 'mini' | 'standard' | 'xl' | 'plus'
export type MosaicLayout = 'row-snap' | 'centered'

export type ModuleConfig = {
	idleMinutes: number
	refreshSeconds: number
	targetPage: number
	quoteSource: 'built-in' | 'custom-url'
	customQuoteUrl: string
	maxCharsPerChunk: number
	quoteRevealDelayMs: number
	authorRevealDelayMs: number
	authorStartDelayMs: number
	quoteSlots: number
	authorSlots: number
	/** @deprecated kept for back-compat with v0.1/0.2 connections; use library + screensaverId instead. */
	tileFolder: string
	gridCols: number
	gridRows: number
	tileFps: number
	displayMode: DisplayMode
	tilePixelSize: number
	mosaicTextColor: string
	mosaicAuthorColor: string
	mosaicBgColor: string
	mosaicWordRevealMs: number
	mosaicLayout: MosaicLayout
	screensaverLibraryPath: string
	screensaverId: string
	deckSize: DeckSize
}

export type ConfigContext = {
	availableScreensavers: { id: string; name: string }[]
}

export function GetConfigFields(ctx: ConfigContext = { availableScreensavers: [] }): SomeCompanionConfigField[] {
	const screensaverChoices = [
		{ id: '', label: 'None (text mosaic only / disabled)' },
		...ctx.availableScreensavers.map((s) => ({ id: s.id, label: s.name })),
	]
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'About',
			width: 12,
			value: 'Activates a word-by-word quote screensaver after an idle period.',
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
			id: 'refreshSeconds',
			label: 'Quote refresh interval (seconds)',
			width: 6,
			min: 10,
			max: 86400,
			default: 180,
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
			type: 'dropdown',
			id: 'quoteSource',
			label: 'Quote source',
			width: 6,
			default: 'built-in',
			choices: [
				{ id: 'built-in', label: 'Built-in (bundled quotes)' },
				{ id: 'custom-url', label: 'Custom URL (JSON endpoint)' },
			],
		},
		{
			type: 'textinput',
			id: 'customQuoteUrl',
			label: 'Custom quote URL (returns {quote, author}) — only used when source is Custom URL',
			width: 12,
			default: '',
		},
		{
			type: 'number',
			id: 'maxCharsPerChunk',
			label: 'Max chars per chunk',
			width: 4,
			min: 1,
			max: 200,
			default: 12,
		},
		{
			type: 'number',
			id: 'quoteSlots',
			label: 'Quote slots',
			width: 4,
			min: 1,
			max: 50,
			default: 10,
		},
		{
			type: 'number',
			id: 'authorSlots',
			label: 'Author slots',
			width: 4,
			min: 1,
			max: 20,
			default: 5,
		},
		{
			type: 'number',
			id: 'quoteRevealDelayMs',
			label: 'Quote reveal delay (ms)',
			width: 4,
			min: 0,
			max: 60000,
			default: 1000,
		},
		{
			type: 'number',
			id: 'authorRevealDelayMs',
			label: 'Author reveal delay (ms)',
			width: 4,
			min: 0,
			max: 60000,
			default: 1000,
		},
		{
			type: 'number',
			id: 'authorStartDelayMs',
			label: 'Author start delay (ms)',
			width: 4,
			min: 0,
			max: 60000,
			default: 2000,
		},
		{
			type: 'dropdown',
			id: 'displayMode',
			label: 'Display mode',
			width: 6,
			default: 'text-mosaic',
			choices: [
				{ id: 'text-mosaic', label: 'Text mosaic (quote painted across all buttons)' },
				{ id: 'text-over-gif', label: 'Text mosaic over animated GIF tiles' },
				{ id: 'gif-only', label: 'Animated GIF tiles only (no text)' },
				{ id: 'text-vars', label: 'Legacy: per-button text variables' },
			],
		},
		{
			type: 'number',
			id: 'tilePixelSize',
			label: 'Button pixel size (Stream Deck Standard = 72)',
			width: 6,
			min: 32,
			max: 240,
			default: 72,
		},
		{
			type: 'colorpicker',
			id: 'mosaicTextColor',
			label: 'Mosaic quote color',
			width: 4,
			default: 0xffffff,
			returnType: 'string',
		},
		{
			type: 'colorpicker',
			id: 'mosaicAuthorColor',
			label: 'Mosaic author color',
			width: 4,
			default: 0x9ae6ff,
			returnType: 'string',
		},
		{
			type: 'colorpicker',
			id: 'mosaicBgColor',
			label: 'Mosaic background color (used when no GIF)',
			width: 4,
			default: 0x000000,
			returnType: 'string',
		},
		{
			type: 'number',
			id: 'mosaicWordRevealMs',
			label: 'Mosaic: ms per word reveal (0 = show whole quote at once)',
			width: 6,
			min: 0,
			max: 10000,
			default: 220,
		},
		{
			type: 'dropdown',
			id: 'mosaicLayout',
			label: 'Mosaic layout',
			width: 6,
			default: 'row-snap',
			choices: [
				{ id: 'row-snap', label: 'Row-snapped (each line fits inside one button row, top-aligned)' },
				{ id: 'centered', label: 'Centered (free wrap, vertically centered)' },
			],
		},
		{
			type: 'static-text',
			id: 'libraryHeader',
			label: 'Screensaver library (Elgato-compatible)',
			width: 12,
			value: 'Library is a folder of installed screensavers. Use the "Install screensaver from zip" action to import an Elgato marketplace pack.',
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
			type: 'textinput',
			id: 'tileFolder',
			label: 'Legacy: raw tile folder path (overrides library if set)',
			width: 12,
			default: '',
		},
		{
			type: 'number',
			id: 'gridCols',
			label: 'Grid columns',
			width: 4,
			min: 1,
			max: 16,
			default: 5,
		},
		{
			type: 'number',
			id: 'gridRows',
			label: 'Grid rows',
			width: 4,
			min: 1,
			max: 8,
			default: 3,
		},
		{
			type: 'number',
			id: 'tileFps',
			label: 'Animation FPS (refresh rate cap)',
			width: 4,
			min: 1,
			max: 30,
			default: 15,
		},
	]
}
