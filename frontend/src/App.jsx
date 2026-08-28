// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage    from './pages/AuthPage';
import SetupWizard from './pages/Setupwizard';   // ← capital W — match your filename exactly

// ── Protected route ───────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── Temporary dashboard placeholder ──────────────────────────────
function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div style={{
      padding: 40, fontFamily: 'sans-serif',
      background: '#0a0e1a', color: '#f0f4ff', minHeight: '100vh'
    }}>
      <h2 style={{ marginBottom: 8 }}>✅ Dashboard</h2>
      <p style={{ color: '#8b9ab8' }}>
        Welcome, <strong>{user?.full_name}</strong> · Role: <strong>{user?.role}</strong>
      </p>
      <button
        onClick={logout}
        style={{
          marginTop: 24, padding: '10px 20px',
          background: '#2563eb', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth — both /login and /register show the same AuthPage */}
          <Route path="/login"    element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />

          {/* Setup wizard — shown after first login */}
          <Route path="/setup" element={
            <PrivateRoute><SetupWizard /></PrivateRoute>
          } />

          {/* Dashboard */}
          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />

          {/* Default → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}