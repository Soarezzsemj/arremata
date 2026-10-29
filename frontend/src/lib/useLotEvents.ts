import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from './api';

export function useLotEvents(lotId: string | undefined, enabled: boolean): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!lotId || !enabled || typeof EventSource === 'undefined') return;

    const source = new EventSource(`${API_URL}/lots/${encodeURIComponent(lotId)}/events`);
    const refetchLot = () => queryClient.invalidateQueries({ queryKey: ['lot', lotId] });
    const onChange = () => {
      refetchLot();
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['my-bids'] });
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
    };

    source.onopen = () => {
      setConnected(true);
      refetchLot();
    };
    
    source.onerror = () => setConnected(source.readyState === EventSource.OPEN);
    source.addEventListener('bid', onChange);
    source.addEventListener('settled', onChange);

    return () => {
      source.close();
      setConnected(false);
    };
  }, [lotId, enabled, queryClient]);

  return connected;
}
