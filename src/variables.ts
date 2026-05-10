import type ModuleInstance from './main.js'

export type VariablesSchema = Record<string, string | number>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		screensaver_active: { name: 'Screensaver active (0/1)' },
		seconds_since_last_press: { name: 'Seconds since last button press' },
	})
}
