import 'dotenv/config';



const isProduction = process.env.NODE_ENV === 'production';


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
