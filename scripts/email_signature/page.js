// Drives the generated signature preview page: renders the dark-background
// preview, exposes the HTML source, and copies the signature to the clipboard.
//
// A hand-made selection is serialized by the browser as inline styles only,
// and the embedded font faces live in a <style> element, so the clipboard
// payload has to be assembled explicitly.

const signature = document.getElementById("tt-signature")
const fontStyle = document.getElementById("tt-signature-fonts")
const statusLine = document.getElementById("copy-status")

const signatureHtml = fontStyle.outerHTML + signature.outerHTML
const plainText = signature.innerText.trim().replace(/\n\s*\n/g, "\n")

const darkPreview = signature.cloneNode(true)
darkPreview.removeAttribute("id")
document.getElementById("dark-preview").append(darkPreview)
document.getElementById("source").value = signatureHtml

let statusTimer = 0
function report(message) {
  statusLine.textContent = message
  window.clearTimeout(statusTimer)
  statusTimer = window.setTimeout(() => {
    statusLine.textContent = ""
  }, 4000)
}

/**
 * Put `flavors` (a MIME-type → payload map) on the clipboard.
 *
 * `navigator.clipboard.write` sanitizes `text/html`, which deletes the <style>
 * element the embedded fonts arrive in. A `copy` event's payload is passed
 * through verbatim, so the fonts survive the round trip into Proton Mail.
 */
function copyToClipboard(flavors) {
  const onCopy = (event) => {
    event.preventDefault()
    for (const [type, payload] of Object.entries(flavors)) {
      event.clipboardData.setData(type, payload)
    }
  }
  document.addEventListener("copy", onCopy, { once: true })

  // Firefox refuses `execCommand("copy")` without a live selection.
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNode(signature)
  selection.removeAllRanges()
  selection.addRange(range)

  const copied = document.execCommand("copy")

  selection.removeAllRanges()
  document.removeEventListener("copy", onCopy)
  return copied
}

function bind(id, flavors, message) {
  document.getElementById(id).addEventListener("click", () => {
    report(
      copyToClipboard(flavors)
        ? message
        : "Copy failed — open “HTML source” below and copy it by hand.",
    )
  })
}

bind(
  "copy-rich",
  { "text/html": signatureHtml, "text/plain": plainText },
  "Copied — paste into Proton’s signature editor.",
)
bind("copy-source", { "text/plain": signatureHtml }, "Copied HTML source.")
