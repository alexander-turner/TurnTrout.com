import type { Node, Root } from "hast"
import type { JSX } from "preact"

import { type Components, type Jsx, toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Fragment, jsx, jsxs } from "preact/jsx-runtime"
// skip-cq: js-w1028 (react is used for the table component)
import * as React from "react"

import type { FilePath } from "./path"

import { trace } from "./trace"

interface TableProps extends JSX.HTMLAttributes<HTMLTableElement> {
  defaultValue?: string | number
}

const customComponents: Partial<Components> = {
  table: (props: TableProps) => {
    const { defaultValue, ...tableProps } = props
    if (typeof defaultValue === "number") {
      props.defaultValue = defaultValue.toString()
    }
    return (
      <div className="table-container">
        <table {...tableProps} />
      </div>
    )
  },
}

export function htmlToJsx(fp: FilePath, tree: Node): JSX.Element | undefined {
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
  return undefined
}
