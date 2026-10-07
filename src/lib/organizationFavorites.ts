const STORAGE_PREFIX = 'efinsuite.favorite-organizations.';

export function favoriteOrganizationsKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId || 'local'}`;
}

export function readFavoriteOrganizationIds(userId?: string | null): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(favoriteOrganizationsKey(userId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function writeFavoriteOrganizationIds(userId: string | null | undefined, ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(favoriteOrganizationsKey(userId), JSON.stringify(ids));
}

export function toggleFavoriteOrganization(ids: string[], organizationId: string): string[] {
  return ids.includes(organizationId)
    ? ids.filter((id) => id !== organizationId)
    : [...ids, organizationId];
}

export function orderOrganizationsByFavorite<T extends { id: string; name: string }>(
  organizations: T[],
  favoriteIds: string[],
): T[] {
  const favorites = new Set(favoriteIds);
  return [...organizations].sort((a, b) => {
    const favoriteDelta = Number(favorites.has(b.id)) - Number(favorites.has(a.id));
    if (favoriteDelta !== 0) return favoriteDelta;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
