import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import BillingScreen from '../pages/BillingScreen';
import Dashboard from '../pages/Dashboard';
import Login from '../pages/Login';
import ProductList from '../pages/ProductList';
import PurchaseScreen from '../pages/PurchaseScreen';
import UserGroupList from '../pages/UserGroupList';
import UserList from '../pages/UserList';
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/users" element={<UserList />} />
        <Route path="/user-groups" element={<UserGroupList />} />
        <Route path="/billing" element={<BillingScreen />} />
        <Route path="/purchase" element={<PurchaseScreen />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
