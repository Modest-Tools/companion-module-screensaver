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
	resolutionFolders: Record<DeckSize, string | null>
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
		const hasAny = Object.values(resolutions).some((v) => v !== null)
		if (!hasAny) continue

		out.push({
			id: entry,
			name: prettifyName(entry),
			rootPath: full,
			resolutionFolders: resolutions,
		})
	}
	return out.sort((a, b) => a.name.localeCompare(b.name))
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

	for (const entry of zip.getEntries()) {
		if (entry.isDirectory) continue
		const lower = entry.entryName.toLowerCase()
		// Only extract files that are useful: GIFs, WebP, PNG (icon), and JSON metadata.
		// Skip the heavy .streamDeckProfile binaries.
		if (lower.endsWith('.streamdeckprofile')) continue
		if (lower.includes('__macosx')) continue

		const safeEntryPath = entry.entryName.replace(/\\/g, '/').split('/').filter(Boolean).join('/')
		if (!safeEntryPath) continue
		const outPath = path.join(dest, safeEntryPath)
		const outDir = path.dirname(outPath)
		await mkdir(outDir, { recursive: true })
		await writeFile(outPath, entry.getData())
	}

	return { installedTo: dest, screensaverId: safeName }
}

function sanitizeFolderName(name: string): string {
	return name.replace(/[\/\\:*?"<>|]/g, '-').trim() || 'screensaver'
}

function prettifyName(folderName: string): string {
	return folderName
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase())
}
