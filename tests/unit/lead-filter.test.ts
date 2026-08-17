import { describe, it, expect } from "vitest";
import { resolveAssignedToFilter } from "@/lib/lead-filter";

const CURRENT_USER = "11111111-1111-1111-1111-111111111111";
const OTHER_USER = "22222222-2222-2222-2222-222222222222";

describe("resolveAssignedToFilter", () => {
  it("defaults to the current user when no param is present (no query param)", () => {
    expect(resolveAssignedToFilter(undefined, CURRENT_USER)).toBe(CURRENT_USER);
  });

  it("returns undefined (no filter) when param is explicit 'all'", () => {
    expect(resolveAssignedToFilter("all", CURRENT_USER)).toBeUndefined();
  });

  it("returns 'none' when param is explicit 'none'", () => {
    expect(resolveAssignedToFilter("none", CURRENT_USER)).toBe("none");
  });

  it("returns the requested vendor id when param is a valid UUID", () => {
    expect(resolveAssignedToFilter(OTHER_USER, CURRENT_USER)).toBe(OTHER_USER);
  });

  it("defaults to the current user when param is a malformed UUID", () => {
    expect(resolveAssignedToFilter("not-a-uuid", CURRENT_USER)).toBe(CURRENT_USER);
  });
});
