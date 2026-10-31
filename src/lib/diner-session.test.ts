import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_MS, parseSavedSession } from "./diner-session";

const now = 1_000_000_000_000;
const valid = { sessionId: "s1", restaurantName: "Demo", tableLabel: "Mesa 1", savedAt: now - 1000 };

describe("parseSavedSession", () => {
  it("lee una sesión guardada reciente", () => {
    expect(parseSavedSession(JSON.stringify(valid), now)).toEqual(valid);
  });

  it("olvida la sesión cuando caduca", () => {
    const old = { ...valid, savedAt: now - SESSION_MAX_AGE_MS - 1 };
    expect(parseSavedSession(JSON.stringify(old), now)).toBeNull();
  });

  it("devuelve null con datos vacíos, rotos o incompletos", () => {
    expect(parseSavedSession(null, now)).toBeNull();
    expect(parseSavedSession("{no json", now)).toBeNull();
    expect(parseSavedSession('{"sessionId":"s1"}', now)).toBeNull();
    expect(parseSavedSession("123", now)).toBeNull();
  });
});
