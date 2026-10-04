export interface HubNavItem {
  label: string;
  href: string;
}

/** Communication hub tabs, including the AI receptionist. */
export const COMMUNICATION_NAV: HubNavItem[] = [
  { label: 'Compose', href: '/communication' },
  { label: 'Inbox', href: '/communication?tab=inbox' },
  { label: 'Contacts', href: '/communication?tab=contacts' },
  { label: 'Voice', href: '/communication?tab=voice' },
  { label: 'Branding', href: '/communication?tab=branding' },
  { label: 'AI Receptionist', href: '/communication?tab=receptionist' },
];

/** True when a sidebar href matches the current path and query. Compose is the hub default. */
export function navHrefMatches(href: string, pathname: string, search: string): boolean {
  const [path, query] = href.split('?');
  if (pathname !== path) return false;
  const actual = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (!query) {
    if (path === '/communication') {
      const tab = actual.get('tab');
      return !tab || tab === 'compose';
    }
    return true;
  }
  const expected = new URLSearchParams(query);
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}
