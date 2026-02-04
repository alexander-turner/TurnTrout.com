declare module "citation-js" {
  interface FormatOptions {
    format?: "text" | "object"
    type?: string
    style?: string
    lang?: string
  }

  interface CSLAuthor {
    given?: string
    family: string
  }

  interface CSLDate {
    "date-parts": number[][]
  }

  interface CSLEntry {
    id?: string
    type: string
    title?: string
    author?: CSLAuthor[]
    issued?: CSLDate
    accessed?: CSLDate
    URL?: string
    DOI?: string
    [key: string]: unknown
  }

  class Cite {
    constructor(data: CSLEntry | CSLEntry[] | string)
    format(style: string, options?: FormatOptions): string
    get(options?: FormatOptions): CSLEntry[]
  }

  export = Cite
}
