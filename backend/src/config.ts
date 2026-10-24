import 'dotenv/config';

// Lê as variáveis de ambiente num lugar só, para o resto do código não usar process.env direto.

const isProduction = process.env.NODE_ENV === 'production';

// Em produção os segredos são obrigatórios: subir com um valor padrão conhecido
// deixaria qualquer um forjar tokens (JWT) ou recalcular a cadeia de hashes (CHAIN).
function readSecret(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`A variável de ambiente ${name} é obrigatória em produção`);
  }
  return devDefault;
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3333,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: readSecret('JWT_SECRET', 'dev-jwt-secret'),
  chainSecret: readSecret('CHAIN_SECRET', 'dev-chain-secret'),
};
