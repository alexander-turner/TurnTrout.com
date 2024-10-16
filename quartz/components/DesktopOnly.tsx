import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import React from "react"
export default ((component?: QuartzComponent) => {
  if (component) {
    const Component = component
    const DesktopOnly: QuartzComponent = (props: QuartzComponentProps) => {
      return <Component displayClass="desktop-only" {...props} />
    }

    DesktopOnly.displayName = component.displayName
    DesktopOnly.afterDOMLoaded = component?.afterDOMLoaded
    DesktopOnly.beforeDOMLoaded = component?.beforeDOMLoaded
    DesktopOnly.css = component?.css
    return DesktopOnly
  } else {
    return () => null
  }
}) satisfies QuartzComponentConstructor
