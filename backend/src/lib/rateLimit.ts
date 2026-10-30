import rateLimit from 'express-rate-limit';

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
      },
    });
  },
};

export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
});

export const bidLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 60,
});

export const searchLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 30,
});