import { describe, expect, it } from "vitest";

import { getPublicProfile, resolvePublicProfileSlug } from "../app/profile-data";

describe("public medical profile", () => {
  it("keeps one canonical stable profile URL", () => {
    expect(resolvePublicProfileSlug("marina-alves")).toBe("dra-marina-alves");
    expect(resolvePublicProfileSlug("dra-marina-alves")).toBe("dra-marina-alves");
  });

  it("publishes the last confirmed data while a change is under review", () => {
    const profile = getPublicProfile("dra-marina-alves");

    expect(profile?.location.address).toBe("Rua das Palmeiras, 245");
    expect(profile?.pendingChange).toContain("em revisão");
    expect(profile?.contacts.whatsApp.verified).toBe(true);
  });
});
