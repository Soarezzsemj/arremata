import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError, badRequest } from './errors';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;


export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}


export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  
  const status = typeof err === 'object' && err !== null && 'status' in err ? err.status : undefined;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    let message = 'Requisição inválida.';
    if (status === 400) message = 'JSON inválido no corpo da requisição.';
    if (status === 413) message = 'Corpo da requisição grande demais.';
    res.status(status).json({ error: { code: 'VALIDATION_ERROR', message } });
    return;
  }


  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno do servidor.' } });
}

export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw badRequest('Dados inválidos.', {
        issues: result.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}