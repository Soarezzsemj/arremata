// Seed do banco (dados de demonstração).
// Ainda não implementado: os usuários e lotes de exemplo entram quando os models existirem.
// Com --reset (npm run seed:reset) ele vai apagar os dados antes de semear.

const isReset = process.argv.includes('--reset');

console.log(isReset ? 'seed:reset ainda não implementado' : 'seed ainda não implementado');
