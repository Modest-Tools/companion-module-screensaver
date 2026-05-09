import bundledQuotes from './quotes.json' with { type: 'json' }

export type Quote = { quote: string; author: string }

const RECENT_HISTORY = 10

export class QuoteSource {
	private recent: string[] = []

	private library: Quote[]

	constructor() {
		this.library = (bundledQuotes as Quote[]).filter((q) => q.quote && q.author)
	}

	private rememberAndReturn(q: Quote): Quote {
		const key = q.quote
		this.recent.push(key)
		while (this.recent.length > RECENT_HISTORY) this.recent.shift()
		return q
	}

	pickBuiltIn(): Quote {
		if (this.library.length === 0) {
			return { quote: 'No quotes available.', author: 'System' }
		}
		const eligible =
			this.library.length > RECENT_HISTORY
				? this.library.filter((q) => !this.recent.includes(q.quote))
				: this.library
		const pool = eligible.length > 0 ? eligible : this.library
		const pick = pool[Math.floor(Math.random() * pool.length)]
		return this.rememberAndReturn(pick)
	}

	async fetchFromUrl(url: string, timeoutMs = 5000): Promise<Quote> {
		const ctrl = new AbortController()
		const timer = setTimeout(() => ctrl.abort(), timeoutMs)
		try {
			const res = await fetch(url, { signal: ctrl.signal })
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as unknown
			const obj = (Array.isArray(data) ? data[0] : data) as Partial<Quote>
			if (!obj || typeof obj.quote !== 'string' || typeof obj.author !== 'string') {
				throw new Error('Invalid quote payload (expected {quote, author})')
			}
			return this.rememberAndReturn({ quote: obj.quote, author: obj.author })
		} finally {
			clearTimeout(timer)
		}
	}
}
