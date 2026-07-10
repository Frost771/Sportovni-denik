import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const quickState = {
  client: null,
  clientPromise: null,
};

const $quick = (selector) => document.querySelector(selector);

const TEMPLATES = [
  {
    label: "Florbalový trénink",
    detail: "90 min",
    sport: "Florbal",
    trainingType: "Florbalový trénink",
    duration: 90,
  },
  {
    label: "Nedělní chytání",
    detail: "120 min",
    sport: "Florbal",
    trainingType: "Nedělní chytání",
    duration: 120,
  },
  {
    label: "Individuální síla",
    detail: "45 min",
    sport: "Florbal",
    trainingType: "Individuální silový trénink",
    duration: 45,
  },
  {
    label: "Fotbalový trénink",
    detail: "90 min",
    sport: "Fotbal",
    trainingType: "Fotbalový trénink",
    duration: 90,
  },
];

function showQuickToast(message, type = "ok") {
  const toast = $quick("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(showQuickToast.timer);
  showQuickToast.timer = setTimeout(() => { toast.className = "toast"; }, 3500);
}

function setQuickBusy(button, busy, text = null) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Načítám…";
  } else {
    button.disabled = false;
    button.textContent = text || button.dataset.originalText || button.textContent;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function setField(selector, value) {
  const field = $quick(selector);
  if (field) field.value = value ?? "";
}

function dispatchChange(selector) {
  const field = $quick(selector);
  if (field) field.dispatchEvent(new Event("change", { bubbles: true }));
}

function leaveEditMode() {
  const cancelButton = $quick("#cancel-edit-btn");
  if (cancelButton && !cancelButton.classList.contains("hidden")) {
    cancelButton.click();
  }
}

function clearEntryValues() {
  [
    "#training-type", "#duration-minutes", "#intensity", "#opponent",
    "#goals-for", "#goals-against", "#minutes-played", "#goals-conceded",
    "#rating", "#notes", "#entry-id",
  ].forEach((selector) => setField(selector, ""));

  setField("#match-type", "Soutěžní");
  setField("#role", "Brankář");
  setField("#venue", "Doma");
  setField("#decision", "Základní doba");
  setField("#shootout-winner", "Náš tým");
}

function prepareForm(eventType, sport) {
  leaveEditMode();
  clearEntryValues();
  setField("#event-type", eventType);
  setField("#sport", sport);
  setField("#event-date", todayIso());
  dispatchChange("#event-type");
  dispatchChange("#sport");
}

function focusNextField(selector) {
  requestAnimationFrame(() => {
    const field = $quick(selector);
    if (field) {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function applyTemplate(template) {
  prepareForm("Trénink", template.sport);
  setField("#training-type", template.trainingType);
  setField("#duration-minutes", template.duration);
  setField("#intensity", "");
  setField("#notes", "");
  focusNextField("#intensity");
  showQuickToast(`Šablona „${template.label}“ byla předvyplněna.`);
}

function fillRepeatedEntry(entry) {
  prepareForm(entry.event_type, entry.sport);

  setField("#training-type", entry.training_type);
  setField("#duration-minutes", entry.duration_minutes);
  setField("#intensity", entry.intensity);
  setField("#match-type", entry.match_type || "Soutěžní");
  setField("#role", entry.role || "Brankář");
  setField("#opponent", entry.opponent);
  setField("#venue", entry.venue || "Doma");
  setField("#goals-for", entry.goals_for);
  setField("#goals-against", entry.goals_against);
  setField("#decision", entry.decision || "Základní doba");
  setField("#minutes-played", entry.minutes_played);
  setField("#goals-conceded", entry.goals_conceded);
  setField("#rating", entry.rating);
  setField("#notes", "");
  dispatchChange("#role");
  dispatchChange("#decision");
  dispatchChange("#goals-for");
  dispatchChange("#goals-against");

  const focusSelector = entry.event_type === "Trénink" ? "#intensity" : "#opponent";
  focusNextField(focusSelector);
  showQuickToast("Poslední záznam byl zkopírován. Datum je dnešní a sezóna zůstala aktivní.");
}

async function getQuickClient() {
  if (quickState.client) return quickState.client;
  if (!quickState.clientPromise) {
    quickState.clientPromise = (async () => {
      const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = await import("./config.js");
      return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    })();
  }
  quickState.client = await quickState.clientPromise;
  return quickState.client;
}

async function repeatLastEntry(button) {
  setQuickBusy(button, true);
  try {
    const client = await getQuickClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("*")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Zatím není žádný záznam, který by šel zopakovat.");
    fillRepeatedEntry(data);
  } catch (error) {
    showQuickToast(error.message || "Poslední záznam se nepodařilo načíst.", "error");
  } finally {
    setQuickBusy(button, false, "Zopakovat poslední záznam");
  }
}

function injectQuickStyles() {
  if ($quick("#quick-entry-styles")) return;
  const style = document.createElement("style");
  style.id = "quick-entry-styles";
  style.textContent = `
    .quick-entry-card { margin-bottom: 16px; padding: 17px 18px; }
    .quick-entry-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 13px; }
    .quick-entry-heading h3 { margin: 0 0 4px; font-size: 1rem; }
    .quick-entry-heading p { margin: 0; }
    .quick-entry-actions { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; }
    .quick-template-button { min-height: 66px; display: grid; align-content: center; gap: 3px; text-align: left; border: 1px solid var(--line); background: white; color: var(--ink); }
    .quick-template-button:hover { border-color: var(--blue); background: var(--blue-soft); }
    .quick-template-button strong { font-size: .86rem; }
    .quick-template-button span { color: var(--muted); font-size: .74rem; font-weight: 600; }
    .quick-repeat-button { min-height: 66px; }
    @media (max-width: 900px) {
      .quick-entry-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .quick-repeat-button { grid-column: 1 / -1; }
    }
    @media (max-width: 520px) {
      .quick-entry-heading { display: block; }
      .quick-entry-actions { grid-template-columns: 1fr; }
      .quick-repeat-button { grid-column: auto; }
    }
  `;
  document.head.appendChild(style);
}

function injectQuickUi() {
  if ($quick("#quick-entry-card")) return;
  const form = $quick("#entry-form");
  if (!form) return;

  const card = document.createElement("section");
  card.id = "quick-entry-card";
  card.className = "card quick-entry-card";
  card.innerHTML = `
    <div class="quick-entry-heading">
      <div>
        <h3>Rychlé přidání</h3>
        <p class="muted small">Šablona jen předvyplní formulář. Náročnost a poznámku doplníš podle konkrétního tréninku.</p>
      </div>
    </div>
    <div class="quick-entry-actions">
      ${TEMPLATES.map((template, index) => `
        <button type="button" class="quick-template-button" data-quick-template="${index}">
          <strong>${template.label}</strong>
          <span>${template.sport} · ${template.detail}</span>
        </button>
      `).join("")}
      <button type="button" id="repeat-last-entry-btn" class="secondary quick-repeat-button">Zopakovat poslední záznam</button>
    </div>
  `;

  form.insertAdjacentElement("beforebegin", card);
  card.addEventListener("click", (event) => {
    const templateButton = event.target.closest("[data-quick-template]");
    if (templateButton) {
      const template = TEMPLATES[Number(templateButton.dataset.quickTemplate)];
      if (template) applyTemplate(template);
      return;
    }

    const repeatButton = event.target.closest("#repeat-last-entry-btn");
    if (repeatButton) repeatLastEntry(repeatButton);
  });
}

injectQuickStyles();
injectQuickUi();
