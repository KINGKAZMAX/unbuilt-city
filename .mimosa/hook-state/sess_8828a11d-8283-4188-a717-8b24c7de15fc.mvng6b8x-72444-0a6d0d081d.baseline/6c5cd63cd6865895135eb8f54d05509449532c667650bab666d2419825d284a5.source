// Selected vessel: persisted so the city remembers who you were last time.
const KEY = 'unbuilt-city:char:v1';
let current = null;

export function getSelectedChar() {
  if (current) return current;
  try { current = globalThis.localStorage?.getItem(KEY) || null; }
  catch { current = null; }
  return current;
}

export function setSelectedChar(name) {
  current = name;
  try { globalThis.localStorage?.setItem(KEY, name); } catch { /* session-only */ }
}
