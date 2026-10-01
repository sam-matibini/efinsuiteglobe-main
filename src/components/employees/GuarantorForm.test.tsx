import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EMPTY_GUARANTOR, GuarantorsForm } from './GuarantorForm';

describe('GuarantorsForm', () => {
  it('lets onboarding continue when no guarantor is entered', () => {
    render(
      <GuarantorsForm
        first={EMPTY_GUARANTOR(1)}
        second={EMPTY_GUARANTOR(2)}
        onChangeFirst={() => {}}
        onChangeSecond={() => {}}
      />,
    );

    expect(screen.getByText(/Guarantors are optional/i)).toBeInTheDocument();
    expect(screen.queryByText(/required before this employee can be marked active/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Guarantor confirmation \(required\)/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Guarantor confirmation \(optional\)/i)).toHaveLength(2);
  });
});
