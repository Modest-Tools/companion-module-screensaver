import type ModuleInstance from './main.js'

export type VariablesSchema = Record<string, string | number>

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const defs: Record<string, { name: string }> = {}
	const quoteSlots = Math.max(1, self.config?.quoteSlots ?? 10)
	const authorSlots = Math.max(1, self.config?.authorSlots ?? 5)

	for (let i = 1; i <= quoteSlots; i++) {
		defs[`quote_chunk_${i}`] = { name: `Quote chunk ${i}` }
	}
	for (let i = 1; i <= authorSlots; i++) {
		defs[`author_chunk_${i}`] = { name: `Author chunk ${i}` }
	}
	defs['screensaver_active'] = { name: 'Screensaver active (0/1)' }
	defs['current_quote'] = { name: 'Full current quote' }
	defs['current_author'] = { name: 'Full current author' }
	defs['seconds_since_last_press'] = { name: 'Seconds since last button press' }
	defs['last_quote_fetched_at'] = { name: 'Last quote fetched at (ISO)' }

	self.setVariableDefinitions(defs)
}
