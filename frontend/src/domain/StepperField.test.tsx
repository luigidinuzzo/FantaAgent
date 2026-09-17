import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { StepperField } from './StepperField';

function Harness({ initial = 10 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="f">Crediti</label>
      <StepperField
        id="f"
        value={value}
        onChange={setValue}
        min={1}
        max={30}
        step={5}
        decreaseLabel="Meno crediti"
        increaseLabel="Più crediti"
      />
    </>
  );
}

describe('StepperField', () => {
  it('− e + cambiano il valore del passo', async () => {
    render(<Harness />);
    const field = screen.getByLabelText('Crediti');
    await userEvent.click(screen.getByRole('button', { name: 'Più crediti' }));
    expect(field).toHaveValue(15);
    await userEvent.click(screen.getByRole('button', { name: 'Meno crediti' }));
    await userEvent.click(screen.getByRole('button', { name: 'Meno crediti' }));
    expect(field).toHaveValue(5);
  });

  it('si ferma ai limiti invece di superarli, e disattiva il bottone', async () => {
    render(<Harness initial={28} />);
    await userEvent.click(screen.getByRole('button', { name: 'Più crediti' }));
    expect(screen.getByLabelText('Crediti')).toHaveValue(30);
    expect(screen.getByRole('button', { name: 'Più crediti' })).toBeDisabled();
  });

  it('il campo resta scrivibile', async () => {
    render(<Harness />);
    const field = screen.getByLabelText('Crediti');
    await userEvent.clear(field);
    await userEvent.type(field, '1');
    expect(field).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Meno crediti' })).toBeDisabled();
  });
});
