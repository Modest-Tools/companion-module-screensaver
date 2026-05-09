export class IdleTracker {
	private lastInputAt: number = Date.now()

	markActivity(): void {
		this.lastInputAt = Date.now()
	}

	secondsSinceLastInput(): number {
		return Math.floor((Date.now() - this.lastInputAt) / 1000)
	}

	hasExceeded(idleMinutes: number): boolean {
		return Date.now() - this.lastInputAt >= idleMinutes * 60 * 1000
	}

	secondsRemaining(idleMinutes: number): number {
		const target = this.lastInputAt + idleMinutes * 60 * 1000
		return Math.max(0, Math.ceil((target - Date.now()) / 1000))
	}
}
