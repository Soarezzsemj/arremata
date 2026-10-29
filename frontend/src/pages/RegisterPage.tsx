import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/format';
import { safeNext, withNext } from '../lib/next';
import type { Role } from '../lib/types';
import { Square } from '../components/Square';
import { buttonClass, containerClass, errorClass, fieldLabelClass, inputClass, textLinkClass } from '../lib/ui';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('BIDDER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({ name, email, password, role });
      navigate(next ?? '/', { replace: next !== null });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${containerClass} py-12 md:py-20`}>
      <div className="mx-auto max-w-md">
        <p className="ui-label flex items-center gap-2 text-muted">
          <Square />
          Conta
        </p>
        <h1 className="ui-display mt-4 text-5xl leading-[0.9] md:text-6xl">Criar conta</h1>
        <form onSubmit={onSubmit} className="mt-10 space-y-6 border-t border-line pt-8">
          <label className={fieldLabelClass}>
            Nome
            <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className={fieldLabelClass}>
            E-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>
          <label className={fieldLabelClass}>
            Senha (mínimo 6 caracteres)
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={fieldLabelClass}>
            Perfil
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              <option value="BIDDER">Licitante (quero dar lances)</option>
              <option value="AUCTIONEER">Leiloeiro (quero criar lotes)</option>
            </select>
          </label>
          {error && <p role="alert" className={errorClass}>{error}</p>}
          <button type="submit" disabled={busy} className={`${buttonClass} w-full`}>
            {busy ? 'Criando...' : 'Criar conta'}
          </button>
        </form>
        <p className="mt-8 border-t border-line pt-6 text-sm">
          Já tem conta?{' '}
          <Link to={withNext('/login', next)} className={textLinkClass}>
            Entrar
          </Link>
        </p>
      </div>
    </section>
  );
}