import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './app';

describe('App', () => {
  it('identifies the application and its purpose', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'CrediCuenta' })).toBeVisible();
    expect(screen.getByText(/control de creditos comerciales/i)).toBeVisible();
  });
});
