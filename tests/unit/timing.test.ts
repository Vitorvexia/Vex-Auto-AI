import { describe, it, expect, vi } from "vitest";
import { sleep } from "@/lib/timing";

describe("sleep", () => {
  it("resolve após o tempo informado (setTimeout real)", async () => {
    vi.useFakeTimers();
    const promise = sleep(500);
    let resolved = false;
    promise.then(() => { resolved = true; });

    await vi.advanceTimersByTimeAsync(499);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);

    vi.useRealTimers();
  });

  it("resolve sem valor (void)", async () => {
    vi.useFakeTimers();
    const promise = sleep(10);
    const advance = vi.advanceTimersByTimeAsync(10);
    const [result] = await Promise.all([promise, advance]);
    expect(result).toBeUndefined();
    vi.useRealTimers();
  });
});
