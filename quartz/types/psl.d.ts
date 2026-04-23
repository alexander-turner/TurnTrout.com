// psl 1.15.0 has types in types/index.d.ts but its package.json "exports"
// field doesn't include a "types" condition, so TypeScript with
// moduleResolution: "bundler" can't resolve them. Re-declare the subset we use.
declare module "psl" {
  interface ParsedDomain {
    input: string
    tld: string | null
    sld: string | null
    domain: string | null
    subdomain: string | null
    listed: boolean
    error?: undefined
  }

  interface ErrorResult {
    input: string
    error: {
      code: string
      message: string
    }
  }

  function parse(input: string): ParsedDomain | ErrorResult
  function get(domain: string): string | null
  function isValid(domain: string): boolean
}
