import { describe, it, expect } from 'vitest';
import type { Product, PurchaseVoucher } from '../src/types';

describe('Cost Price (Prix de Revient / PMP) Logic', () => {
  it('calculates initial PMP correctly for first purchase', () => {
    const startingStock = 0;
    const startingCost = 0;
    const purchasedQty = 5;
    const purchasedPrice = 500;

    const totalPurchasedCost = purchasedQty * purchasedPrice;
    const finalStock = startingStock + purchasedQty;
    const finalCostPrice = Math.round(totalPurchasedCost / purchasedQty);

    expect(finalStock).toBe(5);
    expect(finalCostPrice).toBe(500);
  });

  it('calculates weighted average PMP correctly when adding second purchase (User Scenario)', () => {
    // Scenario:
    // 1. Existing product AZERTY in catalog: stock = 5, prixDeRevient = 500
    // 2. New purchase voucher: qty = 2, prixAchat = 400
    const catalogProduct: Product = {
      code: 'AZERTY',
      designation: 'AZERTY',
      stock: 5,
      prixDeRevient: 500,
      prixAchat: 500,
      prixVente1: 1500,
      prixVente2: 1500,
      prixVente3: 1500
    };

    const newPurchaseQty = 2;
    const newPurchasePrice = 400;

    // A. Preview in draft modal
    const draftPMP = Math.round(
      ((catalogProduct.stock * (catalogProduct.prixDeRevient ?? 0)) + (newPurchaseQty * newPurchasePrice)) /
      (catalogProduct.stock + newPurchaseQty)
    );
    expect(draftPMP).toBe(471); // (5*500 + 2*400) / 7 = 3300 / 7 = 471.42... -> 471

    // B. Catalog product remains at 500 BEFORE saving voucher
    expect(catalogProduct.prixDeRevient).toBe(500);

    // C. Validation / Saving voucher
    const startingStock = catalogProduct.stock;
    const startingCost = catalogProduct.prixDeRevient ?? 0;
    const totalPurchasedCost = newPurchaseQty * newPurchasePrice;
    const finalStock = startingStock + newPurchaseQty;
    const finalCostPrice = Math.round(((startingStock * startingCost) + totalPurchasedCost) / finalStock);

    const updatedCatalogProduct: Product = {
      ...catalogProduct,
      stock: finalStock,
      prixDeRevient: finalCostPrice
    };

    expect(updatedCatalogProduct.stock).toBe(7);
    expect(updatedCatalogProduct.prixDeRevient).toBe(471);
  });

  it('correctly calculates PMP when editing an existing saved purchase voucher', () => {
    // Product catalog state after saving Bon 1 (5 @ 500) and Bon 2 (2 @ 400)
    const currentCatalogProduct: Product = {
      code: 'AZERTY',
      designation: 'AZERTY',
      stock: 7,
      prixDeRevient: 471,
      prixAchat: 400,
      prixVente1: 1500,
      prixVente2: 1500,
      prixVente3: 1500
    };

    // Original Bon 2 being edited: had 2 units @ 400
    const origQty = 2;
    const origCost = 800; // 2 * 400

    // New Bon 2 edit: changed to 4 units @ 400
    const newQty = 4;
    const newCost = 1600; // 4 * 400

    // 1. Revert original Bon 2
    const startingStock = currentCatalogProduct.stock - origQty; // 7 - 2 = 5
    const revertedTotalVal = (currentCatalogProduct.stock * (currentCatalogProduct.prixDeRevient ?? 0)) - origCost; // (7 * 471) - 800 = 2497
    const startingCost = Math.round(revertedTotalVal / startingStock); // 2497 / 5 = 499

    // 2. Apply new edit
    const finalStock = startingStock + newQty; // 5 + 4 = 9
    const finalCostPrice = Math.round((revertedTotalVal + newCost) / finalStock); // (2497 + 1600) / 9 = 4097 / 9 = 455

    expect(startingStock).toBe(5);
    expect(finalStock).toBe(9);
    expect(finalCostPrice).toBe(455);
  });
});
