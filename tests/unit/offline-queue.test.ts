// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireSyncLock,
  clearFailed,
  enqueueClock,
  getQueue,
  releaseSyncLock,
  removeQueued,
  subscribeQueue,
  updateQueued,
} from "@/lib/offline-queue";

const base = {
  kind: "in" as const,
  token: "t",
  workerId: "w-1",
  payload: { lat: 43.65, lng: -79.38, clientTimestamp: "2026-03-12T13:05:00.000Z" },
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("offline queue", () => {
  it("starts empty", () => {
    expect(getQueue()).toEqual([]);
  });

  it("enqueues actions in order and preserves the tap timestamp", () => {
    enqueueClock(base);
    enqueueClock({ ...base, kind: "out" });
    const q = getQueue();
    expect(q).toHaveLength(2);
    expect(q[0].kind).toBe("in");
    expect(q[1].kind).toBe("out");
    expect(q[0].attempts).toBe(0);
    expect(q[0].payload.clientTimestamp).toBe("2026-03-12T13:05:00.000Z");
    expect(q[0].id).toBeTruthy();
  });

  it("removes a single queued action by id", () => {
    const a = enqueueClock(base);
    enqueueClock({ ...base, kind: "out" });
    removeQueued(a.id);
    expect(getQueue().map((x) => x.kind)).toEqual(["out"]);
  });

  it("patches an action without dropping the rest", () => {
    const a = enqueueClock(base);
    updateQueued(a.id, { attempts: 3, lastError: "network" });
    const [item] = getQueue();
    expect(item.attempts).toBe(3);
    expect(item.lastError).toBe("network");
    expect(item.workerId).toBe("w-1");
  });

  it("clearFailed drops only the failed actions", () => {
    const a = enqueueClock(base);
    enqueueClock({ ...base, kind: "out" });
    updateQueued(a.id, { failed: true });
    clearFailed();
    const q = getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe("out");
  });

  it("survives a reload (persisted in localStorage)", () => {
    enqueueClock(base);
    const raw = window.localStorage.getItem("clockwise.offlineQueue.v1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it("recovers from corrupt storage instead of throwing", () => {
    window.localStorage.setItem("clockwise.offlineQueue.v1", "{not json");
    expect(getQueue()).toEqual([]);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const seen = vi.fn();
    const off = subscribeQueue(seen);
    enqueueClock(base);
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    enqueueClock(base);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("only lets one tab hold the sync lock at a time", () => {
    expect(acquireSyncLock()).toBe(true);
    expect(acquireSyncLock()).toBe(false);
    releaseSyncLock();
    expect(acquireSyncLock()).toBe(true);
  });

  it("lets a stale lock expire so a crashed tab cannot wedge sync", () => {
    expect(acquireSyncLock()).toBe(true);
    window.localStorage.setItem("clockwise.syncLock.v1", String(Date.now() - 60_000));
    expect(acquireSyncLock()).toBe(true);
  });
});
