export function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `966${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('5')) digits = `966${digits}`;
  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = cleanPhone(phone);
  const encoded = encodeURIComponent(message);
  return cleaned ? `https://wa.me/${cleaned}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
