import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { containerClass } from '../lib/ui';
import { Brand } from './Brand';
import { Frame } from './Frame';

const linkClass = 'ui-label inline-flex min-h-11 items-center transition-colors duration-150 hover:underline hover:decoration-accent hover:underline-offset-4';

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="ui-label text-muted">[{title}]</h2>
      <ul className="mt-2">{children}</ul>
    </div>
  );
}

export function Footer() {
  const { user, logout } = useAuth();

  return (
    <footer className={`${containerClass} mt-24 pb-8`}>
      <Frame className="px-6 py-8 md:px-10 md:py-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Brand className="text-6xl" />
            <p className="ui-blurb mt-6 max-w-xs">
              Casa de leilões online de obras de arte. Acervo do Art Institute of Chicago.
            </p>
          </div>

          <Column title="Leilão">
            <li><Link to="/" className={linkClass}>Todos os lotes</Link></li>
            <li><Link to="/?phase=live" className={linkClass}>Ao vivo</Link></li>
            <li><Link to="/?phase=scheduled" className={linkClass}>Agendados</Link></li>
            <li><Link to="/?phase=ended" className={linkClass}>Encerrados</Link></li>
          </Column>

          <Column title="Conta">
            {user ? (
              <>
                {user.role === 'AUCTIONEER' && (
                  <li><Link to="/auctioneer/new" className={linkClass}>Novo lote</Link></li>
                )}
                <li>
                  <button type="button" onClick={logout} className={linkClass}>
                    Sair
                  </button>
                </li>
              </>
            ) : (
              <>
                <li><Link to="/login" className={linkClass}>Entrar</Link></li>
                <li><Link to="/register" className={linkClass}>Cadastrar</Link></li>
              </>
            )}
          </Column>

          <Column title="Ajuda">
            <li className="ui-label py-3 text-muted">Valores em reais (BRL)</li>
            <li className="ui-label pb-3 text-muted">Horários no fuso do seu navegador</li>
            <li>
              <a href="https://www.artic.edu" target="_blank" rel="noreferrer" className={linkClass}>
                Art Institute of Chicago ↗
              </a>
            </li>
          </Column>
        </div>

        <p className="ui-label mt-12 border-t border-line pt-4 text-muted">
          <span>© {new Date().getFullYear()} Arremata</span>
        </p>
      </Frame>
    </footer>
  );
}
