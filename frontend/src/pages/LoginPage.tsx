import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/format';
import { buttonClass, inputClass } from '../lib/ui';

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
    <section className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-bold">Entrar</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm">
          Senha
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Não tem conta?{' '}
        <Link to="/register" className="text-indigo-600 hover:underline dark:text-indigo-400">
          Cadastre-se
        </Link>
      </p>
    </section>
  );
}