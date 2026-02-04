import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

const navItems = [
  { href: '/', label: 'Visitas', match: (p: string) => p === '/' || p.startsWith('/obras') },
  { href: '/produtos', label: 'Produtos', match: (p: string) => p.startsWith('/produtos') },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header mobile */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 md:hidden">
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
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm font-medium no-underline ${
                item.match(pathname)
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 flex-col z-10">
        <div className="px-6 py-5">
          <a href="/" className="text-xl font-bold text-gray-900 no-underline">
            Obra Fácil
          </a>
        </div>

        <nav className="flex-1 px-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium no-underline mb-1 ${
                item.match(pathname)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="px-3 pb-5">
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="md:ml-60 max-w-lg mx-auto p-4">
        {children}
      </main>
    </div>
  );
}
