import { createHmac } from 'node:crypto';
import { config } from '../config';
import { create } from 'node:domain';


export type IssueCode = | 'SEQ_GAP' | 'BROKEN_LINK' | 'HASH_MISMATCH' | 'COUNT_MISMATCH' | 'HEAD_MISMATCH' | 'STATE_MISMATCH' | 'RECEIPT_MISMATCH';

export interface ChainIssue {
    code: IssueCode;
    seq?: number;
    message: string;
}

export interface ChainBid {
    seq: number;
    bidderId: string;
    amountCents: number;
    createdAt: Date;
    prevHash: string;
    hash: string;
}


export interface ChainLot {
    id: string;
    bidCount: number;
    headHash: string | null;
    currentPriceCents: number | null;
    leaderId: string | null;
}

export interface ChainReceipt {
    finalHash: string;
}

function hmac(parts: unknown[]): string {
    return createHmac('sha256', config.chainSecret).update(JSON.stringify(parts)).digest('hex');
}

export function genesisHash(lotId: string): string {
    return hmac(['genesis', lotId]);
}


export function computeBidHash(prevHash: string, lotId: string, seq: number, bidderId: string, amountCents: number, createdAtMs: number) : string {
    return hmac([prevHash, lotId, seq, bidderId, amountCents, createdAtMs]);
}


export function verifyChain(bidsInput: ChainBid[],lot: ChainLot,receipt?: ChainReceipt): ChainIssue[] {
  const issues: ChainIssue[] = [];
  const bids = [...bidsInput].sort((a, b) => a.seq - b.seq);

  let expectedSeq = 1;
  let previousStoredHash = genesisHash(lot.id);

  for (const bid of bids) {
    if (bid.seq !== expectedSeq) {
      issues.push({
        code: 'SEQ_GAP',
        seq: bid.seq,
        message: `Esperado lance #${expectedSeq}, encontrado #${bid.seq}.`,
      });
    }
    
    expectedSeq = bid.seq + 1; 

    if (bid.prevHash !== previousStoredHash) {
      issues.push({
        code: 'BROKEN_LINK',
        seq: bid.seq,
        message: `O lance #${bid.seq} não aponta para o lance anterior.`,
      });
    }

    const recomputed = computeBidHash(
      bid.prevHash,
      lot.id,
      bid.seq,
      bid.bidderId,
      bid.amountCents,
      bid.createdAt.getTime(),
    );
    if (recomputed !== bid.hash) {
      issues.push({
        code: 'HASH_MISMATCH',
        seq: bid.seq,
        message: `O conteúdo do lance #${bid.seq} não confere com o hash.`,
      });
    }

    previousStoredHash = bid.hash;
  }

  if (bids.length !== lot.bidCount) {
    issues.push({
      code: 'COUNT_MISMATCH',
      message: `O lote registra ${lot.bidCount} lances, mas existem ${bids.length}.`,
    });
  }

  const last = bids[bids.length - 1];
  const lastHash = last ? last.hash : null;
  if (lastHash !== lot.headHash) {
    issues.push({
      code: 'HEAD_MISMATCH',
      message: 'O último hash da cadeia não confere com o registrado no lote.',
    });
  }

  if (last) {
    if (lot.currentPriceCents !== last.amountCents || lot.leaderId !== last.bidderId) {
      issues.push({
        code: 'STATE_MISMATCH',
        message: 'Preço atual ou líder do lote não conferem com o último lance.',
      });
    }
  }

  if (receipt && receipt.finalHash !== lot.headHash) {
    issues.push({
      code: 'RECEIPT_MISMATCH',
      message: 'O hash final do recibo não confere com a cadeia do lote.',
    });
  }

  return issues;
}
