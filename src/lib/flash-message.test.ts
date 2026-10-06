import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeFlashMessage,
  FLASH_MESSAGE_KEY,
  FLASH_TOAST_DURATION_MS,
  saveFlashMessage,
  startFlashToast,
} from "@/lib/flash-message";

class MemorySessionStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("flash message", () => {
  it("is consumed once so a refresh cannot show an old success message", () => {
    const storage = new MemorySessionStorage();

    saveFlashMessage("新增成功", storage);

    expect(storage.getItem(FLASH_MESSAGE_KEY)).toBe("新增成功");
    expect(consumeFlashMessage(storage)).toBe("新增成功");
    expect(consumeFlashMessage(storage)).toBeNull();
  });
});

describe("flash toast lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows success briefly and clears itself after 2.5 seconds", () => {
    const storage = new MemorySessionStorage();
    const onMessage = vi.fn();
    saveFlashMessage("新增成功", storage);
    const cleanup = startFlashToast(onMessage, storage);

    expect(onMessage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(onMessage).toHaveBeenLastCalledWith("新增成功");
    expect(storage.getItem(FLASH_MESSAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(FLASH_TOAST_DURATION_MS - 1);
    expect(onMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(onMessage).toHaveBeenLastCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
    expect(onMessage).toHaveBeenCalledTimes(2);
  });

  it("clears a visible toast on navigation even when the next page has no message", () => {
    const storage = new MemorySessionStorage();
    const onMessage = vi.fn();
    saveFlashMessage("新增成功", storage);
    const leaveFirstPage = startFlashToast(onMessage, storage);
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(500);

    leaveFirstPage();
    expect(onMessage).toHaveBeenLastCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);

    const leaveNextPage = startFlashToast(onMessage, storage);
    vi.runAllTimers();
    expect(onMessage.mock.calls).toEqual([["新增成功"], [null], [null]]);
    expect(vi.getTimerCount()).toBe(0);
    leaveNextPage();
  });

  it("does not consume an undisplayed message when Strict Mode replays an effect", () => {
    const storage = new MemorySessionStorage();
    const onMessage = vi.fn();
    saveFlashMessage("新增成功", storage);
    const cancelFirstMount = startFlashToast(onMessage, storage);
    cancelFirstMount();

    expect(storage.getItem(FLASH_MESSAGE_KEY)).toBe("新增成功");
    expect(onMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    const cleanup = startFlashToast(onMessage, storage);
    vi.advanceTimersByTime(0);
    expect(onMessage.mock.calls).toEqual([["新增成功"]]);
    cleanup();
    expect(onMessage).toHaveBeenLastCalledWith(null);
  });

  it("gives a new page's success message its own lifetime", () => {
    const storage = new MemorySessionStorage();
    const onMessage = vi.fn();
    saveFlashMessage("新增成功", storage);
    const leaveFirstPage = startFlashToast(onMessage, storage);
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(1000);
    leaveFirstPage();

    saveFlashMessage("修改成功", storage);
    const cleanup = startFlashToast(onMessage, storage);
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(FLASH_TOAST_DURATION_MS - 1);
    expect(onMessage).toHaveBeenLastCalledWith("修改成功");
    vi.advanceTimersByTime(1);
    expect(onMessage).toHaveBeenLastCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
  });
});
