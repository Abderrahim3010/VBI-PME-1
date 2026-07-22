import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, Plus, X, Barcode } from 'lucide-react';
import { Product, Supplier, PurchaseVoucher, VoucherItem } from '../types';
import { getStorageJson, getStorageString, saveData, saveJson } from '../services/localDb';
import { BarcodeLabelModal, BarcodeProduct } from './BarcodeLabelModal';
import { useResizableColumns } from '../hooks/useResizableColumns';

interface PurchaseVoucherWindowProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseVoucher[];
  onAddPurchase: (voucher: PurchaseVoucher) => void;
  onUpdatePurchase?: (id: string, updatedVoucher: PurchaseVoucher) => void;
  onDeletePurchase: (id: string) => void;
  onClose: () => void;
  onProductsUpdate?: (updatedProducts: Product[]) => void;
  onAddSupplier?: (supplier: Supplier) => void;
  createdFamilles?: string[];
  onCreatedFamillesChange?: (familles: string[] | ((prev: string[]) => string[])) => void;
  isOpen?: boolean;
  config?: any;
}

function PurchaseVoucherWindow({
  products,
  suppliers,
  purchases,
  onAddPurchase,
  onUpdatePurchase,
  onDeletePurchase,
  onClose,
  onProductsUpdate,
  onAddSupplier,
  createdFamilles: propCreatedFamilles,
  onCreatedFamillesChange,
  isOpen = false,
  config
}: PurchaseVoucherWindowProps) {
  // Navigation / Selection of historical vouchers
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>(
    purchases.length > 0 ? purchases[purchases.length - 1].id : ''
  );
  
  // Mode state: 'view' or 'create'
  const [mode, setMode] = useState<'view' | 'create'>('view');

  // New Voucher Draft State
  const [newVoucherId, setNewVoucherId] = useState('');
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [newTime, setNewTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  });
  const [newSupplierName, setNewSupplierName] = useState('');
  const [draftItems, setDraftItems] = useState<VoucherItem[]>([]);
  const [versement, setVersement] = useState<number>(0);
  
  // Highlighting/selection state for drafting table
  const [selectedDraftIdx, setSelectedDraftIdx] = useState<number>(-1);

  // Custom Barcode input/filter simulator state
  const [barcodeInput, setBarcodeInput] = useState('');

  // Local specific-bon search states
  const [localSearchOpen, setLocalSearchOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Registre filters
  const [filterVoucherId, setFilterVoucherId] = useState('');
  const [filterVoucherDate, setFilterVoucherDate] = useState('');

  // Supplier selector modal states
  const [isSupplierSelectOpen, setIsSupplierSelectOpen] = useState(false);
  const [supplierSelectType, setSupplierSelectType] = useState<'existing' | 'new'>('existing');
  const [existingSupplierSelected, setExistingSupplierSelected] = useState('');
  
  // New Supplier form states on-the-fly
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierCode, setQuickSupplierCode] = useState('');
  
  // Mode de paiement modal states
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState(() => config?.deliveryInfo?.defaultPayModePurchase || 'ESPECE');
  const [paymentSource, setPaymentSource] = useState('COFFRE N°1');
  const [paymentVersement, setPaymentVersement] = useState<number>(0);

  // Column widths state for Purchase Voucher List table
  const { columnWidths: purchaseListColWidths, startResizing: startResizingPurchaseList } = useResizableColumns({
    num: 50,
    date: 90,
    time: 75,
    supplier: 220,
    itemsCount: 75,
    total: 110
  }, 30, 'purchase_list');

  // Column widths state for Purchase Items table
  const { columnWidths: purchaseItemColWidths, startResizing: startResizingPurchaseItem } = useResizableColumns({
    num: 45,
    code: 120,
    designation: 280,
    colis: 65,
    colisage: 65,
    qte: 65,
    punit: 100,
    montant: 110,
    action: 50
  }, 30, 'purchase_items');

  // Voucher editing state tracker
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Barcode Label Modal State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeProduct | null>(null);
  const [barcodeInitialQty, setBarcodeInitialQty] = useState<number>(1);

  // Print barcode label helper
  const handlePrintBarcodeLabel = (itemToPrint?: VoucherItem) => {
    const itemsList = mode === 'create' ? draftItems : (selectedVoucher?.items || []);
    const targetItem = itemToPrint || ((selectedDraftIdx >= 0 && selectedDraftIdx < itemsList.length) ? itemsList[selectedDraftIdx] : itemsList[0]);
    if (!targetItem) {
      showRetroAlert("Veuillez sélectionner un article dans la liste pour imprimer son étiquette code-barres.", "Saisie achats");
      return;
    }
    const catalogProd = products.find(p => p.code === targetItem.code);
    setBarcodeProduct({
      code: targetItem.code,
      designation: targetItem.designation,
      prixVente1: catalogProd?.prixVente1,
      prixAchat: targetItem.price ?? catalogProd?.prixAchat,
      stock: catalogProd?.stock,
      category: catalogProd?.category
    });
    setBarcodeInitialQty(targetItem.qty > 0 ? targetItem.qty : 1);
    setShowBarcodeModal(true);
  };

  // List of currently open drafts/bons (can have multiple active drafts open at once)
  const [openDrafts, setOpenDrafts] = useState<any[]>(() => {
    return getStorageJson('purchase_open_drafts', []);
  });

  // Keep open drafts persistent in local DB
  useEffect(() => {
    saveJson('purchase_open_drafts', openDrafts);
  }, [openDrafts]);

  // Keep active draft synchronized inside the openDrafts array
  useEffect(() => {
    if (mode === 'create' && newVoucherId) {
      setOpenDrafts(prev => {
        const exists = prev.some(d => d.id === newVoucherId);
        if (!exists) {
          // If for some reason the active draft is not in the list, we append it
          return [...prev, {
            id: newVoucherId,
            date: newDate,
            time: newTime,
            supplier: newSupplierName,
            draftItems,
            versement,
            paymentMode,
            isEditingExisting: !!editingVoucherId
          }];
        }
        return prev.map(draft => {
          if (draft.id === newVoucherId) {
            return {
              ...draft,
              date: newDate,
              time: newTime,
              supplier: newSupplierName,
              draftItems,
              versement,
              paymentMode,
              isEditingExisting: draft.isEditingExisting !== undefined ? draft.isEditingExisting : !!editingVoucherId
            };
          }
          return draft;
        });
      });
    }
  }, [mode, newVoucherId, newDate, newTime, newSupplierName, draftItems, versement, paymentMode, editingVoucherId]);

  // Dynamic list of Families created manually by user, persisted through the local DB adapter as fallback
  const [localCreatedFamilles, setLocalCreatedFamilles] = useState<string[]>(() => {
    return getStorageJson('compos_familles', []);
  });

  const createdFamilles = propCreatedFamilles !== undefined ? propCreatedFamilles : localCreatedFamilles;

  const setCreatedFamilles = (updater: string[] | ((prev: string[]) => string[])) => {
    if (onCreatedFamillesChange) {
      onCreatedFamillesChange(updater);
    } else {
      setLocalCreatedFamilles(updater);
    }
  };

  // Keep it sync'd if using fallback local state
  useEffect(() => {
    if (propCreatedFamilles === undefined) {
      saveJson('compos_familles', localCreatedFamilles);
    }
  }, [localCreatedFamilles, propCreatedFamilles]);

  // Combine manually created families with actual product categories from existing products to form families list
  const familles = useMemo(() => {
    const fromProducts = products
      .map(p => p.category)
      .filter((cat): cat is string => !!cat && cat.trim().length > 0)
      .map(cat => cat.toUpperCase());
    return Array.from(new Set([...createdFamilles, ...fromProducts])).sort();
  }, [createdFamilles, products]);

  // Support inline block-free addition of families
  const [isAddingNewFamille, setIsAddingNewFamille] = useState(false);
  const [newFamilleInput, setNewFamilleInput] = useState('');

  // Family Management Popup Modal states
  const [isManagingFamilies, setIsManagingFamilies] = useState(false);
  const [newFamilyInputName, setNewFamilyInputName] = useState('');
  const [editingFamilyName, setEditingFamilyName] = useState<string | null>(null);
  const [editingFamilyValue, setEditingFamilyValue] = useState('');
  const [confirmDeleteFam, setConfirmDeleteFam] = useState<string | null>(null);

  const handleRenameFamily = (oldName: string, newName: string) => {
    const normalizedOld = oldName.trim().toUpperCase();
    const normalizedNew = newName.trim().toUpperCase();
    if (!normalizedNew || normalizedOld === normalizedNew) return;

    // 1. Update createdFamilles list
    setCreatedFamilles(prev => {
      const updated = prev.map(f => f.toUpperCase() === normalizedOld ? normalizedNew : f);
      if (!updated.includes(normalizedNew)) {
        updated.push(normalizedNew);
      }
      return Array.from(new Set(updated)).sort();
    });

    // 2. Update products in parent state
    if (onProductsUpdate) {
      const updatedProducts = products.map(p => {
        if (p.category && p.category.toUpperCase() === normalizedOld) {
          return { ...p, category: normalizedNew };
        }
        return p;
      });
      onProductsUpdate(updatedProducts);
    }

    // Update active form's category if it matches
    if (prodFamille.toUpperCase() === normalizedOld) {
      setProdFamille(normalizedNew);
    }
  };

  const handleDeleteFamily = (famName: string) => {
    const normalizedFam = famName.trim().toUpperCase();

    // 1. Update createdFamilles list
    setCreatedFamilles(prev => prev.filter(f => f.toUpperCase() !== normalizedFam));

    // 2. Update products in parent state
    if (onProductsUpdate) {
      const updatedProducts = products.map(p => {
        if (p.category && p.category.toUpperCase() === normalizedFam) {
          return { ...p, category: '' };
        }
        return p;
      });
      onProductsUpdate(updatedProducts);
    }

    // Update active form's category if it matches
    if (prodFamille.toUpperCase() === normalizedFam) {
      setProdFamille('');
    }
  };

  // Resizable proportions / sections
  const [topSplitWidth, setTopSplitWidth] = useState<number>(() => {
    return Number(getStorageString('achats_top_split_width')) || 68; // percentage for Registre des Bons
  });
  const [bottomSplitWidth, setBottomSplitWidth] = useState<number>(() => {
    return Number(getStorageString('achats_bottom_split_width')) || 68; // percentage for Articles List
  });
  const [topSectionHeight, setTopSectionHeight] = useState<number>(() => {
    return Number(getStorageString('achats_top_section_height')) || 155; // height in pixels of Registre section
  });
  const [bottomSectionHeight, setBottomSectionHeight] = useState<number>(() => {
    return Number(getStorageString('achats_bottom_section_height')) || 170; // height in pixels of Articles section
  });

  const [isResizingTopHeight, setIsResizingTopHeight] = useState(false);
  const [isResizingBottomHeight, setIsResizingBottomHeight] = useState(false);
  const [isResizingTopWidth, setIsResizingTopWidth] = useState(false);
  const [isResizingBottomWidth, setIsResizingBottomWidth] = useState(false);

  // Absolute coordinate tracking ref
  const resizeStartRef = useRef({
    x: 0,
    y: 0,
    topHeight: 155,
    bottomHeight: 170,
    topWidth: 68,
    bottomWidth: 68
  });

  // Track current resize coordinates in a ref to bypass CPU-bound synchronous disk I/O on pointermove
  const currentHeightWidthRef = useRef({
    topSectionHeight: 155,
    bottomSectionHeight: 170,
    topSplitWidth: 68,
    bottomSplitWidth: 68
  });

  useEffect(() => {
    currentHeightWidthRef.current.topSectionHeight = topSectionHeight;
  }, [topSectionHeight]);
  useEffect(() => {
    currentHeightWidthRef.current.bottomSectionHeight = bottomSectionHeight;
  }, [bottomSectionHeight]);
  useEffect(() => {
    currentHeightWidthRef.current.topSplitWidth = topSplitWidth;
  }, [topSplitWidth]);
  useEffect(() => {
    currentHeightWidthRef.current.bottomSplitWidth = bottomSplitWidth;
  }, [bottomSplitWidth]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isResizingTopHeight) {
        const deltaY = e.clientY - resizeStartRef.current.y;
        const val = Math.max(80, Math.min(600, resizeStartRef.current.topHeight + deltaY));
        setTopSectionHeight(val);
        currentHeightWidthRef.current.topSectionHeight = val;
      }
      if (isResizingBottomHeight) {
        const deltaY = e.clientY - resizeStartRef.current.y;
        const val = Math.max(80, Math.min(650, resizeStartRef.current.bottomHeight + deltaY));
        setBottomSectionHeight(val);
        currentHeightWidthRef.current.bottomSectionHeight = val;
      }
      if (isResizingTopWidth) {
        const element = document.getElementById('top-row-container');
        if (element) {
          const rect = element.getBoundingClientRect();
          const val = Math.max(15, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
          setTopSplitWidth(val);
          currentHeightWidthRef.current.topSplitWidth = val;
        }
      }
      if (isResizingBottomWidth) {
        const element = document.getElementById('bottom-row-container');
        if (element) {
          const rect = element.getBoundingClientRect();
          const val = Math.max(15, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
          setBottomSplitWidth(val);
          currentHeightWidthRef.current.bottomSplitWidth = val;
        }
      }
    };

    const handlePointerUp = () => {
      if (isResizingTopHeight) {
        saveData('achats_top_section_height', String(currentHeightWidthRef.current.topSectionHeight));
      }
      if (isResizingBottomHeight) {
        saveData('achats_bottom_section_height', String(currentHeightWidthRef.current.bottomSectionHeight));
      }
      if (isResizingTopWidth) {
        saveData('achats_top_split_width', String(currentHeightWidthRef.current.topSplitWidth));
      }
      if (isResizingBottomWidth) {
        saveData('achats_bottom_split_width', String(currentHeightWidthRef.current.bottomSplitWidth));
      }
      setIsResizingTopHeight(false);
      setIsResizingBottomHeight(false);
      setIsResizingTopWidth(false);
      setIsResizingBottomWidth(false);
    };

    if (isResizingTopHeight || isResizingBottomHeight || isResizingTopWidth || isResizingBottomWidth) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizingTopHeight, isResizingBottomHeight, isResizingTopWidth, isResizingBottomWidth]);

  // PRODUIT (Product) Modal State
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCatalogSearchOpen, setIsCatalogSearchOpen] = useState(false);
  const [selectedSearchProduct, setSelectedSearchProduct] = useState<Product | null>(null);
  const [dialogMode, setDialogMode] = useState<'add_new' | 'insert_existing' | 'edit_existing'>('add_new');

  // Local transaction-based product list to avoid mutating global products catalog on cancel
  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  // Synchronize local products with props dynamically while preserving local draft state adjustments
  useEffect(() => {
    setLocalProducts(prev => {
      const prevMap = new Map<string, Product>(prev.map(p => [p.code, p]));
      
      // Update catalog products
      const updatedCatalog = products.map(p => {
        const prevProd = prevMap.get(p.code);
        if (prevProd && mode === 'create') {
          return {
            ...p,
            // Keep real stock and stockColis from products prop so that they are always 100% synchronized!
            stock: p.stock,
            stockColis: p.stockColis,
            prixDeRevient: prevProd.prixDeRevient,
            prixAchat: prevProd.prixAchat,
            prixVente1: prevProd.prixVente1,
            prixVente2: prevProd.prixVente2,
            prixVente3: prevProd.prixVente3,
            category: prevProd.category,
            designation: prevProd.designation
          };
        }
        return p;
      });

      // Also preserve any products that exist ONLY in the previous draft localProducts (draft-only products reconstructed on draft load)
      const catalogCodes = new Set(products.map(p => p.code));
      const draftOnly = prev.filter(p => !catalogCodes.has(p.code));

      return [...updatedCatalog, ...draftOnly];
    });
  }, [products, mode]);

  // CUSTOM RETRO DIALOG BOX STATE (to completely bypass blocked iframe alert/confirm modals)
  const [retroDialog, setRetroDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });

  const showRetroAlert = (message: string, title = "VBI PME - Message") => {
    setRetroDialog({
      isOpen: true,
      type: 'alert',
      title,
      message
    });
  };

  const showRetroConfirm = (message: string, onConfirm: () => void, title = "VBI PME - Confirmation") => {
    setRetroDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm
    });
  };
  const [activeDialogTab, setActiveDialogTab] = useState<'general' | 'plus_info' | 'photo'>('general');
  const [selectedCatalogProductCode, setSelectedCatalogProductCode] = useState(''); // for insert_existing
  const [insertSearchQuery, setInsertSearchQuery] = useState(''); // Search query for previous products to insert

  // Modal Form Inputs
  const [prodCode, setProdCode] = useState('');
  const [prodFamille, setProdFamille] = useState('');
  const [prodDesignation, setProdDesignation] = useState('');
  const [prodStockEnStock, setProdStockEnStock] = useState(0);
  const [prodPrixDeRevient, setProdPrixDeRevient] = useState(0);
  
  const [prodNbreColis, setProdNbreColis] = useState(''); // Always blank by default as requested
  const [prodColisage, setProdColisage] = useState(''); // Always blank by default as requested
  const [prodQtyCalculated, setProdQtyCalculated] = useState(0);
  const [prodPrixAchat, setProdPrixAchat] = useState('0');
  const [prodNouveauPrixRevient, setProdNouveauPrixRevient] = useState('0'); // Has its own state now
  const [prodPrixVente1, setProdPrixVente1] = useState('0');
  const [prodPrixVente2, setProdPrixVente2] = useState('0');
  const [prodPrixVente3, setProdPrixVente3] = useState('0');

  // Custom details for F2 (Plus d'info) tab
  const [infoRayon, setInfoRayon] = useState('A-1');
  const [infoUnite, setInfoUnite] = useState('Boite');
  const [infoTvaPercent, setInfoTvaPercent] = useState('0');
  const [infoAlerteStock, setInfoAlerteStock] = useState('5');

  const getOriginalQtyOfItem = (itemCode: string): number => {
    if (!editingVoucherId) return 0;
    const origVoucher = purchases.find(v => String(v.id) === String(editingVoucherId));
    if (!origVoucher) return 0;
    const origItem = origVoucher.items.find(i => i.code === itemCode);
    return origItem ? origItem.qty : 0;
  };

  const getStartingStockAndCost = (itemCode: string) => {
    // 1. Find the current real-time catalog stock and cost of this product from products prop
    const catalogProd = products.find(p => p.code === itemCode);
    const currentStock = catalogProd ? catalogProd.stock : 0;
    const currentCost = catalogProd && catalogProd.prixDeRevient !== undefined ? catalogProd.prixDeRevient : 0;

    // 2. Find the original quantity and price of this product inside the voucher being edited (if any)
    let originalQty = 0;
    let originalPrice = 0;
    if (editingVoucherId) {
      const origVoucher = purchases.find(v => String(v.id) === String(editingVoucherId));
      if (origVoucher) {
        const origItem = origVoucher.items.find(i => i.code === itemCode);
        if (origItem) {
          originalQty = origItem.qty;
          originalPrice = origItem.price;
        }
      }
    }

    // 3. The starting stock before this purchase was made is:
    const startingStock = currentStock - originalQty;

    // 4. The starting cost price before this purchase was made is:
    // If startingStock > 0, we can estimate starting cost as currentCost (or revert the weighted average if possible)
    let startingCost = currentCost;
    if (startingStock > 0 && currentStock > 0 && currentCost > 0 && originalQty > 0) {
      const totalCostVal = originalQty * originalPrice;
      const revertedCost = Math.round(((currentCost * currentStock) - totalCostVal) / startingStock);
      if (revertedCost > 0) {
        startingCost = revertedCost;
      }
    }

    return {
      startingStock,
      startingCost,
      currentStock,
      currentCost
    };
  };

  // Calculates dynamically weighted average cost price on the fly for UI
  const calculatedNouveauPrixRevient = useMemo(() => {
    const { startingStock, startingCost } = getStartingStockAndCost(prodCode);
    
    const qtyVal = Number(prodQtyCalculated) || 0;
    const buyPriceVal = Number(prodPrixAchat) || 0;

    if (startingStock <= 0) {
      return buyPriceVal;
    }
    if (qtyVal <= 0) {
      return startingCost;
    }
    return Math.round(((startingStock * startingCost) + (qtyVal * buyPriceVal)) / (startingStock + qtyVal));
  }, [prodCode, prodQtyCalculated, prodPrixAchat, editingVoucherId, products, purchases]);

  // Filters the list of catalog items dynamically for insert dialog
  const filteredProductsToInsert = useMemo(() => {
    const q = insertSearchQuery.trim().toLowerCase();
    if (!q) return localProducts.slice(0, 100);
    return localProducts.filter(p => 
      p.code.toLowerCase().includes(q) || 
      p.designation.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    ).slice(0, 150);
  }, [localProducts, insertSearchQuery]);

  const navigableVouchers = useMemo(() => {
    const map = new Map<string, { id: string; type: 'closed' | 'draft'; data: any }>();
    
    // Add closed purchases
    purchases.forEach(p => {
      map.set(p.id, {
        id: p.id,
        type: 'closed',
        data: p
      });
    });

    // Add open drafts
    openDrafts.forEach(d => {
      map.set(d.id, {
        id: d.id,
        type: 'draft',
        data: d
      });
    });

    let list = Array.from(map.values());

    // Apply voucher ID filter
    if (filterVoucherId.trim()) {
      const q = filterVoucherId.trim().toLowerCase();
      list = list.filter(v => v.id.toLowerCase().includes(q));
    }

    // Apply voucher Date filter
    if (filterVoucherDate.trim()) {
      const q = filterVoucherDate.trim().toLowerCase();
      list = list.filter(v => {
        const d = v.type === 'closed' ? (v.data.date || '') : (v.data.date || '');
        return d.toLowerCase().includes(q);
      });
    }

    // Sort by ID (numerical sort)
    return list.sort((a, b) => {
      const idA = String(a.id || '');
      const idB = String(b.id || '');
      return idA.localeCompare(idB, undefined, { numeric: true });
    });
  }, [purchases, openDrafts, filterVoucherId, filterVoucherDate]);

  // Set active voucher ID
  const activeId = mode === 'create' ? newVoucherId : selectedVoucherId;

  // Set active voucher index for pager buttons based on the unified navigableVouchers list
  const activeVoucherIndex = navigableVouchers.findIndex(v => v.id === activeId);

  const selectedVoucher = useMemo(() => {
    if (mode === 'create') return null;
    if (selectedVoucherId === '') return null;
    return purchases.find(v => String(v.id) === String(selectedVoucherId)) || null;
  }, [purchases, selectedVoucherId, mode]);

  // Keep selectedVoucherId valid and synchronized with current purchases
  useEffect(() => {
    if (mode === 'view') {
      if (purchases.length === 0) {
        setSelectedVoucherId('');
      } else {
        if (selectedVoucherId !== '') {
          const found = purchases.some(v => String(v.id) === String(selectedVoucherId));
          if (!found) {
            setSelectedVoucherId(purchases[purchases.length - 1].id);
          }
        }
      }
    }
  }, [purchases, selectedVoucherId, mode]);

  // Helper to load any draft or active edited voucher
  const loadDraft = (draft: any) => {
    setNewVoucherId(draft.id);
    setNewDate(draft.date);
    setNewTime(draft.time);
    setNewSupplierName(draft.supplier);
    setDraftItems(draft.draftItems || []);
    setVersement(draft.versement || 0);
    setEditingVoucherId(draft.isEditingExisting ? draft.id : null);
    if (draft.paymentMode) {
      setPaymentMode(draft.paymentMode);
    }
    
    let baseProductsList = [...products];

    // Resilience: ensure any item inside draftItems that is NOT in the catalog is reconstructed locally
    const draftItemsList = draft.draftItems || [];
    const mergedProducts = [...baseProductsList];
    draftItemsList.forEach((item: any) => {
      const exists = mergedProducts.some(p => p.code === item.code);
      if (!exists) {
        mergedProducts.push({
          code: item.code,
          designation: item.designation,
          prixVente1: item.prixVente1 || Math.round(item.price * 1.3),
          prixVente2: item.prixVente2 || Math.round(item.price * 1.3),
          prixVente3: item.prixVente3 || Math.round(item.price * 1.3),
          stock: 0,
          stockColis: 0,
          category: item.category || '',
          prixDeRevient: item.price,
          prixAchat: item.price
        });
      }
    });

    setLocalProducts(mergedProducts);
    
    setBarcodeInput('');
    setSelectedDraftIdx((draft.draftItems || []).length > 0 ? 0 : -1);
    setIsSupplierSelectOpen(false);
    setMode('create');
  };

  // Helper to load any voucher (closed or draft)
  const loadVoucherObj = (nav: { type: 'closed' | 'draft'; data: any }) => {
    if (nav.type === 'draft') {
      loadDraft(nav.data);
    } else {
      const v = nav.data;
      setSelectedVoucherId(v.id);
      setEditingVoucherId(null);
      setMode('view');
    }
  };

  // Handle pagination between historical voucher records
  const handleFirst = () => {
    if (navigableVouchers.length > 0) loadVoucherObj(navigableVouchers[0]);
  };
  const handlePrev = () => {
    if (activeVoucherIndex > 0) loadVoucherObj(navigableVouchers[activeVoucherIndex - 1]);
  };
  const handleNext = () => {
    if (activeVoucherIndex < navigableVouchers.length - 1) loadVoucherObj(navigableVouchers[activeVoucherIndex + 1]);
  };
  const handleLast = () => {
    if (navigableVouchers.length > 0) loadVoucherObj(navigableVouchers[navigableVouchers.length - 1]);
  };

  // Find supplier object for calculations
  const selectedSupplierObj = useMemo(() => {
    const name = mode === 'create' ? newSupplierName : selectedVoucher?.supplier;
    return suppliers.find(s => s.name === name) || null;
  }, [suppliers, newSupplierName, selectedVoucher, mode]);

  // Calculated draft metrics
  const draftMetrics = useMemo(() => {
    let rawAmount = 0;
    let totalQty = 0;
    draftItems.forEach(item => {
      rawAmount += Number(item.total) || 0;
      totalQty += Number(item.qty) || 0;
    });

    const totalHT = rawAmount;
    const tva = 0; 
    const timbre = 0; // Disabled as requested: Timbre is always zero 
    const ttc = totalHT + tva + timbre;

    let oldBalance = selectedSupplierObj ? (Number(selectedSupplierObj.balance) || 0) : 0;
    
    // Adjust old balance if we are editing an existing voucher by subtracting the original voucher's net impact
    if (editingVoucherId && selectedSupplierObj) {
      const origVoucher = purchases.find(v => String(v.id) === String(editingVoucherId));
      if (origVoucher && selectedSupplierObj.name === origVoucher.supplier) {
        const vTtc = Number(origVoucher.ttc) || 0;
        const vVersement = Number(origVoucher.versement) || 0;
        const sBalance = Number(selectedSupplierObj.balance) || 0;
        oldBalance = Math.max(0, sBalance - (vTtc - vVersement));
      }
    }

    const safeVersement = Number(versement) || 0;
    const newBalance = oldBalance + (ttc - safeVersement);

    return { rawAmount, totalQty, totalHT, tva, timbre, ttc, oldBalance, newBalance };
  }, [draftItems, selectedSupplierObj, versement, editingVoucherId, purchases]);

  const previewData = useMemo(() => {
    const isCreate = mode === 'create';
    const id = isCreate ? newVoucherId : (selectedVoucher?.id || '');
    const date = isCreate ? newDate : (selectedVoucher?.date || '');
    const time = isCreate ? newTime : (selectedVoucher?.time || '');
    const supplierName = isCreate ? newSupplierName : (selectedVoucher?.supplier || '');
    const items = isCreate ? draftItems : (selectedVoucher?.items || []);
    const activeRemise = isCreate ? 0 : (selectedVoucher?.remise || 0);
    
    const rawSum = items.reduce((acc, item) => acc + item.total, 0);
    const totalHT = Math.max(0, rawSum - activeRemise);
    const tvaVal = isCreate ? (draftMetrics?.tva || 0) : (selectedVoucher?.tva || 0);
    const timbreVal = isCreate ? (draftMetrics?.timbre || 0) : (selectedVoucher?.timbre || 0);
    const ttcVal = isCreate ? (draftMetrics?.ttc || 0) : (selectedVoucher?.ttc || 0);
    const versementVal = isCreate ? versement : (selectedVoucher?.versement || 0);
    
    const supplierObj = suppliers.find(s => s.name === supplierName) || { id: 'anonyme', name: supplierName, balance: 0, phone: '', address: '', contact: '' };
    
    const payMode = isCreate 
      ? (paymentMode === 'ESPECE' ? 'ESPÈCE / CASH' : (paymentMode === 'CHEQUE' ? 'CHÈQUE / VIREMENT' : 'A TERME'))
      : (selectedVoucher?.paymentMode
          ? (selectedVoucher.paymentMode === 'ESPECE' ? 'ESPÈCE / CASH' : (selectedVoucher.paymentMode === 'CHEQUE' ? 'CHÈQUE / VIREMENT' : 'A TERME'))
          : (selectedVoucher && selectedVoucher.versement >= selectedVoucher.ttc ? 'ESPÈCE / CASH' : 'A TERME')
        );
    
    return {
      id,
      date,
      time,
      supplierName,
      supplierObj,
      items,
      remise: activeRemise,
      tva: tvaVal,
      timbre: timbreVal,
      totalHT,
      ttc: ttcVal,
      rawSum,
      versement: versementVal,
      payMode
    };
  }, [mode, newVoucherId, selectedVoucher, newDate, newTime, newSupplierName, draftItems, versement, suppliers, draftMetrics, paymentMode]);

  // Starts voucher creation flow
  const handleNewVoucher = () => {
    if (!config?.isActivated && purchases.length >= 1) {
      showRetroAlert("⚠️ Limite Démo : Vous ne pouvez pas créer plus de 1 bon d'achat en mode évaluation (démo). Veuillez activer l'application avec un code d'activation dans les configurations.", "Saisie achats");
      return;
    }
    setIsSupplierSelectOpen(true);
    if (suppliers.length > 0) {
      setSupplierSelectType('existing');
      setExistingSupplierSelected(suppliers[0].name);
    } else {
      setSupplierSelectType('new');
      setExistingSupplierSelected('');
    }
    setQuickSupplierName('');
    const nextCodeNum = String(suppliers.length + 1).padStart(3, '0');
    setQuickSupplierCode(`F-${nextCodeNum}`);
  };

  const handleConfirmSupplierForVoucher = () => {
    let finalSupplierName = '';

    if (supplierSelectType === 'new') {
      if (!quickSupplierName.trim()) {
        showRetroAlert("Veuillez saisir le nom du nouveau fournisseur.");
        return;
      }
      // Check duplicate
      const exists = suppliers.some(s => s.name.toLowerCase() === quickSupplierName.trim().toLowerCase());
      if (exists) {
        showRetroAlert("Ce fournisseur existe déjà !");
        return;
      }

      const newSupplierObj: Supplier = {
        id: Math.random().toString(),
        code: quickSupplierCode.trim() || `F-${String(suppliers.length + 1).padStart(3, '0')}`,
        name: quickSupplierName.trim(),
        balance: 0
      };

      if (onAddSupplier) {
        onAddSupplier(newSupplierObj);
      }
      finalSupplierName = newSupplierObj.name;
    } else {
      if (!existingSupplierSelected) {
        showRetroAlert("Veuillez sélectionner un fournisseur.");
        return;
      }
      finalSupplierName = existingSupplierSelected;
    }

    // Calculate unique next number avoiding collisions with both closed purchases and open drafts
    const allIds = [
      ...purchases.map(p => Number(p.id)),
      ...openDrafts.map(d => Number(d.id))
    ].filter(id => !isNaN(id));
    const maxId = allIds.length > 0 ? Math.max(...allIds) : 0;
    const nextNum = String(maxId + 1).padStart(5, '0');
    
    setLocalProducts([...products]);
    setNewVoucherId(nextNum);
    setEditingVoucherId(null); // Reset when creating new
    
    const d = new Date();
    const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const formattedTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    
    setNewDate(formattedDate);
    setNewTime(formattedTime);
    setNewSupplierName(finalSupplierName);
    setDraftItems([]);
    setVersement(0);
    setBarcodeInput('');
    setSelectedDraftIdx(-1);
    setIsSupplierSelectOpen(false);
    setMode('create');

    const newDraft = {
      id: nextNum,
      date: formattedDate,
      time: formattedTime,
      supplier: finalSupplierName,
      draftItems: [],
      versement: 0,
      paymentMode: paymentMode
    };
    setOpenDrafts(prev => [...prev, newDraft]);
  };

  // Modify an existing closed voucher
  const handleEditVoucher = () => {
    if (!selectedVoucher) {
      showRetroAlert("Aucun bon d'achat sélectionné.");
      return;
    }

    // Check if this voucher is already open in our drafts
    const existingDraft = openDrafts.find(d => d.id === selectedVoucher.id && d.isEditingExisting);
    if (existingDraft) {
      loadDraft(existingDraft);
      return;
    }

    // Otherwise, create a new draft for it and add to openDrafts
    const newDraft = {
      id: selectedVoucher.id,
      date: selectedVoucher.date,
      time: selectedVoucher.time,
      supplier: selectedVoucher.supplier,
      draftItems: [...selectedVoucher.items],
      versement: selectedVoucher.versement || 0,
      paymentMode: selectedVoucher.paymentMode,
      isEditingExisting: true
    };

    setOpenDrafts(prev => [...prev, newDraft]);
    loadDraft(newDraft);
  };

  // Safe barcode scanner direct helper
  const handleAddScannedProduct = (productCode: string) => {
    if (!productCode.trim()) return;
    const targetProduct = localProducts.find(p => p.code === productCode.trim());
    if (!targetProduct) {
      // Direct integration: if code doesn't exist, open PRODUIT modal to register it on the fly!
      handleOpenProductDialog('add_new', productCode.trim());
      setBarcodeInput('');
      return;
    }

    // Auto-calculates a fallback purchase price (72% of standard PrixVente1)
    const purchasePrice = Math.round(targetProduct.prixVente1 * 0.72) || 100;

    const existingIndex = draftItems.findIndex(item => item.code === targetProduct.code);
    if (existingIndex >= 0) {
      const updated = [...draftItems];
      updated[existingIndex].qty += 1;
      updated[existingIndex].total = updated[existingIndex].qty * updated[existingIndex].price;
      setDraftItems(updated);
      setSelectedDraftIdx(existingIndex);
    } else {
      const newItem: VoucherItem = {
        id: Math.random().toString(),
        code: targetProduct.code,
        designation: targetProduct.designation,
        colisage: 0,
        nbreColis: 0,
        pieces: 0,
        qty: 1, // Default to 1 unit instead of a carton of 12
        price: purchasePrice,
        total: 1 * purchasePrice
      };
      const updated_items = [...draftItems, newItem];
      setDraftItems(updated_items);
      setSelectedDraftIdx(updated_items.length - 1);
    }
    setBarcodeInput('');
  };

  const handleRemoveDraftItem = (index: number) => {
    if (index < 0 || index >= draftItems.length) return;
    const itemToRemove = draftItems[index];
    showRetroConfirm(
      `Voulez-vous supprimer l'article ${itemToRemove.designation} de ce bon ?`,
      () => {
        const updated = draftItems.filter((_, idx) => idx !== index);
        setDraftItems(updated);
        setSelectedDraftIdx(updated.length > 0 ? updated.length - 1 : -1);

        // When deleting articles from it, they should be deleted from catalogue,
        // but not necessarily from sales (saisie ventes F2)
        const codeToDelete = itemToRemove.code;
        if (onProductsUpdate) {
          onProductsUpdate(products.filter(p => p.code !== codeToDelete));
        }
        setLocalProducts(prev => prev.filter(p => p.code !== codeToDelete));
      },
      "Suppression d'article"
    );
  };

  // Opens Mode de paiement popup instead of saving directly
  const handleSaveVoucher = () => {
    // Determine payment mode and pre-filled versement
    // If config has default, use it. Otherwise, if the main column's versement is 0, default to credit 'A_TERME'
    const defaultMode = config?.deliveryInfo?.defaultPayModePurchase || ((versement === 0) ? 'A_TERME' : 'ESPECE');
    
    setPaymentVersement(versement);
    setPaymentSource('COFFRE N°1');
    setPaymentMode(defaultMode);
    setIsPaymentDialogOpen(true);
  };

  // Handles finalized payment confirmation from the retro modal popup
  const handleConfirmPaymentAndSaveVoucher = () => {
    const finalVersement = Number(paymentVersement) || 0;
    
    // Recalculate newBalance safely with the final versement from the dialog
    const oldBal = Number(draftMetrics.oldBalance) || 0;
    const totalTtc = Number(draftMetrics.ttc) || 0;
    const finalNewBalance = oldBal + (totalTtc - finalVersement);

    const savedVoucher: PurchaseVoucher = {
      id: newVoucherId,
      date: newDate,
      time: newTime,
      supplier: newSupplierName,
      itemsCount: draftItems.length,
      colisCount: draftItems.reduce((acc, t) => acc + (t.nbreColis || 0), 0),
      amount: Number(draftMetrics.rawAmount) || 0,
      remise: 0,
      totalHT: Number(draftMetrics.totalHT) || 0,
      tva: Number(draftMetrics.tva) || 0,
      timbre: Number(draftMetrics.timbre) || 0,
      ttc: totalTtc,
      versement: finalVersement,
      oldBalance: oldBal,
      newBalance: finalNewBalance,
      items: draftItems,
      paymentMode: paymentMode
    };

    // Update the on-screen versement field to align with the dialog choice
    setVersement(finalVersement);

    // Calculate final products with both updated stocks and updated cost prices (weighted average cost / CUMP)
    const finalizedProducts = localProducts.map(p => {
      const matchingItems = savedVoucher.items.filter(item => item.code === p.code);
      if (matchingItems.length > 0) {
        const totalQtyPurchased = matchingItems.reduce((acc, curr) => acc + curr.qty, 0);
        
        // Use our starting stock & cost calculator
        const { startingStock, startingCost, currentStock, currentCost } = getStartingStockAndCost(p.code);
        
        // Calculate final stock
        const finalStock = currentStock - (editingVoucherId ? getOriginalQtyOfItem(p.code) : 0) + totalQtyPurchased;
        
        // Calculate the new weighted average cost dynamically
        let finalCostPrice = currentCost;
        if (startingStock <= 0) {
          // No prior stock, so new cost is just the weighted average of this purchase's items
          const totalPurchasedCost = matchingItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
          finalCostPrice = Math.round(totalPurchasedCost / totalQtyPurchased);
        } else {
          // Prior stock existed before this purchase
          const totalPurchasedCost = matchingItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
          finalCostPrice = Math.round(((startingStock * startingCost) + totalPurchasedCost) / (startingStock + totalQtyPurchased));
        }

        const firstColisage = matchingItems[0].colisage;
        const lastPrice = matchingItems[matchingItems.length - 1].price;

        return {
          ...p,
          stock: finalStock,
          stockColis: firstColisage && firstColisage > 0 ? Math.ceil(Math.max(0, finalStock) / firstColisage) : 0,
          prixDeRevient: finalCostPrice,
          prixAchat: lastPrice
        };
      }
      return p;
    });

    if (!editingVoucherId && !config?.isActivated && purchases.length >= 1) {
      showRetroAlert("⚠️ Limite Démo : Vous ne pouvez pas créer plus de 1 bon d'achat en mode évaluation (démo). Veuillez activer l'application avec un code d'activation dans les configurations.", "Saisie achats");
      return;
    }

    if (editingVoucherId) {
      if (onUpdatePurchase) {
        onUpdatePurchase(editingVoucherId, savedVoucher);
      }
      showRetroAlert(`Bon d'Achat N° ${savedVoucher.id} modifié avec succès!`);
    } else {
      onAddPurchase(savedVoucher);
      showRetroAlert(`Bon d'Achat N° ${savedVoucher.id} enregistré avec succès!`);
    }

    // Remove this voucher from openDrafts since it's now closed/finalized/modified!
    setOpenDrafts(prev => prev.filter(d => d.id !== savedVoucher.id));

    if (onProductsUpdate) {
      onProductsUpdate(finalizedProducts);
    }

    setSelectedVoucherId(savedVoucher.id);
    setEditingVoucherId(null);
    setMode('view');
    setIsPaymentDialogOpen(false);
  };

  // Delete Voucher
  const handleDeleteVoucher = () => {
    if (!selectedVoucher) return;
    
    if (selectedVoucher.items && selectedVoucher.items.length > 0) {
      showRetroAlert("Ce bon d'achat n'est pas vide. Veuillez d'abord supprimer tous les articles de ce bon.", "Saisie achats");
      return;
    }

    showRetroConfirm(
      `Voulez-vous vraiment supprimer définitivement le Bon d'Achat N° ${selectedVoucher.id} ?\n\nCette action rétablira le stock des articles et ajustera le solde du fournisseur (${selectedVoucher.supplier}) automatiquement.`,
      () => {
        const idToDelete = selectedVoucher.id;
        // Pre-calculate remaining list of purchases to select the correct next active one
        const remaining = purchases.filter(p => String(p.id) !== String(idToDelete));
        const nextActiveId = remaining.length > 0 ? remaining[remaining.length - 1].id : '';
        
        onDeletePurchase(idToDelete);
        setOpenDrafts(prev => prev.filter(d => String(d.id) !== String(idToDelete)));
        setSelectedVoucherId(nextActiveId);
        showRetroAlert(`Le Bon d'Achat N° ${idToDelete} a été retiré de la base de données.`);
      },
      "Suppression du bon d'achat"
    );
  };

  // Generates unique barcode strictly between 1000000000000 and 1019999999999
  const generateRandom13DigitBarcode = () => {
    const existingCodes = new Set(products.map(p => p.code));
    let code = '';
    const min = 1000000000000;
    const max = 1019999999999;
    for (let attempt = 0; attempt < 10000; attempt++) {
      const randVal = Math.floor(Math.random() * (max - min + 1)) + min;
      const candidate = randVal.toString();
      if (!existingCodes.has(candidate)) {
        code = candidate;
        break;
      }
    }
    return code;
  };

  // Open PRODUIT Modal settings
  const handleOpenProductDialog = (
    modeType: 'add_new' | 'insert_existing' | 'edit_existing',
    fallbackOrPrefilledBarcode: string = ''
  ) => {
    setDialogMode(modeType);
    setActiveDialogTab('general');
    setInsertSearchQuery(''); // Reset search query on open

    if (modeType === 'add_new') {
      const generated = fallbackOrPrefilledBarcode || generateRandom13DigitBarcode();
      setProdCode(generated);
      setProdDesignation('');
      setProdFamille(familles[0] || '');
      setProdStockEnStock(0);
      setProdPrixDeRevient(0);
      setProdNbreColis(''); // Left blank by default as requested
      setProdColisage(''); // Left blank by default as requested
      setProdQtyCalculated(0);
      setProdPrixAchat('');
      setProdNouveauPrixRevient('');
      setProdPrixVente1('');
      setProdPrixVente2(''); // Pastes Vente 1 automatically by default as requested
      setProdPrixVente3(''); // Pastes Vente 1 automatically by default as requested
      setIsProductDialogOpen(true);
    } 
    else if (modeType === 'insert_existing') {
      if (localProducts.length === 0) {
        showRetroAlert("Aucun produit enregistré dans la base.");
        return;
      }
      setSelectedSearchProduct(localProducts[0]);
      setIsCatalogSearchOpen(true);
    } 
    else if (modeType === 'edit_existing') {
      if (selectedDraftIdx < 0 || selectedDraftIdx >= draftItems.length) {
        showRetroAlert("Veuillez sélectionner un article dans le tableau des détails d'abord.");
        return;
      }
      const item = draftItems[selectedDraftIdx];
      // Find matching catalog product
      const catProd = localProducts.find(p => p.code === item.code);

      setProdCode(item.code);
      setProdDesignation(item.designation);
      setProdFamille(catProd && catProd.category ? catProd.category : (familles.length > 0 ? familles[0] : ''));
      setProdStockEnStock(catProd ? catProd.stock : 0);
      setProdPrixDeRevient(catProd && catProd.prixDeRevient !== undefined ? catProd.prixDeRevient : item.price);
      setProdNbreColis(item.nbreColis !== undefined && item.nbreColis !== 0 ? String(item.nbreColis) : '');
      setProdColisage(item.colisage !== undefined && item.colisage !== 0 ? String(item.colisage) : '');
      setProdQtyCalculated(item.qty);
      setProdPrixAchat(String(item.price));
      setProdNouveauPrixRevient(String(item.price));
      setProdPrixVente1(String(catProd ? catProd.prixVente1 : item.price * 1.3));
      setProdPrixVente2(String(catProd ? (catProd.prixVente2 || catProd.prixVente1) : item.price * 1.3));
      setProdPrixVente3(String(catProd ? (catProd.prixVente3 || catProd.prixVente1) : item.price * 1.3));
      setIsProductDialogOpen(true);
    }
  };

  const handleSelectCatalogProduct = (p: Product) => {
    setSelectedCatalogProductCode(p.code);
    setProdCode(p.code);
    setProdDesignation(p.designation);
    setProdFamille(p.category || (familles.length > 0 ? familles[0] : ''));
    setProdStockEnStock(p.stock);
    const prevPriceRev = p.prixDeRevient !== undefined ? p.prixDeRevient : Math.round(p.prixVente1 * 0.72);
    setProdPrixDeRevient(prevPriceRev);
    setProdNbreColis(''); // Left blank as requested
    setProdColisage(''); // Left blank as requested
    setProdQtyCalculated(0);
    setProdPrixAchat(String(prevPriceRev));
    setProdNouveauPrixRevient(String(prevPriceRev));
    setProdPrixVente1(String(p.prixVente1));
    setProdPrixVente2(String(p.prixVente2 || p.prixVente1));
    setProdPrixVente3(String(p.prixVente3 || p.prixVente1));
    setIsCatalogSearchOpen(false);
    setIsProductDialogOpen(true);
  };

  // Trigger when catalog item changes in dropdown of insert modal
  const handleCatalogProductChange = (code: string) => {
    setSelectedCatalogProductCode(code);
    const target = localProducts.find(p => p.code === code);
    if (target) {
      setProdCode(target.code);
      setProdDesignation(target.designation);
      setProdStockEnStock(target.stock);
      setProdFamille(target.category || (familles.length > 0 ? familles[0] : ''));
      const estCost = target.prixDeRevient !== undefined ? target.prixDeRevient : Math.round(target.prixVente1 * 0.72);
      setProdPrixDeRevient(estCost);
      setProdPrixAchat(String(estCost));
      setProdNouveauPrixRevient(String(estCost));
      setProdPrixVente1(String(target.prixVente1));
      setProdPrixVente2(String(target.prixVente2 || target.prixVente1));
      setProdPrixVente3(String(target.prixVente3 || target.prixVente1));
    }
  };

  // Handles updating calculations based on fields
  const handleNbreColisChange = (val: string) => {
    setProdNbreColis(val);
    if (!val) {
      setProdQtyCalculated(0);
      return;
    }
    const n = Number(val) || 0;
    const c = Number(prodColisage) || 0;
    if (c > 0) {
      setProdQtyCalculated(n * c);
    }
  };

  const handleColisageChange = (val: string) => {
    setProdColisage(val);
    if (!val) {
      return;
    }
    const n = Number(prodNbreColis) || 0;
    const c = Number(val) || 0;
    if (c > 0 && n > 0) {
      setProdQtyCalculated(n * c);
    }
  };

  const handleQtyChange = (val: string) => {
    if (!val) {
      setProdQtyCalculated(0);
      setProdNbreColis('');
      return;
    }
    const qty = Number(val) || 0;
    setProdQtyCalculated(qty);
    const c = Number(prodColisage) || 0;
    if (c > 0) {
      setProdNbreColis(qty > 0 ? String(Math.floor(qty / c)) : '');
    } else {
      setProdNbreColis('');
    }
  };

  // Auto-calculate margin percentage
  const calculateMarginPercent = (sellPriceStr: string, buyPriceStr: string): string => {
    const sell = Number(sellPriceStr) || 0;
    const buy = Number(buyPriceStr) || 0;
    if (buy <= 0) return '0%';
    const pct = ((sell - buy) / buy) * 100;
    return `${pct.toFixed(1)}%`;
  };

  // Save/Add the product from modal
  const handleSaveProductFromModal = () => {
    if (!prodCode.trim()) {
      alert("Le code-barre ou identifiant produit est requis.");
      return;
    }
    if (!prodDesignation.trim()) {
      alert("La désignation du produit est requise.");
      return;
    }

    const cleanCode = prodCode.trim();
    const cleanDesignation = prodDesignation.trim();

    // Check if another product already has the same designation (case-insensitive)
    const duplicateProduct = localProducts.find(
      p => p.designation.trim().toLowerCase() === cleanDesignation.toLowerCase()
    );

    if (duplicateProduct && duplicateProduct.code !== cleanCode) {
      showRetroAlert(
        `Impossible d'enregistrer l'article : un produit avec la désignation "${duplicateProduct.designation}" existe déjà dans la base (Code: ${duplicateProduct.code}).`,
        "Désignation Déjà Utilisée"
      );
      return;
    }

    const cost = Number(prodPrixAchat) || 0;
    const qty = Number(prodQtyCalculated) || 0;
    const sp1 = Number(prodPrixVente1) || 0;
    const sp2 = Number(prodPrixVente2) || 0;
    const sp3 = Number(prodPrixVente3) || 0;
    const colNum = Number(prodColisage) || 0;
    const nbreColNum = Number(prodNbreColis) || 0;

    // Use our starting stock & cost calculator
    const { startingStock, startingCost, currentStock, currentCost } = getStartingStockAndCost(cleanCode);

    // Calculate draft cost price
    let draftCost = cost;
    if (startingStock > 0) {
      if (qty > 0) {
        draftCost = Math.round(((startingStock * startingCost) + (qty * cost)) / (startingStock + qty));
      } else {
        draftCost = startingCost;
      }
    }

    // 1. Registered locally in product catalogue for the duration of this voucher session
    const updatedProducts = [...localProducts];
    const catIdx = updatedProducts.findIndex(p => p.code === cleanCode);
    
    if (catIdx === -1) {
      // Insert new product
      const newCatalogProductObj: Product = {
        code: cleanCode,
        designation: cleanDesignation,
        prixVente1: sp1,
        prixVente2: sp2,
        prixVente3: sp3,
        stock: 0, // Starts catalog template at 0, purchase validation will increment it
        stockColis: 0,
        category: prodFamille,
        prixDeRevient: cost,
        prixAchat: cost
      };
      updatedProducts.push(newCatalogProductObj);
    } else {
      // Update catalog entry (updating designations, edited stocks, and selling prices with weighted average cost price)
      const existingProduct = updatedProducts[catIdx];
      
      updatedProducts[catIdx] = {
        ...existingProduct,
        designation: cleanDesignation,
        stock: currentStock, // DO NOT subtract or revert! Keep actual real-time stock!
        stockColis: colNum > 0 ? Math.ceil(currentStock / colNum) : 0,
        prixVente1: sp1,
        prixVente2: sp2,
        prixVente3: sp3,
        category: prodFamille,
        prixDeRevient: draftCost, // Update to the newly calculated draft cost price!
        prixAchat: cost
      };
    }

    setLocalProducts(updatedProducts);

    // Immediately propagate the new/edited product definition (with starting catalog stock/cost) to the global catalog
    if (onProductsUpdate) {
      onProductsUpdate(updatedProducts);
    }

    // 2. Add/Replace in current voucher items draft
    const existingIndexInVoucherItem = draftItems.findIndex(item => item.code === cleanCode);
    const newVoucherItem: VoucherItem = {
      id: Math.random().toString(),
      code: cleanCode,
      designation: cleanDesignation,
      colisage: colNum,
      nbreColis: nbreColNum,
      pieces: colNum > 0 ? qty % colNum : 0,
      qty: qty,
      price: cost,
      total: qty * cost
    };

    if (existingIndexInVoucherItem >= 0) {
      const updated = [...draftItems];
      updated[existingIndexInVoucherItem] = newVoucherItem;
      setDraftItems(updated);
      setSelectedDraftIdx(existingIndexInVoucherItem);
    } else {
      const updated = [...draftItems, newVoucherItem];
      setDraftItems(updated);
      setSelectedDraftIdx(updated.length - 1);
    }

    setIsProductDialogOpen(false);
  };

  const currentSelectedProduct = useMemo(() => {
    const itemsList = mode === 'create' ? draftItems : (selectedVoucher?.items || []);
    if (selectedDraftIdx >= 0 && selectedDraftIdx < itemsList.length) {
      return itemsList[selectedDraftIdx];
    }
    return itemsList[0] || null;
  }, [draftItems, selectedVoucher, selectedDraftIdx, mode]);

  // Handles Keyboards POS Quick Shortcuts
  useEffect(() => {
    const handleGlobalKeydowns = (e: KeyboardEvent) => {
      if (!isOpen) return;
      // Only process keys when current pane is active (i.e. focused / not writing inside key inputs)
      // Check if user is typing on target elements inside some input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' && !(e.target as HTMLInputElement).readOnly && !isProductDialogOpen && !isPaymentDialogOpen) {
        // Let standard input handle typing, except for Enter barcode
        if (e.key === 'Enter' && (e.target as HTMLInputElement).placeholder.includes('Scanner')) {
          e.preventDefault();
        }
        return;
      }

      if (isCatalogSearchOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsCatalogSearchOpen(false);
        }
        return;
      }

      if (isPaymentDialogOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsPaymentDialogOpen(false);
        }
        if (e.key === 'Enter' || e.key === 'F5') {
          e.preventDefault();
          handleConfirmPaymentAndSaveVoucher();
        }
        return;
      }

      if (isProductDialogOpen) {
        // Modal hotkeys
        if (e.key === 'Escape') {
          setIsProductDialogOpen(false);
        }
        if (e.key === 'F1') {
          e.preventDefault();
          setActiveDialogTab('general');
        }
        if (e.key === 'F2') {
          e.preventDefault();
          setActiveDialogTab('plus_info');
        }
        if (e.key === 'F3') {
          e.preventDefault();
          setActiveDialogTab('photo');
        }
        return;
      }

      // Main window hotkeys
      if (e.key === 'F1') {
        e.preventDefault();
        handleNewVoucher();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        if (mode === 'create') {
          setMode('view');
          setEditingVoucherId(null);
        } else {
          onClose();
        }
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (mode === 'create') {
          showRetroAlert("Impression impossible. Veuillez d'abord fermer le bon (enregistrer) !", "Saisie achats");
        } else if (selectedVoucher) {
          setIsPrintPreviewOpen(true);
        }
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (mode !== 'create') handleEditVoucher();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        if (mode === 'create') handleSaveVoucher();
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (mode === 'create') handleOpenProductDialog('add_new');
      }
      if (e.key === 'Enter') {
        if (mode === 'create') {
          e.preventDefault();
          handleOpenProductDialog('insert_existing');
        }
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (mode === 'create') handleOpenProductDialog('edit_existing');
      }
      if (e.key === 'F10') {
        e.preventDefault();
        handlePrintBarcodeLabel();
      }
      if (e.key === 'Delete') {
        if (mode === 'create' && selectedDraftIdx >= 0) {
          e.preventDefault();
          handleRemoveDraftItem(selectedDraftIdx);
        }
      }
      if (e.ctrlKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (mode === 'view' && selectedVoucher) {
          e.preventDefault();
          handleDeleteVoucher();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeydowns);
    return () => window.removeEventListener('keydown', handleGlobalKeydowns);
  }, [
    isOpen, mode, purchases, selectedDraftIdx, draftItems, isProductDialogOpen, isCatalogSearchOpen, localProducts,
    prodCode, prodDesignation, prodPrixVente1, prodPrixAchat, prodQtyCalculated, prodColisage, prodNbreColis,
    isPaymentDialogOpen, paymentVersement, editingVoucherId, paymentMode, paymentSource, draftMetrics,
    selectedVoucher, selectedVoucherId, handleDeleteVoucher
  ]);

  const unfilteredItems = mode === 'create' ? draftItems : (selectedVoucher?.items || []);
  const currentItems = unfilteredItems.filter(item => {
    if (!localSearchQuery.trim()) return true;
    const q = localSearchQuery.toLowerCase().trim();
    return (
      (item.code || '').toLowerCase().includes(q) ||
      (item.designation || '').toLowerCase().includes(q)
    );
  });
  const displayMetrics = mode === 'create' ? draftMetrics : {
    rawAmount: selectedVoucher?.amount || 0,
    totalQty: selectedVoucher?.items?.reduce((acc, t) => acc + t.qty, 0) || 0,
    totalHT: selectedVoucher?.totalHT || 0,
    tva: selectedVoucher?.tva || 0,
    timbre: selectedVoucher?.timbre || 0,
    ttc: selectedVoucher?.ttc || 0,
    oldBalance: selectedVoucher?.oldBalance || 0,
    newBalance: selectedVoucher?.newBalance || 0,
  };

  return (
    <div id="purchases-root-container" className="flex-1 flex flex-col font-sans text-xs bg-slate-50 dark:bg-slate-900/40 text-slate-800 dark:text-slate-100 h-full overflow-hidden select-none outline-none relative">
      
      {/* 1. Header Toolbar Ribbon - Modernized with Material 3 styling */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 py-1 px-2 rounded-xl border border-slate-200/50 dark:border-slate-800/85 gap-1.5 flex-nowrap overflow-x-auto scrollbar-none select-none shadow-xs mb-2 shrink-0 h-[46px]">
        
        {/* Navigation Pager controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200/20 gap-0.5 shadow-inner">
            <button
              onClick={handleFirst}
              disabled={navigableVouchers.length === 0 || activeVoucherIndex <= 0}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Premier Bon"
            >
              <span className="text-xs font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">⏮</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Début</span>
            </button>
            <button
              onClick={handlePrev}
              disabled={navigableVouchers.length === 0 || activeVoucherIndex <= 0}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Bon Précédent"
            >
              <span className="text-[10px] font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">◀</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Préc.</span>
            </button>
            <button
              onClick={handleNext}
              disabled={navigableVouchers.length === 0 || activeVoucherIndex >= navigableVouchers.length - 1}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Bon Suivant"
            >
              <span className="text-[10px] font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">▶</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Suiv.</span>
            </button>
            <button
              onClick={handleLast}
              disabled={navigableVouchers.length === 0 || activeVoucherIndex >= navigableVouchers.length - 1}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Dernier Bon"
            >
              <span className="text-xs font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">⏭</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Fin</span>
            </button>
          </div>
 
          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />
 
          {/* Action Buttons styled like SalesVoucherWindow */}
          <div className="flex items-center gap-1 flex-nowrap shrink-0">
            <button
              onClick={handleNewVoucher}
              className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 hover:to-teal-700 text-white rounded-lg shadow-md cursor-pointer transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
            >
              <span className="text-xs">📄</span>
              <div className="flex flex-col text-left font-sans">
                <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Nouveau bon</span>
                <span className="text-[7px] font-bold text-emerald-100 tracking-wider">[ F1 ]</span>
              </div>
            </button>

            {mode === 'create' ? (
              <button
                onClick={handleSaveVoucher}
                className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-600 to-teal-700 hover:to-teal-800 text-white rounded-lg shadow-md cursor-pointer transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
              >
                <span className="text-xs">🔒</span>
                <div className="flex flex-col text-left font-sans">
                  <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Fermer le bon</span>
                  <span className="text-[7px] font-extrabold text-emerald-150 tracking-wider">[ F5 ]</span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setIsPrintPreviewOpen(true)}
                disabled={!selectedVoucher}
                className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950 shadow-xs cursor-pointer transition-transform duration-100 active:scale-95 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <span className="text-xs">🖨️</span>
                <div className="flex flex-col text-left font-sans">
                  <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Impression</span>
                  <span className="text-[7px] font-bold text-slate-400 tracking-wider">[ F3 ]</span>
                </div>
              </button>
            )}

            <button
              onClick={handleEditVoucher}
              disabled={mode === 'create' || !selectedVoucher}
              className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950 shadow-xs cursor-pointer disabled:opacity-40 transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
            >
              <span className="text-xs">✏️</span>
              <div className="flex flex-col text-left font-sans">
                <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Modifier</span>
                <span className="text-[7px] font-bold text-slate-400 tracking-wider">[ F4 ]</span>
              </div>
            </button>

            <button
              onClick={() => {
                if (mode !== 'create') {
                  alert("Vous devez être en mode création ou modification de bon d'achat.");
                  return;
                }
                const date = prompt("Saisir la date du bon (JJ/MM/AAAA) :", newDate);
                if (date) setNewDate(date);
              }}
              disabled={mode !== 'create'}
              className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950 shadow-xs cursor-pointer disabled:opacity-40 transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
            >
              <span className="text-xs">✒️</span>
              <div className="flex flex-col text-left font-sans">
                <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Infos Bon</span>
                <span className="text-[7px] font-bold text-slate-400 tracking-wider">[ CTRL+F ]</span>
              </div>
            </button>

            {mode === 'create' ? (
              <div className="flex gap-1 animate-in slide-in-from-right-3 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    if (draftItems && draftItems.length > 0) {
                      showRetroAlert("Ce bon d'achat n'est pas vide. Veuillez d'abord supprimer tous les articles de ce bon.", "Saisie achats");
                      return;
                    }
                    if (editingVoucherId) {
                      showRetroConfirm(
                        `Voulez-vous vraiment supprimer définitivement le Bon d'Achat N° ${newVoucherId} ?\n\nCette action ajustera le solde du fournisseur (${newSupplierName}) automatiquement.`,
                        () => {
                          const idToDelete = newVoucherId;
                          onDeletePurchase(idToDelete);
                          setOpenDrafts(prev => prev.filter(d => String(d.id) !== String(idToDelete)));
                          setMode('view');
                          setEditingVoucherId(null);
                          const remaining = purchases.filter(p => String(p.id) !== String(idToDelete));
                          if (remaining.length > 0) {
                            setSelectedVoucherId(remaining[remaining.length - 1].id);
                          } else {
                            setSelectedVoucherId('');
                          }
                          showRetroAlert(`Le Bon d'Achat N° ${idToDelete} a été retiré de la base de données.`);
                        }
                      );
                    } else {
                      showRetroConfirm(
                        `Voulez-vous vraiment supprimer le Brouillon de Bon d'Achat N° ${newVoucherId} ?`,
                        () => {
                          const idToDelete = newVoucherId;
                          const draftToDel = openDrafts.find(d => String(d.id) === String(idToDelete));
                          if (draftToDel && onProductsUpdate) {
                            const otherPurchasesCodes = new Set(purchases.flatMap(p => p.items.map(i => String(i.code))));
                            const otherDraftsCodes = new Set(
                              openDrafts
                                .filter(d => String(d.id) !== String(idToDelete))
                                .flatMap(d => (d.draftItems || []).map((i: any) => String(i.code)))
                            );
                            const cleanedProducts = products.filter(p => {
                              const inThisDraft = (draftToDel.draftItems || []).some((i: any) => String(i.code) === String(p.code));
                              if (inThisDraft) {
                                return otherPurchasesCodes.has(String(p.code)) || otherDraftsCodes.has(String(p.code));
                              }
                              return true;
                            });
                            onProductsUpdate(cleanedProducts);
                          }
                          setOpenDrafts(prev => prev.filter(d => String(d.id) !== String(idToDelete)));
                          setMode('view');
                          setEditingVoucherId(null);
                          if (purchases.length > 0) {
                            setSelectedVoucherId(purchases[purchases.length - 1].id);
                          } else {
                            setSelectedVoucherId('');
                          }
                        }
                      );
                    }
                  }}
                  className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer transition-transform duration-100 active:scale-95 shadow-xs whitespace-nowrap shrink-0"
                >
                  <span className="text-xs">🗑️</span>
                  <div className="flex flex-col text-left font-sans">
                    <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">
                      {editingVoucherId ? "Suppr. Bon" : "Suppr. Brouillon"}
                    </span>
                    <span className="text-[7px] font-bold text-rose-500 tracking-wider">Dispo</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('view');
                    setEditingVoucherId(null);
                  }}
                  className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950 cursor-pointer transition-transform duration-100 active:scale-95 shadow-xs whitespace-nowrap shrink-0"
                >
                  <span className="text-xs">✕</span>
                  <div className="flex flex-col text-left font-sans">
                    <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Annuler</span>
                    <span className="text-[7px] font-bold text-amber-500 tracking-wider">[ F2 ]</span>
                  </div>
                </button>
              </div>
            ) : (
              <button
                onClick={handleDeleteVoucher}
                disabled={!selectedVoucher}
                className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer disabled:opacity-40 transition-transform duration-100 active:scale-95 shadow-xs whitespace-nowrap shrink-0"
              >
                <span className="text-xs">🗑️</span>
                <div className="flex flex-col text-left font-sans">
                  <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Supprimer</span>
                  <span className="text-[7px] font-semibold text-rose-500 tracking-wider">[ CTRL+SUPP ]</span>
                </div>
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(purchases, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `composes_achats_${Date.now()}.json`);
            dlAnchorElem.click();
          }}
          className="px-2.5 h-8 mr-1 flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950 shadow-xs cursor-pointer transition-transform duration-100 active:scale-95 text-[10px] font-bold"
        >
          <span>📥 Importer JSON</span>
        </button>
      </div>

      {/* Middle Pane: Master historical list & Header Fields */}
      <div 
        id="top-row-container" 
        className="flex flex-col lg:flex-row gap-2 select-none shrink-0" 
        style={{ height: `${topSectionHeight}px` }}
      >
        {/* Vouchers Master Table (Left/Center) */}
        <div 
          style={{ width: `${topSplitWidth}%` }} 
          className="flex flex-col rounded-2xl border border-slate-200/50 dark:border-slate-800/85 bg-white dark:bg-slate-950 h-full min-w-[200px] overflow-hidden shadow-xs"
        >
          <div className="bg-slate-50 dark:bg-slate-900 font-bold px-4 py-1.5 border-b border-slate-150 dark:border-slate-850/60 text-slate-700 dark:text-slate-300 font-sans select-none flex justify-between items-center shrink-0 gap-2 flex-nowrap overflow-x-auto scrollbar-none">
            <span className="flex items-center gap-1.5 font-display text-xs font-extrabold whitespace-nowrap">
              <span className="text-indigo-500">📋</span> Registre des Bons d'Achat
            </span>
            <div className="flex items-center gap-2 select-text">
              {/* N° search filter */}
              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] text-slate-400 font-bold">N°:</span>
                <input
                  type="text"
                  placeholder="Chercher..."
                  value={filterVoucherId}
                  onChange={(e) => setFilterVoucherId(e.target.value)}
                  className="w-24 h-6 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-lg pl-6 pr-4.5 text-[10.5px] font-mono font-bold text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500"
                />
                {filterVoucherId && (
                  <button 
                    onClick={() => setFilterVoucherId('')}
                    className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[9px]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Date search filter */}
              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] text-slate-400 font-bold">📅:</span>
                <input
                  type="text"
                  placeholder="Date..."
                  value={filterVoucherDate}
                  onChange={(e) => setFilterVoucherDate(e.target.value)}
                  className="w-24 h-6 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-lg pl-6 pr-4.5 text-[10.5px] font-mono font-bold text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500"
                />
                {filterVoucherDate && (
                  <button 
                    onClick={() => setFilterVoucherDate('')}
                    className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[9px]"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
          <div 
            className="flex-1 overflow-auto"
            onClick={() => {
              setSelectedVoucherId('');
              setEditingVoucherId(null);
            }}
          >
            <table className="w-full text-left font-sans text-xs border-collapse table-fixed">
              <thead className="bg-slate-100/60 dark:bg-slate-900 font-semibold text-slate-500 dark:text-slate-400 sticky top-0 select-none border-b border-slate-200/40 dark:border-slate-800/40 z-10 text-[10.5px] uppercase tracking-wider">
                <tr>
                  <th style={{ width: `${purchaseListColWidths.num}px`, minWidth: `${purchaseListColWidths.num}px` }} className="px-3 py-2 relative group">
                    N°
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseList('num', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseListColWidths.date}px`, minWidth: `${purchaseListColWidths.date}px` }} className="px-3 py-2 relative group">
                    Date
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseList('date', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseListColWidths.time}px`, minWidth: `${purchaseListColWidths.time}px` }} className="px-3 py-2 relative group">
                    Heure
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseList('time', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseListColWidths.supplier}px`, minWidth: `${purchaseListColWidths.supplier}px` }} className="px-3 py-2 relative group">
                    Fournisseur
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseList('supplier', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseListColWidths.itemsCount}px`, minWidth: `${purchaseListColWidths.itemsCount}px` }} className="px-3 py-2 text-center relative group">
                    Nbre P
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseList('itemsCount', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseListColWidths.total}px`, minWidth: `${purchaseListColWidths.total}px` }} className="px-3 py-2 text-right relative group">
                    Total
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseList('total', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                </tr>
              </thead>
              <tbody className="font-sans text-[11.5px]">
                {navigableVouchers.map((nav) => {
                  const isDraft = nav.type === 'draft';
                  const v = nav.data;
                  const isEditing = editingVoucherId === v.id;
                  
                  const isSelected = mode === 'create'
                    ? (v.id === newVoucherId)
                    : (selectedVoucherId !== '' && v.id === selectedVoucherId);

                  const displaySupplier = isEditing ? newSupplierName : v.supplier;
                  const displayItemsCount = isEditing ? draftItems.length : isDraft ? (v.draftItems || []).length : v.itemsCount;
                  
                  let displayTtc = 0;
                  if (isEditing) {
                    displayTtc = draftMetrics.ttc ?? 0;
                  } else if (isDraft) {
                    const items = v.draftItems || [];
                    displayTtc = items.reduce((sum: number, it: any) => sum + ((it.price || 0) * (it.qty || 0)), 0);
                  } else {
                    displayTtc = v.ttc ?? 0;
                  }

                  const isLocked = !isDraft && !isEditing;

                  return (
                    <tr
                      key={`${nav.type}-${v.id}`}
                      data-selected={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDraft) {
                          loadDraft(v);
                        } else {
                          setSelectedVoucherId(v.id);
                          setEditingVoucherId(null);
                          setMode('view');
                        }
                      }}
                      className={`cursor-pointer border-b border-slate-100 dark:border-slate-900/60 transition-colors ${
                        isEditing
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border-l-2 border-l-amber-500'
                          : isSelected 
                            ? isDraft 
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                              : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'hover:bg-slate-100/60 dark:hover:bg-slate-900/40 odd:bg-slate-50/20 dark:odd:bg-slate-900/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold flex items-center gap-1.5">
                        {!isLocked ? (
                          <span title="Bon ouvert / Modification en cours" className="text-amber-500 text-[11px]">✏️</span>
                        ) : (
                          <span title="Bon clôturé" className="text-slate-400 dark:text-slate-500 text-[11px]">🔒</span>
                        )}
                        <span>{v.id}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{v.date}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{v.time}</td>
                      <td className="px-3 py-2 truncate max-w-[140px] select-all font-medium">{displaySupplier}</td>
                      <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400">{displayItemsCount}</td>
                      <td className="px-3 py-2 text-right font-black text-indigo-950 dark:text-indigo-300">
                        {displayTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DRAG SPLITTER (Width) */}
        <div 
          onPointerDown={(e) => {
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch (err) {}
            resizeStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              topHeight: topSectionHeight,
              bottomHeight: bottomSectionHeight,
              topWidth: topSplitWidth,
              bottomWidth: bottomSplitWidth
            };
            setIsResizingTopWidth(true);
          }}
          className="hidden lg:flex w-1.5 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-col-resize h-full select-none items-center justify-center border-l border-r border-transparent shrink-0"
          title="Glisser pour ajuster la largeur"
        >
          <div className="w-[2px] h-6 bg-slate-300 dark:bg-slate-700 rounded" />
        </div>

        {/* Compact Form Panel (Right) */}
        <div 
          style={{ width: `${100 - topSplitWidth}%` }} 
          className="bg-white dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/85 flex flex-col justify-center overflow-y-auto h-full min-w-[220px] shadow-xs"
        >
          <div className="flex flex-col gap-2">
            {/* Column 1: Ancien solde */}
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider truncate" title="Ancien solde">Ancien solde</span>
              <input
                type="text"
                readOnly
                value={(displayMetrics.oldBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' DA'}
                className="h-7.5 rounded-xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 px-2.5 text-right outline-none text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400"
              />
            </div>

            {/* Column 2: Montant ( bon ) */}
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider truncate" title="Montant ( bon )">Montant ( bon )</span>
              <input
                type="text"
                readOnly
                value={(displayMetrics.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' DA'}
                className="h-7.5 rounded-xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 px-2.5 text-right outline-none text-[11px] font-mono font-bold text-indigo-950 dark:text-indigo-300"
              />
            </div>

            {/* Column 3: Versement */}
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider truncate" title="Versement">Versement</span>
              <input
                type="text"
                readOnly
                value={(mode === 'create' ? (versement || 0) : (selectedVoucher?.versement || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' DA'}
                className="h-7.5 rounded-xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 px-2.5 text-right outline-none text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            {/* Column 4: Nouveau solde */}
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider truncate" title="Nouveau solde">Nouveau solde</span>
              <input
                type="text"
                readOnly
                value={(displayMetrics.newBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' DA'}
                className="h-7.5 rounded-xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 px-2.5 text-right outline-none text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DRAG SPLITTER (Top Height) - drag to resize the division height */}
      <div 
        onPointerDown={(e) => {
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch (err) {}
          resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            topHeight: topSectionHeight,
            bottomHeight: bottomSectionHeight,
            topWidth: topSplitWidth,
            bottomWidth: bottomSplitWidth
          };
          setIsResizingTopHeight(true);
        }}
        className="h-1.5 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-row-resize border-t border-b border-transparent rounded flex items-center justify-center select-none shrink-0"
        title="Glisser verticalement pour changer la hauteur du registre"
      >
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
      </div>

      {/* BOTTOM ACTION BUTTONS - MODERNIZED AND COHESIVE */}
      <div className="flex flex-nowrap items-center justify-start bg-white dark:bg-slate-900 py-1 px-2 border border-slate-200/50 dark:border-slate-800/85 rounded-xl gap-2 shrink-0 select-none shadow-xs overflow-x-auto no-scrollbar h-10">
        
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bottom Table Pager Navigator */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200/20 gap-0.5 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDraftIdx(draftItems.length > 0 ? 0 : -1)}
              disabled={mode === 'view' || draftItems.length === 0}
              title="Aller au début de la liste"
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 border border-slate-200/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer text-[10px]"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={() => setSelectedDraftIdx(prev => Math.max(0, prev - 1))}
              disabled={mode === 'view' || selectedDraftIdx <= 0}
              title="Article Précédent"
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 border border-slate-200/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer text-[10px]"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => setSelectedDraftIdx(prev => Math.min(draftItems.length - 1, prev + 1))}
              disabled={mode === 'view' || selectedDraftIdx === -1 || selectedDraftIdx >= draftItems.length - 1}
              title="Article Suivant"
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 border border-slate-200/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer text-[10px]"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => setSelectedDraftIdx(draftItems.length > 0 ? draftItems.length - 1 : -1)}
              disabled={mode === 'view' || draftItems.length === 0}
              title="Aller à la fin de la liste"
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 border border-slate-200/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer text-[10px]"
            >
              ⏭
            </button>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5" />

        {/* Action buttons list */}
        <div className="flex gap-1 flex-nowrap shrink-0 overflow-x-auto no-scrollbar items-center">
          <button
            type="button"
            onClick={() => handleOpenProductDialog('add_new')}
            disabled={mode === 'view'}
            className="px-2.5 h-7.5 rounded-lg font-bold bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xs cursor-pointer disabled:opacity-30 flex items-center gap-1 active:scale-95 transition-all text-[9.5px] shrink-0"
          >
            <span>➕ Nouveau</span>
            <span className="text-[7.5px] opacity-80 font-mono">[Ctrl+N]</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenProductDialog('insert_existing')}
            disabled={mode === 'view'}
            className="px-2.5 h-7.5 rounded-lg font-bold bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-xs cursor-pointer disabled:opacity-30 flex items-center gap-1 active:scale-95 transition-all text-[9.5px] shrink-0"
          >
            <span>📥 Insérer</span>
            <span className="text-[7.5px] opacity-80 font-mono">[Entrer]</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenProductDialog('edit_existing')}
            disabled={mode === 'view' || selectedDraftIdx === -1}
            className="px-2.5 h-7.5 rounded-lg font-bold bg-white dark:bg-slate-900 text-slate-755 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer disabled:opacity-30 flex items-center gap-1 active:scale-95 transition-all text-[9.5px] shrink-0"
          >
            <span>✏️ Modifier</span>
            <span className="text-[7.5px] opacity-80 font-mono">[F8]</span>
          </button>

          <button
            type="button"
            onClick={() => handleRemoveDraftItem(selectedDraftIdx)}
            disabled={mode === 'view' || selectedDraftIdx === -1}
            className="px-2.5 h-7.5 rounded-lg font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border border-rose-250 dark:border-rose-900/45 shadow-xs cursor-pointer disabled:opacity-30 flex items-center gap-1 active:scale-95 transition-all text-[9.5px] shrink-0"
          >
            <span>❌ Supprimer</span>
            <span className="text-[7.5px] opacity-80 font-mono">[Suppr]</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrintBarcodeLabel()}
            disabled={mode === 'create' ? draftItems.length === 0 : (!selectedVoucher || selectedVoucher.items.length === 0)}
            className="px-2.5 h-7.5 rounded-lg font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer disabled:opacity-30 flex items-center gap-1 active:scale-95 transition-all text-[9.5px] shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span>🖨️ Étiquettes</span>
            <span className="text-[7.5px] opacity-80 font-mono">[F10]</span>
          </button>
        </div>
      </div>

      {/* Item details table and sidebar totals */}
      <div 
        id="bottom-row-container" 
        className="flex-1 flex flex-col lg:flex-row gap-2 select-none min-h-[160px]"
      >
        {/* Table of items details */}
        <div 
          style={{ width: `${bottomSplitWidth}%` }} 
          className={`flex flex-col rounded-2xl border border-slate-200/50 dark:border-slate-800/85 bg-white dark:bg-slate-950 h-full min-w-[250px] overflow-hidden shadow-xs transition-all duration-300 ${
            mode === 'view'
              ? 'opacity-65 grayscale bg-slate-50/70 dark:bg-slate-900/40 border-slate-300 dark:border-slate-850/60'
              : ''
          }`}
        >
          <div className="bg-slate-50 dark:bg-slate-900 font-bold px-4 py-2 border-b border-slate-150 dark:border-slate-850/60 text-slate-700 dark:text-slate-300 font-sans select-none flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-display font-extrabold text-xs flex items-center gap-1.5 shrink-0">
                <span className="text-emerald-500">🛒</span> Articles de ce Bon d'Achat
              </span>
              
              {/* Filter box right next to "Articles de ce Bon d'Achat" */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
                <span className="text-[10px]" title="Recherche dans ce bon d'achat">🔍</span>
                <input
                  type="text"
                  placeholder="Filtrer ce bon..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className="w-32 h-5 font-sans text-[11px] bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold"
                />
                {localSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLocalSearchQuery('')}
                    className="text-[9px] text-slate-400 hover:text-slate-700 dark:hover:text-white font-extrabold px-0.5 cursor-pointer"
                    title="Effacer le filtre"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wide hidden sm:inline">F8 pour éditer la ligne</span>
          </div>
          <div 
            className="flex-1 overflow-auto"
            onClick={() => setSelectedDraftIdx(-1)}
          >
            <table className="w-full text-left font-sans text-xs border-collapse table-fixed">
              <thead className="bg-slate-100/60 dark:bg-slate-900 font-semibold text-slate-500 dark:text-slate-400 sticky top-0 select-none border-b border-slate-200/40 dark:border-slate-800/40 z-10 text-[10.5px] uppercase tracking-wider">
                <tr>
                  <th style={{ width: `${purchaseItemColWidths.num}px`, minWidth: `${purchaseItemColWidths.num}px` }} className="px-3 py-2 text-center relative group">
                    N°
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('num', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.code}px`, minWidth: `${purchaseItemColWidths.code}px` }} className="px-3 py-2 font-mono relative group">
                    Code produit
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('code', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.designation}px`, minWidth: `${purchaseItemColWidths.designation}px` }} className="px-3 py-2 relative group">
                    Désignation Produit
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('designation', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.colis}px`, minWidth: `${purchaseItemColWidths.colis}px` }} className="px-1 py-2 text-center relative group">
                    Colis
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('colis', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.colisage}px`, minWidth: `${purchaseItemColWidths.colisage}px` }} className="px-1 py-2 text-center relative group">
                    Colisage
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('colisage', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.qte}px`, minWidth: `${purchaseItemColWidths.qte}px` }} className="px-1 py-2 text-center relative group">
                    Qté
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('qte', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.punit}px`, minWidth: `${purchaseItemColWidths.punit}px` }} className="px-3 py-2 text-right relative group">
                    Prix Unit
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('punit', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.montant}px`, minWidth: `${purchaseItemColWidths.montant}px` }} className="px-3 py-2 text-right relative group">
                    Montant HT
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('montant', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                  <th style={{ width: `${purchaseItemColWidths.action}px`, minWidth: `${purchaseItemColWidths.action}px` }} className="px-1 py-2 text-center relative group">
                    Action
                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResizingPurchaseItem('action', e.clientX); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 active:bg-indigo-600 z-20" title="Redimensionner" />
                  </th>
                </tr>
              </thead>
              <tbody className="font-sans text-[11.5px] text-slate-705 dark:text-slate-300">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400 dark:text-slate-500 italic font-sans">
                      Aucun produit n'est encore enregistré dans ce bon d'achat. <br/>
                      <span className="text-[10px] text-indigo-500/80 font-bold not-italic font-sans block mt-1">Cliquez sur (+ Nouveau) ou (+ Insérer) pour commencer</span>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, index) => {
                    const actualIndex = unfilteredItems.findIndex(d => d.id === item.id);
                    const isSelected = actualIndex === selectedDraftIdx;
                    return (
                      <tr 
                        key={item.id} 
                        data-selected={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDraftIdx(actualIndex);
                        }}
                        className={`border-b border-slate-100 dark:border-slate-900/60 transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'hover:bg-slate-100/60 dark:hover:bg-slate-900/40 even:bg-slate-50/20 dark:even:bg-slate-900/10'
                        }`}
                      >
                        <td className="px-3 py-2 text-center font-bold text-slate-400">{actualIndex + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">{item.code}</td>
                        <td className="px-3 py-2 font-sans truncate select-all">{item.designation}</td>
                        <td className="px-1 py-2 text-center font-mono">{item.nbreColis ?? 0}</td>
                        <td className="px-1 py-2 text-center text-slate-400 dark:text-slate-500 font-mono">{item.colisage ?? 0}</td>
                        <td className={`px-1 py-2 text-center font-mono font-bold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-950 dark:text-indigo-300'}`}>{item.qty}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          {(item.price ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-black ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {(item.total ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-1 py-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintBarcodeLabel(item);
                            }}
                            className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors"
                            title="Imprimer l'étiquette code-barres"
                          >
                            <Barcode size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* DRAG SPLITTER (Width) */}
        <div 
          onPointerDown={(e) => {
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch (err) {}
            resizeStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              topHeight: topSectionHeight,
              bottomHeight: bottomSectionHeight,
              topWidth: topSplitWidth,
              bottomWidth: bottomSplitWidth
            };
            setIsResizingBottomWidth(true);
          }}
          className="hidden lg:flex w-1.5 bg-transparent hover:bg-slate-205 dark:hover:bg-slate-800 transition-colors cursor-col-resize h-full select-none items-center justify-center border-l border-r border-transparent shrink-0"
          title="Faites glisser pour ajuster la largeur des totaux"
        >
          <div className="w-[2px] h-6 bg-slate-300 dark:bg-slate-700 rounded" />
        </div>

        {/* Sidebar Totals column (Right) */}
        <div 
          style={{ width: `${100 - bottomSplitWidth}%` }} 
          className="bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 p-2.5 rounded-2xl flex flex-col gap-1.5 select-all overflow-y-auto h-full min-w-[200px] shadow-xs"
        >
          <div className="bg-indigo-500/10 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-extrabold px-3 py-1 rounded-xl text-[9.5px] tracking-wider text-center uppercase font-sans shrink-0">
            Recap Financier Achat
          </div>
          
          <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[8.5px]">S/Total Brut</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {(displayMetrics.rawAmount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[8.5px]">Remise Fournisseur</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">0,00 DA</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[8.5px]">Total HT</span>
            <span className="font-mono font-extrabold text-slate-800 dark:text-slate-100">
              {(displayMetrics.totalHT ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[8.5px]">TVA (%)</span>
            <span className="font-mono text-slate-800 dark:text-slate-300">0,00 DA (0%)</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-900 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[8.5px]">Timbre Fiscal</span>
            <span className="font-mono text-slate-800 dark:text-slate-300">
              {(displayMetrics.timbre ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
            </span>
          </div>

          {/* NET EN DINARS (TTC À PAYER) replaces previous styling to match sales */}
          <div className="bg-slate-950 dark:bg-black p-4 rounded-xl text-center flex flex-col gap-1.5 shadow-xl border border-slate-800 mt-2 shrink-0 select-all">
            <span className="text-[11px] font-bold text-amber-400 tracking-widest font-display uppercase leading-none">
              NET EN DINARS (ACHAT)
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-[#10b981] dark:text-[#34d399] tracking-tight drop-shadow-[0_0_10px_rgba(52,211,153,0.6)] mt-1">
              {(displayMetrics.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
            </span>
          </div>
        </div>
      </div>

      {/* ==================== SELECT CATALOG PRODUCT MODAL ==================== */}
      {isCatalogSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 select-none animate-in fade-in duration-150">
          <div className="w-[580px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-850 dark:from-slate-950 dark:to-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex flex-col text-white font-sans">
                <span className="font-extrabold text-sm flex items-center gap-1.5">
                  <Package size={15} /> Insérer un Produit depuis le Catalogue
                </span>
                <span className="text-[10px] opacity-80 mt-0.5">
                  Recherchez et sélectionnez le produit à ajouter au bon d'achat
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogSearchOpen(false)}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Instruction Banner */}
            <div className="bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 px-5 py-3 border-b border-slate-100 dark:border-slate-800/60 font-sans select-none leading-relaxed text-[11px]">
              Recherchez et sélectionnez le produit dans votre stock. Cliquez sur un article pour le choisir puis validez pour configurer sa quantité d'achat.
            </div>

            {/* Content Body */}
            <div className="p-5 flex flex-col gap-4 bg-white dark:bg-slate-900 flex-1">
              
              {/* Search Box Row */}
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3.5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Filtrer par code-barre, désignation, famille..."
                  value={insertSearchQuery}
                  onChange={(e) => {
                    setInsertSearchQuery(e.target.value);
                    setSelectedSearchProduct(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const bestItem = selectedSearchProduct && filteredProductsToInsert.some(p => p.code === selectedSearchProduct.code)
                        ? selectedSearchProduct
                        : filteredProductsToInsert[0];
                      if (bestItem) {
                        handleSelectCatalogProduct(bestItem);
                      }
                    }
                  }}
                  className="w-full h-10 pl-10 pr-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>

              {/* Matching products table */}
              <div className="flex flex-col border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-slate-50/30 dark:bg-slate-950/20">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-1 bg-slate-50 dark:bg-slate-950 font-black text-[9px] text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-850 py-2.5 px-4 select-none font-sans uppercase tracking-widest">
                  <span className="col-span-3">Code Article</span>
                  <span className="col-span-4">Désignation Produit</span>
                  <span className="col-span-2.5">Famille</span>
                  <span className="col-span-1.5 text-center">Stock</span>
                  <span className="col-span-1 text-right">PV1</span>
                </div>
                
                {/* Table Body */}
                <div className="max-h-[200px] overflow-y-auto bg-white dark:bg-slate-900 flex flex-col font-mono text-[11px] text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-850">
                  {(() => {
                    const activeItem = selectedSearchProduct && filteredProductsToInsert.some(p => p.code === selectedSearchProduct.code)
                      ? selectedSearchProduct
                      : (filteredProductsToInsert[0] || null);

                    return (
                      <>
                        {filteredProductsToInsert.map((p) => {
                          const isActive = activeItem && activeItem.code === p.code;
                          return (
                            <div 
                              key={p.code}
                              onClick={() => setSelectedSearchProduct(p)}
                              onDoubleClick={() => handleSelectCatalogProduct(p)}
                              className={`grid grid-cols-12 gap-1 py-2.5 px-4 cursor-pointer items-center leading-tight select-none transition-all duration-75 ${
                                isActive 
                                  ? 'bg-teal-600 text-white font-extrabold shadow-sm scale-[1.01]' 
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <span className="col-span-3 truncate font-bold">{p.code}</span>
                              <span className="col-span-4 truncate font-sans text-xs font-bold">{p.designation}</span>
                              <span className={`col-span-2.5 truncate font-sans text-[10px] ${isActive ? 'text-teal-100' : 'text-slate-500'}`}>
                                {p.category || '(Sans)'}
                              </span>
                              <span className={`col-span-1.5 text-center truncate font-bold ${isActive ? 'text-white' : 'text-teal-600 dark:text-teal-400 font-black'}`}>
                                {p.stock}
                              </span>
                              <span className="col-span-1 text-right truncate font-bold">
                                {Math.round(p.prixVente1)}
                              </span>
                            </div>
                          );
                        })}
                        {filteredProductsToInsert.length === 0 && (
                          <div className="p-10 text-center text-slate-400 dark:text-slate-500 italic font-sans flex flex-col items-center justify-center gap-1.5">
                            <span>🔍</span>
                            <span>Aucun produit correspondant trouvé dans votre stock.</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Bottom Selected Item Preview Box */}
              {(() => {
                const activeItem = selectedSearchProduct && filteredProductsToInsert.some(p => p.code === selectedSearchProduct.code)
                  ? selectedSearchProduct
                  : (filteredProductsToInsert[0] || null);

                return (
                  <>
                    {activeItem && (
                      <div className="bg-teal-50/40 dark:bg-teal-950/10 border border-teal-100/30 p-3 rounded-2xl flex justify-between items-center select-none text-xs font-sans animate-in fade-in duration-150">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase text-teal-600 dark:text-teal-450 tracking-wider">Produit sélectionné</span>
                          <span className="text-slate-900 dark:text-slate-100 font-extrabold mt-0.5">{activeItem.designation}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">{activeItem.code}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Stock actuel</span>
                          <span className="text-teal-600 dark:text-teal-400 font-black text-sm mt-0.5">{activeItem.stock} <span className="text-[10px] font-bold text-slate-500">unités</span></span>
                        </div>
                      </div>
                    )}

                    {/* Dialog Buttons */}
                    <div className="flex justify-end gap-2.5 pt-2 select-none font-sans font-bold border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsCatalogSearchOpen(false)}
                        className="px-5 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        Annuler (Echap)
                      </button>
                      <button
                        type="button"
                        disabled={!activeItem}
                        onClick={() => {
                          if (activeItem) handleSelectCatalogProduct(activeItem);
                        }}
                        className="px-6 h-9 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                      >
                        <Plus size={14} /> Insérer au Bon
                      </button>
                    </div>
                  </>
                );
              })()}

            </div>

          </div>
        </div>
      )}        {/* ==================== PRODUIT (PRODUCT) MODAL DIALOG ==================== */}
      {isProductDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-[2px]">
          <div className="w-[580px] max-w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Titlebar */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center select-none">
              <span className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-200">
                <span>📦</span> CONFIGURATION DU PRODUIT
              </span>
              <button 
                onClick={() => setIsProductDialogOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub-banner: last purchased price or info */}
            <div className="bg-sky-50 dark:bg-sky-950/25 text-sky-900 dark:text-sky-300 px-5 py-2 border-b border-slate-100 dark:border-slate-800/60 font-medium select-none">
              Dernier prix d'achat fournisseur : <span className="font-mono font-bold">{prodStockEnStock > 0 ? `${prodPrixDeRevient} DA` : 'Nouveau Produit'}</span>
            </div>

            {/* Interactive F1/F2/F3 tabs header bar */}
            <div className="flex bg-slate-50 dark:bg-slate-950 border-b border-slate-250 dark:border-slate-800 px-4 pt-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveDialogTab('general')}
                className={`px-4 py-2 text-center font-semibold text-xs border-b-2 transition-all select-none ${
                  activeDialogTab === 'general'
                    ? 'border-indigo-600 text-indigo-650 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                📁 Général [ F1 ]
              </button>

              <button
                type="button"
                onClick={() => setActiveDialogTab('plus_info')}
                className={`px-4 py-2 text-center font-semibold text-xs border-b-2 transition-all select-none ${
                  activeDialogTab === 'plus_info'
                    ? 'border-indigo-600 text-indigo-650 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                ℹ️ Plus d'info. [ F2 ]
              </button>

              <button
                type="button"
                onClick={() => setActiveDialogTab('photo')}
                className={`px-4 py-2 text-center font-semibold text-xs border-b-2 transition-all select-none ${
                  activeDialogTab === 'photo'
                    ? 'border-indigo-600 text-indigo-650 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                📷 Photo [ F3 ]
              </button>
            </div>

            {/* TAB CONTENTS CONTAINER */}
            <div className="p-5 bg-white dark:bg-slate-900 flex-1 overflow-y-auto max-h-[420px]">
              
              {/* TAB 1: GENERAL */}
              {activeDialogTab === 'general' && (
                <div className="flex flex-col gap-3">
                  
                  {/* Row: Code with re-generation helper */}
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <label className="col-span-3 font-bold text-slate-600 dark:text-slate-400">Code-barre</label>
                    <div className="col-span-9 flex gap-2">
                      <input
                        type="text"
                        value={prodCode}
                        onChange={(e) => setProdCode(e.target.value)}
                        readOnly={dialogMode === 'edit_existing'}
                        placeholder="Ex: 1019939874629"
                        className="flex-1 h-8 px-3 bg-white dark:bg-slate-900 read-only:bg-slate-100 dark:read-only:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono font-bold outline-none text-rose-600 dark:text-rose-400 text-xs focus:border-indigo-500"
                      />
                      {dialogMode === 'add_new' && (
                        <button
                          type="button"
                          onClick={() => setProdCode(generateRandom13DigitBarcode())}
                          title="Générer un code-barres aléatoire"
                          className="px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-450 font-bold h-8 rounded-xl border border-indigo-100 dark:border-indigo-900 transition-colors flex items-center justify-center font-sans cursor-pointer text-[10px]"
                        >
                          ⚡ Auto Code
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row: Famille */}
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <label className="col-span-3 font-bold text-slate-600 dark:text-slate-400">Famille</label>
                    <div className="col-span-9 flex gap-2">
                      {isAddingNewFamille ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <input
                            type="text"
                            value={newFamilleInput}
                            onChange={(e) => setNewFamilleInput(e.target.value)}
                            placeholder="Saisir nouvelle famille..."
                            className="flex-1 h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold text-indigo-650 dark:text-indigo-400"
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') {
                                ev.preventDefault();
                                const trimmed = newFamilleInput.trim().toUpperCase();
                                if (trimmed) {
                                  setCreatedFamilles(prev => {
                                    if (prev.includes(trimmed)) return prev;
                                    return [...prev, trimmed];
                                  });
                                  setProdFamille(trimmed);
                                }
                                setIsAddingNewFamille(false);
                                setNewFamilleInput('');
                              } else if (ev.key === 'Escape') {
                                ev.preventDefault();
                                setIsAddingNewFamille(false);
                                setNewFamilleInput('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            title="Valider"
                            onClick={() => {
                              const trimmed = newFamilleInput.trim().toUpperCase();
                              if (trimmed) {
                                setCreatedFamilles(prev => {
                                  if (prev.includes(trimmed)) return prev;
                                  return [...prev, trimmed];
                                });
                                setProdFamille(trimmed);
                              }
                              setIsAddingNewFamille(false);
                              setNewFamilleInput('');
                            }}
                            className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 text-emerald-650 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/40 flex items-center justify-center text-xs font-bold outline-none cursor-pointer"
                          >
                            ✔
                          </button>
                          <button
                            type="button"
                            title="Annuler"
                            onClick={() => {
                              setIsAddingNewFamille(false);
                              setNewFamilleInput('');
                            }}
                            className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/35 text-rose-650 dark:text-rose-400 border border-rose-150 dark:border-rose-900/40 flex items-center justify-center text-xs font-bold outline-none cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <select
                            value={prodFamille}
                            onChange={(e) => setProdFamille(e.target.value)}
                            className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-100 px-2"
                          >
                            {familles.length === 0 ? (
                              <option value="">(Aucune famille)</option>
                            ) : (
                              familles.map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))
                            )}
                          </select>
                          <button 
                            type="button" 
                            title="Ajouter une nouvelle famille"
                            onClick={() => {
                              setIsAddingNewFamille(true);
                              setNewFamilleInput('');
                            }}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold font-mono outline-none cursor-pointer"
                          >
                            ➕
                          </button>
                          <button 
                            type="button" 
                            title="Gérer les familles"
                            onClick={() => {
                              setIsManagingFamilies(true);
                            }}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold font-mono outline-none cursor-pointer"
                          >
                            ⚙️
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row: Designation / Product name */}
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <label className="col-span-3 font-bold text-slate-600 dark:text-slate-400">Produit</label>
                    <input
                      type="text"
                      value={prodDesignation}
                      onChange={(e) => setProdDesignation(e.target.value)}
                      placeholder="Désignation ou nom de l'article"
                      className="col-span-9 h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs"
                    />
                  </div>

                   {/* Row split: Stock, Prix de revient indicator panel */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                    <div>
                      <span className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] mb-1 uppercase tracking-wider">Quantité en stock</span>
                      <input
                        type="number"
                        value={prodStockEnStock}
                        readOnly={true}
                        className="w-full h-8 px-3 border border-slate-200 dark:border-slate-850 font-mono text-center outline-none text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-lg cursor-not-allowed select-none"
                      />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] mb-1 uppercase tracking-wider">Moyenne Prix Revient (DA)</span>
                      <input
                        type="number"
                        value={prodPrixDeRevient}
                        readOnly={true}
                        className="w-full h-8 px-3 border border-slate-200 dark:border-slate-850 font-mono text-center outline-none text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-lg cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  {/* Buying stats row inputs (Nbre colis, Colissage, Quantité) */}
                  <div className="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 bg-indigo-50/20 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/30 dark:border-indigo-900/20">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Nbre colis</label>
                      <input
                        type="number"
                        min="0"
                        value={prodNbreColis}
                        onChange={(e) => handleNbreColisChange(e.target.value)}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-center outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Colisage</label>
                      <input
                        type="number"
                        min="1"
                        value={prodColisage}
                        onChange={(e) => handleColisageChange(e.target.value)}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-center outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Quantité d'unités</label>
                      <input
                        type="number"
                        min="0"
                        value={prodQtyCalculated || ''}
                        onChange={(e) => handleQtyChange(e.target.value)}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-center text-indigo-650 dark:text-sky-400 font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Prices: Prix de revient (previous), Prix Achat, Nouveau prix de revient */}
                  <div className="grid grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Ancien Revient</label>
                      <input
                        type="text"
                        value={prodPrixDeRevient ? `${prodPrixDeRevient} DA` : '0 DA'}
                        readOnly
                        className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 font-mono text-center outline-none text-xs font-bold text-slate-500 dark:text-slate-400 rounded-lg cursor-not-allowed select-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Prix Achat unit.</label>
                      <input
                        type="number"
                        min="0"
                        value={prodPrixAchat}
                        onChange={(e) => {
                          setProdPrixAchat(e.target.value);
                          setProdNouveauPrixRevient(e.target.value);
                        }}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-right text-rose-600 dark:text-rose-400 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Nouveau Revient</label>
                      <input
                        type="text"
                        value={`${calculatedNouveauPrixRevient || '0'} DA`}
                        readOnly
                        className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 font-mono font-bold text-right text-indigo-650 dark:text-sky-400 text-xs outline-none rounded-lg cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  {/* SELL PRICES & MAGIN RULES ROW */}
                  <div className="border border-indigo-100/50 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex flex-col gap-2">
                    <span className="block font-bold text-indigo-900 dark:text-indigo-400 text-[11px] uppercase tracking-wider mb-1 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                      🚀 Tarifs de Vente & Marges
                    </span>
                    
                    <div className="grid grid-cols-12 gap-2 items-center text-xs">
                      {/* PV 1 */}
                      <span className="col-span-3 font-bold text-slate-600 dark:text-slate-400">Prix Vente 1</span>
                      <input
                        type="number"
                        value={prodPrixVente1}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProdPrixVente1(val);
                          setProdPrixVente2(val);
                          setProdPrixVente3(val);
                        }}
                        className="col-span-5 h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-bold outline-none text-xs"
                      />
                      <span className="col-span-1.5 font-semibold text-slate-400 text-center text-[10px]">Marge:</span>
                      <div className="col-span-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 flex items-center justify-center font-mono font-bold text-emerald-600 dark:text-emerald-450">
                        {calculateMarginPercent(prodPrixVente1, prodPrixAchat)}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center text-xs">
                      {/* PV 2 */}
                      <span className="col-span-3 font-bold text-slate-600 dark:text-slate-400">Prix Vente 2</span>
                      <input
                        type="number"
                        value={prodPrixVente2}
                        onChange={(e) => setProdPrixVente2(e.target.value)}
                        className="col-span-5 h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-bold outline-none text-xs"
                      />
                      <span className="col-span-1.5 font-semibold text-slate-400 text-center text-[10px]">Marge:</span>
                      <div className="col-span-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 flex items-center justify-center font-mono font-bold text-emerald-600 dark:text-emerald-450">
                        {calculateMarginPercent(prodPrixVente2, prodPrixAchat)}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center text-xs">
                      {/* PV 3 */}
                      <span className="col-span-3 font-bold text-slate-600 dark:text-slate-400">Prix Vente 3</span>
                      <input
                        type="number"
                        value={prodPrixVente3}
                        onChange={(e) => setProdPrixVente3(e.target.value)}
                        className="col-span-5 h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-bold outline-none text-xs"
                      />
                      <span className="col-span-1.5 font-semibold text-slate-400 text-center text-[10px]">Marge:</span>
                      <div className="col-span-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 flex items-center justify-center font-mono font-bold text-emerald-600 dark:text-emerald-450">
                        {calculateMarginPercent(prodPrixVente3, prodPrixAchat)}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: PLUS D'INFO */}
              {activeDialogTab === 'plus_info' && (
                <div className="flex flex-col gap-3">
                  <span className="block font-bold text-indigo-900 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs uppercase tracking-wider">
                    Informations Complémentaires
                  </span>

                  <div className="grid grid-cols-3 gap-3 items-center">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Rayon / Alvéole</span>
                    <input
                      type="text"
                      className="col-span-2 h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      value={infoRayon}
                      onChange={(e) => setInfoRayon(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-center">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Unité de Vente</span>
                    <select
                      className="col-span-2 h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      value={infoUnite}
                      onChange={(e) => setInfoUnite(e.target.value)}
                    >
                      <option value="Boite">Boite / Bouteille</option>
                      <option value="Carton">Carton entier</option>
                      <option value="Sachet">Sachet / Unitaire</option>
                      <option value="Kilogramme">Kilo (Kg)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-center">
                    <span className="font-bold text-slate-600 dark:text-slate-400">TVA Applicable</span>
                    <select
                      className="col-span-2 h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      value={infoTvaPercent}
                      onChange={(e) => setInfoTvaPercent(e.target.value)}
                    >
                      <option value="0">Aucune TVA (0%)</option>
                      <option value="9">Taux Réduit (9%)</option>
                      <option value="19">Taux Normal (19%)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-center">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Seuil Stock d'alerte</span>
                    <input
                      type="number"
                      className="col-span-2 h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      value={infoAlerteStock}
                      onChange={(e) => setInfoAlerteStock(e.target.value)}
                    />
                  </div>

                  <div className="bg-amber-50/60 dark:bg-amber-950/15 border border-amber-100 dark:border-amber-900/25 p-3 rounded-xl text-amber-900 dark:text-amber-300 mt-2 text-[11px] leading-relaxed">
                    <strong>💡 Remarque :</strong> Ces configurations supplémentaires affectent directement les avertissements visuels de rupture de stock de l'application et la facturation finale.
                  </div>
                </div>
              )}

              {/* TAB 3: PHOTO PRODUIT */}
              {activeDialogTab === 'photo' && (
                <div className="flex flex-col gap-3 items-center bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-850">
                  <span className="block font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2 text-center w-full uppercase tracking-wider text-[11px]">
                    Visuel Associé au Produit
                  </span>
                  
                  {/* Photo Preview Container */}
                  <div className="w-36 h-36 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-3 text-[10px] text-slate-400 dark:text-slate-500 gap-1.5 mt-2 shadow-inner relative overflow-hidden">
                    <span className="text-4xl">📷</span>
                    <span className="font-sans leading-tight">Image Produit <br/>Non Définie</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert("Simulation d'importation d'image lancée. Veuillez choisir un fichier PNG/JPEG.")}
                    className="mt-3 px-4 h-8 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-650 dark:text-indigo-400 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-indigo-150/50 dark:border-indigo-900/30"
                  >
                    📁 Sélectionner un fichier
                  </button>

                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans mt-2">Pris en charge : JPG, PNG, GIF. Max 2 Mo.</span>
                </div>
              )}

            </div>

            {/* Modal Footer Controls */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsProductDialogOpen(false)}
                className="px-4 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>✕ Annuler</span>
              </button>

              <button
                type="button"
                onClick={handleSaveProductFromModal}
                className="px-5 h-8 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-md"
              >
                <span>✔ Valider l'insertion</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SUPPLIER SELECTOR MODAL */}
      {isSupplierSelectOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-[2px]">
          <div className="w-[460px] max-w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center select-none">
              <span className="flex items-center gap-2 font-bold text-sm text-slate-850 dark:text-slate-200">
                <span>👥</span> INITIALISATION DU BON D'ACHAT
              </span>
              <button 
                type="button"
                onClick={() => setIsSupplierSelectOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub-banner description */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300 px-5 py-3 border-b border-slate-100 dark:border-slate-800/60 select-none leading-relaxed flex gap-2 text-[11px]">
              <span className="text-sm">ℹ️</span>
              <div>
                <strong>Nouveau Bon d'Achat :</strong> Veuillez sélectionner un fournisseur existant ou en créer un nouveau à la volée pour continuer.
              </div>
            </div>

            {/* Type selector tabs */}
            <div className="flex bg-slate-50 dark:bg-slate-950 border-b border-slate-250 dark:border-slate-800 px-4 pt-1.5 gap-1.5 select-none">
              <button
                type="button"
                onClick={() => setSupplierSelectType('existing')}
                className={`px-4 py-2 text-center font-semibold text-xs border-b-2 transition-all select-none cursor-pointer ${
                  supplierSelectType === 'existing'
                    ? 'border-indigo-600 text-indigo-650 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                👥 Fournisseur existant
              </button>

              <button
                type="button"
                onClick={() => setSupplierSelectType('new')}
                className={`px-4 py-2 text-center font-semibold text-xs border-b-2 transition-all select-none cursor-pointer ${
                  supplierSelectType === 'new'
                    ? 'border-indigo-600 text-indigo-650 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                ➕ Nouveau fournisseur
              </button>
            </div>

            {/* Tab body container */}
            <div className="p-5 bg-white dark:bg-slate-900 flex-1">
              
              {/* TAB 1: EXISTING SUPPLIER */}
              {supplierSelectType === 'existing' && (
                <div className="flex flex-col gap-3">
                  <span className="text-slate-500 dark:text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Choisissez parmi la liste :</span>
                  {suppliers.length === 0 ? (
                    <div className="bg-amber-50/60 dark:bg-amber-950/15 border border-amber-100 dark:border-amber-900/25 p-3.5 rounded-xl text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
                      ⚠️ Aucun fournisseur disponible dans votre base. <br/>
                      Veuillez cliquer sur l'onglet <strong>"Nouveau fournisseur"</strong> pour l'ajouter directement.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={existingSupplierSelected}
                        onChange={(e) => setExistingSupplierSelected(e.target.value)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none font-bold text-slate-800 dark:text-slate-100"
                      >
                        {suppliers.map(s => (
                          <option key={s.id} value={s.name}>
                            {s.code} — {s.name} (Solde: {(s.balance ?? 0).toLocaleString('fr-FR')} DA)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: REGISTER NEW SUPPLIER ON THE FLY */}
              {supplierSelectType === 'new' && (
                <div className="flex flex-col gap-3">
                  <span className="text-slate-500 dark:text-slate-400 font-bold block text-[10px] uppercase tracking-wider mb-1">Enregistrement Rapide Fournisseur</span>
                  
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <label className="col-span-4 font-bold text-slate-600 dark:text-slate-400">Code</label>
                    <input
                      type="text"
                      value={quickSupplierCode}
                      onChange={(e) => setQuickSupplierCode(e.target.value)}
                      className="col-span-8 h-8 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 font-mono font-bold outline-none text-xs text-indigo-650 dark:text-indigo-400 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-12 gap-3 items-center">
                    <label className="col-span-4 font-bold text-slate-600 dark:text-slate-400">Nom / Raison <span className="text-rose-600 dark:text-rose-450">*</span></label>
                    <input
                      type="text"
                      placeholder="Ex: LARBI HAMIZ"
                      value={quickSupplierName}
                      onChange={(e) => setQuickSupplierName(e.target.value)}
                      className="col-span-8 h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold text-xs"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Controls */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 select-none">
              <button
                type="button"
                onClick={() => setIsSupplierSelectOpen(false)}
                className="px-4 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>✕ Annuler</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmSupplierForVoucher}
                disabled={supplierSelectType === 'existing' && suppliers.length === 0}
                className="px-5 h-8 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-md disabled:opacity-50"
              >
                <span>✔ Créer le bon</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODE DE PAIEMENT RETRO MODAL */}
      {isPaymentDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[80] p-4 text-xs font-sans text-slate-950 select-none">
          <div className="w-[520px] max-w-full bg-white dark:bg-slate-900 border border-slate-200/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Title Bar */}
            <div className="bg-m3-primary dark:bg-slate-950 px-5 py-4 flex items-center justify-between select-none">
              <span className="text-white font-bold font-display text-sm flex items-center gap-2">
                💰 Saisie du Règlement & Fermeture Bon
              </span>
              <button 
                onClick={() => setIsPaymentDialogOpen(false)}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center font-bold hover:bg-white/20 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Dropdown Select Mode */}
            <div className="p-4 px-5 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wide">Mode de paiement:</span>
              <select
                value={paymentMode}
                onChange={(e) => {
                  const modeVal = e.target.value;
                  setPaymentMode(modeVal);
                  if (modeVal === 'A_TERME') {
                    setPaymentVersement(0);
                  } else {
                    setPaymentVersement(draftMetrics.ttc);
                  }
                }}
                className="flex-1 max-w-[240px] h-9 bg-white dark:bg-slate-900 border border-slate-200/10 rounded-xl font-bold px-3 outline-none text-xs text-m3-primary dark:text-sky-400"
              >
                <option value="ESPECE">ESPÈCE / CASH</option>
                <option value="A_TERME">A TERME (CRÉDIT PARTENAIRE)</option>
                <option value="CHEQUE">CHEQUE / VIREMENT BANCAIRE</option>
              </select>
            </div>

            {/* Main Fields block */}
            <div className="p-5 flex flex-col md:flex-row gap-4 flex-1">
              
              {/* Left Column (Balances Calculations) */}
              <div className="flex-1 flex flex-col gap-2.5 p-4 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-250/10 rounded-2xl shadow-xs">
                
                {/* Previous supplier balance */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wide">Ancien Solde Tier:</span>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 font-mono font-bold text-xs text-slate-700 dark:text-slate-300 rounded-lg min-w-[120px] text-right">
                    {(draftMetrics.oldBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </div>
                </div>

                {/* Amount of current voucher */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-m3-primary dark:text-sky-400 text-[10px] uppercase tracking-wide">Net à Payer:</span>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 font-mono font-black text-xs text-m3-primary dark:text-sky-400 rounded-lg min-w-[120px] text-right">
                    {(draftMetrics.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </div>
                </div>

                {/* Total balance accumulated */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                  <span className="font-bold text-indigo-900 dark:text-indigo-400 text-[10px] uppercase tracking-wide">Amortissement total:</span>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 font-mono font-bold text-xs text-indigo-950 dark:text-indigo-300 rounded-lg min-w-[120px] text-right">
                    {((draftMetrics.oldBalance ?? 0) + (draftMetrics.ttc ?? 0)).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </div>
                </div>

                {/* Input for versement */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-rose-500 text-[10px] uppercase tracking-wide">Mon Versement:</span>
                  <input
                    type="number"
                    value={paymentVersement || ''}
                    onChange={(e) => setPaymentVersement(Number(e.target.value) || 0)}
                    disabled={paymentMode === 'A_TERME'}
                    className={`w-[120px] h-8 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-2.5 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-xs outline-none ${
                      paymentMode === 'A_TERME' ? 'opacity-40 cursor-not-allowed' : 'focus:border-rose-500'
                    }`}
                    autoFocus={paymentMode !== 'A_TERME'}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Calculated new rest balance */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                  <span className="font-bold text-slate-850 dark:text-slate-200 text-[10px] uppercase tracking-wide">Nouveau Solde Tier:</span>
                  <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-950 font-mono font-black text-xs text-rose-600 dark:text-rose-400 rounded-lg min-w-[120px] text-right">
                    {(((Number(draftMetrics.oldBalance) || 0) + (Number(draftMetrics.ttc) || 0)) - (Number(paymentVersement) || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </div>
                </div>

              </div>

              {/* Right Column (Sources and description) */}
              <div className="w-full md:w-44 flex flex-col gap-2.5 font-sans">
                {paymentMode !== 'A_TERME' && (
                  <>
                    <span className="font-bold text-slate-500 dark:text-slate-400 text-[9.5px] uppercase tracking-wide block border-b border-slate-100 dark:border-slate-800 pb-1">
                      Trésorerie d'affectation
                    </span>
                    <select
                      value={paymentSource}
                      onChange={(e) => setPaymentSource(e.target.value)}
                      className="w-full h-8.5 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl font-bold px-3 outline-none text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="CAISSE PRINCIPALE">CAISSE PRINCIPALE</option>
                      <option value="COFFRE N°1">COFFRE N°1</option>
                      <option value="COFFRE N°2">COFFRE N°2</option>
                    </select>
                  </>
                )}
                
                <div className="mt-auto bg-slate-100 dark:bg-slate-950/60 p-3.5 rounded-xl text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed border border-slate-150/10">
                  Veuillez spécifier le montant effectivement versé au fournisseur. Le reliquat sera inscrit dans son grand livre.
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 px-5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 select-none">
              <button
                type="button"
                onClick={() => setIsPaymentDialogOpen(false)}
                className="px-5 h-9 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                ✕ Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmPaymentAndSaveVoucher}
                className="px-6 h-9 text-xs font-black bg-m3-primary text-white rounded-full shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                ✓ Enregistrer Bon (F5)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- CUSTOM CONFIRM / ALERT DIALOG BOX -------------------- */}
      {retroDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-[2px] select-none">
          <div className="w-[420px] max-w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-150">
            
            {/* Dialog Title Bar */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-slate-850 dark:text-slate-200">
                <span>📁</span>
                <span>{retroDialog.title}</span>
              </span>
              <button
                onClick={() => setRetroDialog(prev => ({ ...prev, isOpen: false }))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Dialog Contents */}
            <div className="p-5 flex gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 items-start select-text leading-relaxed bg-white dark:bg-slate-900 m-1">
              {/* Question / Icon */}
              <div className="text-3xl select-none flex-shrink-0">
                {retroDialog.type === 'confirm' ? '❓' : '⚠️'}
              </div>
              <div className="flex-1 whitespace-pre-wrap pt-1 selection:bg-indigo-200 dark:selection:bg-indigo-900">
                {retroDialog.message}
              </div>
            </div>

            {/* Dialog Action Buttons */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 select-none">
              {retroDialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setRetroDialog(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Non (Annuler)
                  </button>
                  <button
                    onClick={() => {
                      if (retroDialog.onConfirm) retroDialog.onConfirm();
                      setRetroDialog(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="px-5 h-8 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
                  >
                    Oui
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setRetroDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 h-8 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
                >
                  OK (Valider)
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== MANAGE FAMILIES DIALOG ==================== */}
      {isManagingFamilies && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-[2px]">
          <div className="w-[430px] max-w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-150">
            
            {/* Title bar */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center select-none">
              <span className="flex items-center gap-2 font-bold text-sm text-slate-850 dark:text-slate-200">
                <span>🏷️</span> GÉRER LES FAMILLES
              </span>
              <button 
                onClick={() => {
                  setIsManagingFamilies(false);
                  setNewFamilyInputName('');
                  setEditingFamilyName(null);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content area */}
            <div className="p-5 flex-1 flex flex-col gap-4">
              
              {/* Quick Add Section */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/45 rounded-xl border border-slate-150/10 flex flex-col gap-1.5">
                <span className="font-bold text-[10px] text-indigo-900 dark:text-indigo-400 uppercase tracking-wider">Ajouter une famille :</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: HUILES, LAITAGES..."
                    value={newFamilyInputName}
                    onChange={(e) => setNewFamilyInputName(e.target.value)}
                    className="flex-1 h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold text-slate-800 dark:text-slate-100 uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newFamilyInputName.trim().toUpperCase();
                        if (trimmed) {
                          setCreatedFamilles(prev => {
                            if (prev.includes(trimmed)) return prev;
                            return [...prev, trimmed].sort();
                          });
                          setProdFamille(trimmed);
                          setNewFamilyInputName('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newFamilyInputName.trim().toUpperCase();
                      if (trimmed) {
                        setCreatedFamilles(prev => {
                          if (prev.includes(trimmed)) return prev;
                          return [...prev, trimmed].sort();
                        });
                        setProdFamille(trimmed);
                        setNewFamilyInputName('');
                      }
                    }}
                    className="px-4 bg-indigo-650 hover:bg-indigo-700 text-white font-bold h-8 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center shadow-md"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Families List */}
              <div className="flex flex-col gap-2">
                <span className="font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Familles enregistrées ({familles.length}) :</span>
                
                <div className="max-h-[180px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex flex-col gap-1.5 divide-y divide-slate-100 dark:divide-slate-850/40">
                  {familles.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 dark:text-slate-500 italic">Aucune famille enregistrée.</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {familles.map((fam) => {
                        const isEditingThis = editingFamilyName === fam;
                        return (
                          <div 
                            key={fam}
                            className="flex items-center justify-between py-1.5 px-2 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg transition-colors border border-slate-100/50 dark:border-slate-850/45"
                          >
                            {isEditingThis ? (
                              <div className="flex-1 flex gap-2 items-center">
                                <input
                                  type="text"
                                  value={editingFamilyValue}
                                  onChange={(e) => setEditingFamilyValue(e.target.value)}
                                  className="flex-1 h-7 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-bold uppercase text-xs"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleRenameFamily(fam, editingFamilyValue);
                                      setEditingFamilyName(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingFamilyName(null);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleRenameFamily(fam, editingFamilyValue);
                                    setEditingFamilyName(null);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/35 text-emerald-650 dark:text-emerald-450 flex items-center justify-center font-bold text-xs cursor-pointer border border-emerald-100/30"
                                >
                                  ✔
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFamilyName(null)}
                                  className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/35 text-rose-650 dark:text-rose-400 flex items-center justify-center font-bold text-xs cursor-pointer border border-rose-100/30"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase pl-1 truncate max-w-[200px]">
                                  {fam}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingFamilyName(fam);
                                      setEditingFamilyValue(fam);
                                    }}
                                    className="px-2.5 h-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] transition-colors cursor-pointer"
                                    title="Renommer la famille"
                                  >
                                    Renommer
                                  </button>
                                  {confirmDeleteFam === fam ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDeleteFamily(fam);
                                          setConfirmDeleteFam(null);
                                        }}
                                        className="px-2.5 h-6 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                                        title="Confirmer la suppression"
                                      >
                                        Oui
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteFam(null)}
                                        className="px-2.5 h-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] cursor-pointer"
                                      >
                                        Non
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmDeleteFam(fam);
                                      }}
                                      className="px-2.5 h-6 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] transition-colors cursor-pointer border border-rose-100/35"
                                      title="Supprimer la famille"
                                    >
                                      Suppr.
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Dialog buttons block */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setIsManagingFamilies(false);
                  setNewFamilyInputName('');
                  setEditingFamilyName(null);
                }}
                className="px-5 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- PURCHASE VOUCHER PRINT PREVIEW MODAL (A4 PAPER SPECIFICATION) -------------------- */}
      {isPrintPreviewOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-start overflow-y-auto z-[100200] py-8 select-none print:p-0 print:bg-white print:backdrop-blur-none print-portal-container">
          {/* Inject print-specific CSS dynamically when this modal is open */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              html, body {
                overflow: visible !important;
                height: auto !important;
                background: white !important;
              }
              #root {
                display: none !important;
              }
              body > *:not(.print-portal-container) {
                display: none !important;
              }
              .print-portal-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                overflow: visible !important;
              }
              .print-portal-container > div {
                gap: 0 !important;
              }
              #print-purchase-invoice-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 1.5cm !important;
                box-shadow: none !important;
                background: white !important;
                min-height: 0 !important;
              }
            }
          ` }} />

          <div className="flex flex-col gap-4 items-center print:gap-0">
            {/* Toolbar - Hidden when printing */}
            <div className="w-[794px] bg-slate-800 text-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-lg print:hidden font-sans">
              <div className="flex items-center gap-2">
                <span className="text-lg">🖨️</span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">Aperçu avant impression</h4>
                  <p className="text-[10px] text-slate-300 font-medium">Bon d'Achat au format A4</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  🖨️ Imprimer le Bon
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  ✕ Fermer
                </button>
              </div>
            </div>

            {/* A4 Printable Sheet */}
            <div 
              id="print-purchase-invoice-sheet"
              className="w-[794px] min-h-[1123px] bg-white text-black p-12 relative shadow-2xl rounded-sm font-sans flex flex-col justify-between print:shadow-none print:p-0 print:w-full print:min-h-0 print:bg-white"
            >
              <div>
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                  {/* Left: Company & Buyer */}
                  <div className="flex flex-col text-left font-sans select-text">
                    <h1 className="text-[26px] font-black tracking-tight text-slate-900 uppercase">
                      {config?.invoiceInfo?.nomRaisonSociale || ''}
                    </h1>
                    <p className="text-[10.5px] text-slate-600 leading-normal mt-1">{config?.invoiceInfo?.detail1 || ''}</p>
                    <p className="text-[10.5px] text-slate-600 leading-normal mt-0.5">{config?.invoiceInfo?.detail2 || ''}</p>
                    <p className="text-[10.5px] text-slate-600 leading-normal mt-0.5">{config?.invoiceInfo?.detail3 || ''}</p>
                    {config?.invoiceInfo?.adresse && (
                      <p className="text-[10.5px] text-slate-600 leading-normal mt-0.5">{config.invoiceInfo.adresse}</p>
                    )}
                    <p className="text-[11px] text-slate-800 font-bold mt-3">
                      Acheteur :<span className="font-semibold text-slate-700"> {sessionStorage.getItem('compos_current_user') ? JSON.parse(sessionStorage.getItem('compos_current_user') || '{}')?.username : 'admin'}</span>
                    </p>
                  </div>

                  {/* Right: Beautiful logo box */}
                  <div className="flex flex-col items-end gap-1.5 min-h-[96px] justify-center">
                    {config?.invoiceInfo?.logo ? (
                      <img 
                        src={config.invoiceInfo.logo} 
                        alt="Logo de l'entreprise" 
                        className="max-h-24 max-w-64 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-64 h-24"></div>
                    )}
                    <div className="text-[11px] font-bold text-slate-900 mt-1 select-text">
                      le, {previewData.date}
                    </div>
                  </div>
                </div>

                {/* Subtitle / Document Title & Supplier Box */}
                <div className="grid grid-cols-12 gap-4 items-end mb-4">
                  {/* Title and ID */}
                  <div className="col-span-7 text-left pb-2">
                    <h2 className="text-lg font-black tracking-tight text-black uppercase leading-none select-text">
                      BON D'ACHAT N°{previewData.id.padStart(5, '0')}/{previewData.date.split('/')[2] || new Date().getFullYear().toString()}
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 block mt-1">PAGE : 1</span>
                  </div>

                  {/* Supplier Box */}
                  <div className="col-span-5 flex flex-col items-start font-sans">
                    <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider mb-1 leading-none">FOURNISSEUR :</span>
                    <div className="w-full border border-black rounded-lg p-3 min-h-[75px] text-left select-text">
                      <h4 className="font-black text-xs uppercase leading-snug">{previewData.supplierName}</h4>
                      {previewData.supplierObj?.address && (
                        <p className="text-[10px] text-slate-600 mt-1 font-medium leading-tight">
                          {previewData.supplierObj.address}
                        </p>
                      )}
                      {previewData.supplierObj?.contact && (
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {previewData.supplierObj.contact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Items Table */}
                <div className="mb-6">
                  <table className="w-full border-collapse border border-black text-xs">
                    <thead>
                      <tr className="border-b border-black text-center font-bold bg-slate-50">
                        <th className="border-r border-black p-1 text-[9px] w-[5%]">N°</th>
                        <th className="border-r border-black p-1 text-[9px] w-[16%]">REF</th>
                        <th className="border-r border-black p-1 text-[9px] w-[37%] text-left pl-2">DESIGNATION</th>
                        <th className="border-r border-black p-1 text-[9px] w-[7%]">QTE</th>
                        <th className="border-r border-black p-1 text-[9px] w-[10%]">P.U HT</th>
                        <th className="border-r border-black p-1 text-[9px] w-[11%]">Montant HT</th>
                        <th className="border-r border-black p-1 text-[8.5px] w-[14%]" colSpan={2}>
                          <div className="border-b border-black pb-0.5 mb-0.5 font-black text-center text-[8.5px]">TVA</div>
                          <div className="flex text-[7.5px] font-bold">
                            <span className="w-1/2 border-r border-black/30 text-center">Taux%</span>
                            <span className="w-1/2 text-center">Montant</span>
                          </div>
                        </th>
                        <th className="p-1 text-[9px] w-[12%]">Montant TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Real Items */}
                      {previewData.items.map((item, idx) => {
                        const calculatedItemTvaRate = previewData.totalHT > 0 ? Math.round((previewData.tva / previewData.totalHT) * 100) : 0;
                        const itemHt = item.total;
                        const itemTva = itemHt * (calculatedItemTvaRate / 100);
                        const itemTtc = itemHt + itemTva;
                        return (
                          <tr key={item.id || idx} className="border-b border-black h-7 text-center font-mono select-text">
                            <td className="border-r border-black p-1 text-[9.5px] font-sans font-bold">{idx + 1}</td>
                            <td className="border-r border-black p-1 text-[9px] text-left leading-none font-mono font-medium">{item.code}</td>
                            <td className="border-r border-black p-1 text-[9.5px] text-left font-sans font-semibold uppercase leading-tight select-text pl-2">{item.designation}</td>
                            <td className="border-r border-black p-1 text-[11px] font-sans font-black">{item.qty}</td>
                            <td className="border-r border-black p-1 text-[9.5px] text-right">{item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                            <td className="border-r border-black p-1 text-[9.5px] text-right">{(item.total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                            <td className="border-r border-black p-1 text-[9px] w-[7%] text-center font-sans">
                              {calculatedItemTvaRate}%
                            </td>
                            <td className="border-r border-black p-1 text-[9px] w-[7%] text-right">
                              {itemTva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-1 text-[9.5px] text-right font-sans font-black">{itemTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                      
                      {/* Empty padded rows for professional feel */}
                      {Array.from({ length: Math.max(0, 8 - previewData.items.length) }).map((_, idx) => (
                        <tr key={`empty-${idx}`} className="border-b border-black h-7">
                          <td className="border-r border-black"></td>
                          <td className="border-r border-black"></td>
                          <td className="border-r border-black"></td>
                          <td className="border-r border-black"></td>
                          <td className="border-r border-black"></td>
                          <td className="border-r border-black"></td>
                          <td className="border-r border-black"></td>
                          <td className="border-r border-black"></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invoice Footer Details (Totals & Stop wording) */}
                <div className="grid grid-cols-12 gap-4 items-start mt-6">
                  {/* Left block: Payment mode & sum in words */}
                  <div className="col-span-7 flex flex-col gap-3 text-left font-sans select-text">
                    <p className="text-[10px] font-black text-slate-800 uppercase">
                      Mode de payement : <span className="font-black text-slate-900 border-b border-black pb-0.5">{previewData.payMode}</span>
                    </p>
                    <div className="mt-2 text-[10px] leading-relaxed select-text">
                      <p className="font-bold text-slate-600">Arrêter le présent bon d'achat à la somme de :</p>
                      <p className="font-black text-xs text-black uppercase mt-1 tracking-wide leading-tight">
                        {amountToWordsFR(previewData.ttc)}
                      </p>
                    </div>
                  </div>

                  {/* Right block: Totals grid */}
                  <div className="col-span-5 flex justify-end">
                    <table className="w-[260px] border-collapse border border-black text-[10px] font-sans font-bold">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="border-r border-black p-1.5 bg-slate-50/50 uppercase tracking-wider text-[9px] w-[50%]">TOTAL</td>
                          <td className="p-1.5 text-right font-mono text-[10.5px] w-[50%]">{previewData.rawSum.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="border-r border-black p-1.5 bg-slate-50/50 uppercase tracking-wider text-[9px]">REMISE</td>
                          <td className="p-1.5 text-right font-mono text-[10.5px] text-red-600">{previewData.remise.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="border-r border-black p-1.5 bg-slate-50/50 uppercase tracking-wider text-[9px]">TOTAL HT</td>
                          <td className="p-1.5 text-right font-mono text-[10.5px]">{previewData.totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="border-r border-black p-1.5 bg-slate-50/50 uppercase tracking-wider text-[9px]">TVA</td>
                          <td className="p-1.5 text-right font-mono text-[10.5px]">{previewData.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="border-r border-black p-1.5 bg-slate-50/50 uppercase tracking-wider text-[9px]">TIMBRE</td>
                          <td className="p-1.5 text-right font-mono text-[10.5px]">{previewData.timbre.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="bg-slate-100 font-black">
                          <td className="border-r border-black p-1.5 uppercase tracking-wider text-[9px]">TOTAL TTC</td>
                          <td className="p-1.5 text-right font-mono text-xs">{previewData.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Bottom statutory watermark - centered */}
              <div className="text-center text-[9px] text-slate-400 font-bold tracking-wider mt-5 border-t border-dashed border-slate-200 pt-3 print:mt-10 select-none uppercase">
                SYSTÈME DE FACTURATION AUTOMATISÉ
                <div className="mt-1.5 text-[10.5px] text-slate-700 font-sans font-bold tracking-normal normal-case">
                  {config?.invoiceInfo?.messageFacture || 'Merci pour votre confiance'}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Barcode Label Modal */}
      <BarcodeLabelModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
        product={barcodeProduct}
        initialQty={barcodeInitialQty}
        storeName={config?.storeName || 'VBI PME'}
      />

    </div>
  );
}

// -------------------- FRENCH NUMBER TO WORDS CONVERTER UTILITIES --------------------
function NumberToWordsFR(num: number): string {
  if (num === 0) return "ZÉRO";
  
  const units = ["", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF"];
  const teens = ["DIX", "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE", "DIX-SEPT", "DIX-HUIT", "DIX-NEUF"];
  const tens = ["", "DIX", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE", "SOIXANTE-DIX", "QUATRE-VINGTS", "QUATRE-VINGT-DIX"];
  
  function convertSection(n: number): string {
    let result = "";
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    
    if (h > 0) {
      if (h === 1) {
        result += "CENT ";
      } else {
        result += units[h] + " CENT ";
      }
    }
    
    if (remainder > 0) {
      if (remainder < 10) {
        result += units[remainder];
      } else if (remainder < 20) {
        result += teens[remainder - 10];
      } else {
        const t = Math.floor(remainder / 10);
        const u = remainder % 10;
        
        if (t === 7) {
          result += "SOIXANTE-" + (u === 1 ? "ET-ONZE" : teens[u]);
        } else if (t === 9) {
          result += "QUATRE-VINGT-" + teens[u];
        } else {
          result += tens[t];
          if (u > 0) {
            result += (u === 1 ? "-ET-UN" : "-" + units[u]);
          }
        }
      }
    }
    return result.trim();
  }
  
  const thousand = Math.floor(num / 1000) % 1000;
  const million = Math.floor(num / 1000000) % 1000;
  const rest = Math.floor(num) % 1000;
  
  let finalStr = "";
  if (million > 0) {
    finalStr += convertSection(million) + " MILLION" + (million > 1 ? "S " : " ");
  }
  if (thousand > 0) {
    if (thousand === 1) {
      finalStr += "MILLE ";
    } else {
      finalStr += convertSection(thousand) + " MILLE ";
    }
  }
  if (rest > 0) {
    finalStr += convertSection(rest);
  }
  
  return finalStr.trim().replace(/\s+/g, ' ');
}

function amountToWordsFR(amount: number): string {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);
  
  let words = NumberToWordsFR(integerPart) + " DINAR" + (integerPart > 1 ? "S" : "");
  if (decimalPart > 0) {
    words += " ET " + NumberToWordsFR(decimalPart) + " CENTIME" + (decimalPart > 1 ? "S" : "");
  }
  return words;
}

export default React.memo(PurchaseVoucherWindow, (prev, next) => {
  return prev.isOpen === next.isOpen &&
         prev.products === next.products &&
         prev.suppliers === next.suppliers &&
         prev.purchases === next.purchases &&
         prev.createdFamilles === next.createdFamilles &&
         prev.config === next.config;
});

