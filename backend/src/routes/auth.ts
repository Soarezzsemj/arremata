import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, validate } from '../lib/http';
import { requireAuth } from '../lib/guards';
import { hashPassword, verifyPassword, signToken } from '../lib/auth';
import { conflict, invalidCredentials, unauthorized } from '../lib/errors';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  role: z.enum(['AUCTIONEER', 'BIDDER']),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

function toUser(u: { id: string; name: string; email: string; role: string }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw conflict('EMAIL_TAKEN', 'E-mail já cadastrado.');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role,
        wallet: { create: {} },
      },
    });

    res.status(201).json({
      token: signToken({ userId: user.id, role: user.role }),
      user: toUser(user),
    });
  }),
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) throw invalidCredentials('E-mail ou senha incorretos.');

    res.json({
      token: signToken({ userId: user.id, role: user.role }),
      user: toUser(user),
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw unauthorized('Usuário não encontrado.');
    res.json({ user: toUser(user) });
  }),
);