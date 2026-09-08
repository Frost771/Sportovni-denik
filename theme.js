(() => {
  const key = "sportovni-denik-theme";
  const media = matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  try { preference = localStorage.getItem(key); } catch {}
  if (!["light", "dark"].includes(preference)) preference = null;
  function apply() {
    const dark = preference ? preference === "dark" : media.matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101827" : "#0f4eba");
    const button = document.querySelector("#theme-toggle");
    if (button) {
      button.textContent = dark ? "☀️ Světlý režim" : "🌙 Tmavý režim";
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", dark ? "Zapnout světlý režim" : "Zapnout tmavý režim");
    }
  }
  apply();
  media.addEventListener("change", () => { if (!preference) apply(); });
  window.addEventListener("storage", event => {
    if (event.key === key) { preference = ["light","dark"].includes(event.newValue) ? event.newValue : null; apply(); }
  });
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelector("#theme-toggle")?.addEventListener("click", () => {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(key, preference); } catch {}
      apply();
    });
  });
})();
