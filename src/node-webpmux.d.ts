declare module 'node-webpmux' {
	export class Image {
		width: number
		height: number
		hasAnim: boolean
		frames?: Array<{ width: number; height: number; delay: number }>
		load(pathOrBuffer: string | Buffer): Promise<void>
		getFrameData(idx: number): Promise<Buffer>
		getImageData(): Promise<Buffer>
		static initLib(): Promise<void>
	}

	const _default: { Image: typeof Image }
	export default _default
}
