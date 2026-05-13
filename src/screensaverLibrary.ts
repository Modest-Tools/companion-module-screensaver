import { readdir, stat, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import AdmZip from 'adm-zip'

export type DeckSize = 'mini' | 'standard' | 'xl' | 'plus'

const RESOLUTION_FOLDER_HINTS: Record<DeckSize, string[]> = {
	mini: ['sd mini', 'mini'],
	standard: ['sd standard', 'standard'],
	xl: ['sd xl', 'xl'],
	plus: ['sd plus', 'plus'],
}

export type InstalledScreensaver = {
	id: string // safe identifier (folder name)
	name: string // display name (folder name, prettified)
	rootPath: string // absolute path to the screensaver folder
	format: 'tiles' | 'master'
	resolutionFolders: Record<DeckSize, string | null>
	/** When format === 'master', all master files found at the folder root (.webp or .gif). */
	masterFiles: string[]
	/**
	 * When format === 'master', the master file selected for each deck size based on Elgato's
	 * filename convention (`*_MK_2.gif` → standard, `*_XL_2.gif` → xl, etc.). Falls back to null
	 * for deck sizes without a matching file; callers should use `masterFiles[0]` as a final fallback.
	 */
	masterFilesByDeckSize: Record<DeckSize, string | null>
}

/** Default library location: ~/Documents/CompanionScreensavers */
export function defaultLibraryPath(): string {
	return path.join(os.homedir(), 'Documents', 'CompanionScreensavers')
}

export async function ensureLibraryExists(libraryPath: string): Promise<void> {
	await mkdir(libraryPath, { recursive: true })
}

/**
 * Scan the library folder for installed screensavers. A screensaver is any
 * subfolder containing one or more known resolution folders OR a
 * "Wallpaper GIFs" subfolder (Elgato marketplace shape).
 */
export async function scanLibrary(libraryPath: string): Promise<InstalledScreensaver[]> {
	let entries: string[]
	try {
		entries = await readdir(libraryPath)
	} catch {
		return []
	}

	const out: InstalledScreensaver[] = []
	for (const entry of entries) {
		if (entry.startsWith('.')) continue
		const full = path.join(libraryPath, entry)
		try {
			const s = await stat(full)
			if (!s.isDirectory()) continue
		} catch {
			continue
		}

		const resolutions = await findResolutionFolders(full)
		const hasResolutions = Object.values(resolutions).some((v) => v !== null)

		const masterFiles = hasResolutions ? [] : await findMasterFiles(full)
		if (!hasResolutions && masterFiles.length === 0) continue

		out.push({
			id: entry,
			name: prettifyName(entry),
			rootPath: full,
			format: hasResolutions ? 'tiles' : 'master',
			resolutionFolders: resolutions,
			masterFiles,
			masterFilesByDeckSize: hasResolutions
				? { mini: null, standard: null, xl: null, plus: null }
				: classifyMasterFilesByDeckSize(masterFiles),
		})
	}
	return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Elgato's deck-model naming convention in master-format pack filenames. */
const DECK_FILENAME_HINTS: Record<DeckSize, RegExp[]> = {
	standard: [/(^|[_\-\s])mk[_\-\s]?2($|[_\-\s\.])/i, /(^|[_\-\s])standard($|[_\-\s\.])/i],
	xl: [/(^|[_\-\s])xl($|[_\-\s\.])/i],
	plus: [/(^|[_\-\s])sd[_\-\s]?plus($|[_\-\s\.])/i, /(^|[_\-\s])plus($|[_\-\s\.])/i],
	mini: [/(^|[_\-\s])sd[_\-\s]?mini($|[_\-\s\.])/i, /(^|[_\-\s])mini($|[_\-\s\.])/i],
}

export function classifyMasterFilesByDeckSize(files: string[]): Record<DeckSize, string | null> {
	const out: Record<DeckSize, string | null> = { mini: null, standard: null, xl: null, plus: null }
	for (const file of files) {
		const base = path.basename(file)
		for (const size of Object.keys(DECK_FILENAME_HINTS) as DeckSize[]) {
			if (out[size]) continue
			if (DECK_FILENAME_HINTS[size].some((re) => re.test(base))) {
				out[size] = file
			}
		}
	}
	return out
}

/**
 * Find master-format files at the screensaver folder root — Elgato's "single master"
 * shape where one full-deck animation is sliced into per-button tiles at runtime
 * instead of being shipped pre-tiled. Recognizes both `.webp` (canonical) and `.gif`
 * (older Elgato packs like Pac Man Animated Screensaver V2, which ship loose
 * per-deck-size full-deck GIFs at the root or inside a `Gifs/` subfolder).
 */
async function findMasterFiles(root: string): Promise<string[]> {
	const dirs = [root]
	for (const sub of ['Gifs', 'gifs']) {
		const p = path.join(root, sub)
		try {
			const s = await stat(p)
			if (s.isDirectory()) dirs.push(p)
		} catch {
			/* ignore */
		}
	}

	const out: string[] = []
	for (const dir of dirs) {
		let entries: string[]
		try {
			entries = await readdir(dir)
		} catch {
			continue
		}
		for (const e of entries) {
			if (e.startsWith('.')) continue
			const lower = e.toLowerCase()
			if (!lower.endsWith('.webp') && !lower.endsWith('.gif')) continue
			const full = path.join(dir, e)
			try {
				const s = await stat(full)
				if (s.isFile()) out.push(full)
			} catch {
				/* ignore */
			}
		}
	}
	return out.sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
}

/**
 * Walk a screensaver root for resolution folders. Handles both shapes:
 *   <root>/SD Standard/<gifs>
 *   <root>/Profiles/Wallpaper GIFs/SD Standard/<gifs>
 */
async function findResolutionFolders(root: string): Promise<Record<DeckSize, string | null>> {
	const result: Record<DeckSize, string | null> = { mini: null, standard: null, xl: null, plus: null }
	const candidates: string[] = []

	// First try direct children
	candidates.push(root)

	// Then try Profiles/Wallpaper GIFs structure
	for (const sub of ['Profiles', 'profiles', 'Wallpaper GIFs', 'wallpaper gifs']) {
		const p = path.join(root, sub)
		try {
			const s = await stat(p)
			if (s.isDirectory()) {
				candidates.push(p)
				for (const inner of ['Wallpaper GIFs', 'wallpaper gifs']) {
					const pp = path.join(p, inner)
					try {
						const ss = await stat(pp)
						if (ss.isDirectory()) candidates.push(pp)
					} catch {
						/* ignore */
					}
				}
			}
		} catch {
			/* ignore */
		}
	}

	for (const dir of candidates) {
		let entries: string[] = []
		try {
			entries = await readdir(dir)
		} catch {
			continue
		}
		for (const entry of entries) {
			const lower = entry.toLowerCase()
			for (const size of Object.keys(RESOLUTION_FOLDER_HINTS) as DeckSize[]) {
				if (result[size]) continue
				if (RESOLUTION_FOLDER_HINTS[size].some((h) => lower === h)) {
					const full = path.join(dir, entry)
					try {
						const s = await stat(full)
						if (s.isDirectory()) result[size] = full
					} catch {
						/* ignore */
					}
				}
			}
		}
	}

	return result
}

/**
 * Pick the right resolution folder given a target deck size, falling back to
 * the closest available size if the requested one is missing.
 */
export function pickResolutionFolder(
	screensaver: InstalledScreensaver,
	preferred: DeckSize,
): { folder: string | null; chosenSize: DeckSize | null } {
	if (screensaver.resolutionFolders[preferred]) {
		return { folder: screensaver.resolutionFolders[preferred], chosenSize: preferred }
	}
	const fallbackOrder: DeckSize[] = ['standard', 'xl', 'plus', 'mini']
	for (const size of fallbackOrder) {
		if (screensaver.resolutionFolders[size]) {
			return { folder: screensaver.resolutionFolders[size], chosenSize: size }
		}
	}
	return { folder: null, chosenSize: null }
}

/**
 * Look at a zip's entry names and decide whether it appears to be an Elgato
 * screensaver. Used to skip random zips before extraction.
 */
export function isScreensaverZip(zipPath: string): boolean {
	let zip: AdmZip
	try {
		zip = new AdmZip(zipPath)
	} catch {
		return false
	}
	const entries = zip.getEntries()
	const lowerNames = entries.map((e) => e.entryName.toLowerCase())
	const hasResolutionFolder = lowerNames.some((n) =>
		/(^|\/)(sd ?(mini|standard|xl|plus)|wallpaper gifs)(\/|$)/.test(n),
	)
	const hasGifs = lowerNames.some((n) => n.endsWith('.gif'))
	if (hasResolutionFolder && hasGifs) return true

	// Master format: one or more `.webp` files at the zip root (or one folder deep)
	// with no other structural folders. Heuristic: at least one .webp entry whose
	// path has at most one separator.
	const hasShallowWebp = lowerNames.some((n) => n.endsWith('.webp') && (n.match(/\//g) ?? []).length <= 1)
	if (hasShallowWebp) return true

	// Master-GIF format: `.gif` files whose basenames match Elgato's deck-model naming
	// (e.g. `Pac_Man_MK_2.gif`, `Pac_Man_XL_2.gif`). The deck-suffix regex is specific
	// enough to Elgato's convention that we don't constrain by path depth — packs vary
	// (root, `Gifs/`, or inside a wrapper folder like `Pac Man Animated Screensaver V2/Gifs/`).
	const hasDeckNamedGif = lowerNames.some((n) => {
		if (!n.endsWith('.gif')) return false
		const base = n.split('/').pop() ?? n
		return /(^|[_\-\s])(mk[_\-\s]?2|xl|sd[_\-\s]?plus|sd[_\-\s]?mini)($|[_\-\s\.])/i.test(base)
	})
	return hasDeckNamedGif
}

/**
 * Install an Elgato screensaver zip into the library. Returns the
 * destination folder name.
 */
export async function installScreensaverFromZip(
	zipPath: string,
	libraryPath: string,
	displayName?: string,
): Promise<{ installedTo: string; screensaverId: string }> {
	await ensureLibraryExists(libraryPath)
	const zip = new AdmZip(zipPath)
	const baseName = displayName ?? path.basename(zipPath, path.extname(zipPath))
	const safeName = sanitizeFolderName(baseName)
	const dest = path.join(libraryPath, safeName)
	await mkdir(dest, { recursive: true })

	const shouldSkip = (entryName: string): boolean => {
		const lower = entryName.toLowerCase()
		if (lower.endsWith('.streamdeckprofile')) return true
		if (lower.includes('__macosx')) return true
		return false
	}

	const normalizedPaths: string[] = []
	for (const entry of zip.getEntries()) {
		if (entry.isDirectory) continue
		if (shouldSkip(entry.entryName)) continue
		const safeEntryPath = entry.entryName.replace(/\\/g, '/').split('/').filter(Boolean).join('/')
		if (!safeEntryPath) continue
		normalizedPaths.push(safeEntryPath)
	}

	// Detect a common top-level wrapper folder (e.g. `Pac Man Animated Screensaver V2/`)
	// and strip it during extraction so files don't land one level too deep.
	const prefix = commonTopLevelFolder(normalizedPaths)

	for (const entry of zip.getEntries()) {
		if (entry.isDirectory) continue
		if (shouldSkip(entry.entryName)) continue
		const safeEntryPath = entry.entryName.replace(/\\/g, '/').split('/').filter(Boolean).join('/')
		if (!safeEntryPath) continue
		const stripped = prefix && safeEntryPath.startsWith(prefix) ? safeEntryPath.slice(prefix.length) : safeEntryPath
		if (!stripped) continue
		const outPath = path.join(dest, stripped)
		const outDir = path.dirname(outPath)
		await mkdir(outDir, { recursive: true })
		await writeFile(outPath, entry.getData())
	}

	return { installedTo: dest, screensaverId: safeName }
}

/**
 * If every path in `paths` starts with the same top-level folder, return that
 * folder name including the trailing `/`. Otherwise return `''`. Used to strip
 * a single wrapper folder during zip extraction so files don't land one level
 * too deep.
 */
export function commonTopLevelFolder(paths: string[]): string {
	if (paths.length === 0) return ''
	let prefix: string | null = null
	for (const p of paths) {
		const slash = p.indexOf('/')
		if (slash < 0) return ''
		const top = p.slice(0, slash + 1)
		if (prefix === null) prefix = top
		else if (prefix !== top) return ''
	}
	return prefix ?? ''
}

export function sanitizeFolderName(name: string): string {
	return name.replace(/[\/\\:*?"<>|]/g, '-').trim() || 'screensaver'
}

function prettifyName(folderName: string): string {
	return folderName
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase())
}
