import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EMPTY_GUARANTOR, GuarantorsForm } from '../GuarantorForm';
import { useState } from 'react';
import type { GuarantorRequirement } from '@/lib/addEmployee';

function Harness() {
  const [first, setFirst] = useState(EMPTY_GUARANTOR(1));
  const [second, setSecond] = useState(EMPTY_GUARANTOR(2));
  const [requirement, setRequirement] = useState<GuarantorRequirement>('optional');
  return (
    <GuarantorsForm
      first={first}
      second={second}
      onChangeFirst={setFirst}
      onChangeSecond={setSecond}
      requirement={requirement}
      onRequirementChange={setRequirement}
    />
  );
}

describe('GuarantorsForm requirement toggle', () => {
  it('defaults to optional and does not show required confirmation', () => {
    render(<Harness />);

    const toggle = screen.getByRole('switch', { name: 'Require guarantors' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/does not require guarantors/i)).toBeInTheDocument();
    expect(screen.queryByText('Guarantor confirmation (required) *')).not.toBeInTheDocument();
  });

  it('shows required confirmation only after the toggle is turned on', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('switch', { name: 'Require guarantors' }));

    expect(screen.getByRole('switch', { name: 'Require guarantors' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByText('Guarantor confirmation (required) *')).toHaveLength(2);
  });
});
