import { Components, Jsx, toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Node, Root } from "hast"
import { Fragment, jsx, jsxs } from "preact/jsx-runtime"
import { trace } from "./trace"
import { type FilePath } from "./path"

import React, { HTMLAttributes } from "react"

const customComponents: Partial<Components> = {
  table: (props) => {
    if (typeof props.defaultValue === "number") {
      props.defaultValue = props.defaultValue.toString()
    }
    return (
      <div className="table-container">
        <table {...(props as unknown as HTMLAttributes<HTMLTableElement>)} />
      </div>
    )
  },
}

export function htmlToJsx(fp: FilePath, tree: Node) {
  try {
    return toJsxRuntime(tree as Root, {
      Fragment,
      jsx: jsx as Jsx,
      jsxs: jsxs as Jsx,
      elementAttributeNameCase: "html",
      components: customComponents,
    })
  } catch (e) {
    trace(`Failed to parse Markdown in \`${fp}\` into JSX`, e as Error)
  }
}
