import { MY_PAYMENT_URL } from '@/lib/cra/mypayment/catalog';

/**
 * Opens a blank tab synchronously (inside the click, so browsers allow it) and returns a
 * function that sends it to CRA My Payment once the record is saved. eFinsuite never
 * scripts the CRA page: the tab is detached from this app before it navigates.
 */
export function reserveCraTab(): { go: () => void; close: () => void } {
  const tab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      /* ignore */
    }
  }
  return {
    go: () => {
      if (tab && !tab.closed) tab.location.replace(MY_PAYMENT_URL);
      else window.open(MY_PAYMENT_URL, '_blank', 'noopener,noreferrer');
    },
    close: () => {
      if (tab && !tab.closed) tab.close();
    },
  };
}

export function openCraMyPayment() {
  window.open(MY_PAYMENT_URL, '_blank', 'noopener,noreferrer');
}
