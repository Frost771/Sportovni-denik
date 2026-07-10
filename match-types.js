function ensureMatchTypes() {
  const select = document.querySelector("#match-type");
  if (!select || select.querySelector('option[value="Neregistrovaná liga"]')) return;

  const option = document.createElement("option");
  option.value = "Neregistrovaná liga";
  option.textContent = "Neregistrovaná liga";

  const friendly = select.querySelector('option[value="Přátelský/přípravný"]');
  select.insertBefore(option, friendly || null);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureMatchTypes, { once: true });
} else {
  ensureMatchTypes();
}
