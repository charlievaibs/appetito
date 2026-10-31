import { describe, expect, it } from "vitest";
import { describeStaffEvent, parsePerformance, parseStaffNames, parseTeam, personLabel, rangeStart } from "./team";

describe("parseTeam", () => {
  it("lee miembros e invitaciones", () => {
    const team = parseTeam({
      members: [{ user_id: "u1", email: "a@x.com", role: "owner", display_name: "Olga", active: true, open_tables: 2 }],
      invites: [{ id: "i1", email: "b@x.com", role: "waiter" }],
    });
    expect(team.members).toEqual([
      { userId: "u1", email: "a@x.com", role: "owner", displayName: "Olga", active: true, openTables: 2 },
    ]);
    expect(team.invites).toEqual([{ id: "i1", email: "b@x.com", role: "waiter" }]);
  });

  it("toma valores por defecto cuando faltan nombre o estado", () => {
    const [m] = parseTeam({ members: [{ user_id: "u1", email: "a@x.com", role: "waiter" }], invites: [] }).members;
    expect(m).toMatchObject({ displayName: null, active: true, openTables: 0 });
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

describe("personLabel", () => {
  it("prefiere el nombre, luego el correo", () => {
    expect(personLabel({ displayName: "Ana", email: "a@x.com" })).toBe("Ana");
    expect(personLabel({ displayName: null, email: "a@x.com" })).toBe("a@x.com");
    expect(personLabel({ displayName: " " })).toBe("Sin nombre");
  });
});

describe("parseStaffNames y parsePerformance", () => {
  it("lee nombres sin correos", () => {
    expect(parseStaffNames([{ user_id: "u1", name: "Wendy", role: "waiter" }, { user_id: "u2", name: "", role: "cashier" }, { role: "x" }])).toEqual([
      { userId: "u1", name: "Wendy", role: "waiter" },
      { userId: "u2", name: null, role: "cashier" },
    ]);
  });

  it("lee el rendimiento y convierte los números", () => {
    const [p] = parsePerformance([
      { user_id: "u1", role: "waiter", display_name: "Wendy", email: "w@x.com", active: true, tables: 4, items_taken: 12, sales_cents: "5000", collected_cents: 0, collected_count: 0, avg_minutes: 55, open_tables: 1 },
    ]);
    expect(p).toMatchObject({ tables: 4, itemsTaken: 12, salesCents: 5000, avgMinutes: 55, openTables: 1 });
    expect(parsePerformance([{ user_id: "u1", role: "waiter", avg_minutes: null }])[0].avgMinutes).toBeNull();
    expect(parsePerformance("raro")).toEqual([]);
  });
});

describe("rangeStart", () => {
  const now = new Date(2026, 9, 31, 15, 30);

  it("hoy empieza a medianoche", () => {
    expect(rangeStart("today", now)).toEqual(new Date(2026, 9, 31, 0, 0));
  });

  it("la semana y el mes incluyen el día de hoy", () => {
    expect(rangeStart("week", now)).toEqual(new Date(2026, 9, 25, 0, 0));
    expect(rangeStart("month", now)).toEqual(new Date(2026, 9, 2, 0, 0));
  });
});

describe("describeStaffEvent", () => {
  it("explica los eventos conocidos", () => {
    expect(describeStaffEvent("role_changed", { from: "waiter", to: "manager" })).toContain("waiter → manager");
    expect(describeStaffEvent("removed", {})).toContain("baja");
    expect(describeStaffEvent("algo_raro", null)).toBe("algo_raro");
  });
});
