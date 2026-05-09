export function chunkText(text: string, maxChars: number): string[] {
	const words = text.trim().split(/\s+/).filter(Boolean)
	if (words.length === 0) return []

	const chunks: string[] = []
	let current = ''

	for (const word of words) {
		if (current.length === 0) {
			current = word
			continue
		}
		const candidate = current + ' ' + word
		if (candidate.length <= maxChars) {
			current = candidate
		} else {
			chunks.push(current)
			current = word
		}
	}
	if (current.length > 0) chunks.push(current)
	return chunks
}

export function padOrTruncate(chunks: string[], slots: number): string[] {
	const out = chunks.slice(0, slots)
	while (out.length < slots) out.push('')
	return out
}
