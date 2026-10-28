import { queryOptions } from '@tanstack/react-query';
import { apiGet } from './api';
import type { Wallet } from './types';

export const walletQuery = queryOptions({
  queryKey: ['wallet'],
  queryFn: () => apiGet<Wallet>('/me/wallet'),
});
