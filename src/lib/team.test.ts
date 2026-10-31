import { describe, expect, it } from "vitest";
import { parseTeam } from "./team";

describe("parseTeam", () => {
  it("lee miembros e invitaciones", () => {
    const team = parseTeam({
      members: [{ user_id: "u1", email: "a@x.com", role: "owner" }],
      invites: [{ id: "i1", email: "b@x.com", role: "waiter" }],
    });
    expect(team.members).toEqual([{ userId: "u1", email: "a@x.com", role: "owner" }]);
    expect(team.invites).toEqual([{ id: "i1", email: "b@x.com", role: "waiter" }]);
  });

  it("descarta entradas con rol desconocido o sin id", () => {
    const team = parseTeam({
      members: [{ user_id: "u1", email: "a@x.com", role: "staff" }, { email: "x" }],
      invites: [{ id: "i1", email: "b@x.com", role: "jefe" }],
    });
    expect(team).toEqual({ members: [], invites: [] });
  });

  it("devuelve vacío con una respuesta inesperada", () => {
    expect(parseTeam(null)).toEqual({ members: [], invites: [] });
    expect(parseTeam([1, 2])).toEqual({ members: [], invites: [] });
  });
});
