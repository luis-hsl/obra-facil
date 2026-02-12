import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  match: (p: string) => boolean;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Clientes',
    shortLabel: 'Clientes',
    match: (p) => p === '/' || p === '/clientes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73A9.18 9.18 0 0112 12.75zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1A6.48 6.48 0 004 14c-.99 0-1.93.21-2.78.58A2.01 2.01 0 000 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0020 14c-.37 0-.74.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
      </svg>
    ),
  },
  {
    href: '/andamento',
    label: 'Em Andamento',
    shortLabel: 'Andamento',
    match: (p) => p === '/andamento',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" />
      </svg>
    ),
  },
  {
    href: '/operacional',
    label: 'Operacional',
    shortLabel: 'Operacional',
    match: (p) => p === '/operacional',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z" />
      </svg>
    ),
  },
  {
    href: '/concluidos',
    label: 'Concluídos',
    shortLabel: 'Concluídos',
    match: (p) => p === '/concluidos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    shortLabel: 'Financeiro',
    match: (p) => p === '/financeiro',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.87c0 1.88-1.43 2.93-3.12 3.17z" />
      </svg>
    ),
  },
  {
    href: '/produtos',
    label: 'Produtos',
    shortLabel: 'Produtos',
    match: (p) => p.startsWith('/produtos'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z" />
      </svg>
    ),
  },
  {
    href: '/marca',
    label: 'Minha Marca',
    shortLabel: 'Marca',
    match: (p) => p === '/marca',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z" />
      </svg>
    ),
  },
];

// Grupos do sidebar
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

  const isMoreActive = BOTTOM_NAV_MORE.some(item => item.match(pathname));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header mobile — gradient */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 md:hidden shadow-md">
        <div className="flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-white no-underline tracking-tight">
            Obra Fácil
          </a>
          <button
            onClick={signOut}
            className="text-sm text-blue-100 hover:text-white font-medium"
          >
            Sair
          </button>
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
                    <span className={`flex-shrink-0 transition-transform duration-150 ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500 group-hover:scale-110'
                    }`}>
                      {isActive ? item.activeIcon : item.icon}
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
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <span>{isActive ? item.activeIcon : item.icon}</span>
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
                <span className="transition-transform duration-150">
                  {isActive ? item.activeIcon : item.icon}
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
            <svg className="w-5 h-5" fill={moreOpen ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
