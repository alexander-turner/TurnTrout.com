// Toggle between Tengwar (Elvish) and English translation on click
document.addEventListener("nav", function () {
  const elvishElements = document.querySelectorAll(".elvish");

  for (const el of elvishElements) {
    el.addEventListener("click", function (e) {
      // Don't toggle if clicking a link inside
      if (e.target.tagName === "A") return;

      this.classList.toggle("show-translation");
    });

    // Add keyboard accessibility
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute(
      "aria-label",
      "Click to toggle between Elvish and English translation",
    );

    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.classList.toggle("show-translation");
      }
    });
  }
});
