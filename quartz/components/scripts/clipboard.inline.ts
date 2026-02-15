import { animate, svgCheck, svgCopy } from "./component_script_utils"

document.addEventListener("nav", () => {
  const els = document.getElementsByTagName("pre")
  for (const element of els) {
    const codeBlock = element.getElementsByTagName("code")[0]
    if (codeBlock) {
      const source = codeBlock.innerText.replace(/\n\n/g, "\n")
      const button = document.createElement("button")
      const onClick = () => {
        navigator.clipboard.writeText(source).then(
          () => {
            button.blur()
            button.innerHTML = svgCheck
            animate(
              2000,
              () => {
                // No per-frame updates needed, only completion callback to restore button state
              },
              () => {
                button.innerHTML = svgCopy
                button.style.borderColor = ""
              },
            )
          },
          (error) => console.error(error),
        )
      }
      button.className = "clipboard-button"
      button.type = "button"
      button.innerHTML = svgCopy
      button.ariaLabel = "Copy source"
      button.addEventListener("click", onClick)
      element.prepend(button)
    }
  }
})
