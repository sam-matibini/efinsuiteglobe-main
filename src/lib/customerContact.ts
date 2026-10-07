/** PostgREST reports a column the live database has not added yet. */
export function isMissingContactPersonColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  if (!message.includes('contact_person')) return false;
  return message.includes('column') || message.includes('schema') || message.includes('pgrst204');
}
