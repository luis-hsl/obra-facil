import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

const navItems = [
  {
    href: '/',
    label: 'Clientes',
    shortLabel: 'Clientes',
    match: (p: string) => p === '/' || p === '/clientes',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/andamento',
    label: 'Em Andamento',
    shortLabel: 'Andamento',
    match: (p: string) => p === '/andamento',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/operacional',
    label: 'Operacional',
    shortLabel: 'Operacional',
    match: (p: string) => p === '/operacional',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/concluidos',
    label: 'Concluídos',
    shortLabel: 'Concluídos',
    match: (p: string) => p === '/concluidos',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    shortLabel: 'Financeiro',
    match: (p: string) => p === '/financeiro',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/produtos',
    label: 'Produtos',
    shortLabel: 'Produtos',
    match: (p: string) => p.startsWith('/produtos'),
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/marca',
    label: 'Minha Marca',
    shortLabel: 'Marca',
    match: (p: string) => p === '/marca',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
];

// Bottom nav: 4 itens principais + "Mais"
const BOTTOM_NAV_MAIN = navItems.slice(0, 4);
const BOTTOM_NAV_MORE = navItems.slice(4);

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = BOTTOM_NAV_MORE.some(item => item.match(pathname));

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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline mb-1 ${
                item.match(pathname)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.icon}
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
      <main className="p-4 pb-24 max-w-lg mx-auto md:ml-60 md:max-w-none md:mx-0 md:px-8 md:py-6 md:pb-6">
        {children}
      </main>

      {/* Bottom Navigation Mobile — 5 itens: 4 principais + Mais */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-20">
        {/* Menu "Mais" — popup */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-full right-2 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[180px] z-20">
              {BOTTOM_NAV_MORE.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium no-underline ${
                    item.match(pathname) ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => { setMoreOpen(false); signOut(); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 w-full"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-around items-center">
          {BOTTOM_NAV_MAIN.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-1 min-w-0 flex-1 no-underline ${
                item.match(pathname) ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 truncate">{item.shortLabel}</span>
            </a>
          ))}
          {/* Botão "Mais" */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center py-2 px-1 min-w-0 flex-1 ${
              isMoreActive ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            <span className="text-[10px] mt-1">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
