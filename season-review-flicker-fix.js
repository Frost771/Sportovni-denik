const seasonReviewFlickerState = {
  cachedReviews: new Map(),
  observer: null,
  cacheTimer: null,
};

const $seasonReviewFlicker = (selector) => document.querySelector(selector);

function seasonReviewFlickerIdFromCard(card) {
  const closeButton = card.querySelector("[data-close-season]");
  if (closeButton) return closeButton.dataset.closeSeason;

  const reopenButton = card.querySelector("[data-reopen-season]");
  if (reopenButton) return reopenButton.dataset.reopenSeason;

  return null;
}

function cacheSeasonReviewCard(card) {
  if (!(card instanceof Element)) return;

  const seasonId = seasonReviewFlickerIdFromCard(card);
  const review = card.querySelector(".season-review");

  if (!seasonId || !review) return;

  seasonReviewFlickerState.cachedReviews.set(
    String(seasonId),
    review.cloneNode(true)
  );
}

function cacheSeasonReviewNode(node) {
  if (!(node instanceof Element)) return;

  if (node.matches?.("#seasons-list .record-card, .record-card")) {
    cacheSeasonReviewCard(node);
  }

  node
    .querySelectorAll?.(".record-card")
    .forEach(cacheSeasonReviewCard);
}

function cacheAllSeasonReviews() {
  $seasonReviewFlicker("#seasons-list")
    ?.querySelectorAll(".record-card")
    .forEach(cacheSeasonReviewCard);
}

function restoreMissingSeasonReviews() {
  const seasonsList = $seasonReviewFlicker("#seasons-list");
  if (!seasonsList) return;

  seasonsList.querySelectorAll(".record-card").forEach((card) => {
    if (card.querySelector(".season-review")) {
      cacheSeasonReviewCard(card);
      return;
    }

    const seasonId = seasonReviewFlickerIdFromCard(card);
    const cached = seasonReviewFlickerState.cachedReviews.get(String(seasonId));

    if (!seasonId || !cached) return;

    const recordMain = card.querySelector(".record-main");
    if (!recordMain) return;

    recordMain.appendChild(cached.cloneNode(true));
  });
}

function scheduleSeasonReviewCache(delay = 0) {
  clearTimeout(seasonReviewFlickerState.cacheTimer);
  seasonReviewFlickerState.cacheTimer = setTimeout(() => {
    cacheAllSeasonReviews();
    restoreMissingSeasonReviews();
  }, delay);
}

function installSeasonReviewMutationObserver() {
  const seasonsList = $seasonReviewFlicker("#seasons-list");
  if (!seasonsList || seasonReviewFlickerState.observer) return;

  seasonReviewFlickerState.observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach(cacheSeasonReviewNode);
      mutation.addedNodes.forEach(cacheSeasonReviewNode);
    });

    restoreMissingSeasonReviews();
    queueMicrotask(cacheAllSeasonReviews);
  });

  seasonReviewFlickerState.observer.observe(seasonsList, {
    childList: true,
    subtree: true,
  });

  cacheAllSeasonReviews();
}

function bindSeasonReviewFlickerEvents() {
  document.addEventListener(
    "input",
    (event) => {
      if (event.target.matches("[data-season-review-textarea]")) {
        const card = event.target.closest(".record-card");
        if (card) cacheSeasonReviewCard(card);
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          "[data-edit-season-review], [data-save-season-review], " +
            "[data-cancel-season-review], [data-close-season], " +
            "[data-reopen-season], .nav-tabs button"
        )
      ) {
        scheduleSeasonReviewCache(0);
        scheduleSeasonReviewCache(80);
      }
    },
    true
  );
}

function initializeSeasonReviewFlickerFix() {
  installSeasonReviewMutationObserver();
  bindSeasonReviewFlickerEvents();

  // Seznam sezón může hlavní aplikace vytvořit až po přihlášení.
  const bodyObserver = new MutationObserver(() => {
    if ($seasonReviewFlicker("#seasons-list")) {
      installSeasonReviewMutationObserver();
      restoreMissingSeasonReviews();
    }
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

initializeSeasonReviewFlickerFix();
