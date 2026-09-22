import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './features/authSlice';
import { makeStore } from './store';

const sessionUser = {
  id: '10000000-0000-4000-8000-000000000001',
  displayName: 'Test Player',
  email: 'player@example.com',
  roles: ['CUSTOMER'],
};

function renderApp(path: string) {
  return render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
}

function mockGateway() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/identity/auth/login')) {
      return jsonResponse({ success: true, data: { token: 'jwt-token', user: sessionUser } });
    }
    if (url.endsWith('/health')) return jsonResponse({ status: 'ok' });
    return jsonResponse({ success: true, data: [] });
  }));
}

describe('protected routing and sessions', () => {
  beforeEach(mockGateway);

  it('redirects an anonymous visitor to login', async () => {
    renderApp('/app/catalog');
    expect(await screen.findByRole('heading', { name: 'Player sign in' })).toBeInTheDocument();
  });

  it('logs in, persists the session, and enters the protected layout', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), sessionUser.email);
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Enter arcade →' }));

    expect(await screen.findByRole('heading', { name: 'My arcade dashboard' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('jwt-token');
    expect(JSON.parse(localStorage.getItem(AUTH_USER_KEY) ?? '{}')).toMatchObject(sessionUser);
  });

  it('restores a valid stored session and keeps login inaccessible', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'stored-token');
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionUser));
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'My arcade dashboard' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Player sign in' })).not.toBeInTheDocument());
  });

  it('blocks a customer from the admin portal and hides admin navigation', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'customer-token');
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionUser));
    renderApp('/admin/users');

    expect(await screen.findByRole('heading', { name: /not available for your role/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Users/i })).not.toBeInTheDocument();
  });

  it('lets an administrator enter the admin portal', async () => {
    const admin = { ...sessionUser, roles: ['CUSTOMER', 'ADMIN'] };
    localStorage.setItem(AUTH_TOKEN_KEY, 'admin-token');
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(admin));
    renderApp('/admin/users');

    expect(await screen.findByRole('heading', { name: 'Players & staff' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /User Groups/i })).toBeInTheDocument();
  });

  it('sends an administrator to the admin portal even if login started from a customer path', async () => {
    const admin = { ...sessionUser, roles: ['ADMIN'] };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/identity/auth/login')) {
        return jsonResponse({ success: true, data: { token: 'admin-jwt', user: admin } });
      }
      return jsonResponse({ success: true, data: [] });
    }));
    const user = userEvent.setup();
    render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/app/dashboard' } } }]}>
          <App />
        </MemoryRouter>
      </Provider>,
    );

    await user.type(screen.getByLabelText('Email'), admin.email);
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Enter arcade →' }));

    expect(await screen.findByRole('heading', { name: 'Arcade command center' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Users/i })).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
