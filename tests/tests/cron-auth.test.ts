import { describe, expect, it } from "vitest";
import { requireCronSecret } from "../app/api/_shared/cron-auth";

describe("cron auth", () => {
  it("accepts only Authorization bearer token", () => {
    process.env.CRON_SECRET = "secret";
    const valid = requireCronSecret(new Request("https://maya.test/api", { headers: { authorization: "Bearer secret" } }));
    const invalidQuery = requireCronSecret(new Request("https://maya.test/api?secret=secret"));

    expect(valid.ok).toBe(true);
    expect(invalidQuery.ok).toBe(false);
  });
});
