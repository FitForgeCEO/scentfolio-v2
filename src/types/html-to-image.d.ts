declare module 'html-to-image' {
  export function toPng(node: HTMLElement, options?: {
    width?: number
    height?: number
    pixelRatio?: number
    backgroundColor?: string
    cacheBust?: boolean
    quality?: number
  }): Promise<string>

  export function toJpeg(node: HTMLElement, options?: {
    width?: number
    height?: number
    pixelRatio?: number
    backgroundColor?: string
    quality?: number
  }): Promise<string>

  export function toBlob(node: HTMLElement, options?: {
    width?: number
    height?: number
    pixelRatio?: number
    backgroundColor?: string
  }): Promise<Blob | null>

  export function toSvg(node: HTMLElement, options?: {
    width?: number
    height?: number
    pixelRatio?: number
    backgroundColor?: string
  }): Promise<string>
}
