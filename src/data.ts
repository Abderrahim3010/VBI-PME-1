import { Product, Client, Supplier, PurchaseVoucher, SalesVoucher } from './types';

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'client-anonyme',
    code: 'CLI-0001',
    name: 'Anonyme',
    balance: 0,
    address: ''
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_PURCHASES: PurchaseVoucher[] = [];

export const INITIAL_SALES: SalesVoucher[] = [];

