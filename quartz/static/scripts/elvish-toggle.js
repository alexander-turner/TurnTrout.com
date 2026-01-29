// Toggle between Tengwar (Elvish) and English translation on click
function toggleElvish() {
  this.classList.toggle("show-translation");
  // Update aria-pressed state for screen readers
  const isShowing = this.classList.contains("show-translation");
  this.setAttribute("aria-pressed", isShowing ? "true" : "false");
}

function handleElvishKeydown(e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleElvish.call(this);
  }
}

function handleElvishClick(e) {
  // Don't toggle if clicking a link inside (check ancestors too)
  if (e.target.closest("a")) return;
  toggleElvish.call(this);
}

document.addEventListener("nav", function () {
  const elvishElements = document.querySelectorAll(".elvish");

  for (const el of elvishElements) {
    // Prevent duplicate listeners on SPA navigation
    if (el.dataset.elvishInitialized) continue;
    el.dataset.elvishInitialized = "true";

    // Add keyboard accessibility
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-pressed", "false");
    el.setAttribute("aria-describedby", "elvish-help");

    el.addEventListener("click", handleElvishClick);
    el.addEventListener("keydown", handleElvishKeydown);
  }

  // Add hidden help text for screen readers (only once)
  if (!document.getElementById("elvish-help")) {
    const helpText = document.createElement("span");
    helpText.id = "elvish-help";
    helpText.className = "visually-hidden";
    helpText.textContent = "Toggle between Elvish and English translation";
    document.body.appendChild(helpText);
  }
});
