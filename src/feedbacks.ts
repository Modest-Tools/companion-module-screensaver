import type ModuleInstance from './main.js'

export type FeedbacksSchema = {
	screensaver_active: {
		type: 'boolean'
		options: Record<string, never>
	}
	screensaver_idle_warning: {
		type: 'boolean'
		options: { warningSeconds: number }
	}
	screensaver_tile: {
		type: 'advanced'
		options: { slot: number }
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		screensaver_active: {
			name: 'Screensaver active',
			type: 'boolean',
			defaultStyle: { bgcolor: 0x111111, color: 0xffffff },
			options: [],
			callback: () => self.isScreensaverActive(),
		},
		screensaver_idle_warning: {
			name: 'Idle warning (about to activate)',
			type: 'boolean',
			defaultStyle: { bgcolor: 0xffaa00, color: 0x000000 },
			options: [
				{
					id: 'warningSeconds',
					type: 'number',
					label: 'Trigger when remaining idle seconds is at most',
					default: 60,
					min: 1,
					max: 3600,
				},
			],
			callback: (fb) => {
				const remaining = self.idleSecondsRemaining()
				return remaining !== null && remaining <= Number(fb.options.warningSeconds ?? 60)
			},
		},
		screensaver_tile: {
			name: 'Screensaver tile (animated background)',
			type: 'advanced',
			options: [
				{
					id: 'slot',
					type: 'number',
					label: 'Slot (0-based, row-major: top-left = 0)',
					default: 0,
					min: 0,
					max: 127,
				},
			],
			callback: (fb) => {
				const slot = Number(fb.options.slot ?? 0)
				return self.getTileImageBuffer(slot, fb.image) ?? {}
			},
		},
	})
}
