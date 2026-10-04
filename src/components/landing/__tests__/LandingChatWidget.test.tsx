import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LandingChatWidget } from '../LandingChatWidget';

const speak = vi.hoisted(() => vi.fn());
const invoke = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAliceTTS', () => ({
  useAliceTTS: () => ({
    speak,
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    replay: vi.fn(),
    toggle: vi.fn(),
    isSpeaking: false,
    isPaused: false,
    isLoading: false,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

const today = new Date('2026-10-04T15:00:00.000Z');

beforeEach(() => {
  speak.mockClear();
  invoke.mockReset();
});

function openChat() {
  render(<LandingChatWidget today={today} />);
  fireEvent.click(screen.getByRole('button', { name: 'Chat with Alice' }));
}

describe('landing receptionist widget', () => {
  it('answers tax dates, books, and speaks without the marketing assistant', () => {
    openChat();
    expect(screen.getByText('AI Receptionist • ElevenLabs')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tax dates' }));
    expect(screen.getByText(/GST\/HST return: October 31, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Corporation tax balance: March 31, 2027/)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Book' }));
    expect(screen.getByText('Booked general appointment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Speak' }));
    expect(speak).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Email the desk' })).toHaveAttribute('href', expect.stringMatching(/^mailto:info@efintax\.biz/));
    expect(screen.getByRole('link', { name: 'Text the desk' })).toHaveAttribute('href', expect.stringMatching(/^sms:\+17789020442/));
    expect(screen.getByRole('link', { name: 'WhatsApp the desk' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/17789020442/));
  });

  it('saves a visitor contact on this visit', () => {
    openChat();
    fireEvent.click(screen.getByRole('button', { name: 'Add your contact' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ngozi Ade' } });
    fireEvent.change(screen.getByLabelText('Cell / phone'), { target: { value: '4165550199' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ngozi@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));

    expect(screen.getByText(/I am Ngozi Ade/)).toBeInTheDocument();
    expect(screen.getByText(/Lead saved/)).toBeInTheDocument();
    expect(screen.getByText('Contact saved: Ngozi Ade')).toBeInTheDocument();
    expect(decodeURIComponent(screen.getByRole('link', { name: 'Email the desk' }).getAttribute('href') || '')).toContain('Ngozi Ade');
  });

  it('keeps product questions on the marketing assistant', async () => {
    invoke.mockResolvedValue({ data: 'Plans start with a free trial.' });
    openChat();
    fireEvent.change(screen.getByLabelText('Type your question'), { target: { value: 'What does the software cost?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Plans start with a free trial.')).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('accounting-assistant', expect.any(Object));
  });
});
