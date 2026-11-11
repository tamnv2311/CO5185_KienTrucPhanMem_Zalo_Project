/**
 * Where the signed-in session lives.
 *
 * Each browser tab keeps its own copy (sessionStorage), so two tabs can be signed in as two
 * different accounts and stay that way across reloads. localStorage holds the most recent
 * sign-in so a brand-new tab starts signed in, like a normal web app.
 */
export interface StoredSession {
  /** Key of the local cache (the login e-mail). */
  userId: string;
  /** Id of the account on the backend (live mode). */
  remoteUserId?: string;
  mode: "live" | "demo";
  accessToken?: string;
  refreshToken?: string;
}

const KEY = "zalolite.session";

function parse(raw: string | null): StoredSession | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as StoredSession; } catch { return undefined; }
}

function shared(): StoredSession | undefined {
  try { return parse(localStorage.getItem(KEY)); } catch { return undefined; }
}

export function readSession(): StoredSession | undefined {
  try {
    const own = sessionStorage.getItem(KEY);
    if (own) return parse(own);
    const inherited = localStorage.getItem(KEY);
    if (inherited) sessionStorage.setItem(KEY, inherited);
    return parse(inherited);
  } catch {
    return undefined;
  }
}

export function writeSession(session: StoredSession) {
  try {
    const raw = JSON.stringify(session);
    sessionStorage.setItem(KEY, raw);
    localStorage.setItem(KEY, raw);
  } catch { /* storage unavailable: the session lasts until the page is closed */ }
}

/** Signs this tab out; the shared copy is only removed when it belongs to the same account. */
export function clearSession() {
  try {
    const own = parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    if (own && shared()?.userId === own.userId) localStorage.removeItem(KEY);
  } catch { /* nothing to clear */ }
}

/** Stores renewed tokens for this tab, and for new tabs when they would open the same account. */
export function updateTokens(accessToken: string, refreshToken: string) {
  try {
    const own = parse(sessionStorage.getItem(KEY));
    if (!own) return;
    const raw = JSON.stringify({ ...own, accessToken, refreshToken });
    sessionStorage.setItem(KEY, raw);
    if (shared()?.userId === own.userId) localStorage.setItem(KEY, raw);
  } catch { /* keep the in-memory session */ }
}

/**
 * Another tab of the same account may already have renewed the tokens (refresh tokens are
 * single-use). Returns true when newer tokens were adopted from it.
 */
export function adoptSharedTokens(): boolean {
  try {
    const own = parse(sessionStorage.getItem(KEY));
    const other = shared();
    if (!own || !other || other.userId !== own.userId || !other.accessToken || other.accessToken === own.accessToken) return false;
    sessionStorage.setItem(KEY, JSON.stringify({ ...own, accessToken: other.accessToken, refreshToken: other.refreshToken }));
    return true;
  } catch {
    return false;
  }
}
