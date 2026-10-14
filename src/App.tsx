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
import { Placeholder } from '@/app/Placeholder';
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
        <Route
          path="/returns"
          element={<Placeholder title="Returns & exchanges" sub="Requests from customers." />}
        />
        <Route
          path="/returns/:returnNo"
          element={<Placeholder title="Returns & exchanges" sub="Requests from customers." />}
        />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<ProductEditor />} />
        <Route path="/products/:id" element={<ProductEditor />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route
          path="/storefront"
          element={
            <Placeholder
              title="Banners & homepage"
              sub="Images and messages on the store home page."
            />
          }
        />
        <Route
          path="/customers"
          element={
            <Placeholder
              title="Customers"
              sub="Everyone who has ordered online or bought in person."
            />
          }
        />
        <Route
          path="/settings"
          element={
            <Placeholder
              title="Settings"
              sub="Store details, shipping, tracking, colours and your login."
            />
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
