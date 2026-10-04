export const CONTACTS_CHANGED_EVENT = 'efinsuite:contacts-changed';

export function notifyContactsChanged() {
  window.dispatchEvent(new Event(CONTACTS_CHANGED_EVENT));
}
