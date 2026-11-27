import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { AccountPage } from './pages/AccountPage';
import { BookPage } from './pages/BookPage';
import { GamesPage } from './pages/GamesPage';
import { HomePage } from './pages/HomePage';
import { LocationsPage } from './pages/LocationsPage';
import { LoginPage } from './pages/LoginPage';
import { PartiesPage } from './pages/PartiesPage';
import { VenuePage } from './pages/VenuePage';
import { Shell } from './Shell';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="locations/:slug" element={<VenuePage />} />
          <Route path="parties" element={<PartiesPage />} />
          <Route path="parties/:code" element={<PartiesPage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="book" element={<BookPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="account/bookings" element={<RequireAuth><AccountPage /></RequireAuth>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login?next=/account/bookings" replace />;
  return children;
}
