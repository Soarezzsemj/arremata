import { Link, NavLink } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from './ThemeToggle';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'hover:underline';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold">
          Arremata
        </Link>
        <nav className="flex gap-4 text-sm">
          <NavLink to="/" end className={linkClass}>
            Lotes
          </NavLink>
          {user?.role === 'AUCTIONEER' && (
            <NavLink to="/auctioneer/new" className={linkClass}>
              Novo lote
            </NavLink>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="text-slate-600 dark:text-slate-400">
              {user.name} ({user.role === 'AUCTIONEER' ? 'Leiloeiro' : 'Licitante'})
            </span>
            <button type="button" onClick={logout} className="hover:underline">
              Sair
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:underline">
              Entrar
            </Link>
            <Link to="/register" className="hover:underline">
              Cadastrar
            </Link>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}