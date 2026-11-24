export function buildZatcaTlvBase64(
  sellerName: string,
  vatNumber: string,
  timestampIso: string,
  totalWithVat: string,
  vatAmount: string,
): string {
  const encoder = new TextEncoder();
  const chunks: number[] = [];
  const pushTag = (tag: number, val: string) => {
    const bytes = encoder.encode(val);
    chunks.push(tag, bytes.length, ...bytes);
  };
  pushTag(1, sellerName);
  pushTag(2, vatNumber);
  pushTag(3, timestampIso);
  pushTag(4, totalWithVat);
  pushTag(5, vatAmount);
  const binary = String.fromCharCode(...chunks);
  return btoa(binary);
}
