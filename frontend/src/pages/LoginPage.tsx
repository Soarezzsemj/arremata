import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/format';
import { Square } from '../components/Square';
import { buttonClass, containerClass, errorClass, fieldLabelClass, inputClass, textLinkClass } from '../lib/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
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
        <h1 className="ui-display mt-4 text-5xl leading-[0.9] md:text-6xl">Entrar</h1>
        <form onSubmit={onSubmit} className="mt-10 space-y-6 border-t border-line pt-8">
          <label className={fieldLabelClass}>
            E-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>
          <label className={fieldLabelClass}>
            Senha
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && <p role="alert" className={errorClass}>{error}</p>}
          <button type="submit" disabled={busy} className={`${buttonClass} w-full`}>
            {busy ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="mt-8 border-t border-line pt-6 text-sm">
          Não tem conta?{' '}
          <Link to="/register" className={textLinkClass}>
            Cadastre-se
          </Link>
        </p>
      </div>
    </section>
  );
}