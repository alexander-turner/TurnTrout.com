import { setupCopyButton } from "./component_script_utils"

document.addEventListener("nav", () => {
  const els = document.getElementsByTagName("pre")
  for (const element of els) {
    const codeBlock = element.getElementsByTagName("code")[0]
    if (codeBlock) {
      const button = document.createElement("button")
      button.className = "clipboard-button"
      button.type = "button"
      button.ariaLabel = "Copy source"
      setupCopyButton(button, () => codeBlock.innerText.replace(/\n\n/g, "\n"))
      element.prepend(button)
    }
  }
})
