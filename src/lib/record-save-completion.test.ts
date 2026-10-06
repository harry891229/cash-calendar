import { describe, expect, it, vi } from "vitest";
import { commitRecordSave } from "@/lib/record-save-completion";
import { createSubmissionGuard } from "@/lib/submission-guard";

function failure() {
  throw new Error("Storage unavailable");
}

describe("committed record save completion", () => {
  it.each([
    { categoryFails: true, toastFails: false },
    { categoryFails: false, toastFails: true },
    { categoryFails: true, toastFails: true },
  ])("keeps a saved submission locked and navigates despite optional storage failure: %j", ({ categoryFails, toastFails }) => {
    const guard = createSubmissionGuard();
    const writtenIds: string[] = [];
    const saveRecords = vi.fn(() => writtenIds.push("new-record-id"));
    const rememberCategory = vi.fn(categoryFails ? failure : () => {});
    const showSuccess = vi.fn(toastFails ? failure : () => {});
    const navigate = vi.fn();
    expect(guard.tryLock()).toBe(true);

    const result = commitRecordSave({ saveRecords, rememberCategory, showSuccess, navigate });

    expect(result).toEqual({ navigated: true });
    expect(saveRecords).toHaveBeenCalledOnce();
    expect(rememberCategory).toHaveBeenCalledOnce();
    expect(showSuccess).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(writtenIds).toEqual(["new-record-id"]);
    expect(guard.tryLock()).toBe(false);
  });

  it("reports a failed primary write before any success actions run", () => {
    const rememberCategory = vi.fn();
    const showSuccess = vi.fn();
    const navigate = vi.fn();

    expect(() => commitRecordSave({ saveRecords: failure, rememberCategory, showSuccess, navigate })).toThrow("Storage unavailable");
    expect(rememberCategory).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports navigation failure as already committed instead of throwing a retryable save error", () => {
    const saveRecords = vi.fn();
    const result = commitRecordSave({
      saveRecords,
      rememberCategory: () => {},
      showSuccess: () => {},
      navigate: failure,
    });

    expect(result).toEqual({ navigated: false });
    expect(saveRecords).toHaveBeenCalledOnce();
  });
});
