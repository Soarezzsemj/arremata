import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { forbiddenRole, unauthorized } from './errors';
import { verifyToken } from './auth';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Faça login para continuar.');
  }
  try {
    req.user = verifyToken(header.slice(7));
  } catch {
    throw unauthorized('Sessão inválida ou expirada.');
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      throw forbiddenRole('Você não tem permissão para esta ação.');
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      //token invalido ou expirado
    }
  }
  next();
}