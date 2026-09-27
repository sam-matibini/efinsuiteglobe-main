import { notesDistinctFromPayment } from './invoiceDocumentText';

const payment = 'To make e-transfer donations, please use the email address: info@hsde.ca. If you would like to donate via Electronic Funds Transfer, let us know and we will provide a void cheque.';

describe('invoice notes and payment instructions', () => {
  it('hides a note that repeats the payment instructions', () => {
    const note = payment.replace(/\.$/, '');
    expect(notesDistinctFromPayment(note, payment)).toBeUndefined();
  });

  it('keeps a note that adds something besides the payment instructions', () => {
    expect(notesDistinctFromPayment(`Thank you for attending. ${payment}`, payment)).toBe('Thank you for attending.');
  });

  it('keeps a note when no payment instructions are shown', () => {
    expect(notesDistinctFromPayment('Due on receipt', '')).toBe('Due on receipt');
  });
});
