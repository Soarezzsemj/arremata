import { app } from './app';
import { config } from './config';
import { settleDueLots } from './services/settlement';

app.listen(config.port, () => {
  console.log(`API rodando na porta ${config.port}`);
});

setInterval(() => {
  settleDueLots().catch((err) => console.error('settleDueLots', err));
}, 30_000);