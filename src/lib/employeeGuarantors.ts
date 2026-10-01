/** A guarantor row is stored only when a name was entered. Blank rows are skipped. */
export function namedGuarantors<T extends { full_name?: string | null }>(
  drafts: T[],
): Array<T & { full_name: string }> {
  return drafts.flatMap((draft) => {
    const full_name = (draft.full_name ?? '').trim();
    return full_name ? [{ ...draft, full_name }] : [];
  });
}
