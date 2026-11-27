import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const venue = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Ambience',
  slug: 'ambience',
  city: 'Gurugram',
  mall: 'Ambience Mall',
  address: 'NH8',
  phone: '999',
  email: 'hello@arcade.test',
  description: 'Games and parties',
  timezone: 'Asia/Kolkata',
  active: true,
  partyTypeIds: [],
  packageCodes: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('public site', () => {
  it('shows open venues on the home page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [venue] }),
    })));
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Play first. Party louder.' })).toBeInTheDocument();
    expect(await screen.findAllByText('Gurugram')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Ambience' })).toBeInTheDocument();
  });

  it('says when no venues are open', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    })));
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('No venues are open yet.')).toBeInTheDocument();
  });

  it('asks for a venue before a package can be booked', async () => {
    const party = {
      id: 'b1000000-0000-4000-8000-000000000001',
      code: 'BIRTHDAY',
      title: 'Birthday',
      description: 'A birthday party',
      active: true,
      sortOrder: 1,
    };
    const pack = {
      code: 'LITE',
      name: 'Lite',
      description: 'Arcade play',
      pricePerPersonCents: 49900,
      currency: 'INR',
      minGuests: 10,
      maxGuests: 40,
      durationMinutes: 60,
      sortOrder: 1,
      active: true,
      inclusionIds: [],
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.includes('/package')
        ? [pack]
        : url.includes('/venues')
          ? [{ ...venue, partyTypeIds: [party.id] }]
          : url.includes('/party-types')
            ? [party]
            : [];
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data }),
      };
    }));
    render(
      <MemoryRouter initialEntries={['/parties']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Select a venue for availability and price.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Book this package' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Book a party at'), { target: { value: venue.id } });

    expect(await screen.findByRole('link', { name: 'Book this package' })).toBeInTheDocument();
    expect(screen.queryByText('Select a venue for availability and price.')).not.toBeInTheDocument();
  });
});
