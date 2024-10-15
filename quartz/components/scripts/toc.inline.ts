document.addEventListener("DOMContentLoaded", function () {
  const sections = document.querySelectorAll(".center h1, .center h2, .center h3")
  const navLinks = document.querySelectorAll("#toc-content a")

  function onScroll() {
    let currentSection = ""

    sections.forEach((section: any) => {
      const sectionTop = section.offsetTop
      if (scrollY + 300 >= sectionTop) {
        currentSection = section.getAttribute("id")
      }
    })

    navLinks.forEach((link: any) => {
      link.classList.remove("active")
      const slug = link?.href.split("#")[1]
      if (currentSection && slug === currentSection) {
        link.classList.add("active")
      }
    })
  }

  window.addEventListener("scroll", onScroll)
})