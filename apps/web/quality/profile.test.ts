import { describe, expect, it } from "vitest";

import { getPublicProfile, resolvePublicProfileSlug } from "../app/profile-data";

describe("public medical profile", () => {
  it("keeps one canonical stable profile URL", () => {
    expect(resolvePublicProfileSlug("marina-alves")).toBe("mariana-andrade");
    expect(resolvePublicProfileSlug("dra-marina-alves")).toBe("mariana-andrade");
  });

  it("publishes the migrated public profile through the reader seam", async () => {
    process.env.MEDARIO_PUBLIC_PROFILE_SOURCE = "fixture";
    const profile = await getPublicProfile("dra-marina-alves");

    expect(profile?.location.address).toBe("Rua das Palmeiras, 245");
    expect(profile?.name).toBe("Dra. Mariana Andrade");
    expect(profile?.contacts.phone.verified).toBe(true);
  });
});
