const gkState = {
  client: null,
  clientPromise: null,
  editingId: null,
  schemaReady: null,
  statsById: new Map(),
};

const $gk = (selector) => document.querySelector(selector);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FIELDS = [
  ["shots_on_goal", "Střely na bránu", 0, null],
  ["saves", "Zákroky", 0, null],
  ["goals_from_cross", "Góly po přihrávce přes brankoviště", 0, null],
  ["goals_from_re