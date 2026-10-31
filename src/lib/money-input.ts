/**
 * Lee un importe escrito por una persona («20», «20,5», «1.250,75», «1,250.75») y lo devuelve en céntimos.
 * Acepta coma o punto como decimal y puntos o comas como separador de miles. null si no es un importe válido.
 */
export function parseMoneyInput(input: string): number | null {
  const text = input.trim().replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);
  let integer = text;
  let decimals = "";

  if (decimalAt >= 0) {
    const after = text.length - decimalAt - 1;
    const sameSeparator = text.split(text[decimalAt]).length - 1;
    // Un único separador con 3 dígitos detrás se trata como miles («1.250»); con 1 o 2, como decimales.
    const isDecimal = after >= 1 && after <= 2 && sameSeparator === 1 ? true : lastDot >= 0 && lastComma >= 0 && after <= 2;
    if (isDecimal) {
      integer = text.slice(0, decimalAt);
      decimals = text.slice(decimalAt + 1);
    }
  }

  const whole = integer.replace(/[.,]/g, "");
  if (!/^\d+$/.test(whole) || whole.length > 12) return null;
  const cents = Number(whole) * 100 + Number((decimals + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
