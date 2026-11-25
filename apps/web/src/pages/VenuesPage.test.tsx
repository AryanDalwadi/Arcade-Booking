import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeStore } from '../store';
import { VenuesPage } from './VenuesPage';

const venueId = 'd1000000-0000-4000-8000-000000000001';

function json(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('venue admin masters', () => {
  it('shows the three default packages after a venue is opened', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/catalog/venues')) {
        return json([{
          id: venueId,
          name: 'Ambience Mall Gurgaon',
          slug: 'timezone-ambiencemallgurgaon',
          city: 'Gurgaon',
          mall: 'Ambience',
          address: '',
          phone: '',
          email: '',
          description: '',
          timezone: 'Asia/Kolkata',
          active: true,
          partyTypeIds: [],
          createdAt: '2026-11-24T10:00:00.000Z',
        }]);
      }
      if (url.endsWith('/api/catalog/party-types') || url.endsWith('/api/catalog/inclusions')) return json([]);
      if (url.endsWith(`/api/catalog/venues/${venueId}/packages`)) {
        return json(['LITE', 'CLASSIC', 'PREMIUM'].map((code, index) => ({
          id: `e1000000-0000-4000-8000-00000000000${index + 1}`,
          venueId,
          code,
          name: code === 'LITE' ? 'Lite' : code === 'CLASSIC' ? 'Classic' : 'Premium',
          description: `${code} package`,
          pricePerPersonCents: 49900,
          currency: 'INR',
          minGuests: 10,
          maxGuests: 40,
          durationMinutes: 60,
          sortOrder: index + 1,
          active: true,
          inclusionIds: [],
        })));
      }
      return json([]);
    }));

    render(
      <Provider store={makeStore()}>
        <MemoryRouter>
          <VenuesPage />
        </MemoryRouter>
      </Provider>,
    );

    expect(await screen.findByText('Ambience Mall Gurgaon')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    expect(await screen.findByRole('heading', { name: 'Lite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Classic' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Premium' })).toBeInTheDocument();
    expect(screen.getByText(/choose it in this venue/i)).toBeInTheDocument();
  });
});
