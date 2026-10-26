import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { apiGet } from '../lib/api';
import type { LotSummary } from '../lib/types';
import { Brand } from './Brand';
import { Square } from './Square';
import { ThemeToggle } from './ThemeToggle';

const itemClass =
  'group ui-label inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-left transition-colors duration-150';
const activeClass = 'underline decoration-1 underline-offset-4';

const phaseLinks = [
  { value: '', label: 'Lotes' },
  { value: 'live', label: 'Ao vivo' },
  { value: 'scheduled', label: 'Agendados' },
  { value: 'ended', label: 'Encerrados' },
];

export function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);

  const lots = useQuery({
    queryKey: ['lots', ''],
    queryFn: () => apiGet<{ lots: LotSummary[]; serverTime: string }>('/lots'),
    refetchInterval: 10_000,
  });
  const count = lots.data?.lots.length;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  const currentPhase = location.pathname === '/' ? (params.get('phase') ?? '') : null;
  const navClass = ({ isActive }: { isActive: boolean }) => `${itemClass} ${isActive ? activeClass : ''}`;

  const items: ReactNode[] = phaseLinks.map((p) => {
    const active = currentPhase === p.value;
    return (
      <Link
        key={p.value || 'all'}
        to={p.value ? `/?phase=${p.value}` : '/'}
        aria-current={active ? 'page' : undefined}
        className={`${itemClass} ${active ? activeClass : ''}`}
      >
        <Square />
        {p.label}
        {p.value === '' && count !== undefined && <span className="text-muted">[{String(count).padStart(2, '0')}]</span>}
      </Link>
    );
  });

  if (user?.role === 'AUCTIONEER') {
    items.push(
      <NavLink key="new" to="/auctioneer/new" className={navClass}>
        <Square />
        Novo lote
      </NavLink>,
    );
  }

  if (user) {
    items.push(
      <span key="me" className={`${itemClass} text-muted`}>
        <Square />
        <span className="max-w-[16ch] truncate">{user.name}</span>
        <span>· {user.role === 'AUCTIONEER' ? 'Leiloeiro' : 'Licitante'}</span>
      </span>,
      <button key="logout" type="button" onClick={logout} className={itemClass}>
        <Square />
        Sair
      </button>,
    );
  } else {
    items.push(
      <NavLink key="login" to="/login" className={navClass}>
        <Square />
        Entrar
      </NavLink>,
      <NavLink key="register" to="/register" className={navClass}>
        <Square />
        Cadastrar
      </NavLink>,
    );
  }

  items.push(<ThemeToggle key="theme" className={itemClass} />);

  return (
    <header className="relative z-40">
      <div className="flex items-start justify-between gap-6 px-6 pt-5 md:px-10 md:pt-7">
        <Link to="/" aria-label="Arremata, página inicial" className="-ml-1 mt-1 inline-flex min-h-11 items-center px-1">
          <Brand className="text-5xl md:text-6xl" />
        </Link>

        {/* Desktop menu */}
        <nav
          aria-label="Principal"
          className="hidden grid-flow-col grid-rows-2 gap-x-8 md:grid lg:gap-x-14 xl:gap-x-20"
        >
          {items}
        </nav>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="menu-celular"
          className={`${itemClass} px-1 md:hidden`}
        >
          <Square />
          {open ? 'Fechar' : 'Menu'}
        </button>
      </div>

      {open && (
        <nav
          id="menu-celular"
          aria-label="Principal"
          className="mx-6 mt-3 grid grid-cols-1 border-y border-line py-2 min-[420px]:grid-cols-2 md:hidden"
        >
          {items}
        </nav>
      )}
    </header>
  );
}
