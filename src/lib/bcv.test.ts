import { describe, expect, it } from "vitest";
import { parseBcvNumber, parseBcvRates, parseDolarApi } from "./bcv";

/** Recorte de la portada del BCV con la misma estructura que la página real. */
const page = `
<div id="euro" class="col-sm-12"><div class="field-content"><div class="row recuadrotsmc">
<span> EUR </span><div class="centrado textp"><strong class="strong-tb"> 991,25386822</strong></div></div></div></div>
<div id="yuan"><strong class="strong-tb"> 133,71041635</strong></div>
<div id="dolar" class="col-sm-12"><div class="field-content"><div class="row recuadrotsmc">
<span> USD</span><div class="centrado textp"> <strong class="strong-tb">889,57540000</strong> </div></div></div></div>
<div class="pull-right dinpro center"> Fecha Valor: <span class="date-display-single" content="2026-11-02T00:00:00-04:00">Lunes, 02 Noviembre 2026</span></div>
`;

describe("parseBcvNumber", () => {
  it("lee el formato del BCV", () => {
    expect(parseBcvNumber("889,57540000")).toBeCloseTo(889.5754);
    expect(parseBcvNumber(" 1.234,50 ")).toBeCloseTo(1234.5);
  });

  it("rechaza lo que no es un número razonable", () => {
    for (const bad of ["", "abc", "0", "-5", "99999999999"]) expect(parseBcvNumber(bad)).toBeNull();
  });
});

describe("parseBcvRates", () => {
  it("extrae dólar, euro y fecha", () => {
    const rates = parseBcvRates(page);
    expect(rates?.usd).toBeCloseTo(889.5754);
    expect(rates?.eur).toBeCloseTo(991.25386822);
    expect(rates?.date).toBe("2026-11-02");
  });

  it("devuelve null si la página cambió o falta algo", () => {
    expect(parseBcvRates("<html>otra cosa</html>")).toBeNull();
    expect(parseBcvRates(page.replace('id="dolar"', 'id="otro"'))).toBeNull();
    expect(parseBcvRates(page.replace("Fecha Valor:", "Fecha:"))).toBeNull();
  });
});

describe("parseDolarApi", () => {
  it("lee promedio y fecha", () => {
    expect(parseDolarApi({ moneda: "USD", promedio: 889.2553, fechaActualizacion: "2026-10-30T00:00:00-04:00" })).toEqual({
      rate: 889.2553,
      date: "2026-10-30",
    });
  });

  it("descarta respuestas raras", () => {
    expect(parseDolarApi(null)).toBeNull();
    expect(parseDolarApi({ promedio: null, fechaActualizacion: "2026-10-30" })).toBeNull();
    expect(parseDolarApi({ promedio: 1, fechaActualizacion: "ayer" })).toBeNull();
  });
});
