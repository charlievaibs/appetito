const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Da formato de dinero a un importe en céntimos: 1299 → "$12.99". */
export function formatPrice(cents: number): string {
  return usd.format(cents / 100);
}

/** Convierte "12", "12.5" o "12,50" en céntimos. Devuelve null si no es un precio válido. */
export function parsePriceToCents(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}
