import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config';

export type TokenPayload = { userId: string; role: Role };

const JWT_ALGORITHM = 'HS256';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('arremata-senha-inexistente', 10);

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { algorithm: JWT_ALGORITHM, expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
}