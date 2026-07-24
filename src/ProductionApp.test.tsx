import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductionApp, UnavailableState } from './ProductionApp';

describe('production admin entry', () => {
  it('shows an explicit unavailable state instead of mock production data', () => {
    render(<ProductionApp config={{ configured: false, missing: ['VITE_SUPABASE_URL'] }} />);
    expect(screen.getByRole('heading', { name: 'Admin connection required' })).toBeInTheDocument();
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument();
    expect(screen.queryByText('Aarav Mehta')).not.toBeInTheDocument();
  });

  it('warns operators not to expose privileged credentials', () => {
    render(<UnavailableState missing={[]} />);
    expect(screen.getByText(/Never add Firebase Admin credentials/i)).toBeInTheDocument();
  });
});
