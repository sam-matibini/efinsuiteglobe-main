import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { emptyOrg } from '@/lib/timeAttendance/engine';

vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrganization: () => ({ organization: { id: 'org-1', name: 'Matibini Operations' } }),
  useMyOrganizationMemberships: () => ({ data: [{ organization_id: 'org-1', role: 'owner' }] }),
}));

vi.mock('@/hooks/useEmployees', () => ({
  useEmployees: () => ({ employees: [] }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'owner@example.com' }, isAdmin: true, signOut: vi.fn() }),
}));

vi.mock('@/hooks/useTimeAttendance', () => ({
  useTimeAttendance: () => ({
    org: emptyOrg('org-1'),
    isLoading: false,
    send: vi.fn(),
  }),
}));

import TimeAttendance from '@/pages/payroll/TimeAttendance';

describe('Time & Attendance page', () => {
  it('shows the services checkout instead of a blank screen', () => {
    render(
      <MemoryRouter>
        <TimeAttendance />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Time & Attendance' })).toBeInTheDocument();
    expect(screen.getByText('Services Checkout')).toBeInTheDocument();
    expect(screen.getByText('Employee Clock-In / Clock-Out')).toBeInTheDocument();
  });
});
