export interface Product {
  code: string;
  designation: string;
  prixVente1: number;
  prixVente2: number;
  prixVente3: number;
  stock: number;
  stockColis?: number;
  detail?: string;
  image?: string;
  category?: string;
  prixDeRevient?: number;
  prixAchat?: number;
  date?: string;
  blocked?: boolean;
  expirationDate?: string;
  hasExpiration?: boolean;
  alertDays?: number;
  stockMin?: number;
  colissage?: string;
  unitOfMeasure?: string;
  tva?: number;
  priceLimit?: number;
  productType?: string;
  destockBarcode?: string;
  destockQtyDeduced?: number;
  destockSur?: number;
  destockQtyToDestock?: number;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  balance: number; // Ancien solde
  address?: string;
  contact?: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  balance: number; // Ancien solde
  address?: string;
  contact?: string;
}

export interface VoucherItem {
  id: string;
  code: string;
  designation: string;
  nbreColis?: number;
  colisage?: number;
  pieces?: number;
  qty: number;
  price: number; // Prix d'achat ou Prix de vente
  total: number;
  purchasePrice?: number; // Frozen purchase price (prixAchat) at time of sale
  costPrice?: number; // Frozen cost price (prixDeRevient) at time of sale
}

export interface PurchaseVoucher {
  id: string; // N° du bon
  date: string; // DD/MM/YYYY
  time: string; // HH:MM:SS
  supplier: string; // Supplier name
  itemsCount: number;
  colisCount: number;
  amount: number;
  remise: number;
  totalHT: number;
  tva: number;
  timbre: number;
  ttc: number;
  versement: number;
  oldBalance: number;
  newBalance: number;
  items: VoucherItem[];
  paymentMode?: string;
  paymentSource?: string;
}

export interface SalesVoucher {
  id: string; // N° du BL
  date: string; // DD/MM/YYYY
  time: string; // HH:MM:SS
  client: string; // Client name
  type: 'VENTE' | 'RETOUR';
  itemsCount: number;
  colisCount: number;
  amount: number;
  remise: number;
  totalHT: number;
  tva: number;
  timbre: number;
  ttc: number;
  versement: number;
  oldBalance: number;
  newBalance: number;
  items: VoucherItem[];
  vendeur?: string;
  observations?: string;
  paymentMode?: string;
  paymentSource?: string;
}

export interface CoffreTransaction {
  id: string;
  coffreId: 'coffre1' | 'coffre2';
  type: 'ENTREE' | 'SORTIE';
  category: 'VENTE' | 'ACHAT' | 'VERSEMENT_CLIENT' | 'REGLEMENT_FOURNISSEUR' | 'APPORT' | 'CHARGE' | 'AUTRE';
  date: string;
  time: string;
  amount: number;
  label: string;
  reference?: string;
  note?: string;
  user?: string;
}

export type ActiveWindowId = 
  | 'products' 
  | 'purchases' 
  | 'sales' 
  | 'clients' 
  | 'suppliers' 
  | 'stats' 
  | 'caisse'
  | 'inventaire'
  | 'configuration'
  | 'help'
  | 'welcome'
  | 'situation'
  | 'situation_clients'
  | 'user_management';

export interface InventoryItem {
  code: string;
  designation: string;
  category?: string;
  prixAchat: number;
  prixVente1: number;
  stockTheorique: number;
  stockPhysique: number;
  ecart: number; // stockPhysique - stockTheorique
  valeurEcart: number; // ecart * prixAchat
}

export interface InventoryHistoryRecord {
  id: string;
  date: string;
  time: string;
  note?: string;
  totalArticlesCounted: number;
  totalEcartQty: number;
  totalEcartValue: number;
  items: InventoryItem[];
}

export interface User {
  id: string;
  username: string;
  password?: string;
  type: '1' | '9'; // '1' = Administrateur, '9' = Personnalisé
  permissions: string[]; // List of authorized permission codes e.g. ["1", "2"]
}

export interface TransactionLog {
  id: string;
  user: string;
  date: string;
  time: string;
  action: string;
}

export interface ClientPayment {
  id: string;
  clientId: string; // matches client.id
  clientName: string;
  date: string; // DD/MM/YYYY
  time: string; // HH:MM:SS
  amount: number;
  remark: string;
  user: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string; // matches supplier.id
  supplierName: string;
  date: string; // DD/MM/YYYY
  time: string; // HH:MM:SS
  amount: number;
  remark: string;
  user: string;
}

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

export interface PurchaseOpenDraft {
  id: string;
  date: string;
  time: string;
  supplier: string;
  draftItems: VoucherItem[];
  versement: number;
  paymentMode?: string;
  isEditingExisting?: boolean;
}

export interface AppConfig {
  companyName?: string;
  activity?: string;
  address?: string;
  phone?: string;
  nif?: string;
  nis?: string;
  rc?: string;
  ai?: string;
  rib?: string;
  isActivated?: boolean;
  activationKey?: string;
  deliveryInfo?: {
    defaultPayModeDelivery?: 'ESPECE' | 'A_TERME';
  };
}

export interface WindowInstance {
  id: ActiveWindowId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
}
