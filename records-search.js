const recordsSearchState = {
  observer: null,
  bodyObserver: null,
  applyTimer: null,
};

const $recordsSearch = (selector) => document.querySelector(selector);

function normalizeRecordsSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs")
    .replace(/\s+/g, " ")
    .trim();
}

function recordsSearchTokens() {
  const query = normalizeRecordsSearchText(
    $recordsSearch("#records-search-input")?.value
  );

  return query ? query.split(" ").filter(Boolean) : [];
}

function injectRecordsSearchStyles() {
  if ($recordsSearch("#records-search-styles")) return;

  const style = document.createElement("style");
  style.id = "records-search-styles";
  style.textContent = `
    .records-search-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: end;
      margin-bottom: 16px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: white;
    }

    .records-search-label {
      min-width: 0;
      margin: 0;
    }

    .records-search-label input {
      width: 100%;
      margin-top: 7px;
    }

    .records-search-clear {
      min-width: 100px;
      height: 46px;
    }

    .records-search-status {
      grid-column: 1 / -1;
      min-height: 1.25em;
      margin: 0;
      color: var(--muted);
      font-size: .8rem;
      line-height: 1.4;
    }

    .records-search-hidden {
      display: none !important;
    }

    @media (max-width: 620px) {
      .records-search-panel {
        grid-template-columns: 1fr;
      }

      .records-search-clear {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}

function injectRecordsSearchUi() {
  if ($recordsSearch("#records-search-panel")) return;

  const recordsList = $recordsSearch("#records-list");
  if (!recordsList) return;

  const panel = document.createElement("div");
  panel.id = "records-search-panel";
  panel.className = "records-search-panel";
  panel.innerHTML = `
    <label class="records-search-label">
      Hledat v záznamech
      <input
        id="records-search-input"
        type="search"
        placeholder="Soupeř, typ tréninku, povrch nebo text poznámky…"
        autocomplete="off"
        spellcheck="false"
      >
    </label>
    <button
      id="records-search-clear"
      type="button"
      class="secondary records-search-clear hidden"
    >
      Vymazat
    </button>
    <p
      id="records-search-status"
      class="records-search-status"
      aria-live="polite"
    ></p>
  `;

  recordsList.insertAdjacentElement("beforebegin", panel);
}

function searchableCardText(card) {
  return normalizeRecordsSearchText(card.textContent);
}

function updateRecordsSearchStatus(total, visible, hasQuery) {
  const status = $recordsSearch("#records-search-status");
  const clearButton = $recordsSearch("#records-search-clear");
  if (!status || !clearButton) return;

  clearButton.classList.toggle("hidden", !hasQuery);

  if (!hasQuery) {
    status.textContent = total
      ? `Zobrazeno ${total} záznamů podle vybraných filtrů.`
      : "";
    return;
  }

  if (!total) {
    status.textContent = "Pro vybrané filtry nejsou žádné záznamy.";
    return;
  }

  status.textContent = visible
    ? `Nalezeno ${visible} z ${total} záznamů.`
    : "Žádný záznam neodpovídá hledanému textu.";
}

function applyRecordsSearch() {
  const recordsList = $recordsSearch("#records-list");
  if (!recordsList) return;

  const cards = [...recordsList.querySelectorAll(".record-card")];
  const tokens = recordsSearchTokens();
  const hasQuery = tokens.length > 0;
  let visible = 0;

  cards.forEach((card) => {
    const text = searchableCardText(card);
    const matches = !hasQuery || tokens.every((token) => text.includes(token));

    card.classList.toggle("records-search-hidden", !matches);
    if (matches) visible += 1;
  });

  updateRecordsSearchStatus(cards.length, visible, hasQuery);
}

function scheduleRecordsSearch(delay = 0) {
  clearTimeout(recordsSearchState.applyTimer);
  recordsSearchState.applyTimer = setTimeout(applyRecordsSearch, delay);
}

function clearRecordsSearch() {
  const input = $recordsSearch("#records-search-input");
  if (!input) return;

  input.value = "";
  applyRecordsSearch();
  input.focus();
}

function bindRecordsSearchEvents() {
  const input = $recordsSearch("#records-search-input");
  const clearButton = $recordsSearch("#records-search-clear");
  if (!input || !clearButton) return;

  input.addEventListener("input", () => scheduleRecordsSearch(40));

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      event.preventDefault();
      clearRecordsSearch();
    }
  });

  clearButton.addEventListener("click", clearRecordsSearch);

  ["#records-sport", "#records-season", "#records-type"].forEach((selector) => {
    $recordsSearch(selector)?.addEventListener("change", () => {
      queueMicrotask(applyRecordsSearch);
      requestAnimationFrame(applyRecordsSearch);
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest('.nav-tabs button[data-page="records"]')) {
        queueMicrotask(applyRecordsSearch);
        requestAnimationFrame(applyRecordsSearch);
      }
    },
    true
  );
}

function installRecordsSearchObserver() {
  const recordsList = $recordsSearch("#records-list");
  if (!recordsList || recordsSearchState.observer) return;

  recordsSearchState.observer = new MutationObserver(() => {
    // Hlavní aplikace i doplňky překreslují karty dynamicky.
    // MutationObserver proběhne ještě před vykreslením dalšího snímku.
    applyRecordsSearch();
  });

  recordsSearchState.observer.observe(recordsList, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  applyRecordsSearch();
}

function waitForRecordsSearchElements() {
  injectRecordsSearchUi();
  installRecordsSearchObserver();

  if (
    ($recordsSearch("#records-search-panel") && recordsSearchState.observer) ||
    recordsSearchState.bodyObserver
  ) {
    return;
  }

  recordsSearchState.bodyObserver = new MutationObserver(() => {
    injectRecordsSearchUi();
    installRecordsSearchObserver();

    if ($recordsSearch("#records-search-panel") && recordsSearchState.observer) {
      bindRecordsSearchEvents();
      recordsSearchState.bodyObserver.disconnect();
      recordsSearchState.bodyObserver = null;
    }
  });

  recordsSearchState.bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

injectRecordsSearchStyles();
waitForRecordsSearchElements();
bindRecordsSearchEvents();
applyRecordsSearch();
