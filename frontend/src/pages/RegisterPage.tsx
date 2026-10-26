import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/format';
import type { Role } from '../lib/types';
import { buttonClass, inputClass } from '../lib/ui';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
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
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Nome
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm">
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm">
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
        <label className="block text-sm">
          Perfil
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
            <option value="BIDDER">Licitante (quero dar lances)</option>
            <option value="AUCTIONEER">Leiloeiro (quero criar lotes)</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Criando...' : 'Criar conta'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Já tem conta?{' '}
        <Link to="/login" className="text-indigo-600 hover:underline dark:text-indigo-400">
          Entrar
        </Link>
      </p>
    </section>
  );
}