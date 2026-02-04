import { useAuth } from '../lib/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-gray-900 no-underline">
          Obra Fácil
        </a>
        <button
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sair
        </button>
      </header>
      <main className="max-w-lg mx-auto p-4">
        {children}
      </main>
    </div>
  );
}
