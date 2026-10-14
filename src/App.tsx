import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProductsPage } from '@/features/products/ProductsPage';
import { ProductEditor } from '@/features/products/ProductEditor';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { OrdersPage } from '@/features/orders/OrdersPage';
import { PosPage } from '@/features/pos/PosPage';
import { ReturnsPage } from '@/features/returns/ReturnsPage';
import { StorefrontPage } from '@/features/storefront/StorefrontPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { RequireAuth } from '@/app/RequireAuth';
import { useAuth } from '@/store/useAuth';

function LoginRoute() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

export default function App() {
  const load = useAuth((st) => st.load);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderNo" element={<OrdersPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/returns" element={<ReturnsPage />} />
        <Route path="/returns/:returnNo" element={<ReturnsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<ProductEditor />} />
        <Route path="/products/:id" element={<ProductEditor />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/storefront" element={<StorefrontPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
