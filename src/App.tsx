import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import AtendimentosList from './pages/AtendimentosList';
import AtendimentoForm from './pages/AtendimentoForm';
import AtendimentoDetail from './pages/AtendimentoDetail';
import ProdutosList from './pages/ProdutosList';
import ProdutoForm from './pages/ProdutoForm';

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
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />

        {/* Atendimentos */}
        <Route path="/" element={<ProtectedRoute><AtendimentosList /></ProtectedRoute>} />
        <Route path="/atendimentos/novo" element={<ProtectedRoute><AtendimentoForm /></ProtectedRoute>} />
        <Route path="/atendimentos/:id" element={<ProtectedRoute><AtendimentoDetail /></ProtectedRoute>} />
        <Route path="/atendimentos/:id/editar" element={<ProtectedRoute><AtendimentoForm /></ProtectedRoute>} />

        {/* Produtos */}
        <Route path="/produtos" element={<ProtectedRoute><ProdutosList /></ProtectedRoute>} />
        <Route path="/produtos/novo" element={<ProtectedRoute><ProdutoForm /></ProtectedRoute>} />
        <Route path="/produtos/:id/editar" element={<ProtectedRoute><ProdutoForm /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
