import { LocalStorage } from "@raycast/api";

const SESSION_KEY = "retype_session";
const HISTORY_KEY = "retype_history";

/** How long a re-trigger counts as "try next layout" rather than a fresh run. */
const REPEAT_THRESHOLD_MS = 3000;

export interface Session {
  /** Epoch ms when the last retype ran. */
  timestamp: number;
  /** The original text before any transformation. */
  originalText: string;
  /** ID of the detected source layout. */
  sourceLayoutId: string;
  /** IDs of target layouts already tried, in order. */
  triedTargetIds: string[];
}

export interface LayoutHistory {
  /** Layout IDs ordered most-recently-used first. */
  targetOrder: string[];
}

export const SessionManager = {
  async load(): Promise<Session | null> {
    const raw = await LocalStorage.getItem<string>(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  },

  async save(session: Session): Promise<void> {
    await LocalStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  isRepeat(session: Session | null): boolean {
    if (!session) return false;
    return Date.now() - session.timestamp < REPEAT_THRESHOLD_MS;
  },
};

export const HistoryManager = {
  async load(): Promise<LayoutHistory> {
    const raw = await LocalStorage.getItem<string>(HISTORY_KEY);
    if (!raw) return { targetOrder: [] };
    try {
      return JSON.parse(raw) as LayoutHistory;
    } catch {
      return { targetOrder: [] };
    }
  },

  /** Move targetId to front of history (most recently used). */
  async recordSuccess(targetId: string): Promise<void> {
    const history = await HistoryManager.load();
    const updated = [targetId, ...history.targetOrder.filter((id) => id !== targetId)];
    await LocalStorage.setItem(HISTORY_KEY, JSON.stringify({ targetOrder: updated }));
  },
};
