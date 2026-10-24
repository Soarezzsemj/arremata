import { PrismaClient } from '@prisma/client';

// Um único PrismaClient para a aplicação inteira, para não abrir várias conexões com o banco.
// A conexão só acontece na primeira consulta, então importar este arquivo não exige banco.
export const prisma = new PrismaClient();
