import type ModuleInstance from './main.js'

export type VariablesSchema = Record<string, string | number>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		screensaver_active: { name: 'Screensaver active (0/1)' },
		seconds_since_last_press: { name: 'Seconds since last button press' },
		last_install_result: { name: 'Last "Install from zip" result' },
		last_install_at: { name: 'Last "Install from zip" timestamp' },
	})
}
