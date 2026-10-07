/**
 * PostgREST returns at most 1,000 rows unless the caller asks for the next page.
 * These helpers walk every page so a bank register can show its full quantity.
 */

export const POSTGREST_PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllPages<T extends { id?: string }>(
  fetchPage: (from: number, to: number) => PageResult<T>,
  pageSize = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    if (page.length === 0) break;

    let added = 0;
    for (const row of page) {
      if (row.id && seen.has(row.id)) continue;
      if (row.id) seen.add(row.id);
      rows.push(row);
      added += 1;
    }

    if (added === 0 || page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function fetchInChunks<T>(
  ids: string[],
  chunkSize: number,
  fetchChunk: (ids: string[]) => PageResult<T>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const { data, error } = await fetchChunk(chunk);
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}
