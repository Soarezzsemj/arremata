import { Request, Response, NextFunction } from "express";
import { AppError, badRequest } from "./errors";
import { ZodSchema } from "zod";
import path from "path";

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn:AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
  return res.status(err.status).json({
    error: { code: err.code, message: err.message, details: err.details },
  });
}

if (err instanceof SyntaxError && "status" in err && err.status === 400) {
  return res.status(400).json({
    error: { code: "VALIDATION_ERROR", message: "JSON inválido no corpo da requisição." },
  });
}

console.error(err);
return res.status(500).json({error: { code: "INTERNAL", message: "Erro interno do servidor." },});
}

export function validate(schema: ZodSchema){
    return(req: Request, res: Response, next: NextFunction) =>  {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const issues = result.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
            }));
            throw badRequest("Dados invalidos", {issues});
        }

        req.body = result.data;
        next();
    };
}