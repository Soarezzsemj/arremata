import { Route, Routes } from 'react-router';
import { CropMarks } from './components/CropMarks';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { RequireAuth } from './components/RequireAuth';
import { RequireRole } from './components/RequireRole';
import { containerClass } from './lib/ui';
import { AuditPage } from './pages/AuditPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { LotPage } from './pages/LotPage';
import { MyAuctionsPage } from './pages/MyAuctionsPage';
import { NewLotPage } from './pages/NewLotPage';
import { ReceiptPage } from './pages/ReceiptPage';
import { RegisterPage } from './pages/RegisterPage';
import { WalletPage } from './pages/WalletPage';

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a
        href="#conteudo"
        className="ui-label sr-only z-[60] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <CropMarks />
      <Header />
      <main id="conteudo" className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lots/:id" element={<LotPage />} />
          <Route path="/comprovante/:token" element={<ReceiptPage />} />
          <Route path="/auditoria/:lotId" element={<AuditPage />} />
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
          <Route
            path="/carteira"
            element={
              <RequireAuth>
                <WalletPage />
              </RequireAuth>
            }
          />
          <Route
            path="/meus-leiloes"
            element={
              <RequireAuth>
                <MyAuctionsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<p className={`${containerClass} ui-label py-16`}>Página não encontrada.</p>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
