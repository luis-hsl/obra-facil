import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import GlobalSearch from './GlobalSearch';

const navItems = [
  {
    href: '/',
    label: 'Agenda',
    shortLabel: 'Agenda',
    match: (p: string) => p === '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/clientes',
    label: 'Clientes',
    shortLabel: 'Clientes',
    match: (p: string) => p === '/clientes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/andamento',
    label: 'Em Andamento',
    shortLabel: 'Andamento',
    match: (p: string) => p === '/andamento',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/operacional',
    label: 'Operacional',
    shortLabel: 'Operacional',
    match: (p: string) => p === '/operacional',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    shortLabel: 'Financeiro',
    match: (p: string) => p === '/financeiro',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/produtos',
    label: 'Produtos',
    shortLabel: 'Produtos',
    match: (p: string) => p.startsWith('/produtos'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/marca',
    label: 'Minha Marca',
    shortLabel: 'Marca',
    match: (p: string) => p === '/marca',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm14 4h2a2 2 0 012 2v1a1 1 0 01-1 1h-1v0a1 1 0 00-1 1v7a2 2 0 01-4 0v-7a1 1 0 00-1-1v0a1 1 0 01-1-1v-1a2 2 0 012-2h3z" />
      </svg>
    ),
  },
];

// Grupos do sidebar: CRM (Agenda, Clientes, Andamento, Operacional) | Configurar (Financeiro, Produtos, Marca)
const SIDEBAR_GROUPS = [
  { label: 'CRM', items: navItems.slice(0, 4) },
  { label: 'Configurar', items: navItems.slice(4) },
];

// Bottom nav: 4 itens principais + "Mais"
const BOTTOM_NAV_MAIN = navItems.slice(0, 4);
const BOTTOM_NAV_MORE = navItems.slice(4);

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isMoreActive = BOTTOM_NAV_MORE.some(item => item.match(pathname));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header mobile — gradient */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 md:hidden shadow-md">
        <div className="flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-white no-underline tracking-tight">
            Obra Fácil
          </a>
          <div className="flex items-center gap-3">
            <button onClick={() => setSearchOpen(true)} className="text-blue-100 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button onClick={signOut} className="text-sm text-blue-100 hover:text-white font-medium">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 bg-white border-r border-slate-200/80 flex-col z-10">
        <div className="px-5 py-5 border-b border-slate-100">
          <a href="/" className="no-underline flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/30">
              <span className="text-white font-bold text-sm">OF</span>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Obra Fácil</span>
          </a>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Buscar...</span>
            <kbd className="ml-auto text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-400">Ctrl K</kbd>
          </button>
        </div>

        <nav className="flex-1 px-3 pt-4 overflow-y-auto">
          {SIDEBAR_GROUPS.map((group, gIdx) => (
            <div key={group.label} className={gIdx > 0 ? 'mt-5' : ''}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive = item.match(pathname);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-xl text-sm font-medium no-underline mb-0.5 relative transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {/* Barra lateral ativa */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                    )}
                    <span className={`flex-shrink-0 transition-colors duration-200 ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-100 pt-3">
          <button
            onClick={signOut}
            className="group w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
          >
            <svg className="w-5 h-5 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="p-4 pb-24 max-w-lg mx-auto md:ml-60 md:max-w-none md:mx-0 md:px-8 md:py-6 md:pb-6">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Bottom Navigation Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 md:hidden z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {/* Menu "Mais" — popup */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-10 bg-black/10" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-full right-2 mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 min-w-[180px] z-20 animate-slide-up">
              {BOTTOM_NAV_MORE.map((item) => {
                const isActive = item.match(pathname);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium no-underline ${
                      isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </a>
                );
              })}
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => { setMoreOpen(false); signOut(); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 w-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-around items-center">
          {BOTTOM_NAV_MAIN.map((item) => {
            const isActive = item.match(pathname);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-2 px-1 min-w-0 flex-1 no-underline relative transition-colors duration-150 ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" />
                )}
                <span className="transition-colors duration-200">
                  {item.icon}
                </span>
                <span className="text-xs mt-1 truncate font-medium">{item.shortLabel}</span>
              </a>
            );
          })}
          {/* Botão "Mais" */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center py-2 px-1 min-w-0 flex-1 relative transition-colors duration-150 ${
              isMoreActive ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            {isMoreActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" />
            )}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
