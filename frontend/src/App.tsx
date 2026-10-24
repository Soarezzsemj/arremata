import { Route, Routes } from 'react-router';
import { ThemeToggle } from './components/ThemeToggle';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <span className="text-lg font-semibold">Arremata</span>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-5xl px-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
