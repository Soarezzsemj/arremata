export class AppError extends Error{
    constructor(
        public status: number,
        public code: string,
        message: string,
        public details?: unknown,
    ){
        super(message);
        this.name = "AppError";
    }

}

// status p fazer 
// 400, 401(sem token), 401(email ou senha errado/invalido),
// 403(recurso de outro usuario), 403(papel sem permissao), 404(nao encontrado),
// 409(conflito: email ja cadastrado, lote nao comecou/encerrado/cancelado,
// lance abaixo do minimo, saldo insuficiente, ja e o lider, lote com lances),
// 500(erro inesperado), 503(api externa fora do ar)

export function notFound(message: string):AppError{

    return new AppError(404,"NOT_FOUND",message)
}

export function badRequest(message: string, details?: unknown):AppError{

    return new AppError(400, "VALIDATION_ERROR", message, details)
}

export function unauthorized(message: string):AppError{

    return new AppError(401, "UNAUTHORIZED", message)
}

export function invalidCredentials(message: string):AppError{

    return new AppError(401, "INVALID_CREDENTIALS", message)
}

export function forbidden(message: string):AppError{

    return new AppError(403, "FORBIDDEN", message)
}

export function forbiddenRole(message: string):AppError{

    return new AppError(403, "FORBIDDEN_ROLE", message)
}

export function conflict(code: string, message: string): AppError {

  return new AppError(409, code, message);

}

export function externalUnavailable(message: string):AppError{

    return new AppError(503, "EXTERNAL_API_UNAVAILABLE",message)
}

export function internal(message: string):AppError{

    return new AppError(500, "INTERNAL",message)
}


