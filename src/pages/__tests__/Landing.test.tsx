import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../Landing';

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
}

describe('Landing Page', () => {
  it('renders without crashing', () => {
    renderLanding();
    expect(document.querySelector('.min-h-screen')).toBeTruthy();
  });

  it('displays brand name "efinsuite Globe"', () => {
    renderLanding();
    expect(screen.getAllByText('efinsuite Globe').length).toBeGreaterThanOrEqual(1);
  });

  it('has Features, Pricing, Testimonials nav links', () => {
    renderLanding();
    expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pricing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Testimonials').length).toBeGreaterThanOrEqual(1);
  });

  it('has Sign In and Get Started buttons', () => {
    renderLanding();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getAllByText('Get Started').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Live ticker badge', () => {
    renderLanding();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders hero headline with AI-Powered', () => {
    renderLanding();
    expect(screen.getByText('AI-Powered')).toBeInTheDocument();
  });

  it('renders Start Free Trial CTA', () => {
    renderLanding();
    expect(screen.getAllByText(/Start Free Trial/).length).toBeGreaterThanOrEqual(1);
  });
});
