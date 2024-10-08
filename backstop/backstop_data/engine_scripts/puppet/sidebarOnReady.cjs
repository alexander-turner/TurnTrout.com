const normalOnReady = require("./onReady.cjs")

const sidebarHidden = async (page) => {
  return page.evaluate(() => {
    const leftSidebar = document.querySelector("#left-sidebar")
    return leftSidebar.classList.contains("hide-above-screen")
  })
}

module.exports = async (page, scenario, vp) => {
  await normalOnReady(page, scenario, vp)

  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 100))

  // Wait for sidebar to disappear
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Check if sidebar is hidden
  const isHidden = sidebarHidden(page)
  if (!isHidden) {
    throw new Error("Sidebar not hidden when scrolling down on mobile.")
  }

  // Scroll back up
  await page.evaluate(() => window.scrollBy(0, -10))

  // Wait for sidebar to reappear
  await new Promise((resolve) => setTimeout(resolve, 300))

  if (await sidebarHidden(page)) {
    throw new Error("Sidebar still hidden after scrolling back up on mobile.")
  }
}
