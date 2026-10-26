import { Route, Routes } from 'react-router';
import { Header } from './components/Header';
import { RequireRole } from './components/RequireRole';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { LotPage } from './pages/LotPage';
import { NewLotPage } from './pages/NewLotPage';
import { RegisterPage } from './pages/RegisterPage';

export function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lots/:id" element={<LotPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/auctioneer/new"
            element={
              <RequireRole role="AUCTIONEER">
                <NewLotPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<p className="py-8">Página não encontrada.</p>} />
        </Routes>
      </main>
    </div>
  );
}