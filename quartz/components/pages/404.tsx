import React from "react"

import { cdnBaseUrl, PREVIEWABLE_CLASS } from "../constants"
import notFoundStyle from "../styles/404.scss"
import { QuartzComponent, QuartzComponentConstructor } from "../types"

const NotFound: QuartzComponent = () => {
  return (
    <article className={PREVIEWABLE_CLASS} data-use-dropcap="false">
      <div id="not-found-div">
        <div>
          <h1>404</h1>
          <p>
            That page doesn’t exist. <br />
            But don’t leave! There <br />
            are other fish in the pond.
          </p>
        </div>

        <img
          src={`${cdnBaseUrl}/static/images/turntrout-art-transparent.avif`}
          id="trout-reading"
          className="no-select"
          alt="Alex in a trout costume, reading a book."
          width={1280}
          height={1152}
        />
      </div>
    </article>
  )
}
NotFound.css = notFoundStyle

export default (() => NotFound) satisfies QuartzComponentConstructor
