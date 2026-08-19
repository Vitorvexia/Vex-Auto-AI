import { describe, it, expect } from "vitest";
import { resolveAssignedToFilter, isStaleLead } from "@/lib/lead-filter";

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

describe("isStaleLead", () => {
  const now = new Date("2026-08-17T12:00:00.000Z").getTime();

  it("is not stale exactly at the 2h threshold", () => {
    const ultimaAtividade = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    expect(isStaleLead(ultimaAtividade, now)).toBe(false);
  });

  it("is stale just past the 2h threshold", () => {
    const ultimaAtividade = new Date(now - 2 * 60 * 60 * 1000 - 1000).toISOString();
    expect(isStaleLead(ultimaAtividade, now)).toBe(true);
  });

  it("is not stale for recent activity", () => {
    const ultimaAtividade = new Date(now - 5 * 60 * 1000).toISOString();
    expect(isStaleLead(ultimaAtividade, now)).toBe(false);
  });
});
