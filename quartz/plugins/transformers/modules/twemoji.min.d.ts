declare module "twemoji.min" {
  export const twemoji: {
    parse(
      text: string,
      options?: {
        callback: (icon: string, options: object) => string
        attributes: (icon: string) => object
        base: string
        ext: string
        className: string
        size: string | number
        folder: string
      },
    ): string
  }
}
