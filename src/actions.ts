import type ModuleInstance from './main.js'

export type ActionsSchema = {
	start_screensaver: { options: Record<string, never> }
	stop_screensaver: { options: Record<string, never> }
	reset_idle_timer: { options: Record<string, never> }
	install_screensaver_zip: {
		options: { zipFile: string; zipPath: string; displayName: string }
	}
	generate_setup_file: {
		options: { outputPath: string }
	}
}

export function UpdateActions(self: ModuleInstance): void {
	const incomingZips = self.listIncomingZips()
	const zipChoices = [
		{ id: '', label: incomingZips.length ? '— pick a zip from the dropdown above, or paste a path below —' : '— (no .zip files in incoming folder) —' },
		...incomingZips.map((name) => ({ id: name, label: name })),
	]

	self.setActionDefinitions({
		start_screensaver: {
			name: 'Start screensaver',
			options: [],
			callback: async () => {
				await self.startScreensaver('manual')
			},
		},
		stop_screensaver: {
			name: 'Stop screensaver',
			options: [],
			callback: async () => {
				self.stopScreensaver('manual')
			},
		},
		reset_idle_timer: {
			name: 'Reset idle timer',
			options: [],
			callback: async () => {
				self.markActivity()
			},
		},
		install_screensaver_zip: {
			name: 'Install screensaver from zip',
			description: 'Extract an Elgato Marketplace .zip into your library. Tip: dropping a zip in your Incoming folder auto-installs it within 30s — this action is for one-off paths or re-installs.',
			options: [
				{
					id: 'zipFile',
					type: 'dropdown',
					label: 'Incoming zip',
					default: '',
					choices: zipChoices,
					tooltip: 'Pick a .zip from your Incoming folder (refreshed every ~30s).',
				},
				{
					id: 'zipPath',
					type: 'textinput',
					label: 'Or paste a path to a .zip',
					default: '',
					tooltip: 'Used only if no Incoming zip is selected above. Accepts ~/ and absolute paths.',
				},
				{
					id: 'displayName',
					type: 'textinput',
					label: 'Display name (optional)',
					default: '',
					tooltip: 'Defaults to the zip filename if blank.',
				},
			],
			callback: async (event) => {
				const zipFile = String(event.options.zipFile ?? '').trim()
				const zipPath = String(event.options.zipPath ?? '').trim()
				const displayName = String(event.options.displayName ?? '').trim() || undefined

				const resolved = zipFile ? self.resolveIncomingZip(zipFile) : zipPath
				if (!resolved) {
					self.log('warn', 'install_screensaver_zip: pick a zip from the dropdown or paste a path.')
					return
				}
				await self.installScreensaverZip({ zipPath: resolved, displayName })
			},
		},
		generate_setup_file: {
			name: 'Generate page setup file',
			description: 'Write a .companionconfig with the screensaver page (all tile buttons) and triggers. Import via Settings → Import / Export → Import.',
			options: [
				{
					id: 'outputPath',
					type: 'textinput',
					label: 'Output path',
					default: '~/Downloads/screensaver-setup.companionconfig',
					tooltip: 'Where to write the .companionconfig file. Accepts ~/ and absolute paths.',
				},
			],
			callback: async (event) => {
				const outputPath = String(event.options.outputPath ?? '~/Downloads/screensaver-setup.companionconfig')
				await self.generateSetupFile({ outputPath })
			},
		},
	})
}
