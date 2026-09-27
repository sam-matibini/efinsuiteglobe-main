function normalizeDocumentText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/g, '').toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Drop a note that only repeats the payment instructions already printed below it. */
export function notesDistinctFromPayment(notes?: string | null, paymentInstructions?: string | null): string | undefined {
  const note = (notes || '').trim();
  const payment = (paymentInstructions || '').trim();
  if (!note) return undefined;
  if (!payment) return note;

  const noteKey = normalizeDocumentText(note);
  const paymentKey = normalizeDocumentText(payment);
  if (!paymentKey) return note;
  if (noteKey === paymentKey) return undefined;

  if (noteKey.includes(paymentKey)) {
    const pattern = paymentKey.split(' ').filter(Boolean).map(escapeRegExp).join('\\s+');
    const stripped = note
      .replace(new RegExp(pattern, 'i'), '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[,.\-–]+|[,.\-–]+$/g, '')
      .trim();
    return stripped || undefined;
  }

  return note;
}
