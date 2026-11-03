// Per-visitor conveniences kept in localStorage. Private windows, blocked site data and
// old browsers can make every access throw, so nothing here ever does: the pages work
// without it and simply start fresh.
const PREFIX = 'cc-web-';

export function loadJSON(key, fallback) {
    try {
        const raw = globalThis.localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function saveJSON(key, value) {
    try {
        globalThis.localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}
