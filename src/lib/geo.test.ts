import { describe, expect, it } from "vitest";
import { formatDistance } from "./geo";

describe("formatDistance", () => {
  it("usa metros por debajo de un kilómetro", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(149.6)).toBe("150 m");
  });

  it("usa kilómetros con un decimal desde 1000 m", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(2450)).toBe("2.5 km");
  });
});
