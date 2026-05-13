declare module 'omggif' {
	export class GifReader {
		constructor(buf: Uint8Array)
		readonly width: number
		readonly height: number
		numFrames(): number
		frameInfo(frame: number): {
			x: number
			y: number
			width: number
			height: number
			delay: number
			disposal: number
			transparent_index: number | null
			interlaced: boolean
			has_local_palette: boolean
		}
		decodeAndBlitFrameRGBA(frame: number, pixels: Uint8Array): void
		decodeAndBlitFrameBGRA(frame: number, pixels: Uint8Array): void
	}
}
