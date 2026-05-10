import type ModuleInstance from './main.js'

export type ActionsSchema = {
	start_screensaver: { options: Record<string, never> }
	stop_screensaver: { options: Record<string, never> }
	reset_idle_timer: { options: Record<string, never> }
	install_screensaver_zip: {
		options: { zipPath: string; displayName: string }
	}
	generate_setup_file: {
		options: { outputPath: string }
	}
}

export function UpdateActions(self: ModuleInstance): void {
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
			description:
				'Extracts an Elgato Stream Deck screensaver .zip into your library folder. Pad GIFs go in subfolders by deck size (SD Mini / SD Standard / SD XL / SD Plus).',
			options: [
				{
					id: 'zipPath',
					type: 'textinput',
					label: 'Path to .zip file',
					default: '',
				},
				{
					id: 'displayName',
					type: 'textinput',
					label: 'Display name (optional, defaults to zip filename)',
					default: '',
				},
			],
			callback: async (event) => {
				const zipPath = String(event.options.zipPath ?? '').trim()
				const displayName = String(event.options.displayName ?? '').trim() || undefined
				if (!zipPath) {
					self.log('warn', 'install_screensaver_zip: no zipPath provided')
					return
				}
				await self.installScreensaverZip({ zipPath, displayName })
			},
		},
		generate_setup_file: {
			name: 'Generate page setup file (.companionconfig)',
			description:
				'Writes a .companionconfig file containing all billboard buttons (one per slot). After running, go to Settings → Import / Export → Import in Companion and pick this file.',
			options: [
				{
					id: 'outputPath',
					type: 'textinput',
					label: 'Output path',
					default: '~/Downloads/screensaver-setup.companionconfig',
				},
			],
			callback: async (event) => {
				const outputPath = String(event.options.outputPath ?? '~/Downloads/screensaver-setup.companionconfig')
				await self.generateSetupFile({ outputPath })
			},
		},
	})
}
