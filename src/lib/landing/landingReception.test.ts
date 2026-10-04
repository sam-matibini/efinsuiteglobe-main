import { describe, expect, it } from 'vitest';
import { followUpHref, isLandingReceptionRequest, landingVisitLines, replyToLandingVisitor, createLandingReceptionist, visitorIntroduction } from './landingReception';

const today = new Date('2026-10-04T15:00:00.000Z');

describe('landing page receptionist', () => {
  it('treats tax, booking, and channel requests as reception', () => {
    expect(isLandingReceptionRequest('When is GST/HST due?')).toBe(true);
    expect(isLandingReceptionRequest('I would like to book an appointment.')).toBe(true);
    expect(isLandingReceptionRequest('When are you open?')).toBe(true);
    expect(isLandingReceptionRequest('What does the software cost?')).toBe(false);
  });

  it('answers a tax question with the next filing dates', () => {
    const result = replyToLandingVisitor(createLandingReceptionist(), 'When are the GST/HST and corporation tax filing dates?', today);
    expect(result.reply).toMatch(/GST\/HST return: October 31, 2026/);
    expect(result.reply).toMatch(/Corporation tax balance: March 31, 2027/);
    expect(result.reply).toMatch(/name and phone number/i);
  });

  it('builds email, SMS, and WhatsApp follow-ups to the public desk', () => {
    const note = 'Please call me about payroll.';
    const visitor = { name: 'Ngozi Ade', phone: '4165550199', email: 'ngozi@example.com' };
    expect(followUpHref('email', note, visitor)).toMatch(/^mailto:info@efintax\.biz/);
    expect(decodeURIComponent(followUpHref('sms', note, visitor))).toMatch(/sms:\+17789020442/);
    expect(followUpHref('whatsapp', note, visitor)).toMatch(/^https:\/\/wa\.me\/17789020442/);
    expect(decodeURIComponent(followUpHref('email', note, visitor))).toContain('Ngozi Ade');
    expect(visitorIntroduction(visitor)).toBe('I am Ngozi Ade. My phone is 4165550199. My email is ngozi@example.com.');
  });

  it('keeps bookings, messages, and contacts from this visit', () => {
    let org = createLandingReceptionist();
    org = replyToLandingVisitor(org, 'I would like to book an appointment.', today).org;
    org = replyToLandingVisitor(org, 'Please take a message.', today).org;
    org = replyToLandingVisitor(org, visitorIntroduction({ name: 'Ngozi Ade', phone: '4165550199', email: 'ngozi@example.com' }), today).org;
    expect(landingVisitLines(org)).toEqual([
      'Booked general appointment',
      'Message saved for the desk',
      'Contact saved: Ngozi Ade',
    ]);
  });
});
