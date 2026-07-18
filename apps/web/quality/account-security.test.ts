import { describe, expect, it, vi } from "vitest";
import { deleteAccountAndEndSession, shouldApplyAccountProfile } from "../app/account-security";

describe("account session security", () => {
  it("rejects profile responses from a previous auth generation", () => {
    expect(shouldApplyAccountProfile(true, 2, 2)).toBe(true);
    expect(shouldApplyAccountProfile(true, 1, 2)).toBe(false);
    expect(shouldApplyAccountProfile(false, 2, 2)).toBe(false);
  });

  it("ends the local session only after server-side account deletion succeeds", async () => {
    const calls: string[] = [];
    await deleteAccountAndEndSession(async () => { calls.push("delete"); }, async () => { calls.push("signout"); });
    expect(calls).toEqual(["delete", "signout"]);

    const signOut = vi.fn();
    await expect(deleteAccountAndEndSession(async () => { throw new Error("failed"); }, signOut)).rejects.toThrow("failed");
    expect(signOut).not.toHaveBeenCalled();

    await expect(deleteAccountAndEndSession(async () => undefined, async () => { throw new Error("local signout failed"); })).resolves.toBeUndefined();
  });
});
