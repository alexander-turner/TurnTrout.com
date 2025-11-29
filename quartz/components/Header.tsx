// skipcq: JS-W1028
import React from "react"

import style from "./styles/header.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

// skipcq: JS-D1001
const Header: QuartzComponent = ({ children }: QuartzComponentProps) => {
  return children.length > 0 ? <header>{children}</header> : null
}

Header.css = style

export default (() => Header) satisfies QuartzComponentConstructor
