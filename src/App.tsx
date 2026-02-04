import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import ObrasList from './pages/ObrasList';
import ObraForm from './pages/ObraForm';
import ObraDetail from './pages/ObraDetail';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ObrasList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/obras/nova"
          element={
            <ProtectedRoute>
              <ObraForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/obras/:id"
          element={
            <ProtectedRoute>
              <ObraDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/obras/:id/editar"
          element={
            <ProtectedRoute>
              <ObraForm />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
