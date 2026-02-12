import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import ClientesList from './pages/ClientesList';
import AndamentoList from './pages/AndamentoList';
import OperacionalList from './pages/OperacionalList';
import ConcluidosList from './pages/ConcluidosList';
import Financeiro from './pages/Financeiro';
import AtendimentoForm from './pages/AtendimentoForm';
import AtendimentoDetail from './pages/AtendimentoDetail';
import Precificacao from './pages/Precificacao';
import ProdutosList from './pages/ProdutosList';
import ProdutoForm from './pages/ProdutoForm';
import MarcaConfig from './pages/MarcaConfig';
import Agenda from './pages/Agenda';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-sm">OF</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Carregando...</p>
        </div>
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-sm">OF</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />

        {/* Agenda (home) */}
        <Route path="/" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute><ClientesList /></ProtectedRoute>} />

        {/* Em Andamento */}
        <Route path="/andamento" element={<ProtectedRoute><AndamentoList /></ProtectedRoute>} />

        {/* Operacional */}
        <Route path="/operacional" element={<ProtectedRoute><OperacionalList /></ProtectedRoute>} />
        <Route path="/precificacao/:id" element={<ProtectedRoute><Precificacao /></ProtectedRoute>} />

        {/* Concluídos */}
        <Route path="/concluidos" element={<ProtectedRoute><ConcluidosList /></ProtectedRoute>} />

        {/* Financeiro */}
        <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />

        {/* Atendimentos (detail/form) */}
        <Route path="/atendimentos/novo" element={<ProtectedRoute><AtendimentoForm /></ProtectedRoute>} />
        <Route path="/atendimentos/:id" element={<ProtectedRoute><AtendimentoDetail /></ProtectedRoute>} />
        <Route path="/atendimentos/:id/editar" element={<ProtectedRoute><AtendimentoForm /></ProtectedRoute>} />

        {/* Produtos */}
        <Route path="/produtos" element={<ProtectedRoute><ProdutosList /></ProtectedRoute>} />
        <Route path="/produtos/novo" element={<ProtectedRoute><ProdutoForm /></ProtectedRoute>} />
        <Route path="/produtos/:id/editar" element={<ProtectedRoute><ProdutoForm /></ProtectedRoute>} />

        {/* Marca */}
        <Route path="/marca" element={<ProtectedRoute><MarcaConfig /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
