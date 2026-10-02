import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import AuthPage from './pages/AuthPage';
import SetupWizard from './pages/setupwizard';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

import Purchases from './pages/Purchases';
import NewPurchase from './pages/NewPurchase';
import PurchaseDetails from './pages/PurchaseDetails';
import Suppliers from "./pages/Suppliers";


function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();

  return isAuthenticated
    ? children
    : <Navigate to="/login" replace />;
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>

        <Routes>

          <Route
            path="/login"
            element={<AuthPage />}
          />

          <Route
            path="/register"
            element={<AuthPage />}
          />

          <Route
            path="/setup"
            element={
              <PrivateRoute>
                <SetupWizard />
              </PrivateRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />

          <Route
            path="/purchases"
            element={
              <PrivateRoute>
                <Purchases />
              </PrivateRoute>
            }
          />
          <Route
  path="/suppliers"
  element={
    <PrivateRoute>
      <Suppliers />
    </PrivateRoute>
  }
/>

          <Route
            path="/purchases/new"
            element={
              <PrivateRoute>
                <NewPurchase />
              </PrivateRoute>
            }
          />

          <Route
            path="/purchases/:id"
            element={
              <PrivateRoute>
                <PurchaseDetails />
              </PrivateRoute>
            }
          />

          <Route
            path="*"
            element={<Navigate to="/login" replace />}
          />

        </Routes>

      </AuthProvider>
    </BrowserRouter>
  );
}