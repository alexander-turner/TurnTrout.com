declare module "*.scss" {
  const content: string
  export = content
}

// dom custom event
interface CustomEventMap {
  nav: CustomEvent<{ url: FullSlug }>
  themechange: CustomEvent<{ theme: "light" | "dark" }>
  "darkmode-ready": CustomEvent<undefined>
  "search-index-ready": CustomEvent<undefined>
}

declare const fetchData: Promise<ContentIndex>
