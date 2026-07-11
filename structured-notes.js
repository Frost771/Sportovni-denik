const structuredNotesState = {
  client: null,
  clientPromise: null,
  schemaReady: null,
  editingId: null,
  detailsById: new Map(),
  recordsObserver: null,
  bodyObserver: null,
  refreshPromise: null,
};

const $structured = (selector) => document.querySelector(selector);
const STRUCTURED_NOTES_CACHE_KEY = "sportovni-denik-structured-notes-v1";

const STRUCTURED_FIELDS = [
  {
    key: "went_well",
    selector: "#structured-went-well",
    label: "Co se mi povedlo",
    placeholder: "Konkrétní zákroky, technické věci nebo situace, se kterými jsi byl spokojený…",
  },
  {
    key: "improve",
    selector: "#structured-improve",
    label: "Co chci zlepšit",
    placeholder: "Co nebylo ideální a na co se chceš zaměřit příště…",
  },
  {
    key: "insights",
    selector: "#structured-insights",
    label: "Moje poznatky",
    placeholder: "Proč něco fungovalo, co sis uvědomil a jak chceš upravit techniku, postavení nebo rozhodování…",
  },
];

function escapeStructuredHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function showStructuredToast(message, type = "ok") {
  const toast = $structured("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;

  clearTimeout(showStructuredToast.timer);
  showStructuredToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

function eventTypeLabel(eventType = null) {
  const type = eventType || $structured("#event-type")?.value || "Trénink";
  return type === "Zápas" ? "Průběh zápasu" : "Průběh tréninku";
}

function updateMainNotesLabel() {
  const notes = $structured("#notes");
  const label = notes?.closest("label");
  if (!notes || !label) return;

  let title = label.querySelector(".structured-notes-main-title");

  if (!title) {
    [...label.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .forEach((node) => {
        node.textContent = "";
      });

    title = document.createElement("span");
    title.className = "structured-notes-main-title";
    label.insertBefore(title, notes);
  }

  const heading = eventTypeLabel();
  title.textContent = heading;
  notes.placeholder =
    heading === "Průběh zápasu"
      ? "Jak zápas probíhal, jaké situace se opakovaly a jak padly góly…"
      : "Co se na tréninku dělalo, jaká cvičení a herní situace jste řešili…";
}

function injectStructuredNotesStyles() {
  if ($structured("#structured-notes-styles")) return;

  const style = document.createElement("style");
  style.id = "structured-notes-styles";
  style.textContent = `
    .structured-notes-fields {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      padding: 15px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #f8fbff;
    }

    .structured-notes-fields label {
      min-width: 0;
      margin: 0;
    }

    .structured-notes-fields textarea {
      width: 100%;
      min-height: 125px;
      margin-top: 7px;
      resize: vertical;
    }

    .structured-notes-intro {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--muted);
      font-size: .8rem;
      line-height: 1.5;
    }

    .structured-notes-schema-warning {
      grid-column: 1 / -1;
      margin: 0;
      padding: 9px 11px;
      border: 1px solid #ead28c;
      border-radius: 10px;
      background: #fff7df;
      color: #6b5410;
      font-size: .78rem;
      line-height: 1.4;
    }

    .structured-notes-summary {
      margin-top: 12px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 13px;
      background: #f8fbff;
    }

    .structured-notes-section {
      padding: 10px 12px;
    }

    .structured-notes-section + .structured-notes-section {
      border-top: 1px solid var(--line);
    }

    .structured-notes-section strong {
      display: block;
      margin-bottom: 4px;
      color: var(--blue-dark);
      font-size: .79rem;
    }

    .structured-notes-section p {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.55;
    }

    .structured-notes-original {
      display: none !important;
    }

    @media (max-width: 850px) {
      .structured-notes-fields {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function injectStructuredNotesUi() {
  if ($structured("#structured-notes-fields")) return;

  const notes = $structured("#notes");
  const notesLabel = notes?.closest("label");
  if (!notes || !notesLabel) return;

  updateMainNotesLabel();

  const wrapper = document.createElement("div");
  wrapper.id = "structured-notes-fields";
  wrapper.className = "structured-notes-fields span-all";
  wrapper.innerHTML = `
    <p class="structured-notes-intro">
      Všechny části jsou nepovinné. Vyplň jen to, co má pro daný trénink nebo zápas smysl.
    </p>
    ${STRUCTURED_FIELDS.map(
      (field) => `
        <label>
          ${field.label}
          <textarea
            id="${field.selector.slice(1)}"
            rows="4"
            placeholder="${escapeStructuredHtml(field.placeholder)}"
          ></textarea>
        </label>
      `
    ).join("")}
    <p id="structured-notes-schema-warning" class="structured-notes-schema-warning hidden">
      Databáze zatím nemá pole pro detailní poznámky. Spusť SQL migraci structured_notes_migration.sql.
    </p>
  `;

  notesLabel.insertAdjacentElement("afterend", wrapper);
  $structured("#event-type")?.addEventListener("change", updateMainNotesLabel);
}

function normalizeStructuredNotes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const normalized = {
    version: Number.isFinite(value.version) ? value.version : 1,
  };

  let hasValue = false;

  STRUCTURED_FIELDS.forEach(({ key }) => {
    const text = String(value[key] ?? "").trim();
    if (text) {
      normalized[key] = text;
      hasValue = true;
    }
  });

  return hasValue ? normalized : null;
}

function collectStructuredNotes() {
  const collected = { version: 1 };
  let hasValue = false;

  STRUCTURED_FIELDS.forEach(({ key, selector }) => {
    const text = $structured(selector)?.value?.trim() || "";
    if (text) {
      collected[key] = text;
      hasValue = true;
    }
  });

  return hasValue ? collected : null;
}

function fillStructuredNotes(value) {
  const notes = normalizeStructuredNotes(value);

  STRUCTURED_FIELDS.forEach(({ key, selector }) => {
    const field = $structured(selector);
    if (field) field.value = notes?.[key] || "";
  });
}

function clearStructuredNotes() {
  fillStructuredNotes(null);
}

function installStructuredNotesFetchPatch() {
  if (window.__structuredNotesFetchPatched) return;
  window.__structuredNotesFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    let nextInit = init;

    try {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init?.method || input?.method || "GET").toUpperCase();
      const isEntryWrite =
        url.includes("/rest/v1/sport_entries") &&
        (method === "POST" || method === "PATCH");

      if (isEntryWrite && typeof init?.body === "string") {
        const parsedBody = JSON.parse(init.body);
        const details = collectStructuredNotes();
        const addDetails = (row) => ({
          ...row,
          structured_notes: details,
        });

        nextInit = {
          ...init,
          body: JSON.stringify(
            Array.isArray(parsedBody)
              ? parsedBody.map(addDetails)
              : addDetails(parsedBody)
          ),
        };
      }
    } catch (error) {
      console.warn("Detailní poznámky nebylo možné přidat k požadavku.", error);
    }

    return originalFetch(input, nextInit);
  };
}

async function getStructuredNotesClient() {
  if (structuredNotesState.client) return structuredNotesState.client;

  if (!structuredNotesState.clientPromise) {
    structuredNotesState.clientPromise = (async () => {
      const [{ createClient }, config] = await Promise.all([
        import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"),
        import("./config.js"),
      ]);

      return createClient(
        config.SUPABASE_URL,
        config.SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }
      );
    })();
  }

  structuredNotesState.client = await structuredNotesState.clientPromise;
  return structuredNotesState.client;
}

async function checkStructuredNotesSchema() {
  try {
    const client = await getStructuredNotesClient();
    const { error } = await client
      .from("sport_entries")
      .select("structured_notes")
      .limit(1);

    structuredNotesState.schemaReady = !error;
  } catch (error) {
    console.warn("Kontrola pole structured_notes selhala.", error);
    structuredNotesState.schemaReady = false;
  }

  $structured("#structured-notes-schema-warning")?.classList.toggle(
    "hidden",
    structuredNotesState.schemaReady !== false
  );
}

function loadStructuredNotesCache() {
  try {
    const cached = JSON.parse(
      localStorage.getItem(STRUCTURED_NOTES_CACHE_KEY) || "[]"
    );

    structuredNotesState.detailsById = new Map(
      Array.isArray(cached)
        ? cached
            .filter(
              (item) =>
                Array.isArray(item) &&
                item.length === 2 &&
                item[0] &&
                item[1] &&
                typeof item[1] === "object"
            )
            .map(([id, item]) => [
              String(id),
              {
                eventType: item.eventType || null,
                details: normalizeStructuredNotes(item.details),
              },
            ])
        : []
    );
  } catch (error) {
    console.warn("Mezipaměť detailních poznámek se nepodařilo načíst.", error);
  }
}

function saveStructuredNotesCache() {
  try {
    localStorage.setItem(
      STRUCTURED_NOTES_CACHE_KEY,
      JSON.stringify([...structuredNotesState.detailsById.entries()])
    );
  } catch (error) {
    console.warn("Mezipaměť detailních poznámek se nepodařilo uložit.", error);
  }
}

async function refreshStructuredNotesMap() {
  if (structuredNotesState.schemaReady === false) return;
  if (structuredNotesState.refreshPromise) {
    return structuredNotesState.refreshPromise;
  }

  structuredNotesState.refreshPromise = (async () => {
    try {
      const client = await getStructuredNotesClient();
      const { data, error } = await client
        .from("sport_entries")
        .select("id, event_type, structured_notes");

      if (error) throw error;

      structuredNotesState.detailsById = new Map(
        (data || []).map((row) => [
          String(row.id),
          {
            eventType: row.event_type,
            details: normalizeStructuredNotes(row.structured_notes),
          },
        ])
      );

      saveStructuredNotesCache();
      annotateAllStructuredRecords();
    } catch (error) {
      console.warn("Detailní poznámky se nepodařilo načíst.", error);
    } finally {
      structuredNotesState.refreshPromise = null;
    }
  })();

  return structuredNotesState.refreshPromise;
}

async function loadStructuredNotesForEdit(id) {
  try {
    const client = await getStructuredNotesClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("structured_notes")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    fillStructuredNotes(data?.structured_notes || null);
  } catch (error) {
    console.warn("Detailní poznámky záznamu se nepodařilo načíst.", error);
    clearStructuredNotes();
  }
}

async function loadLastStructuredNotes() {
  try {
    const client = await getStructuredNotesClient();
    const { data, error } = await client
      .from("sport_entries")
      .select("structured_notes")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    setTimeout(
      () => fillStructuredNotes(data?.structured_notes || null),
      160
    );
  } catch (error) {
    console.warn("Detailní poznámky posledního záznamu se nepodařilo načíst.", error);
  }
}

function entryIdFromStructuredCard(card) {
  return card.querySelector("[data-edit-entry]")?.dataset.editEntry || null;
}

function findOriginalNotesParagraph(card) {
  const main = card.querySelector(".record-main");
  if (!main) return null;

  const directParagraphs = [...main.children].filter(
    (element) =>
      element.tagName === "P" &&
      !element.classList.contains("structured-notes-section")
  );

  return directParagraphs.length >= 2 ? directParagraphs[1] : null;
}

function eventTypeFromStructuredCard(card) {
  const badgeTexts = [...card.querySelectorAll(".badges .badge")].map(
    (badge) => badge.textContent?.trim()
  );

  if (badgeTexts.includes("Zápas")) return "Zápas";
  if (badgeTexts.includes("Trénink")) return "Trénink";
  return null;
}

function structuredSectionsForCard(card, entryData) {
  const sections = [];
  const originalNotes = findOriginalNotesParagraph(card);
  const notesText = originalNotes?.textContent?.trim() || "";
  const details = entryData?.details || null;
  const eventType = entryData?.eventType || eventTypeFromStructuredCard(card);

  if (notesText) {
    sections.push({
      label: eventTypeLabel(eventType),
      text: notesText,
    });
  }

  STRUCTURED_FIELDS.forEach(({ key, label }) => {
    const text = details?.[key]?.trim();
    if (text) sections.push({ label, text });
  });

  return { sections, originalNotes };
}

function annotateStructuredRecord(card) {
  if (!(card instanceof Element)) return;

  const entryId = entryIdFromStructuredCard(card);
  if (!entryId) return;

  const entryData = structuredNotesState.detailsById.get(String(entryId)) || null;
  const main = card.querySelector(".record-main");
  const badges = main?.querySelector(".badges");
  if (!main || !badges) return;

  const existing = main.querySelector(".structured-notes-summary");
  const { sections, originalNotes } = structuredSectionsForCard(card, entryData);

  if (!sections.length) {
    existing?.remove();
    originalNotes?.classList.remove("structured-notes-original");
    return;
  }

  originalNotes?.classList.add("structured-notes-original");

  const signature = JSON.stringify(sections);
  if (existing?.dataset.signature === signature) return;

  const summary = existing || document.createElement("div");
  summary.className = "structured-notes-summary";
  summary.dataset.signature = signature;
  summary.innerHTML = sections
    .map(
      ({ label, text }) => `
        <div class="structured-notes-section">
          <strong>${escapeStructuredHtml(label)}</strong>
          <p>${escapeStructuredHtml(text)}</p>
        </div>
      `
    )
    .join("");

  if (!existing) badges.insertAdjacentElement("beforebegin", summary);
}

function annotateStructuredNode(node) {
  if (!(node instanceof Element)) return;

  if (node.matches?.(".record-card")) annotateStructuredRecord(node);
  node.querySelectorAll?.(".record-card").forEach(annotateStructuredRecord);
}

function annotateAllStructuredRecords() {
  $structured("#records-list")
    ?.querySelectorAll(".record-card")
    .forEach(annotateStructuredRecord);
}

function installStructuredRecordsObserver() {
  const recordsList = $structured("#records-list");
  if (!recordsList || structuredNotesState.recordsObserver) return;

  structuredNotesState.recordsObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(annotateStructuredNode);
    });

    annotateAllStructuredRecords();
  });

  structuredNotesState.recordsObserver.observe(recordsList, {
    childList: true,
    subtree: true,
  });

  annotateAllStructuredRecords();
}

function waitForStructuredRecordsList() {
  installStructuredRecordsObserver();

  if (structuredNotesState.recordsObserver || structuredNotesState.bodyObserver) {
    return;
  }

  structuredNotesState.bodyObserver = new MutationObserver(() => {
    installStructuredRecordsObserver();

    if (structuredNotesState.recordsObserver) {
      structuredNotesState.bodyObserver.disconnect();
      structuredNotesState.bodyObserver = null;
    }
  });

  structuredNotesState.bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function waitForStructuredSave() {
  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    if ($structured("#page-records")?.classList.contains("active")) {
      clearInterval(timer);
      structuredNotesState.editingId = null;
      clearStructuredNotes();
      refreshStructuredNotesMap();
      return;
    }

    if (attempts >= 25) clearInterval(timer);
  }, 200);
}

function bindStructuredNotesEvents() {
  $structured("#entry-form")?.addEventListener(
    "submit",
    (event) => {
      const details = collectStructuredNotes();

      if (details && structuredNotesState.schemaReady === false) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showStructuredToast(
          "Nejdřív spusť SQL migraci pro detailní poznámky.",
          "error"
        );
        return;
      }

      waitForStructuredSave();
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const editButton = event.target.closest("[data-edit-entry]");

      if (editButton) {
        structuredNotesState.editingId = editButton.dataset.editEntry;
        setTimeout(
          () => loadStructuredNotesForEdit(structuredNotesState.editingId),
          100
        );
        return;
      }

      if (event.target.closest("#repeat-last-entry-btn")) {
        structuredNotesState.editingId = null;
        loadLastStructuredNotes();
        return;
      }

      if (
        event.target.closest(
          '#cancel-edit-btn, #entry-form button[type="reset"], [data-quick-template]'
        )
      ) {
        structuredNotesState.editingId = null;
        setTimeout(clearStructuredNotes, 0);
        return;
      }

      if (event.target.closest('.nav-tabs button[data-page="records"]')) {
        annotateAllStructuredRecords();
        refreshStructuredNotesMap();
        requestAnimationFrame(annotateAllStructuredRecords);
      }
    },
    true
  );

  ["#records-sport", "#records-season", "#records-type"].forEach((selector) => {
    $structured(selector)?.addEventListener("change", () => {
      queueMicrotask(annotateAllStructuredRecords);
      requestAnimationFrame(annotateAllStructuredRecords);
    });
  });
}

loadStructuredNotesCache();
injectStructuredNotesStyles();
injectStructuredNotesUi();
installStructuredNotesFetchPatch();
waitForStructuredRecordsList();
bindStructuredNotesEvents();
annotateAllStructuredRecords();

setTimeout(async () => {
  await checkStructuredNotesSchema();

  if (structuredNotesState.schemaReady) {
    await refreshStructuredNotesMap();
  }
}, 250);
