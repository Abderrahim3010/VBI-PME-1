import type { Client, Product, SalesVoucher, VoucherItem } from '../types';
import { getStorageString, saveSalesReservationState } from './localDb';

export const SALES_OPEN_DRAFTS_KEY = 'sales_open_drafts';

export type DraftReservationStatus = 'reserved' | 'released' | 'committed';

export interface SalesDraftReservation {
  lineId: string;
  productCode: string;
  reservedQuantity: number;
}

export interface SalesOpenDraft {
  draftId: string;
  id: string;
  isEditingExisting: boolean;
  date: string;
  time: string;
  clientName: string;
  type: 'VENTE' | 'RETOUR';
  vendeurName: string;
  observations: string;
  versement: number;
  remise: number;
  tvaRate: number;
  draftItems: VoucherItem[];
  originalItems: VoucherItem[];
  reservations: SalesDraftReservation[];
  reservationStatus: DraftReservationStatus;
  createdAt: string;
  updatedAt: string;
  paymentMode?: 'ESPECE' | 'A_TERME';
}

export interface ParsedSalesDrafts {
  validDrafts: SalesOpenDraft[];
  recoverableInvalidReservations: SalesDraftReservation[];
  hadInvalidDrafts: boolean;
}

function isVoucherItem(value: unknown): value is VoucherItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' &&
    typeof item.code === 'string' &&
    typeof item.designation === 'string' &&
    typeof item.qty === 'number' && Number.isFinite(item.qty) &&
    typeof item.price === 'number' && Number.isFinite(item.price) &&
    typeof item.total === 'number' && Number.isFinite(item.total);
}

function isReservation(value: unknown): value is SalesDraftReservation {
  if (!value || typeof value !== 'object') return false;
  const reservation = value as Record<string, unknown>;
  return typeof reservation.lineId === 'string' &&
    typeof reservation.productCode === 'string' &&
    typeof reservation.reservedQuantity === 'number' &&
    Number.isFinite(reservation.reservedQuantity);
}

function isSalesOpenDraft(value: unknown): value is SalesOpenDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.draftId === 'string' &&
    typeof draft.id === 'string' &&
    typeof draft.isEditingExisting === 'boolean' &&
    typeof draft.date === 'string' &&
    typeof draft.time === 'string' &&
    typeof draft.clientName === 'string' &&
    (draft.type === 'VENTE' || draft.type === 'RETOUR') &&
    typeof draft.vendeurName === 'string' &&
    typeof draft.observations === 'string' &&
    typeof draft.versement === 'number' &&
    typeof draft.remise === 'number' &&
    typeof draft.tvaRate === 'number' &&
    Array.isArray(draft.draftItems) && draft.draftItems.every(isVoucherItem) &&
    Array.isArray(draft.originalItems) && draft.originalItems.every(isVoucherItem) &&
    Array.isArray(draft.reservations) && draft.reservations.every(isReservation) &&
    (draft.reservationStatus === 'reserved' || draft.reservationStatus === 'released' || draft.reservationStatus === 'committed') &&
    typeof draft.createdAt === 'string' &&
    typeof draft.updatedAt === 'string';
}

export function createSalesDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sales-draft-${crypto.randomUUID()}`;
  }
  return `sales-draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function calculateDraftReservations(
  draftItems: VoucherItem[],
  originalItems: VoucherItem[] = []
): SalesDraftReservation[] {
  const currentById = new Map<string, VoucherItem>();
  const originalById = new Map<string, VoucherItem>();

  for (const item of draftItems) {
    if (currentById.has(item.id)) throw new Error(`Duplicate sales draft line ID: ${item.id}`);
    currentById.set(item.id, item);
  }
  for (const item of originalItems) {
    if (originalById.has(item.id)) throw new Error(`Duplicate original sales line ID: ${item.id}`);
    originalById.set(item.id, item);
  }

  const lineIds = new Set([...currentById.keys(), ...originalById.keys()]);
  const reservations: SalesDraftReservation[] = [];
  for (const lineId of lineIds) {
    const current = currentById.get(lineId);
    const original = originalById.get(lineId);
    if (current && original && current.code !== original.code) {
      throw new Error(`Sales draft line ${lineId} changed product code`);
    }
    const reservedQuantity = (current?.qty ?? 0) - (original?.qty ?? 0);
    if (reservedQuantity !== 0) {
      reservations.push({
        lineId,
        productCode: current?.code ?? original!.code,
        reservedQuantity
      });
    }
  }
  return reservations;
}

function reservationTotals(reservations: SalesDraftReservation[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const reservation of reservations) {
    totals.set(
      reservation.productCode,
      (totals.get(reservation.productCode) ?? 0) + reservation.reservedQuantity
    );
  }
  return totals;
}

function reservationsMatch(left: SalesDraftReservation[], right: SalesDraftReservation[]): boolean {
  if (left.length !== right.length) return false;
  const byLine = new Map(left.map(item => [`${item.lineId}\u0000${item.productCode}`, item.reservedQuantity]));
  return right.every(item =>
    byLine.get(`${item.lineId}\u0000${item.productCode}`) === item.reservedQuantity
  );
}

export function applyReservationTransition(
  products: Product[],
  previousReservations: SalesDraftReservation[],
  nextReservations: SalesDraftReservation[]
): Product[] {
  const previousTotals = reservationTotals(previousReservations);
  const nextTotals = reservationTotals(nextReservations);
  const affectedCodes = new Set([...previousTotals.keys(), ...nextTotals.keys()]);
  const productCodes = new Set(products.map(product => product.code));
  for (const code of affectedCodes) {
    if (!productCodes.has(code)) throw new Error(`Reserved product ${code} no longer exists`);
  }

  return products.map(product => {
    if (!affectedCodes.has(product.code)) return product;
    const stock = product.stock +
      (previousTotals.get(product.code) ?? 0) -
      (nextTotals.get(product.code) ?? 0);
    return {
      ...product,
      stock,
      stockColis: Math.ceil(stock / 12)
    };
  });
}

export function releaseDraftReservations(products: Product[], drafts: SalesOpenDraft[]): Product[] {
  const reservations = drafts
    .filter(draft => draft.reservationStatus === 'reserved')
    .flatMap(draft => draft.reservations);
  return applyReservationTransition(products, reservations, []);
}

export function parseSalesOpenDrafts(raw: string | null): ParsedSalesDrafts {
  if (!raw) {
    return { validDrafts: [], recoverableInvalidReservations: [], hadInvalidDrafts: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { validDrafts: [], recoverableInvalidReservations: [], hadInvalidDrafts: true };
  }
  if (!Array.isArray(parsed)) {
    return { validDrafts: [], recoverableInvalidReservations: [], hadInvalidDrafts: true };
  }

  const validDrafts: SalesOpenDraft[] = [];
  const recoverableInvalidReservations: SalesDraftReservation[] = [];
  let hadInvalidDrafts = false;
  for (const value of parsed) {
    if (isSalesOpenDraft(value)) {
      if (value.reservationStatus !== 'reserved') {
        hadInvalidDrafts = true;
        continue;
      }
      try {
        const expectedReservations = calculateDraftReservations(value.draftItems, value.originalItems);
        if (reservationsMatch(value.reservations, expectedReservations)) {
          validDrafts.push(value);
          continue;
        }
      } catch {}
      hadInvalidDrafts = true;
      recoverableInvalidReservations.push(...value.reservations);
      continue;
    }
    hadInvalidDrafts = true;
    if (value && typeof value === 'object') {
      const reservations = (value as Record<string, unknown>).reservations;
      if (Array.isArray(reservations)) {
        recoverableInvalidReservations.push(...reservations.filter(isReservation));
      }
    }
  }
  return { validDrafts, recoverableInvalidReservations, hadInvalidDrafts };
}

export function readPersistedSalesDrafts(): ParsedSalesDrafts {
  return parseSalesOpenDrafts(getStorageString(SALES_OPEN_DRAFTS_KEY));
}

export async function persistSalesReservationMutation(
  products: Product[],
  openDrafts: SalesOpenDraft[],
  finalized?: { sales: SalesVoucher[]; clients: Client[] }
): Promise<void> {
  await saveSalesReservationState({
    products,
    openDrafts,
    ...(finalized ? { sales: finalized.sales, clients: finalized.clients } : {})
  });
}
