import { describe, expect, it } from "vitest";
import {
  consumeFlashMessage,
  FLASH_MESSAGE_KEY,
  saveFlashMessage,
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
