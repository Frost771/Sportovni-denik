const gkState = {
  client: null,
  editingId: null,
  schemaReady: null,
  statsById: new Map(),
  refreshTimer: null,
};

const $gk = (selector) => document.querySelector(selector);

const FIELDS = [
  ["shots_on_goal", "Střely na bránu", 0, null],
  ["saves", "Zákroky", 0, null],
  ["goals_from_cross", "Góly po přihrávce přes brankoviště", 0, null],
  ["goals_from_rebound