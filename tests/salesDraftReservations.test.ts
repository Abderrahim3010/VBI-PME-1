import { describe, it, expect } from 'vitest';
import {
  calculateDraftReservations,
  applyReservationTransition,
  releaseDraftReservations,
  parseSalesOpenDrafts
} from '../src/services/salesDraftReservations';
import type { Product, VoucherItem, SalesOpenDraft } from '../src/types';

describe('Sales Draft Reservations Unit Tests', () => {
  const sampleProducts: Product[] = [
    { code: 'P1', designation: 'Produit 1', prixVente1: 100, prixVente2: 100, prixVente3: 100, stock: 50 },
    { code: 'P2', designation: 'Produit 2', prixVente1: 200, prixVente2: 200, prixVente3: 200, stock: 30 }
  ];

  it('calculates draft reservations for VENTE (decreases stock)', () => {
    const draftItems: VoucherItem[] = [
      { id: 'item-1', code: 'P1', designation: 'Produit 1', qty: 5, price: 100, total: 500 }
    ];
    const reservations = calculateDraftReservations(draftItems, [], 'VENTE');
    expect(reservations).toEqual([
      { lineId: 'item-1', productCode: 'P1', reservedQuantity: 5 }
    ]);

    const nextProducts = applyReservationTransition(sampleProducts, [], reservations);
    const p1 = nextProducts.find(p => p.code === 'P1');
    expect(p1?.stock).toBe(45);
  });

  it('calculates draft reservations for RETOUR (increases stock)', () => {
    const draftItems: VoucherItem[] = [
      { id: 'item-1', code: 'P1', designation: 'Produit 1', qty: 5, price: 100, total: 500 }
    ];
    const reservations = calculateDraftReservations(draftItems, [], 'RETOUR');
    expect(reservations).toEqual([
      { lineId: 'item-1', productCode: 'P1', reservedQuantity: -5 }
    ]);

    const nextProducts = applyReservationTransition(sampleProducts, [], reservations);
    const p1 = nextProducts.find(p => p.code === 'P1');
    expect(p1?.stock).toBe(55);
  });

  it('releases draft reservations back to catalog stock', () => {
    const draftItems: VoucherItem[] = [
      { id: 'item-1', code: 'P1', designation: 'Produit 1', qty: 10, price: 100, total: 1000 }
    ];
    const reservations = calculateDraftReservations(draftItems, [], 'VENTE');
    const reservedProducts = applyReservationTransition(sampleProducts, [], reservations);

    const draft: SalesOpenDraft = {
      draftId: 'draft-1',
      id: '0001',
      isEditingExisting: false,
      date: '23/07/2026',
      time: '12:00:00',
      clientName: 'Anonyme',
      type: 'VENTE',
      vendeurName: '<Aucun>',
      observations: '',
      versement: 0,
      remise: 0,
      tvaRate: 0,
      draftItems,
      originalItems: [],
      reservations,
      reservationStatus: 'reserved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const releasedProducts = releaseDraftReservations(reservedProducts, [draft]);
    const p1 = releasedProducts.find(p => p.code === 'P1');
    expect(p1?.stock).toBe(50);
  });

  it('parses valid JSON sales draft array', () => {
    const rawJson = JSON.stringify([
      {
        draftId: 'draft-1',
        id: '0001',
        isEditingExisting: false,
        date: '23/07/2026',
        time: '12:00:00',
        clientName: 'Anonyme',
        type: 'VENTE',
        vendeurName: '<Aucun>',
        observations: '',
        versement: 0,
        remise: 0,
        tvaRate: 0,
        draftItems: [{ id: 'item-1', code: 'P1', designation: 'Produit 1', qty: 5, price: 100, total: 500 }],
        originalItems: [],
        reservations: [{ lineId: 'item-1', productCode: 'P1', reservedQuantity: 5 }],
        reservationStatus: 'reserved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const result = parseSalesOpenDrafts(rawJson);
    expect(result.validDrafts).toHaveLength(1);
    expect(result.validDrafts[0].id).toBe('0001');
    expect(result.hadInvalidDrafts).toBe(false);
  });
});
