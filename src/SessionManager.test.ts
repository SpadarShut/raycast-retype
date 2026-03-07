import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @raycast/api LocalStorage
// ---------------------------------------------------------------------------

const store = new Map<string, string>();

vi.mock("@raycast/api", () => ({
  LocalStorage: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  },
}));

import { HistoryManager, SessionManager } from "./SessionManager";
import type { Session } from "./SessionManager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    timestamp: Date.now(),
    originalText: "hello",
    sourceLayoutId: "en",
    triedTargetIds: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

describe("SessionManager", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe("load", () => {
    it("returns null when storage is empty", async () => {
      expect(await SessionManager.load()).toBeNull();
    });

    it("returns the stored session when present", async () => {
      const session = makeSession();
      await SessionManager.save(session);
      const loaded = await SessionManager.load();
      expect(loaded).toEqual(session);
    });

    it("returns null when stored value is invalid JSON", async () => {
      store.set("retype_session", "not-json");
      expect(await SessionManager.load()).toBeNull();
    });
  });

  describe("save", () => {
    it("persists the session so load retrieves it", async () => {
      const session = makeSession({ originalText: "world", sourceLayoutId: "ru" });
      await SessionManager.save(session);
      expect(await SessionManager.load()).toEqual(session);
    });

    it("overwrites a previously saved session", async () => {
      await SessionManager.save(makeSession({ originalText: "first" }));
      const second = makeSession({ originalText: "second" });
      await SessionManager.save(second);
      expect((await SessionManager.load())?.originalText).toBe("second");
    });
  });

  describe("isRepeat", () => {
    it("returns false when session is null", () => {
      expect(SessionManager.isRepeat(null)).toBe(false);
    });

    it("returns true when timestamp is within 3 seconds", () => {
      const session = makeSession({ timestamp: Date.now() - 1000 });
      expect(SessionManager.isRepeat(session)).toBe(true);
    });

    it("returns false when timestamp is older than 3 seconds", () => {
      const session = makeSession({ timestamp: Date.now() - 4000 });
      expect(SessionManager.isRepeat(session)).toBe(false);
    });

    it("returns true at exactly 2999 ms ago", () => {
      const session = makeSession({ timestamp: Date.now() - 2999 });
      expect(SessionManager.isRepeat(session)).toBe(true);
    });

    it("returns false at exactly 3000 ms ago", () => {
      const session = makeSession({ timestamp: Date.now() - 3000 });
      expect(SessionManager.isRepeat(session)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// HistoryManager
// ---------------------------------------------------------------------------

describe("HistoryManager", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe("load", () => {
    it("returns empty targetOrder when storage is empty", async () => {
      expect(await HistoryManager.load()).toEqual({ targetOrder: [] });
    });

    it("returns stored history", async () => {
      store.set("retype_history", JSON.stringify({ targetOrder: ["ru", "en"] }));
      expect(await HistoryManager.load()).toEqual({ targetOrder: ["ru", "en"] });
    });

    it("returns empty targetOrder when stored value is invalid JSON", async () => {
      store.set("retype_history", "bad-json");
      expect(await HistoryManager.load()).toEqual({ targetOrder: [] });
    });
  });

  describe("recordSuccess", () => {
    it("adds a new layout id to the front when history is empty", async () => {
      await HistoryManager.recordSuccess("ru");
      expect(await HistoryManager.load()).toEqual({ targetOrder: ["ru"] });
    });

    it("moves an existing id to the front without duplication", async () => {
      store.set("retype_history", JSON.stringify({ targetOrder: ["en", "ru", "be"] }));
      await HistoryManager.recordSuccess("ru");
      expect((await HistoryManager.load()).targetOrder).toEqual(["ru", "en", "be"]);
    });

    it("prepends a brand-new id before existing ones", async () => {
      store.set("retype_history", JSON.stringify({ targetOrder: ["en", "ru"] }));
      await HistoryManager.recordSuccess("be");
      expect((await HistoryManager.load()).targetOrder).toEqual(["be", "en", "ru"]);
    });

    it("does not duplicate the id when it is already first", async () => {
      store.set("retype_history", JSON.stringify({ targetOrder: ["ru", "en"] }));
      await HistoryManager.recordSuccess("ru");
      const history = await HistoryManager.load();
      expect(history.targetOrder).toEqual(["ru", "en"]);
      expect(history.targetOrder.filter((id) => id === "ru").length).toBe(1);
    });

    it("handles a single-element history correctly", async () => {
      store.set("retype_history", JSON.stringify({ targetOrder: ["en"] }));
      await HistoryManager.recordSuccess("ru");
      expect((await HistoryManager.load()).targetOrder).toEqual(["ru", "en"]);
    });
  });
});
