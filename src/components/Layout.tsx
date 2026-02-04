import { useAuth } from '../lib/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-gray-900 no-underline">
            Obra Fácil
          </a>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sair
          </button>
        </div>
        <nav className="flex gap-4 mt-2">
          <a href="/" className="text-sm font-medium text-gray-600 no-underline hover:text-gray-900">
            Visitas
          </a>
          <a href="/produtos" className="text-sm font-medium text-gray-600 no-underline hover:text-gray-900">
            Produtos
          </a>
        </nav>
      </header>
      <main className="max-w-lg mx-auto p-4">
        {children}
      </main>
    </div>
  );
}
