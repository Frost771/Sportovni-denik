const seasonReviewState = {
  client: null,
  clientPromise: null,
  schemaReady: null,
  reviewsById: new Map(),
  annotateTimer: null,
};

const $seasonReview = (selector) => document.querySelector(selector);

function escapeSeasonReviewHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function showSeasonReviewToast(message, type = "ok") {
  const toast = $seasonReview("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;

  clearTimeout(showSeasonReviewToast.timer);
  showSeasonReviewToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

function injectSeasonReviewStyles() {
  if ($seasonReview("#season-review-styles")) return;

  const style = document.createElement("style");
  style.id = "season-review-styles";
  style.textContent = `
    .season-review {
      margin-top: 13px;
      padding-top: 13px;
      border-top: 1px solid var(--line);
    }

    .season-review-heading {
      margin: 0 0 7px;
      color: var(--blue-dark);
      font-size: .86rem;
      font-weight: 800;
    }

    .season-review-text {
      margin: 0 0 10px;
      white-space: pre-wrap;
      line-height: 1.6;
    }

    .season-review-empty {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: .82rem;
    }

    .season-review-form label {
      display: block;
      margin: 0;
    }

    .season-review-form textarea {
      width: 100%;
      min-height: 150px;
      margin-top: 7px;
      resize: vertical;
    }

    .season-review-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-top: 10px;
    }

    .season-review-actions button {
      width: auto;
    }

    .season-review-hint {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: .76rem;
      line-height: 1.45;
    }

    .season-review-schema-warning {
      margin: 12px 0 16px;
      padding: 11px 13px;
      border: 1px solid #ead28c;
      border-radius: 12px;
      background: #fff7df;
      color: #6b5410;
      font-size: .82rem;
      line-height: 1.45;
    }

    @media (max-width: 560px) {
      .season-review-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .season-review-actions button {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureSeasonReviewWarning() {
  if ($seasonReview("#season-review-schema-warning")) return;

  const seasonsList = $seasonReview("#seasons-list");
  if (!seasonsList) return;

  const warning = document.createElement("div");
  warning.id = "season-review-schema-warning";
  warning.className = "season-review-schema-warning hidden";
  warning.textContent =
    "Databáze zatím nemá sloupec pro zhodnocení sezóny. Spusť SQL migraci season_review_migration.sql.";

  seasonsList.insertAdjacentElement("beforebegin", warning);
}

async function getSeasonReviewClient() {
  if (seasonReviewState.client) return seasonReviewState.client;

  if (!seasonReviewState.clientPromise) {
    seasonReviewState.clientPromise = (async () => {
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

  seasonReviewState.client = await seasonReviewState.clientPromise;
  return seasonReviewState.client;
}

async function checkSeasonReviewSchema() {
  try {
    const client = await getSeasonReviewClient();
    const { error } = await client
      .from("sport_seasons")
      .select("season_review")
      .limit(1);

    seasonReviewState.schemaReady = !error;
  } catch (error) {
    console.warn("Kontrola sloupce season_review selhala.", error);
    seasonReviewState.schemaReady = false;
  }

  $seasonReview("#season-review-schema-warning")?.classList.toggle(
    "hidden",
    seasonReviewState.schemaReady !== false
  );
}

async function refreshSeasonReviews() {
  if (seasonReviewState.schemaReady === false) return;

  try {
    const client = await getSeasonReviewClient();
    const { data, error } = await client
      .from("sport_seasons")
      .select("id, season_review");

    if (error) throw error;

    seasonReviewState.reviewsById = new Map(
      (data || []).map((season) => [
        String(season.id),
        season.season_review || "",
      ])
    );

    scheduleSeasonReviewAnnotation(0);
  } catch (error) {
    console.warn("Zhodnocení sezón se nepodařilo načíst.", error);
  }
}

function seasonIdFromCard(card) {
  const closeButton = card.querySelector("[data-close-season]");
  if (closeButton) return closeButton.dataset.closeSeason;

  const reopenButton = card.querySelector("[data-reopen-season]");
  if (reopenButton) return reopenButton.dataset.reopenSeason;

  return null;
}

function renderSeasonReviewReadMode(container, seasonId) {
  const review = seasonReviewState.reviewsById.get(String(seasonId)) || "";

  container.dataset.mode = "read";
  container.innerHTML = review
    ? `
      <p class="season-review-heading">Celkové zhodnocení sezóny</p>
      <p class="season-review-text">${escapeSeasonReviewHtml(review)}</p>
      <button
        type="button"
        class="secondary"
        data-edit-season-review="${escapeSeasonReviewHtml(seasonId)}"
      >
        Upravit zhodnocení
      </button>
    `
    : `
      <p class="season-review-empty">Celkové zhodnocení této sezóny zatím není vyplněné.</p>
      <button
        type="button"
        class="secondary"
        data-edit-season-review="${escapeSeasonReviewHtml(seasonId)}"
      >
        Přidat zhodnocení
      </button>
    `;
}

function renderSeasonReviewEditMode(container, seasonId) {
  const review = seasonReviewState.reviewsById.get(String(seasonId)) || "";

  container.dataset.mode = "edit";
  container.innerHTML = `
    <div class="season-review-form">
      <label>
        Celkové zhodnocení sezóny
        <textarea
          data-season-review-textarea="${escapeSeasonReviewHtml(seasonId)}"
          placeholder="Jak ses během sezóny cítil, v čem ses posunul, co se povedlo a na čem chceš pracovat dál…"
        ></textarea>
      </label>
      <div class="season-review-actions">
        <button
          type="button"
          class="primary"
          data-save-season-review="${escapeSeasonReviewHtml(seasonId)}"
        >
          Uložit zhodnocení
        </button>
        <button
          type="button"
          class="secondary"
          data-cancel-season-review="${escapeSeasonReviewHtml(seasonId)}"
        >
          Zrušit
        </button>
      </div>
      <p class="season-review-hint">
        Pole není povinné. Uložením prázdného textu stávající zhodnocení smažeš.
      </p>
    </div>
  `;

  const textarea = container.querySelector(
    `[data-season-review-textarea="${CSS.escape(String(seasonId))}"]`
  );

  if (textarea) {
    textarea.value = review;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
}

function annotateSeasonReviewCards() {
  if (seasonReviewState.schemaReady === false) return;

  document
    .querySelectorAll("#seasons-list .record-card")
    .forEach((card) => {
      const seasonId = seasonIdFromCard(card);
      if (!seasonId) return;

      let container = card.querySelector(".season-review");

      if (!container) {
        container = document.createElement("div");
        container.className = "season-review";
        container.dataset.seasonReviewId = String(seasonId);
        card.querySelector(".record-main")?.appendChild(container);
      }

      if (container.dataset.mode === "edit") return;

      const currentReview =
        seasonReviewState.reviewsById.get(String(seasonId)) || "";

      if (container.dataset.renderedReview === currentReview) return;

      renderSeasonReviewReadMode(container, seasonId);
      container.dataset.renderedReview = currentReview;
    });
}

function scheduleSeasonReviewAnnotation(delay = 120) {
  clearTimeout(seasonReviewState.annotateTimer);
  seasonReviewState.annotateTimer = setTimeout(
    annotateSeasonReviewCards,
    delay
  );
}

async function saveSeasonReview(seasonId, button) {
  const container = button.closest(".season-review");
  const textarea = container?.querySelector(
    `[data-season-review-textarea="${CSS.escape(String(seasonId))}"]`
  );

  if (!container || !textarea) return;

  if (seasonReviewState.schemaReady === false) {
    showSeasonReviewToast(
      "Nejdřív spusť SQL migraci pro sloupec season_review.",
      "error"
    );
    return;
  }

  const review = textarea.value.trim();
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Ukládám…";

  try {
    const client = await getSeasonReviewClient();
    const { error } = await client
      .from("sport_seasons")
      .update({ season_review: review || null })
      .eq("id", seasonId);

    if (error) throw error;

    seasonReviewState.reviewsById.set(String(seasonId), review);
    renderSeasonReviewReadMode(container, seasonId);
    container.dataset.renderedReview = review;

    showSeasonReviewToast(
      review
        ? "Zhodnocení sezóny bylo uloženo."
        : "Zhodnocení sezóny bylo smazáno."
    );
  } catch (error) {
    console.warn("Zhodnocení sezóny se nepodařilo uložit.", error);
    showSeasonReviewToast(
      error.message || "Zhodnocení sezóny se nepodařilo uložit.",
      "error"
    );

    button.disabled = false;
    button.textContent = originalText;
  }
}

function bindSeasonReviewEvents() {
  document.addEventListener(
    "click",
    (event) => {
      const editButton = event.target.closest("[data-edit-season-review]");
      if (editButton) {
        const seasonId = editButton.dataset.editSeasonReview;
        const container = editButton.closest(".season-review");
        if (container) renderSeasonReviewEditMode(container, seasonId);
        return;
      }

      const saveButton = event.target.closest("[data-save-season-review]");
      if (saveButton) {
        saveSeasonReview(
          saveButton.dataset.saveSeasonReview,
          saveButton
        );
        return;
      }

      const cancelButton = event.target.closest("[data-cancel-season-review]");
      if (cancelButton) {
        const seasonId = cancelButton.dataset.cancelSeasonReview;
        const container = cancelButton.closest(".season-review");
        if (container) {
          renderSeasonReviewReadMode(container, seasonId);
          container.dataset.renderedReview =
            seasonReviewState.reviewsById.get(String(seasonId)) || "";
        }
        return;
      }

      if (
        event.target.closest(
          '.nav-tabs button[data-page="seasons"], [data-close-season], [data-reopen-season]'
        )
      ) {
        setTimeout(() => {
          refreshSeasonReviews();
          scheduleSeasonReviewAnnotation(150);
        }, 500);
      }
    },
    true
  );

  $seasonReview("#season-form")?.addEventListener("submit", () => {
    setTimeout(() => {
      refreshSeasonReviews();
      scheduleSeasonReviewAnnotation(150);
    }, 650);
  });
}

injectSeasonReviewStyles();
ensureSeasonReviewWarning();
bindSeasonReviewEvents();

setInterval(() => {
  if ($seasonReview("#page-seasons")?.classList.contains("active")) {
    annotateSeasonReviewCards();
  }
}, 1000);

setTimeout(async () => {
  await checkSeasonReviewSchema();

  if (seasonReviewState.schemaReady) {
    await refreshSeasonReviews();
  }
}, 250);
