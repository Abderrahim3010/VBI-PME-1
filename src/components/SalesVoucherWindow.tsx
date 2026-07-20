import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, Client, SalesVoucher, VoucherItem, User } from '../types';
import { 
  Edit, Edit3, RefreshCw, BarChart3, Printer, Plug, Search, Plus, Minus, Trash2, 
  Package, Coins, DollarSign, User as UserIcon, Users, AlertTriangle, Lightbulb, 
  Folder, FileText, MessageSquare, HelpCircle, X, Check, Eye
} from 'lucide-react';

interface OpenVoucher {
  id: string; // The draft ID or edited ID
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
  paymentMode?: 'ESPECE' | 'A_TERME';
}

interface SalesVoucherWindowProps {
  products: Product[];
  clients: Client[];
  sales: SalesVoucher[];
  onAddSale: (voucher: SalesVoucher) => void;
  onUpdateSale: (oldId: string, updatedVoucher: SalesVoucher) => void;
  onDeleteSale: (id: string) => void;
  onProductsUpdate: (products: Product[]) => void;
  onClientsUpdate: (clients: Client[]) => void;
  onClose: () => void;
  isOpen?: boolean;
  config?: any;
  currentUser?: User | null;
}

function SalesVoucherWindow({
  products,
  clients,
  sales,
  onAddSale,
  onUpdateSale,
  onDeleteSale,
  onProductsUpdate,
  onClientsUpdate,
  onClose,
  isOpen = false,
  config,
  currentUser
}: SalesVoucherWindowProps) {
  // Selection/navigation between previous invoices
  const [selectedSaleId, setSelectedSaleId] = useState<string>(() => {
    return sales.length > 0 ? sales[sales.length - 1].id : '';
  });

  // Mode: 'view' or 'create'
  const [mode, setMode] = useState<'view' | 'create'>('view');

  // List of currently open drafts/bons (can have multiple active drafts open at once)
  const [openVouchers, setOpenVouchers] = useState<OpenVoucher[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Local replicas of products to calculate stock changes in draft / edit mode correctly
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  // Synchronize local products with props dynamically
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // When the window is closed (isOpen goes from true to false), restore all draft stocks and clear drafts
  useEffect(() => {
    if (!isOpen) {
      // Gather all items to restore and subtract
      const allRestore: VoucherItem[] = [];
      const allSubtract: VoucherItem[] = [];
      
      openVouchers.forEach(v => {
        allRestore.push(...v.draftItems);
        if (v.isEditingExisting) {
          const origSale = sales.find(s => String(s.id) === String(v.id));
          if (origSale) {
            allSubtract.push(...origSale.items);
          }
        }
      });
      
      if (allRestore.length > 0 || allSubtract.length > 0) {
        restoreVoucherItemsToStock(allRestore, allSubtract);
      }
      setOpenVouchers([]);
      setActiveDraftId(null);
      setDraftItems([]);
    }
  }, [isOpen]);

  // Mode de paiement modal states
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'ESPECE' | 'A_TERME'>(() => config?.deliveryInfo?.defaultPayModeDelivery || 'ESPECE');
  const [paymentSource, setPaymentSource] = useState('CAISSE PRINCIPALE');
  const [paymentVersement, setPaymentVersement] = useState<number>(0);

  // Draft invoice state
  const [newSaleId, setNewSaleId] = useState('0001');
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [newTime, setNewTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  });

  const [newClientName, setNewClientName] = useState('');
  const [newType, setNewType] = useState<'VENTE' | 'RETOUR'>('VENTE');
  const [vendeurName, setVendeurName] = useState('<Aucun>');
  const [observations, setObservations] = useState('');
  const [versement, setVersement] = useState<number>(0);
  const [remise, setRemise] = useState<number>(0);
  const [tvaRate, setTvaRate] = useState<number>(0); // 0% default
  const [timbreValue, setTimbreValue] = useState<number>(0);
  const [draftItems, setDraftItems] = useState<VoucherItem[]>([]);

  // Search input state
  const [showBenefit, setShowBenefit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1);

  // Selected table item for showing product helper metrics or "images" on right
  const [viewingItemCode, setViewingItemCode] = useState<string>('');

  // Observations modal states
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [tempObs, setTempObs] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Product chooser dialogue states
  const [isProductChooserOpen, setIsProductChooserOpen] = useState(false);
  const [chooserSearchQuery, setChooserSearchQuery] = useState('');
  
  const filteredChooserProducts = useMemo(() => {
    const query = chooserSearchQuery.trim().toLowerCase();
    if (!query) {
      return products.slice(0, 100);
    }
    return products.filter(p => 
      p.designation.toLowerCase().includes(query) || 
      p.code.toLowerCase().includes(query)
    ).slice(0, 150);
  }, [products, chooserSearchQuery]);

  const [selectedProductInChooser, setSelectedProductInChooser] = useState<Product | null>(null);
  const [chooserQty, setChooserQty] = useState<number | ''>(1);
  const [selectedPriceType, setSelectedPriceType] = useState<'prixVente1' | 'prixVente2' | 'prixVente3'>('prixVente1');
  const [customSellingPrice, setCustomSellingPrice] = useState<number | ''>(0);
  const [isConfigPopupOpen, setIsConfigPopupOpen] = useState(false);

  // Item Edit Modal states
  const [isItemEditModalOpen, setIsItemEditModalOpen] = useState(false);
  const [editModalQty, setEditModalQty] = useState<number | ''>(1);
  const [editModalPrice, setEditModalPrice] = useState<number | ''>(0);
  const [editModalIndex, setEditModalIndex] = useState<number>(-1);
  const [editPriceType, setEditPriceType] = useState<'prixVente1' | 'prixVente2' | 'prixVente3' | ''>('');

  // Client Selection and Creation Modal states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  const filteredClients = useMemo(() => {
    const trimmed = clientSearchQuery.trim().toLowerCase();
    const activeClients = clients.filter(c => c.name.toLowerCase() !== 'anonyme');
    if (!trimmed) {
      return activeClients.slice(0, 100);
    }
    return activeClients.filter(c => 
      c.name.toLowerCase().includes(trimmed) ||
      c.code.toLowerCase().includes(trimmed)
    ).slice(0, 155);
  }, [clients, clientSearchQuery]);

  const [clientFormName, setClientFormName] = useState('');
  const [clientFormPhone, setClientFormPhone] = useState('');
  const [clientFormAddress, setClientFormAddress] = useState('');
  const [clientFormBalance, setClientFormBalance] = useState<string>('0');

  // Facturation dropdown and preview modal states
  const [isFacturationDropdownOpen, setIsFacturationDropdownOpen] = useState(false);
  const [isFacturePreviewOpen, setIsFacturePreviewOpen] = useState(false);
  const [isBonPreviewOpen, setIsBonPreviewOpen] = useState(false);
  const [factureType, setFactureType] = useState<'normal' | 'proforma'>('normal');
  const [showComptabiliseesList, setShowComptabiliseesList] = useState(false);
  const [showNonComptabiliseesList, setShowNonComptabiliseesList] = useState(false);

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

  const showRetroAlert = (message: string, title = "Messages") => {
    setRetroDialog({
      isOpen: true,
      type: 'alert',
      title,
      message
    });
  };

  const showRetroConfirm = (message: string, onConfirm: () => void, title = "Messages") => {
    setRetroDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm
    });
  };

  const adjustProductStockInParent = (code: string, change: number) => {
    const updatedProducts = products.map(p => {
      if (p.code === code) {
        const finalStock = p.stock + change;
        return {
          ...p,
          stock: finalStock,
          stockColis: Math.ceil(finalStock / 12)
        };
      }
      return p;
    });
    onProductsUpdate(updatedProducts);
    setLocalProducts(updatedProducts);
  };

  const restoreVoucherItemsToStock = (items: VoucherItem[], originalItemsToSubtract?: VoucherItem[]) => {
    if (items.length === 0 && (!originalItemsToSubtract || originalItemsToSubtract.length === 0)) return;
    const updatedProducts = products.map(p => {
      let finalStock = p.stock;
      
      const matchingItemsToRestore = items.filter(i => i.code === p.code);
      if (matchingItemsToRestore.length > 0) {
        finalStock += matchingItemsToRestore.reduce((sum, item) => sum + item.qty, 0);
      }
      
      if (originalItemsToSubtract) {
        const matchingItemsToSubtract = originalItemsToSubtract.filter(i => i.code === p.code);
        if (matchingItemsToSubtract.length > 0) {
          finalStock -= matchingItemsToSubtract.reduce((sum, item) => sum + item.qty, 0);
        }
      }
      return {
        ...p,
        stock: finalStock,
        stockColis: Math.ceil(finalStock / 12)
      };
    });
    onProductsUpdate(updatedProducts);
    setLocalProducts(updatedProducts);
  };

  const handleSelectClient = (clientName: string) => {
    if (mode !== 'create') {
      showRetroAlert("Pour affecter ce client, vous devez d'abord cliquer sur 'Nouveau bon' (F2) ou être en mode modification.", "Saisie ventes");
      return;
    }
    setNewClientName(clientName);
    setIsClientModalOpen(false);
  };

  const handleCreateClient = () => {
    if (!clientFormName.trim()) {
      showRetroAlert("Le nom du client est requis.", "Saisie ventes");
      return;
    }
    const duplicate = clients.find(c => c.name.toLowerCase() === clientFormName.trim().toLowerCase());
    if (duplicate) {
      showRetroAlert("Un client avec ce nom existe déjà.", "Saisie ventes");
      return;
    }

    const nextCodeNum = clients.length + 1;
    const generatedCode = 'C-' + String(nextCodeNum).padStart(3, '0');
    const newClient: Client = {
      id: 'client-' + Date.now(),
      code: generatedCode,
      name: clientFormName.trim(),
      balance: parseFloat(clientFormBalance) || 0,
      contact: clientFormPhone.trim() || undefined,
      address: clientFormAddress.trim() || undefined
    };

    // Save client
    onClientsUpdate([...clients, newClient]);

    // If in create mode, automatically select this client
    if (mode === 'create') {
      setNewClientName(newClient.name);
    }

    // Reset form states
    setClientFormName('');
    setClientFormPhone('');
    setClientFormAddress('');
    setClientFormBalance('0');

    // Close modal
    setIsClientModalOpen(false);

    showRetroAlert(`Client "${newClient.name}" créé avec succès !${mode === 'create' ? ' Associé à cette vente.' : ''}`, "Saisie ventes");
  };

  // Table column widths inside product chooser
  const [colWidths, setColWidths] = useState({
    code: 110,
    designation: 240,
    prixUnitaire: 110,
    prixAchat: 110,
    prixRevient: 110,
    stock: 75
  });

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, colName: keyof typeof colWidths) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colName];

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      setColWidths(prev => ({
        ...prev,
        [colName]: Math.max(50, startWidth + dx)
      }));
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // Search input query to search/filter products already sold in the current voucher
  const [soldItemsSearchQuery, setSoldItemsSearchQuery] = useState('');

  const navigableVouchers = useMemo(() => {
    const map = new Map<string, { id: string; type: 'closed' | 'draft'; data: any }>();
    
    // Add closed sales
    sales.forEach(sale => {
      map.set(sale.id, {
        id: sale.id,
        type: 'closed',
        data: sale
      });
    });

    // Add/overwrite open drafts
    openVouchers.forEach(v => {
      map.set(v.id, {
        id: v.id,
        type: 'draft',
        data: v
      });
    });

    // Sort by ID
    return Array.from(map.values()).sort((a, b) => {
      const idA = String(a.id || '');
      const idB = String(b.id || '');
      return idA.localeCompare(idB, undefined, { numeric: true });
    });
  }, [sales, openVouchers]);

  // Map of product codes to effective/live stock values
  const effectiveStockMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      map.set(p.code, p.stock);
    });
    return map;
  }, [products]);

  const activeNavIndex = useMemo(() => {
    return navigableVouchers.findIndex(v => v.id === selectedSaleId);
  }, [navigableVouchers, selectedSaleId]);

  const selectedSale = useMemo(() => {
    if (mode === 'create') return null;
    return sales.find(s => String(s.id) === String(selectedSaleId)) || sales[sales.length - 1] || null;
  }, [sales, selectedSaleId, mode]);

  const selectVoucherById = (id: string, customNavList?: typeof navigableVouchers) => {
    setSelectedSaleId(id);
    const listToUse = customNavList || navigableVouchers;
    const found = listToUse.find(v => v.id === id);
    if (found) {
      if (found.type === 'draft') {
        const draft = found.data;
        setNewSaleId(draft.id);
        setNewDate(draft.date);
        setNewTime(draft.time);
        setNewClientName(draft.clientName);
        setNewType(draft.type);
        setVendeurName(draft.vendeurName);
        setObservations(draft.observations);
        setVersement(draft.versement);
        setRemise(draft.remise);
        setTvaRate(draft.tvaRate);
        setDraftItems(draft.draftItems);
        
        setEditingVoucherId(draft.isEditingExisting ? draft.id : null);
        
        setSelectedItemIndex(-1);
        setViewingItemCode('');
        
        setActiveDraftId(draft.id);
        setMode('create');
      } else {
        // Closed sale
        setActiveDraftId(null);
        setMode('view');
        setSelectedSaleId(found.id);
        setViewingItemCode('');
        setSelectedItemIndex(-1);
      }
    }
  };

  useEffect(() => {
    if (sales.length > 0 && !selectedSaleId && mode === 'view') {
      setSelectedSaleId(sales[sales.length - 1].id);
    }
  }, [sales, selectedSaleId, mode]);

  // Set default client to Anonyme on initial load or reset
  useEffect(() => {
    if (clients.length > 0 && !newClientName) {
      setNewClientName('Anonyme');
    }
  }, [clients, newClientName]);

  // Keep active draft synchronized inside the openVouchers array
  useEffect(() => {
    if (activeDraftId) {
      setOpenVouchers(prev => prev.map(v => {
        if (v.id === activeDraftId) {
          return {
            ...v,
            date: newDate,
            time: newTime,
            clientName: newClientName,
            type: newType,
            vendeurName: vendeurName,
            observations: observations,
            versement: versement,
            remise: remise,
            tvaRate: tvaRate,
            draftItems: draftItems,
            paymentMode: paymentMode
          };
        }
        return v;
      }));
    }
  }, [
    activeDraftId,
    newDate,
    newTime,
    newClientName,
    newType,
    vendeurName,
    observations,
    versement,
    remise,
    tvaRate,
    draftItems,
    paymentMode
  ]);

  const loadDraft = (draft: OpenVoucher) => {
    setSelectedSaleId(draft.id);
    setNewSaleId(draft.id);
    setNewDate(draft.date);
    setNewTime(draft.time);
    setNewClientName(draft.clientName);
    setNewType(draft.type);
    setVendeurName(draft.vendeurName);
    setObservations(draft.observations);
    setVersement(draft.versement);
    setRemise(draft.remise);
    setTvaRate(draft.tvaRate);
    setDraftItems(draft.draftItems);
    if (draft.paymentMode) {
      setPaymentMode(draft.paymentMode);
    }
    
    setEditingVoucherId(draft.isEditingExisting ? draft.id : null);
    
    setSelectedItemIndex(-1);
    setViewingItemCode('');
    
    setActiveDraftId(draft.id);
    setMode('create');
  };

  const removeDraft = (id: string) => {
    const draftToRestore = openVouchers.find(v => String(v.id) === String(id));
    if (draftToRestore) {
      restoreVoucherItemsToStock(draftToRestore.draftItems);
    }
    setOpenVouchers(prev => prev.filter(v => String(v.id) !== String(id)));
    if (String(activeDraftId) === String(id)) {
      setActiveDraftId(null);
      setMode('view');
      if (sales.length > 0) {
        setSelectedSaleId(sales[sales.length - 1].id);
      }
    }
  };

  // Handle invoice index traversal using pager buttons
  const handleFirst = () => {
    if (navigableVouchers.length > 0) {
      selectVoucherById(navigableVouchers[0].id);
    }
  };
  const handlePrev = () => {
    if (activeNavIndex > 0) {
      selectVoucherById(navigableVouchers[activeNavIndex - 1].id);
    }
  };
  const handleNext = () => {
    if (activeNavIndex !== -1 && activeNavIndex < navigableVouchers.length - 1) {
      selectVoucherById(navigableVouchers[activeNavIndex + 1].id);
    }
  };
  const handleLast = () => {
    if (navigableVouchers.length > 0) {
      selectVoucherById(navigableVouchers[navigableVouchers.length - 1].id);
    }
  };

  // Locate selected client info
  const selectedClientObj = useMemo(() => {
    const name = mode === 'create' ? newClientName : (selectedSale?.client || 'Anonyme');
    return clients.find(c => c.name === name) || { id: 'anonyme', name: 'Anonyme', balance: 0, phone: '', address: '' };
  }, [clients, newClientName, selectedSale, mode]);

  // Calculations
  const computedMetrics = useMemo(() => {
    const items = mode === 'create' ? draftItems : (selectedSale?.items || []);
    const rawSum = items.reduce((acc, item) => acc + item.total, 0);
    
    // Remise can be specified
    const activeRemise = mode === 'create' ? remise : (selectedSale?.remise || 0);
    const totalHT = Math.max(0, rawSum - activeRemise);
    
    const activeTvaRate = mode === 'create' ? tvaRate : 0;
    const tva = totalHT * (activeTvaRate / 100);
    
    const activeTimbre = mode === 'create' 
      ? 0 
      : (selectedSale?.timbre || 0);

    const ttc = totalHT + tva + activeTimbre;
    let oldBalance = 0;
    if (mode === 'create') {
      oldBalance = selectedClientObj ? Number(selectedClientObj.balance) || 0 : 0;
      if (editingVoucherId && selectedClientObj) {
        const origSale = sales.find(s => String(s.id) === String(editingVoucherId));
        if (origSale && selectedClientObj.name === origSale.client) {
          const sTtc = Number(origSale.ttc) || 0;
          const sVersement = Number(origSale.versement) || 0;
          oldBalance = Math.max(0, oldBalance - (sTtc - sVersement));
        }
      }
    } else {
      oldBalance = selectedSale?.oldBalance ?? 0;
    }
    
    const activeVersement = mode === 'create' ? versement : (selectedSale?.versement || 0);
    const newBalance = mode === 'view'
      ? (selectedSale?.newBalance ?? 0)
      : oldBalance + (ttc - activeVersement);

    return {
      rawAmount: rawSum,
      remise: activeRemise,
      totalHT,
      tva,
      timbre: activeTimbre,
      ttc,
      oldBalance,
      newBalance,
      totalQty: items.reduce((acc, item) => acc + item.qty, 0),
      colisCount: items.reduce((acc, item) => acc + (item.nbreColis || 0), 0)
    };
  }, [draftItems, selectedSale, mode, selectedClientObj, versement, remise, tvaRate, editingVoucherId, sales]);

  // Active items helper reference
  const currentItems = mode === 'create' ? draftItems : (selectedSale?.items || []);

  const previewData = useMemo(() => {
    const isCreate = mode === 'create';
    const id = isCreate ? newSaleId : (selectedSale?.id || '');
    const date = isCreate ? newDate : (selectedSale?.date || '');
    const time = isCreate ? newTime : (selectedSale?.time || '');
    const clientName = isCreate ? (newClientName || 'Anonyme') : (selectedSale?.client || 'Anonyme');
    const items = isCreate ? draftItems : (selectedSale?.items || []);
    const activeRemise = isCreate ? remise : (selectedSale?.remise || 0);
    const activeTvaRate = isCreate ? tvaRate : (selectedSale?.tva ? 19 : 0);
    const activeVendeur = isCreate ? vendeurName : (selectedSale?.vendeur || '<Aucun>');
    const observationsText = isCreate ? observations : (selectedSale?.observations || '');
    
    const rawSum = items.reduce((acc, item) => acc + item.total, 0);
    const totalHT = Math.max(0, rawSum - activeRemise);
    const tvaVal = totalHT * (activeTvaRate / 100);
    const timbreVal = isCreate 
      ? 0 
      : (selectedSale?.timbre || 0);
    const ttcVal = totalHT + tvaVal + timbreVal;
    
    const clientObj = clients.find(c => c.name === clientName) || { id: 'anonyme', name: clientName, balance: 0, phone: '', address: '' };
    
    const payMode = isCreate 
      ? (paymentMode === 'ESPECE' ? 'ESPÈCE / CASH' : 'A TERME')
      : (selectedSale?.paymentMode
          ? (selectedSale.paymentMode === 'ESPECE' ? 'ESPÈCE / CASH' : 'A TERME')
          : (selectedSale && selectedSale.versement >= selectedSale.ttc ? 'ESPÈCE / CASH' : 'A TERME')
        );
    
    return {
      id,
      date,
      time,
      clientName,
      clientObj,
      items,
      remise: activeRemise,
      tvaRate: activeTvaRate,
      tva: tvaVal,
      timbre: timbreVal,
      totalHT,
      ttc: ttcVal,
      rawSum,
      vendeur: activeVendeur,
      observations: observationsText,
      payMode
    };
  }, [mode, newSaleId, selectedSale, newDate, newTime, newClientName, draftItems, remise, tvaRate, vendeurName, observations, clients, paymentMode]);

  // Keyboard shortcut Ctrl+B for profit/benefit toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowBenefit(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Total Benefit / Margin Calculation
  const totalBenefit = useMemo(() => {
    const items = mode === 'create' ? draftItems : (selectedSale?.items || []);
    const itemsBenefit = items.reduce((acc, item) => {
      const originalProduct = products.find(p => p.code === item.code);
      const buyPrice = originalProduct?.prixAchat ?? originalProduct?.prixDeRevient ?? 0;
      const profitPerUnit = item.price - buyPrice;
      const itemProfit = profitPerUnit * item.qty;
      return acc + itemProfit;
    }, 0);
    const activeRemise = mode === 'create' ? remise : (selectedSale?.remise || 0);
    return itemsBenefit - activeRemise;
  }, [draftItems, selectedSale, mode, remise, products]);

  // Auto-filtering/indexing logic for the sold products table
  const displayedItems = useMemo(() => {
    const mapped = currentItems.map((item, originalIndex) => ({
      ...item,
      originalIndex
    }));
    if (!soldItemsSearchQuery.trim()) return mapped;
    const q = soldItemsSearchQuery.toLowerCase();
    return mapped.filter(item => 
      item.code.toLowerCase().includes(q) || 
      item.designation.toLowerCase().includes(q)
    );
  }, [currentItems, soldItemsSearchQuery]);

  // Set first item as active if none is clicked
  useEffect(() => {
    if (currentItems.length > 0 && selectedItemIndex !== -1) {
      const codes = currentItems.map(i => i.code);
      if (!codes.includes(viewingItemCode)) {
        setViewingItemCode(currentItems[0].code);
        setSelectedItemIndex(0);
      }
    }
  }, [currentItems, viewingItemCode, selectedItemIndex]);

  const startCreateMode = () => {
    if (!config?.isActivated && sales.length >= 1) {
      showRetroAlert("⚠️ Limite Démo : Vous ne pouvez pas créer plus de 1 bon de vente en mode évaluation (démo). Veuillez activer l'application avec un code d'activation dans les configurations.", "Saisie ventes");
      return;
    }

    // Sync starting products
    setLocalProducts(products);

    // Calculate a unique next number avoiding collisions with both closed sales and open drafts
    const allIds = [
      ...sales.map(s => Number(s.id)),
      ...openVouchers.map(v => Number(v.id))
    ];
    const maxId = allIds.length > 0 ? Math.max(...allIds) : 0;
    const nextNum = String(maxId + 1).padStart(4, '0');

    const d = new Date();
    const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const formattedTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

    const newDraft: OpenVoucher = {
      id: nextNum,
      isEditingExisting: false,
      date: formattedDate,
      time: formattedTime,
      clientName: 'Anonyme',
      type: 'VENTE',
      vendeurName: '<Aucun>',
      observations: '',
      versement: 0,
      remise: 0,
      tvaRate: 0,
      draftItems: [],
      paymentMode: paymentMode
    };

    setOpenVouchers(prev => [...prev, newDraft]);
    loadDraft(newDraft);
  };

  const handleDeleteSelectedVoucher = () => {
    if (mode === 'create') return;
    if (!selectedSale) {
      showRetroAlert("Aucun bon sélectionné pour suppression.", "Saisie ventes");
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteVoucher = () => {
    if (!selectedSale) return;

    // Call deletion on parent level (which restores stock and balance)
    onDeleteSale(selectedSale.id);

    // Reset selection in the current component view
    if (sales.length > 1) {
      const remainingSales = sales.filter(s => String(s.id) !== String(selectedSale.id));
      if (remainingSales.length > 0) {
        setSelectedSaleId(remainingSales[remainingSales.length - 1].id);
      }
    } else {
      setSelectedSaleId('');
    }

    setNewClientName('Anonyme');
    setIsDeleteConfirmOpen(false);
  };

  const handleEditVoucher = () => {
    if (!selectedSale) {
      showRetroAlert("Aucun bon de livraison sélectionné.", "Saisie ventes");
      return;
    }

    // Check if this voucher is already open in our drafts
    const existingDraft = openVouchers.find(v => String(v.id) === String(selectedSale.id) && v.isEditingExisting);
    if (existingDraft) {
      loadDraft(existingDraft);
      return;
    }

    showRetroConfirm(
      "Voulez-vous vraiment modifier ce bon de livraison ?",
      () => {
        // The master products stock already contains the subtracted quantity of this sale.
        // Since we are loading this sale's items into the active draft list (draftItems),
        // the reservation and the original sale's stock impact cancel out perfectly.
        // So we keep the current products stock as-is and synchronize localProducts.
        setLocalProducts(products);

        const newDraft: OpenVoucher = {
          id: selectedSale.id,
          isEditingExisting: true,
          date: selectedSale.date,
          time: selectedSale.time,
          clientName: selectedSale.client,
          type: selectedSale.type || 'VENTE',
          vendeurName: selectedSale.vendeur || '<Aucun>',
          observations: selectedSale.observations || '',
          versement: selectedSale.versement || 0,
          remise: selectedSale.remise || 0,
          tvaRate: selectedSale.tva ? 19 : 0,
          draftItems: [...selectedSale.items],
          paymentMode: selectedSale.paymentMode as 'ESPECE' | 'A_TERME'
        };

        setOpenVouchers(prev => [...prev, newDraft]);
        loadDraft(newDraft);
      },
      "Messages"
    );
  };

  const handleCloseAndSaveVoucher = () => {
    if (draftItems.length === 0) {
      showRetroAlert("Veuillez ajouter au moins un produit pour fermer et enregistrer le bon.", "Saisie ventes");
      return;
    }

    if (newClientName.toLowerCase() === 'anonyme') {
      // Save immediately with full payment without opening the dialog for Anonyme client
      handleConfirmPaymentAndSaveVoucher(computedMetrics.ttc);
      return;
    }

    // Default to config default pay mode with pre-filled full versement
    const defaultMode = config?.deliveryInfo?.defaultPayModeDelivery || 'ESPECE';
    setPaymentMode(defaultMode);
    setPaymentVersement(defaultMode === 'A_TERME' ? 0 : Number((computedMetrics.ttc).toFixed(2)));
    setPaymentSource('CAISSE PRINCIPALE');
    setIsPaymentDialogOpen(true);
  };

  const handleConfirmPaymentAndSaveVoucher = (customVersement?: number | unknown) => {
    const finalVersement = (typeof customVersement === 'number')
      ? customVersement
      : (paymentMode === 'A_TERME' ? 0 : Number(paymentVersement) || 0);
    
    // Recalculate newBalance with final versement
    const finalNewBalance = computedMetrics.oldBalance + (computedMetrics.ttc - finalVersement);

    const savedVoucher: SalesVoucher = {
      id: newSaleId,
      date: newDate,
      time: newTime,
      client: newClientName,
      type: newType,
      itemsCount: draftItems.length,
      colisCount: computedMetrics.colisCount,
      amount: computedMetrics.rawAmount,
      remise: remise,
      totalHT: computedMetrics.totalHT,
      tva: computedMetrics.tva,
      timbre: computedMetrics.timbre,
      ttc: computedMetrics.ttc,
      versement: finalVersement,
      oldBalance: computedMetrics.oldBalance,
      newBalance: finalNewBalance,
      observations: observations,
      vendeur: vendeurName,
      items: draftItems,
      paymentMode: paymentMode
    };

    // The parent stock is already fully decremented in real-time as items are added/edited in the draft.
    // Therefore, we do not subtract the draft items again when finalizing the sales voucher.
    const finalizedProducts = localProducts;

    // Calculate and update client balance
    const updatedClients = clients.map(c => {
      if (c.name === savedVoucher.client) {
        return {
          ...c,
          balance: savedVoucher.newBalance
        };
      }
      return c;
    });

    if (!editingVoucherId && !config?.isActivated && sales.length >= 1) {
      showRetroAlert("⚠️ Limite Démo : Vous ne pouvez pas créer plus de 1 bon de vente en mode évaluation (démo). Veuillez activer l'application avec un code d'activation dans les configurations.", "Limite Démo");
      return;
    }

    if (editingVoucherId) {
      onUpdateSale(editingVoucherId, savedVoucher);
      showRetroAlert(`Bon de Livraison N° ${savedVoucher.id} a été modifié avec succès !`, "Saisie ventes");
      
      // Remove from drafts
      setOpenVouchers(prev => prev.filter(v => v.id !== editingVoucherId));
      setActiveDraftId(null);
      setSelectedSaleId(savedVoucher.id);
      setEditingVoucherId(null);
      setMode('view');
    } else {
      onAddSale(savedVoucher);
      showRetroAlert(`Bon de Livraison N° ${savedVoucher.id} a été enregistré !`, "Saisie ventes");
      
      // Remove from drafts
      setOpenVouchers(prev => prev.filter(v => v.id !== newSaleId));
      setActiveDraftId(null);
      setSelectedSaleId(savedVoucher.id);
      setEditingVoucherId(null);
      setMode('view');
    }

    onProductsUpdate(finalizedProducts);
    onClientsUpdate(updatedClients);
    setIsPaymentDialogOpen(false);
  };

  const handleFermerLeBon = () => {
    if (mode === 'create') {
      if (draftItems.length === 0) {
        const idToDelete = editingVoucherId || newSaleId;
        
        if (editingVoucherId) {
          onDeleteSale(editingVoucherId);
        }

        // Build remaining navigable list synchronously
        const map = new Map<string, { id: string; type: 'closed' | 'draft'; data: any }>();
        
        // Add closed sales, filtering out idToDelete if it is being deleted
        sales.forEach(sale => {
          if (sale.id !== idToDelete) {
            map.set(sale.id, {
              id: sale.id,
              type: 'closed',
              data: sale
            });
          }
        });

        // Add open drafts, filtering out idToDelete
        openVouchers.forEach(v => {
          if (v.id !== idToDelete) {
            map.set(v.id, {
              id: v.id,
              type: 'draft',
              data: v
            });
          }
        });

        // Sort by ID
        const remainingNavigable = Array.from(map.values()).sort((a, b) => {
          const idA = String(a.id || '');
          const idB = String(b.id || '');
          return idA.localeCompare(idB, undefined, { numeric: true });
        });

        // Update openVouchers state
        setOpenVouchers(prev => prev.filter(v => v.id !== idToDelete));
        setActiveDraftId(null);
        setEditingVoucherId(null);

        if (remainingNavigable.length > 0) {
          // Find old index in the original list of navigableVouchers
          const oldIndex = navigableVouchers.findIndex(v => v.id === idToDelete);
          const targetIndex = Math.min(Math.max(0, oldIndex - 1), remainingNavigable.length - 1);
          const fallbackId = remainingNavigable[targetIndex >= 0 ? targetIndex : 0].id;
          selectVoucherById(fallbackId, remainingNavigable);
        } else {
          // Clear everything
          setSelectedSaleId('');
          setNewClientName('Anonyme');
          setNewSaleId('');
          setDraftItems([]);
          setMode('view');
        }

        if (editingVoucherId) {
          showRetroAlert("Le bon de livraison a été supprimé car tous ses produits ont été retirés.", "Saisie ventes");
        }
      } else {
        handleCloseAndSaveVoucher();
      }
    }
  };

  // Hotkeys Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      // If we are editing inside some text inputs, don't trigger global hotkeys unless barcode input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' && !(e.target as HTMLInputElement).readOnly && !isProductChooserOpen && !isPaymentDialogOpen) {
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

      if (e.key === 'F7') {
        e.preventDefault();
        setIsProductChooserOpen(true);
      } else if (e.key === 'F1') {
        e.preventDefault();
        startCreateMode();
      } else if (e.key === 'F5' && mode === 'create') {
        e.preventDefault();
        handleFermerLeBon();
      } else if (e.key === 'F4' && mode === 'view') {
        e.preventDefault();
        handleEditVoucher();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleFermerLeBon();
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (mode === 'create') {
          showRetroAlert("Impression impossible. Veuillez d'abord fermer le bon (enregistrer) !", "Saisie ventes");
        } else {
          setIsBonPreviewOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, draftItems, newSaleId, newDate, newTime, newClientName, newType, versement, remise, tvaRate, products, isPaymentDialogOpen, paymentVersement, paymentMode, openVouchers]);

  // Handle keyboard navigation for the product chooser dialog
  useEffect(() => {
    if (!isProductChooserOpen) return;

    const handleChooserKeyDown = (e: KeyboardEvent) => {
      if (isConfigPopupOpen) return; // Let the configuration popup form handle its own keys

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsProductChooserOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredChooserProducts.length === 0) return;
        const currentIdx = filteredChooserProducts.findIndex(p => p.code === selectedProductInChooser?.code);
        let nextIdx = 0;
        if (currentIdx >= 0 && currentIdx < filteredChooserProducts.length - 1) {
          nextIdx = currentIdx + 1;
        }
        setSelectedProductInChooser(filteredChooserProducts[nextIdx]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredChooserProducts.length === 0) return;
        const currentIdx = filteredChooserProducts.findIndex(p => p.code === selectedProductInChooser?.code);
        let prevIdx = filteredChooserProducts.length - 1;
        if (currentIdx > 0) {
          prevIdx = currentIdx - 1;
        }
        setSelectedProductInChooser(filteredChooserProducts[prevIdx]);
      } else if (e.key === 'Enter') {
        if (selectedProductInChooser) {
          e.preventDefault();
          if (selectedProductInChooser.blocked) {
            showRetroAlert(`⚠️ Impossible d'insérer l'article : Le produit "${selectedProductInChooser.designation}" est BLOQUÉ !`, "Article Bloqué");
            return;
          }
          setChooserQty(1);
          setSelectedPriceType('prixVente1');
          setCustomSellingPrice(selectedProductInChooser.prixVente1);
          setIsConfigPopupOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleChooserKeyDown);
    return () => window.removeEventListener('keydown', handleChooserKeyDown);
  }, [isProductChooserOpen, isConfigPopupOpen, filteredChooserProducts, selectedProductInChooser]);

  const handleInsertProduct = () => {
    if (mode !== 'create') {
      showRetroAlert("Ajout d'articles impossible en mode consultation. Veuillez cliquer d'abord sur 'Nouveau bon'.", "Saisie ventes");
      return;
    }
    setChooserSearchQuery('');
    setSelectedProductInChooser(null);
    setChooserQty(1);
    setSelectedPriceType('prixVente1');
    setCustomSellingPrice(0);
    setIsProductChooserOpen(true);
  };

  const performInsertProduct = (product: Product, quantitySelected: number = 1, priceSelected?: number) => {
    const finalPrice = priceSelected !== undefined ? priceSelected : product.prixVente1;
    
    const colisageVal = (product as any).colisage || 12;
    const newItem: VoucherItem = {
      id: `draft-${Date.now()}-${Math.random()}`,
      code: product.code,
      designation: product.designation,
      colisage: colisageVal,
      nbreColis: Math.floor(quantitySelected / colisageVal),
      pieces: quantitySelected % colisageVal,
      qty: quantitySelected,
      price: finalPrice,
      total: quantitySelected * finalPrice
    };
    const updated = [...draftItems, newItem];
    setDraftItems(updated);
    setSelectedItemIndex(updated.length - 1);
    setViewingItemCode(product.code);

    // Immediately subtract the stock in the parent state
    adjustProductStockInParent(product.code, -quantitySelected);
  };

  const insertProductDirectly = (product: Product, quantitySelected: number = 1, priceSelected?: number): boolean => {
    if (mode !== 'create') {
      showRetroAlert("Ajout d'articles impossible en mode consultation. Veuillez cliquer d'abord sur 'Nouveau bon'.", "Saisie ventes");
      return false;
    }

    if (product.blocked) {
      showRetroAlert(`⚠️ Impossible d'insérer l'article : Le produit "${product.designation}" est BLOQUÉ !`, "Article Bloqué");
      return false;
    }

    const currentStock = effectiveStockMap.get(product.code) ?? product.stock;

    if (currentStock <= 0) {
      showRetroConfirm(
        `⚠️ Stock Épuisé : Le produit "${product.designation}" a un stock de ${currentStock}.\n\nVoulez-vous l'insérer quand même ?`,
        () => {
          performInsertProduct(product, quantitySelected, priceSelected);
          setIsConfigPopupOpen(false);
          setIsProductChooserOpen(false);
        },
        "Stock Épuisé"
      );
    } else if (quantitySelected > currentStock) {
      showRetroConfirm(
        `⚠️ Stock Insuffisant : Le produit "${product.designation}" a un stock de ${currentStock} mais vous avez saisi ${quantitySelected}.\n\nVoulez-vous continuer ?`,
        () => {
          performInsertProduct(product, quantitySelected, priceSelected);
          setIsConfigPopupOpen(false);
          setIsProductChooserOpen(false);
        },
        "Stock Insuffisant"
      );
    } else {
      performInsertProduct(product, quantitySelected, priceSelected);
      setIsConfigPopupOpen(false);
      setIsProductChooserOpen(false);
    }
    return true;
  };

  const handleDeleteItem = () => {
    if (mode !== 'create') {
      showRetroAlert("Suppression des lignes impossible en mode consultation. Cliquez sur 'Nouveau Bon' pour saisir.", "Saisie ventes");
      return;
    }
    if (draftItems.length === 0) return;
    const currentItem = draftItems[selectedItemIndex];
    if (!currentItem) return;

    const updated = draftItems.filter((_, idx) => idx !== selectedItemIndex);
    setDraftItems(updated);

    // Immediately restore the stock of the deleted product in the parent state
    adjustProductStockInParent(currentItem.code, currentItem.qty);

    const nextIdx = Math.max(0, selectedItemIndex - 1);
    setSelectedItemIndex(nextIdx);
    if (updated[nextIdx]) {
      setViewingItemCode(updated[nextIdx].code);
    } else {
      setViewingItemCode('');
    }
  };

  const handleEditPriceOrQty = () => {
    if (mode !== 'create') {
      showRetroAlert("Modification impossible en mode consultation. Créez un nouveau bon.", "Saisie ventes");
      return;
    }
    const currentItem = draftItems[selectedItemIndex];
    if (!currentItem) return;

    const matchingProduct = products.find(p => p.code === currentItem.code);
    let initialPriceType: 'prixVente1' | 'prixVente2' | 'prixVente3' | '' = '';
    if (matchingProduct) {
      if (currentItem.price === matchingProduct.prixVente1) {
        initialPriceType = 'prixVente1';
      } else if (currentItem.price === matchingProduct.prixVente2) {
        initialPriceType = 'prixVente2';
      } else if (currentItem.price === matchingProduct.prixVente3) {
        initialPriceType = 'prixVente3';
      }
    }

    setEditModalQty(currentItem.qty);
    setEditModalPrice(currentItem.price);
    setEditPriceType(initialPriceType);
    setEditModalIndex(selectedItemIndex);
    setIsItemEditModalOpen(true);
  };

  const handleSaveVoucher = () => {
    handleCloseAndSaveVoucher();
  };



  // Filtered products for search insertion
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return localProducts;
    return localProducts.filter(p => 
      p.designation.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.code.includes(searchQuery)
    );
  }, [localProducts, searchQuery]);

  // Find info about product currently selected/clicked inside invoice details
  const viewingProduct = useMemo(() => {
    return localProducts.find(p => p.code === viewingItemCode) || null;
  }, [localProducts, viewingItemCode]);

  // Navigation functions inside items of this invoice
  const selectFirstItem = () => { if (currentItems.length > 0) { setSelectedItemIndex(0); setViewingItemCode(currentItems[0].code); } };
  const selectPrevItem = () => { if (selectedItemIndex > 0) { setSelectedItemIndex(selectedItemIndex - 1); setViewingItemCode(currentItems[selectedItemIndex - 1].code); } };
  const selectNextItem = () => { if (selectedItemIndex < currentItems.length - 1) { setSelectedItemIndex(selectedItemIndex + 1); setViewingItemCode(currentItems[selectedItemIndex + 1].code); } };
  const selectLastItem = () => { if (currentItems.length > 0) { setSelectedItemIndex(currentItems.length - 1); setViewingItemCode(currentItems[currentItems.length - 1].code); } };

  // Set values when navigating between saved sales
  useEffect(() => {
    if (selectedSale && mode === 'view') {
      setVersement(selectedSale.versement || 0);
      setRemise(selectedSale.remise || 0);
      setObservations(selectedSale.observations || '');
      setVendeurName(selectedSale.vendeur || '<Aucun>');
    }
  }, [selectedSale, mode]);

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedItemIndex(-1);
          setViewingItemCode('');
        }
      }}
      className="flex-1 flex flex-col font-sans text-xs bg-slate-50 dark:bg-slate-900/40 text-slate-800 dark:text-slate-100 h-full overflow-hidden select-none outline-none"
    >
      
      {/* 1. Header Toolbar Ribbon - Modernized with Material 3 styling */}
      <div 
        style={{ marginTop: '0px', marginBottom: '2px', width: '100%' }}
        className="flex items-center justify-between bg-white dark:bg-slate-900 py-1 px-2 rounded-xl border border-slate-200/50 dark:border-slate-800/85 gap-1.5 select-none shadow-xs h-[46px] shrink-0 flex-nowrap overflow-x-auto scrollbar-none"
      >
        
        {/* Media Buttons: Deb, Prec, Suiv, Fin grouped together */}
        <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
          <div className="flex bg-slate-105 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200/20 gap-0.5 dev-pager-group shadow-inner">
            <button
              onClick={handleFirst}
              disabled={navigableVouchers.length <= 1 || activeNavIndex <= 0}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Premier Bon"
            >
              <span className="text-xs font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">⏮</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Début</span>
            </button>
            <button
              onClick={handlePrev}
              disabled={navigableVouchers.length <= 1 || activeNavIndex <= 0}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Bon Précédent"
            >
              <span className="text-[10px] font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">◀</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Préc.</span>
            </button>
            <button
              onClick={handleNext}
              disabled={navigableVouchers.length <= 1 || activeNavIndex === -1 || activeNavIndex >= navigableVouchers.length - 1}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Bon Suivant"
            >
              <span className="text-[10px] font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">▶</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Suiv.</span>
            </button>
            <button
              onClick={handleLast}
              disabled={navigableVouchers.length <= 1 || activeNavIndex === -1 || activeNavIndex >= navigableVouchers.length - 1}
              className="w-9 h-7.5 flex flex-col justify-center items-center rounded bg-white dark:bg-slate-900 border border-slate-200/30 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 select-none cursor-pointer"
              title="Dernier Bon"
            >
              <span className="text-xs font-sans leading-none text-slate-800 dark:text-sky-400 font-extrabold">⏭</span>
              <span className="text-[6.5px] font-black text-slate-500 uppercase tracking-tight">Fin</span>
            </button>
          </div>
 
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
 
          {/* Action Buttons: F1, F2, F3... */}
          <div className="flex items-center gap-1 flex-nowrap shrink-0">
            <button
              onClick={startCreateMode}
              className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 hover:to-teal-700 text-white rounded-lg shadow-md cursor-pointer transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
            >
              <span className="text-xs">📄</span>
              <div className="flex flex-col text-left">
                <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Nouveau bon</span>
                <span className="text-[7px] font-bold text-emerald-100 tracking-wider">[ F1 ]</span>
              </div>
            </button>

            <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              onClick={handleFermerLeBon}
              disabled={mode !== 'create'}
              className={`px-2.5 h-8 flex items-center justify-center gap-1.5 rounded-lg shadow-sm transition-transform duration-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${
                mode === 'create'
                  ? 'bg-gradient-to-br from-[#1e293b] to-slate-800 text-white cursor-pointer'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-950 cursor-default'
              }`}
            >
              <span className="text-xs">🔒</span>
              <div className="flex flex-col text-left">
                <span style={{ fontSize: '9.5px', lineHeight: '9px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Fermer le bon</span>
                <span className="text-[7px] font-bold opacity-80 tracking-wider">[ F2 ]</span>
              </div>
            </button>
            <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              type="button"
              disabled={mode === 'create'}
              onClick={() => setIsBonPreviewOpen(true)}
              className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950 shadow-xs cursor-pointer transition-transform duration-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Printer size={13} className="text-slate-500 dark:text-slate-400" />
              <div className="flex flex-col text-left">
                <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Imprimer le bon</span>
                <span className="text-[7px] font-bold text-slate-400 tracking-wider">[ F3 ]</span>
              </div>
            </button>

            <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              onClick={handleEditVoucher}
              disabled={mode === 'create' || !selectedSale}
              className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950 shadow-xs cursor-pointer disabled:opacity-40 transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
            >
              <Edit size={13} className="text-slate-500 dark:text-slate-400" />
              <div className="flex flex-col text-left">
                <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold uppercase tracking-wider leading-none">Modifier</span>
                <span className="text-[7px] font-bold text-slate-400 tracking-wider">[ F4 ]</span>
              </div>
            </button>

            <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              onClick={() => {
                const nextTva = tvaRate === 0 ? 19 : 0;
                setTvaRate(nextTva);
                showRetroAlert(`TVA changé à ${nextTva}%`, "Configuration");
              }}
              className="px-2.5 h-8 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 rounded-lg hover:opacity-90 shadow-xs cursor-pointer transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0"
            >
              <RefreshCw size={13} className="text-m3-primary dark:text-sky-400" />
              <div className="flex flex-col text-left">
                <span style={{ fontSize: '9.5px', fontFamily: 'Arial' }} className="font-extrabold text-m3-primary dark:text-sky-400 uppercase tracking-wider leading-none">Mode de tarif</span>
                <span className="text-[7px] font-bold text-green-600 dark:text-green-400 tracking-wider">TARIF {tvaRate === 19 ? 'TVA 19%' : '1'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area with closed status styles */}
      <div className="flex-1 flex flex-col min-h-0 relative">

        {/* 2. Client and Document Metadatas panel */}
        <div 
          style={{ height: '128px', width: '100%' }}
          className="mx-0.5 mt-0.5 mb-2 p-3 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl flex flex-nowrap gap-3.5 items-center justify-start text-slate-900 dark:text-slate-100 shadow-xs relative overflow-visible shrink-0"
        >
        
        {/* Left container: Client + metadata on Row 1, and facturation auxiliary cards raised to Row 2 */}
        <div className="flex flex-col gap-1.5 shrink-0 select-text justify-center">
          {/* Row 1: Client Select/Avatar AND N° de bon, Date d'édition, Heure beside each other */}
          <div className="flex items-center gap-2.5">
            {/* Client avatar and select */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsClientModalOpen(true)}
                title="Choisir ou créer un client (Fichier clients)"
                className="w-10 h-10 shrink-0 bg-gradient-to-b from-sky-50 to-sky-100/50 dark:from-slate-900 dark:to-slate-950 border border-sky-100/30 dark:border-slate-800 rounded-xl shadow-sm flex items-center justify-center cursor-pointer hover:scale-110 hover:border-sky-300 dark:hover:border-slate-700 active:scale-95 transition-all duration-100 focus:outline-none"
              >
                {/* Custom SVG Avatar resembling the blue client image exactly */}
                <svg className="w-7 h-7" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="48" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="2"/>
                  <path d="M25 40C25 25 35 15 50 15C65 15 75 25 75 40C75 43 70 45 68 40C62 30 38 30 32 40C30 45 25 43 25 40Z" fill="#eab308"/>
                  <circle cx="50" cy="45" r="22" fill="#fed7aa"/>
                  <path d="M35 30C42 22 58 22 65 30C60 25 40 25 35 30Z" fill="#ca8a04"/>
                  <circle cx="43" cy="42" r="3" fill="#1e3a8a"/>
                  <circle cx="57" cy="42" r="3" fill="#1e3a8a"/>
                  <path d="M44 54C47 57 53 57 56 54" stroke="#1e3a8a" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M22 85C22 72 32 63 45 61L50 67L55 61C68 63 78 72 78 85H22Z" fill="#1d4ed8"/>
                  <path d="M41 62L50 71L59 62L50 60L41 62Z" fill="#ffffff"/>
                  <path d="M47 68L50 82L53 68L50 66L47 68Z" fill="#ea580c"/>
                </svg>
              </button>
              <div className="flex flex-col gap-0.5 w-[115px]">
                <span className="font-extrabold text-[9px] text-blue-900 dark:text-sky-400/90 uppercase tracking-wide">Client</span>
                {mode === 'create' ? (
                  <select
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="h-7 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-sans font-extrabold text-blue-900 dark:text-sky-400 focus:outline-none w-full"
                  >
                    <option value="Anonyme">ANONYME</option>
                    {clients.filter(c => c.name.toLowerCase() !== 'anonyme').map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    readOnly
                    value={(selectedSale?.client?.toLowerCase() === 'anonyme') ? 'ANONYME' : (selectedSale?.client || '')}
                    className="h-7 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-sans font-extrabold text-[10px] text-slate-900 dark:text-slate-100 focus:outline-none w-full"
                  />
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-7 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

            {/* N° de bon, Date, Heure (now side by side next to Client group) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* N° de bon */}
              <div className="flex flex-col gap-0.5 w-[75px]">
                <span className="font-extrabold text-[8.5px] text-slate-400 dark:text-slate-400 leading-none uppercase tracking-wide">N° de bon</span>
                <input
                  type="text"
                  readOnly
                  value={mode === 'create' ? newSaleId : (selectedSale?.id || '')}
                  style={{ fontSize: '12px', textDecorationLine: 'none', fontFamily: 'Arial' }}
                  className="h-7 px-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-black text-center text-rose-600 focus:outline-none"
                />
              </div>

              {/* Date d'édition */}
              <div className="flex flex-col gap-0.5 w-[85px]">
                <span className="font-extrabold text-[8.5px] text-slate-400 dark:text-slate-400 leading-none uppercase tracking-wide">Date d'édition</span>
                <input
                  type="text"
                  readOnly={mode === 'view'}
                  value={mode === 'create' ? newDate : (selectedSale?.date || '')}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ fontSize: '12px', fontFamily: 'Arial' }}
                  className="h-7 px-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-center text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {/* Heure */}
              <div className="flex flex-col gap-0.5 w-[70px]">
                <span className="font-extrabold text-[8.5px] text-slate-400 dark:text-slate-400 leading-none uppercase tracking-wide">Heure</span>
                <input
                  type="text"
                  readOnly={mode === 'view'}
                  value={mode === 'create' ? newTime : (selectedSale?.time || '')}
                  onChange={(e) => setNewTime(e.target.value)}
                  style={{ fontFamily: 'Arial', fontSize: '13px' }}
                  className="h-7 px-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-center text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Facturation, Autres imp, Import/Exp raised to Row 2 side by side */}
          <div className="flex flex-row gap-1.5 select-none font-sans font-bold shrink-0 relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'create') {
                    showRetroAlert("Impression impossible. Veuillez d'abord fermer le bon (enregistrer) !", "Saisie ventes");
                    return;
                  }
                  setIsFacturationDropdownOpen(!isFacturationDropdownOpen);
                }}
                className={`h-8 px-2.5 border rounded-xl flex gap-2 items-center text-left transition-all cursor-pointer active:scale-95 w-[145px] focus:outline-none ${
                  isFacturationDropdownOpen
                    ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-slate-800 dark:border-sky-500 dark:text-sky-450'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <BarChart3 size={14} className="text-blue-500 dark:text-sky-400 shrink-0" />
                <div className="flex-1 flex flex-col leading-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">Facturation</span>
                    <span className="text-[7px] text-slate-400">▼</span>
                  </div>
                  <span className="text-[7.5px] text-slate-400 mt-0.5">Comptes actifs</span>
                </div>
              </button>

              {isFacturationDropdownOpen && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsFacturationDropdownOpen(false)} 
                  />
                  
                  {/* Dropdown Menu exactly like image.png */}
                  <div className="absolute left-0 top-full mt-1 w-[260px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-50 text-left font-sans select-none animate-in fade-in slide-in-from-top-1 duration-100 no-gray-override">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFacturationDropdownOpen(false);
                        setFactureType('normal');
                        setIsFacturePreviewOpen(true);
                      }}
                      className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-start text-xs text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2.5"></span>
                      <span className="flex-1 text-slate-800 dark:text-slate-100">
                        Imprimer Facture
                      </span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsFacturationDropdownOpen(false);
                        setShowComptabiliseesList(true);
                      }}
                      className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-start text-xs text-slate-800 dark:text-slate-200 font-semibold cursor-pointer border-t border-slate-100 dark:border-slate-800/60"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2.5"></span>
                      <span className="flex-1 text-slate-800 dark:text-slate-100">
                        Factures de Ventes Comptabilisées
                      </span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsFacturationDropdownOpen(false);
                        setShowNonComptabiliseesList(true);
                      }}
                      className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-start text-xs text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2.5"></span>
                      <span className="flex-1 text-slate-800 dark:text-slate-100">
                        Factures de Ventes NON Comptabilisées
                      </span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsFacturationDropdownOpen(false);
                        setFactureType('proforma');
                        setIsFacturePreviewOpen(true);
                      }}
                      className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-start text-xs text-slate-800 dark:text-slate-200 font-semibold cursor-pointer border-t border-slate-100 dark:border-slate-800/60"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2.5"></span>
                      <span className="flex-1 text-slate-800 dark:text-slate-100">
                        Facture Proforma
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="h-8 bg-slate-50 dark:bg-slate-900/60 px-2.5 border border-slate-200/50 dark:border-slate-800 rounded-xl flex gap-2 items-center text-slate-600 dark:text-slate-300 w-[145px]">
              <Printer size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
              <div className="flex flex-col leading-none text-left">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">Autres imp.</span>
                <span className="text-[7.5px] text-slate-400 mt-0.5">BLs Multiples</span>
              </div>
            </div>
            <div className="h-8 bg-slate-50 dark:bg-slate-900/60 px-2.5 border border-slate-200/50 dark:border-slate-800 rounded-xl flex gap-2 items-center text-slate-600 dark:text-slate-300 w-[145px]">
              <Plug size={14} className="text-teal-500 dark:text-teal-400 shrink-0" />
              <div className="flex flex-col leading-none text-left">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">Import / Exp</span>
                <span className="text-[7.5px] text-slate-400 mt-0.5">Sauvegardes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Central Balance / Cash Account summary card */}
        <div className="w-[190px] bg-slate-50 dark:bg-slate-900 p-1.5 border border-slate-300/10 rounded-2xl flex flex-col gap-1 text-xs font-mono font-bold leading-tight shadow-xs select-all shrink-0">
          {selectedClientObj.name.toLowerCase() !== 'anonyme' && (
            <div className="flex justify-between items-center bg-white dark:bg-slate-950 px-2 py-0.5 border border-slate-200/50 dark:border-slate-800/55 rounded-lg">
              <span style={{ fontFamily: 'Arial', fontSize: '11.5px' }} className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold font-sans">Ancien solde:</span>
              <span className="text-red-600 dark:text-red-400 font-extrabold text-xs">
                {(computedMetrics.oldBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center bg-white dark:bg-slate-950 px-2 py-0.5 border border-slate-200/50 dark:border-slate-800/55 rounded-lg">
            <span style={{ fontFamily: 'Arial', fontSize: '12.5px' }} className="text-[9.5px] text-m3-primary dark:text-sky-400 font-semibold font-sans">Montant bon:</span>
            <span className="text-blue-900 dark:text-sky-300 font-extrabold text-xs">
              {(computedMetrics.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
            </span>
          </div>
          <div className="flex justify-between items-center bg-white dark:bg-slate-950 px-2 py-0.5 border border-rose-200 dark:border-rose-900/40 rounded-lg">
            <span style={{ fontSize: '12.5px', fontFamily: 'Arial' }} className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold font-sans">Versement:</span>
            <input
              type="number"
              disabled={mode === 'view'}
              value={mode === 'create' ? versement : (selectedSale?.versement || 0)}
              onChange={(e) => setVersement(Number(e.target.value))}
              className="w-20 text-right bg-transparent font-mono font-extrabold text-green-700 dark:text-green-400 outline-none text-xs"
              style={{ direction: 'ltr' }}
            />
          </div>
          {selectedClientObj.name.toLowerCase() !== 'anonyme' && (
            <div className="flex justify-between items-center bg-white dark:bg-slate-950 px-2 py-0.5 border border-slate-200/50 dark:border-slate-800/55 rounded-lg">
              <span style={{ fontSize: '12.5px', fontFamily: 'Arial', fontWeight: 'bold' }} className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold font-sans">Nouveau solde:</span>
              <span className="text-rose-600 dark:text-rose-400 font-extrabold text-xs">
                {(computedMetrics.newBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
              </span>
            </div>
          )}
        </div>

        {/* Rightmost Commerciaux / Transaction box */}
        <div className="w-[140px] shrink-0 flex flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">
            {mode === 'create' ? (
              <select
                value={vendeurName}
                onChange={(e) => setVendeurName(e.target.value)}
                className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none text-[10.5px] font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="<Aucun>">&lt;Aucun&gt;</option>
                <option value="HICHEM">HICHEM</option>
                <option value="AGENCE ALGER">AGENCE ALGER</option>
              </select>
            ) : (
              <input
                type="text"
                readOnly
                value={selectedSale?.vendeur || vendeurName}
                className="h-7 px-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-lg focus:outline-none font-bold text-[10.5px]"
              />
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 leading-none uppercase tracking-wide">Transaction</span>
            {mode === 'create' ? (
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'VENTE' | 'RETOUR')}
                className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-blue-900 dark:text-sky-400 focus:outline-none text-[10.5px]"
              >
                <option value="VENTE">VENTE</option>
                <option value="RETOUR">RETOUR</option>
              </select>
            ) : (
              <input
                type="text"
                readOnly
                value={selectedSale?.type || 'VENTE'}
                className="h-7 px-2 bg-blue-50 text-blue-950 text-center font-bold border border-blue-300 focus:outline-none text-[10.5px] rounded-lg"
              />
            )}
          </div>

          {/* TVA, 0-9 & A-Z side-by-side next to each other right under */}
          <div className="flex items-center gap-1 mt-0.5 w-full">
            <button 
              onClick={() => showRetroAlert("Impôt de timbre configuré", "Configuration")}
              className="flex-1 h-6 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md cursor-pointer text-[9px] font-black border border-slate-200/60 dark:border-slate-800/80 flex items-center justify-center transition-all"
              title="TVA%"
            >
              <BarChart3 size={11} className="text-slate-600 dark:text-slate-400" />
            </button>
            <button 
              onClick={() => showRetroAlert("Filtre numérique actif", "Filtres")}
              className="flex-1 h-6 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md cursor-pointer text-[9px] font-black border border-slate-200/60 dark:border-slate-800/80 flex items-center justify-center transition-all"
              title="0-9"
            >
              0-9
            </button>
            <button 
              onClick={() => showRetroAlert("Tri alphabétique par désignation actif", "Tri")}
              className="flex-1 h-6 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md cursor-pointer text-[9px] font-black border border-slate-200/60 dark:border-slate-800/80 flex items-center justify-center transition-all"
              title="A-Z"
            >
              A-Z
            </button>
          </div>
        </div>
      </div>

      {/* 3. Middle Code-Produit Input / Control Line - Modern Material 3 */}
      <div 
        className="mx-0.5 py-1 px-2 bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800 rounded-xl flex items-center justify-start gap-2 select-none shrink-0 overflow-hidden transition-all duration-300 h-10"
      >
        {/* Search input wrapped in a tight flex layout */}
        <div className="relative flex items-center shrink-0">
          <Search size={13} className="absolute left-2 text-slate-400" />
          <input
            type="text"
            placeholder="Saisir code barre ou désignation..."
            value={soldItemsSearchQuery}
            onChange={(e) => setSoldItemsSearchQuery(e.target.value)}
            className="w-56 h-7.5 pl-7 pr-2.5 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-lg font-sans text-xs focus:outline-none font-semibold focus:border-m3-primary dark:focus:border-sky-500"
          />
        </div>

        {/* Group containing navigator AND action buttons together, so they stay positioned beside each other without moving on resize */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {/* Table index navigator controls */}
          <div 
            className="flex items-center gap-0.5 h-7.5 bg-slate-50 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200/10 shrink-0 flex-nowrap"
          >
            <button
              onClick={selectFirstItem}
              className="w-6.5 h-6 font-bold hover:bg-slate-100 dark:hover:bg-slate-900 text-[10px] text-slate-700 dark:text-slate-300 rounded bg-white dark:bg-slate-950/20 cursor-pointer"
              title="Premier de la grille"
            >
              ⏮
            </button>
            <button
              onClick={selectPrevItem}
              className="w-6.5 h-6 font-bold hover:bg-slate-100 dark:hover:bg-slate-900 text-[10px] text-slate-700 dark:text-slate-300 rounded bg-white dark:bg-slate-950/20 cursor-pointer"
              title="Précédent de la grille"
            >
              ◀
            </button>
            <button
              onClick={selectNextItem}
              className="w-6.5 h-6 font-bold hover:bg-slate-100 dark:hover:bg-slate-900 text-[10px] text-slate-700 dark:text-slate-300 rounded bg-white dark:bg-slate-950/20 cursor-pointer"
              title="Suivant de la grille"
            >
              ▶
            </button>
            <button
              onClick={selectLastItem}
              className="w-6.5 h-6 font-bold hover:bg-slate-100 dark:hover:bg-slate-900 text-[10px] text-slate-700 dark:text-slate-300 rounded bg-white dark:bg-slate-950/20 cursor-pointer"
              title="Dernier de la grille"
            >
              ⏭
            </button>
          </div>

          <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />

          {/* Action buttons with Material 3 styling (permanently grouped beside navigator) */}
          <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
            <button
              onClick={handleInsertProduct}
              disabled={mode === 'view'}
              type="button"
              className="h-7.5 px-2.5 bg-gradient-to-br from-sky-500 to-sky-600 hover:opacity-95 text-white rounded-lg text-[9.5px] font-black tracking-wide flex items-center gap-1 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-100 cursor-pointer shrink-0 animate-pulse-once disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={12} /> Insérer [F7]
            </button>

            <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              onClick={handleEditPriceOrQty}
              disabled={mode === 'view' || selectedItemIndex === -1 || !draftItems[selectedItemIndex]}
              type="button"
              className="h-7.5 px-2.5 bg-gradient-to-br from-amber-500 to-amber-600 hover:opacity-95 text-white rounded-lg text-[9.5px] font-black tracking-wide flex items-center gap-1 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-100 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Edit size={12} /> Modifier [F8]
            </button>

            <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              onClick={handleDeleteItem}
              disabled={mode === 'view' || selectedItemIndex === -1 || !draftItems[selectedItemIndex]}
              type="button"
              className="h-7.5 px-2.5 bg-gradient-to-br from-rose-500 to-rose-600 hover:opacity-95 text-white rounded-lg text-[9.5px] font-black tracking-wide flex items-center gap-1 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-100 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Minus size={12} /> Supprimer [Supp]
            </button>

            <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

            <button
              onClick={() => {
                setTempObs(observations);
                setIsObsModalOpen(true);
              }}
              type="button"
              title="Observations"
              className={`h-7.5 w-7.5 flex items-center justify-center rounded-lg text-[10px] shadow-sm hover:scale-105 active:scale-95 transition-all duration-100 cursor-pointer border shrink-0 ${
                observations 
                  ? 'bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-700 font-bold' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
              }`}
            >
              <FileText size={13} />
            </button>

            {/* Supprimer registry button to delete registered vouchers */}
            {mode === 'view' && selectedSale && (
              <>
                <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />
                <button
                  onClick={handleDeleteSelectedVoucher}
                  type="button"
                  title="Supprimer définitivement ce bon de vente de la liste historique"
                  className="h-7.5 w-7.5 flex items-center justify-center rounded-lg text-[10px] shadow-sm hover:scale-105 active:scale-95 text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40 dark:hover:bg-rose-950 cursor-pointer shrink-0 transition-transform duration-100"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. Main grid list + right previews sidebar */}
      <div className="grid grid-cols-12 gap-3.5 mx-0.5 min-h-[160px] flex-1 mt-1">
        
        {/* Main Products Grid Table */}
        <div className={`col-span-8 flex flex-col border border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-950 shadow-inner rounded-2xl overflow-hidden transition-all duration-300 ${
          mode === 'view' 
            ? 'grayscale opacity-50 dark:opacity-30 bg-slate-200/30 dark:bg-black/20 pointer-events-none' 
            : ''
        }`}>
          <div 
            onClick={() => {
              setSelectedItemIndex(-1);
              setViewingItemCode('');
            }}
            className="flex-1 overflow-auto"
          >
            <table 
              onClick={(e) => e.stopPropagation()}
              className="w-full text-left font-sans text-xs border-collapse"
            >
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold select-none border-b border-slate-200/60 dark:border-slate-800/80 z-10">
                <tr>
                  <th className="w-10 px-3 py-2 text-center text-[10px] uppercase tracking-wider">N°</th>
                  <th className="w-28 px-3 py-2 font-mono text-[10px] uppercase tracking-wider">Code</th>
                  <th className="px-3 py-2 font-sans text-[10px] uppercase tracking-wider">Désignation</th>
                  <th className="w-14 px-1 py-2 text-center text-[10px] uppercase tracking-wider">Colis</th>
                  <th className="w-14 px-1 py-2 text-center text-[10px] uppercase tracking-wider">Colisage</th>
                  <th className="w-14 px-1 py-2 text-center text-[10px] uppercase tracking-wider">Pièces</th>
                  <th className="w-14 px-1 py-2 text-center text-[10px] uppercase tracking-wider">Qté</th>
                  <th className="w-24 px-3 py-2 text-right text-[10px] uppercase tracking-wider">P. Unit</th>
                  <th className="w-24 px-3 py-2 text-right text-[10px] uppercase tracking-wider">Montant</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-400 dark:text-slate-600 italic font-sans select-all">
                      {soldItemsSearchQuery ? "Aucun article correspondant à votre recherche." : "Aucun article enregistré pour ce bon. Cliquez sur \"Nouveau Bon\" puis \"Insérer Produit\"."}
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => {
                    const isSelected = selectedItemIndex === item.originalIndex;
                    const matchingProduct = products.find(p => p.code === item.code);
                    const isBlocked = matchingProduct?.blocked === true;
                    return (
                      <tr
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemIndex(item.originalIndex);
                          setViewingItemCode(item.code);
                        }}
                        className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/40 transition-colors ${
                          isSelected 
                            ? 'bg-m3-primary/10 dark:bg-sky-500/10 text-m3-primary dark:text-sky-300 font-bold' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-900/40 even:bg-slate-50/20 dark:even:bg-slate-950/20'
                        }`}
                      >
                        <td 
                          style={item.originalIndex === 0 || item.originalIndex === 1 ? { fontSize: '14px' } : undefined}
                          className="px-3 py-2 text-center select-none font-bold"
                        >
                          {item.originalIndex + 1}
                        </td>
                        <td 
                          style={{
                            ...(item.originalIndex === 0 || item.originalIndex === 1 ? { fontSize: '13px', fontFamily: 'Arial' } : {}),
                            ...(isBlocked ? { color: '#e11d48', fontWeight: 'bold' } : {})
                          }}
                          className={`px-3 py-2 font-mono text-[11px] truncate select-all ${isBlocked ? 'text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20 border-l-2 border-rose-500' : ''}`}
                        >
                          {item.code}
                        </td>
                        <td 
                          style={item.originalIndex === 0 || item.originalIndex === 1 ? { fontSize: '14px', fontFamily: 'Arial' } : undefined}
                          className="px-3 py-2 font-sans truncate select-all"
                        >
                          {item.designation}
                        </td>
                        <td 
                          style={item.originalIndex === 0 ? { fontSize: '13px' } : item.originalIndex === 1 ? { fontSize: '13px', fontFamily: 'Arial' } : undefined}
                          className="px-1 py-1 sm:py-2 text-center font-mono select-all text-slate-300/10 dark:text-slate-800/10"
                        >
                          {/* Colis is always blank */}
                        </td>
                        <td 
                          style={item.originalIndex === 0 || item.originalIndex === 1 ? { fontSize: '13px' } : undefined}
                          className="px-1 py-1 sm:py-2 text-center font-mono text-slate-300/10 dark:text-slate-800/10 select-all"
                        >
                          {/* Colisage is always blank */}
                        </td>
                        <td className="px-1 py-2 text-center font-mono select-all text-slate-300/10 dark:text-slate-800/10">
                          {/* Pièces is always blank */}
                        </td>
                        <td className={`px-1 py-2 text-center font-mono font-bold select-all ${isSelected ? 'text-m3-primary dark:text-sky-400' : 'text-slate-900 dark:text-slate-200'}`}>
                          {item.qty}
                        </td>
                        <td className="px-3 py-2 text-right font-mono select-all">
                          {(item.price ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-extrabold select-all">
                          {(item.total ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right pre-visual sidebar & ultimate bill fields */}
        <div className="col-span-4 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2 justify-start">
          
          {/* Money recaps list matching screenshot exactly */}
          <div className="flex flex-col gap-1.5 font-mono select-all text-xs">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-900">
              <span style={{ fontSize: '10.5px', fontFamily: 'Arial' }} className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[9px]">Montant Brut</span>
              <span style={{ fontSize: '11.5px', fontFamily: 'Arial' }} className="font-black text-slate-800 dark:text-slate-200">
                {(computedMetrics.rawAmount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-900">
              <span style={{ fontSize: '10.5px', fontFamily: 'Arial' }} className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[9px]">Remise (Dinars)</span>
              <input
                type="number"
                disabled={mode === 'view'}
                value={remise || ''}
                onChange={(e) => setRemise(Math.max(0, Number(e.target.value)))}
                style={{ fontSize: '11px', fontFamily: 'Arial' }}
                className="w-24 text-right bg-slate-50 dark:bg-slate-900 h-6 border border-slate-200 dark:border-slate-800 rounded px-1.5 text-red-600 font-extrabold outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-900">
              <span style={{ fontFamily: 'Arial', fontSize: '10.5px' }} className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[9px]">Total HT</span>
              <span style={{ fontSize: '11.5px', fontFamily: 'Arial' }} className="font-extrabold text-slate-800 dark:text-slate-200">
                {(computedMetrics.totalHT ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-900">
              <span style={{ fontSize: '10.5px', fontFamily: 'Arial' }} className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[9px]">TVA (19%)</span>
              <span style={{ fontSize: '11.5px', fontFamily: 'Arial' }} className="font-bold text-blue-900 dark:text-sky-400">
                {(computedMetrics.tva ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-900">
              <span style={{ fontSize: '10.5px', fontFamily: 'Arial' }} className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[9px]">TIMBRE FISCAL</span>
              <span style={{ fontSize: '11.5px', fontFamily: 'Arial' }} className="font-bold text-amber-700 dark:text-amber-450">
                {(computedMetrics.timbre ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
            </div>

            <div className="flex flex-col gap-0.5 py-1.5 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 mt-0.5">
              <div className="flex justify-between items-center w-full">
                <span style={{ fontSize: '11px', fontFamily: 'Arial' }} className="font-black text-blue-900 dark:text-sky-300 uppercase tracking-wide text-[9.5px]">Net à Payer (TTC)</span>
                <span style={{ fontSize: '12.5px', fontFamily: 'Arial' }} className="font-mono font-black text-blue-900 dark:text-sky-400 text-xs">
                  {(computedMetrics.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                </span>
              </div>
              {showBenefit && (
                <div className="flex justify-between items-center w-full pt-1 border-t border-dashed border-emerald-500/40 text-[9px] select-all">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Marge Bénéficiaire :</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-[10.5px]">
                    +{(totalBenefit ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </span>
                </div>
              )}
              {!showBenefit && (
                <div className="text-center text-[8px] text-slate-400 dark:text-slate-500 italic pt-0.5 border-t border-slate-200/40 dark:border-slate-800/40 select-none">
                  Appuyez sur <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-300">Ctrl + B</kbd> pour afficher la marge.
                </div>
              )}
            </div>
          </div>

          {/* Totals Sub-Window- Sticky to place without mt-auto pushing it with resize */}
          <div className="bg-slate-950 dark:bg-black p-4 rounded-xl text-center flex flex-col gap-1.5 shadow-xl border border-slate-800 mt-2 shrink-0 select-all">
            <span className="text-[11px] font-bold text-amber-400 tracking-widest font-display uppercase leading-none">
              NET EN DINARS (TTC À PAYER)
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-[#10b981] dark:text-[#34d399] tracking-tight drop-shadow-[0_0_10px_rgba(52,211,153,0.6)] mt-1">
              {(computedMetrics.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
            </span>
          </div>
        </div>
      </div>

      </div>

      {/* Observations Dialog Modal */}
      {isObsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[1001] p-4 text-xs">
          <div className="w-[450px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header of the dialog */}
            <div className="bg-[#1e293b] dark:bg-slate-950 px-5 py-4 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 text-white font-bold font-display text-sm">
                <FileText size={15} /> Notes sur le bon
              </div>
              <button
                onClick={() => setIsObsModalOpen(false)}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observations / Notes du bon</label>
                <textarea
                  value={tempObs}
                  onChange={(e) => setTempObs(e.target.value)}
                  placeholder="Saisissez vos observations sur le bon..."
                  className="w-full h-28 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-sans text-xs focus:outline-none focus:border-m3-primary dark:focus:border-sky-500 resize-none text-slate-800 dark:text-slate-100"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsObsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all cursor-pointer text-[11px]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setObservations(tempObs);
                    setIsObsModalOpen(false);
                    if (mode === 'view' && selectedSale) {
                      const updatedSale = {
                        ...selectedSale,
                        observations: tempObs
                      };
                      onUpdateSale(selectedSale.id, updatedSale);
                    }
                  }}
                  className="px-5 py-2 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:opacity-95 text-white rounded-xl font-black shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-[11px]"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Chooser Dialog Modal */}
      {isProductChooserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 text-xs">
          <div className="w-[850px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header of the dialog */}
            <div className="bg-m3-primary dark:bg-slate-950 px-5 py-3 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 text-white font-bold font-display text-sm">
                <Package size={15} /> Sélectionner un produit à vendre
              </div>
              <button
                onClick={() => setIsProductChooserOpen(false)}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Inner Content */}
            <div className="p-3.5 flex flex-col gap-2 select-none">
              
              {/* Search Bar inside Chooser */}
              <div className="flex flex-col gap-1.5">
                <span className="font-extrabold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Filtrer les articles de la base:</span>
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Saisissez le nom d'un produit, la référence ou scannez son code-barres..."
                    value={chooserSearchQuery}
                    onChange={(e) => setChooserSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-sans text-xs focus:outline-none focus:border-m3-primary dark:focus:border-sky-500 animate-pulse-once"
                  />
                </div>
              </div>

              {/* Scrollable list of products */}
              <div 
                onClick={() => setSelectedProductInChooser(null)}
                className="border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-950 h-[420px] overflow-auto shadow-inner rounded-2xl"
              >
                <table 
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-left font-sans text-xs border-collapse table-fixed"
                >
                  <thead className="bg-[#dfdfde]/40 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold sticky top-0 border-b border-slate-200/60 dark:border-slate-800/80 z-10 select-none">
                    <tr>
                      <th style={{ width: colWidths.code }} className="px-3 py-2 relative select-none truncate font-display text-[9.5px] uppercase tracking-wider">Code-barres</th>
                      <th style={{ width: colWidths.designation }} className="px-3 py-2 relative select-none truncate font-display text-[9.5px] uppercase tracking-wider">Designation de l'article</th>
                      <th style={{ width: colWidths.prixUnitaire }} className="px-3 py-2 text-right relative select-none truncate font-display text-[9.5px] uppercase tracking-wider">Prix Unitaire</th>
                      <th style={{ width: colWidths.prixAchat }} className="px-3 py-2 text-right relative select-none truncate font-display text-[9.5px] uppercase tracking-wider">Prix d'Achat</th>
                      <th style={{ width: colWidths.prixRevient }} className="px-3 py-2 text-right relative select-none truncate font-display text-[9.5px] uppercase tracking-wider">Prix de Revient</th>
                      <th style={{ width: colWidths.stock }} className="px-3 py-2 text-center relative select-none truncate font-display text-[9.5px] uppercase tracking-wider">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChooserProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                          Aucun produit trouvé dans votre base.
                        </td>
                      </tr>
                    ) : (
                      filteredChooserProducts.map((p) => {
                        const isChosenTmp = selectedProductInChooser?.code === p.code;
                        const liveStock = effectiveStockMap.get(p.code) ?? p.stock;
                        return (
                          <tr
                            key={p.code}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (p.blocked) {
                                showRetroAlert(`⚠️ Impossible d'insérer l'article : Le produit "${p.designation}" est BLOQUÉ !`, "Article Bloqué");
                                return;
                              }
                              if (selectedProductInChooser?.code === p.code) {
                                // Second click: open the configuration popup!
                                setChooserQty(1);
                                setSelectedPriceType('prixVente1');
                                setCustomSellingPrice(p.prixVente1);
                                setIsConfigPopupOpen(true);
                              } else {
                                // First click: just select/highlight
                                setSelectedProductInChooser(p);
                              }
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (p.blocked) {
                                showRetroAlert(`⚠️ Impossible d'insérer l'article : Le produit "${p.designation}" est BLOQUÉ !`, "Article Bloqué");
                                return;
                              }
                              setSelectedProductInChooser(p);
                              setChooserQty(1);
                              setSelectedPriceType('prixVente1');
                              setCustomSellingPrice(p.prixVente1);
                              setIsConfigPopupOpen(true);
                            }}
                            className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/40 h-8.5 transition-colors ${
                              isChosenTmp 
                                ? 'bg-indigo-600/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-extrabold border-l-2 border-l-indigo-600 dark:border-l-indigo-400' 
                                : p.blocked 
                                  ? 'bg-rose-50/20 dark:bg-rose-950/10 text-rose-600 dark:text-rose-450'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <td 
                              style={{ width: colWidths.code, maxWidth: colWidths.code }} 
                              className={`px-3 py-1.5 font-mono text-[11px] truncate ${p.blocked ? 'text-red-600 dark:text-red-400 font-extrabold bg-red-50 dark:bg-red-950/30' : ''}`}
                            >
                              {p.code}
                            </td>
                            <td style={{ width: colWidths.designation, maxWidth: colWidths.designation }} className="px-3 py-1.5 font-sans truncate">
                              {p.designation}
                            </td>
                            <td style={{ width: colWidths.prixUnitaire, maxWidth: colWidths.prixUnitaire }} className="px-3 py-1.5 text-right font-mono font-bold truncate">
                              {(p.prixVente1 ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                            </td>
                            <td style={{ width: colWidths.prixAchat, maxWidth: colWidths.prixAchat }} className="px-3 py-1.5 text-right font-mono text-slate-400 dark:text-slate-500 truncate">
                              {(p.prixAchat || p.prixDeRevient || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                            </td>
                            <td style={{ width: colWidths.prixRevient, maxWidth: colWidths.prixRevient }} className="px-3 py-1.5 text-right font-mono text-slate-400 dark:text-slate-500 truncate">
                              {(p.prixDeRevient || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                            </td>
                            <td 
                              style={{ width: colWidths.stock, maxWidth: colWidths.stock }} 
                              className={`px-3 py-1.5 text-center font-mono font-bold truncate ${
                                liveStock <= 0 
                                  ? 'text-rose-600 dark:text-rose-400 font-extrabold' 
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {liveStock}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Footer actions of popup */}
            <div className="bg-slate-50 dark:bg-slate-950 py-2 px-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 select-none">
              <button
                type="button"
                onClick={() => setIsProductChooserOpen(false)}
                className="px-5 h-7 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-300/30 rounded-lg transition-all cursor-pointer"
              >
                Fermer (Echap)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. Payment Mode Dialogue (Mode de Règlement / Fermeture de Bon) */}
      {isPaymentDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 text-xs font-sans text-slate-950 select-none">
          <div className="w-[520px] max-w-full bg-white dark:bg-slate-900 border border-slate-200/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Title Bar */}
            <div className="bg-m3-primary dark:bg-slate-950 px-5 py-4 flex items-center justify-between select-none">
              <span className="text-white font-bold font-display text-sm flex items-center gap-2">
                <Coins size={15} /> Saisie du Règlement & Fermeture
              </span>
              <button 
                onClick={() => setIsPaymentDialogOpen(false)}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Dropdown Select Mode */}
            <div className="p-4 px-5 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wide">Mode de règlement:</span>
              <select
                value={paymentMode}
                onChange={(e) => {
                  const modeVal = e.target.value as 'ESPECE' | 'A_TERME';
                  setPaymentMode(modeVal);
                  if (modeVal === 'A_TERME') {
                    setPaymentVersement(0);
                  } else {
                    setPaymentVersement(Number((computedMetrics.ttc).toFixed(2)));
                  }
                }}
                className="flex-1 max-w-[240px] h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold px-3 outline-none text-xs text-m3-primary dark:text-sky-400"
              >
                <option value="ESPECE">ESPÈCE / COMPTANT</option>
                <option value="A_TERME">A TERME (CRÉDIT COMPTE)</option>
              </select>
            </div>

            {/* Main Fields block */}
            <div className="p-5 flex flex-col md:flex-row gap-4 flex-1">
              
              {/* Left Column (Balances Calculations) */}
              <div className="flex-1 flex flex-col gap-2.5 p-4 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-300/10 rounded-2xl shadow-xs">
                
                {/* Previous client balance */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wide">Ancien Solde:</span>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 font-mono font-bold text-xs text-slate-700 dark:text-slate-300 rounded-lg min-w-[120px] text-right">
                    {(computedMetrics.oldBalance ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </div>
                </div>

                {/* Amount of current voucher */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-m3-primary dark:text-sky-400 text-[10px] uppercase tracking-wide">Net à Payer:</span>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 font-mono font-black text-xs text-m3-primary dark:text-sky-400 rounded-lg min-w-[120px] text-right">
                    {(computedMetrics.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </div>
                </div>

                {/* Total balance accumulated */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                  <span className="font-bold text-indigo-900 dark:text-indigo-400 text-[10px] uppercase tracking-wide">Amortissement total:</span>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 font-mono font-bold text-xs text-indigo-950 dark:text-indigo-300 rounded-lg min-w-[120px] text-right">
                    {((computedMetrics.oldBalance ?? 0) + (computedMetrics.ttc ?? 0)).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </div>
                </div>

                {/* Input for versement */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-rose-500 text-[10px] uppercase tracking-wide">Versement direct:</span>
                  <input
                    type="number"
                    value={paymentVersement || ''}
                    onChange={(e) => setPaymentVersement(Number(e.target.value) || 0)}
                    disabled={paymentMode === 'A_TERME'}
                    className={`w-[120px] h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-xs outline-none ${
                      paymentMode === 'A_TERME' ? 'opacity-40 cursor-not-allowed' : 'focus:border-rose-500'
                    }`}
                    autoFocus={paymentMode !== 'A_TERME'}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Calculated new rest balance */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-[10px] uppercase tracking-wide">Nouveau Solde Tiers:</span>
                  <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-950 font-mono font-black text-xs text-rose-600 dark:text-rose-400 rounded-lg min-w-[120px] text-right">
                    {(((computedMetrics.oldBalance ?? 0) + (computedMetrics.ttc ?? 0)) - paymentVersement).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
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
                      className="w-full h-8.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold px-2 px-3 outline-none text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="CAISSE PRINCIPALE">CAISSE PRINCIPALE</option>
                      <option value="COFFRE N°1">COFFRE N°1</option>
                      <option value="COFFRE N°2">COFFRE N°2</option>
                    </select>
                  </>
                )}
                
                <div className="mt-auto bg-slate-100 dark:bg-slate-950/60 p-3.5 rounded-xl text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed border border-slate-200/10">
                  Veuillez spécifier le montant effectivement perçu. Le reste sera imputé au registre crédit de la fiche tierce.
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 px-5 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 select-none">
              <button
                type="button"
                onClick={() => setIsPaymentDialogOpen(false)}
                className="px-5 h-9 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <X size={14} /> Fermer
              </button>

              <button
                type="button"
                onClick={() => handleConfirmPaymentAndSaveVoucher()}
                className="px-6 h-9 text-xs font-black bg-m3-primary text-white rounded-full shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer justify-center"
              >
                <Check size={14} /> Enregistrer Bon (F5)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Custom delete confirmation modal */}
      {isDeleteConfirmOpen && selectedSale && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 select-none animate-in fade-in zoom-in duration-100">
          <div className="bg-white dark:bg-slate-900 w-[450px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            {/* Modal Title bar */}
            <div className="bg-gradient-to-r from-rose-500/10 to-rose-600/15 p-4 pb-3 flex items-center gap-3">
              <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400" />
              <div>
                <h3 className="font-sans font-black text-xs text-rose-800 dark:text-rose-400 uppercase tracking-wider">
                  Confirmation de suppression
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">Cette action est définitive et irréversible</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex flex-col gap-3 font-sans text-xs text-slate-705 dark:text-slate-300">
              <p className="leading-relaxed">
                Voulez-vous vraiment supprimer le <strong className="text-blue-900 dark:text-sky-450">Bon de Vente N° {selectedSale.id}</strong> définitivement ?
              </p>
              
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-250/20 p-3 rounded-2xl flex flex-col gap-1 text-[11px] leading-relaxed select-text font-mono text-rose-700 dark:text-rose-400">
                <div className="flex justify-between">
                  <span>Client :</span>
                  <span className="font-bold">{selectedSale.client}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date / Heure :</span>
                  <span>{selectedSale.date} à {selectedSale.time}</span>
                </div>
                <div className="flex justify-between border-t border-rose-200/30 pt-1 mt-1 font-bold">
                  <span>Montant TTC :</span>
                  <span>{(selectedSale.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal flex gap-1.5 items-start">
                <Lightbulb size={12} className="text-amber-500 shrink-0 mt-0.5" />
                <span>Les stocks correspondants seront automatiquement re-crédités dans la base de données, et le solde du client sera ré-ajusté de manière transparente.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-5 h-9 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteVoucher}
                className="px-6 h-9 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer animate-in zoom-in justify-center"
              >
                <Trash2 size={13} /> Oui, Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Client Selector & Creation Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[10005] p-4 select-none">
          <div className="w-[740px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header of the dialog */}
            <div className="bg-gradient-to-r from-sky-800 to-sky-900 dark:from-slate-950 dark:to-slate-900 px-5 py-4 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 text-white font-bold font-display text-sm">
                <Users size={15} /> Fichier Clients & Sélection Directe
              </div>
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Main content grid */}
            <div className="p-5 flex flex-col md:flex-row gap-5 overflow-hidden max-h-[70vh]">
              
              {/* LEFT COLUMN: Select Client */}
              <div className="flex-1 flex flex-col gap-3 min-w-[320px]">
                <div className="flex flex-col gap-1">
                  <h4 className="font-extrabold text-[10px] text-sky-800 dark:text-sky-400 uppercase tracking-wide">
                    Sélectionner un Client Existant
                  </h4>
                  <div className="relative select-text">
                    <input
                      type="text"
                      placeholder="Rechercher par nom ou code..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-sky-500 font-sans font-bold"
                    />
                    <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>

                {/* Clients list */}
                <div className="flex-1 overflow-y-auto border border-slate-150 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 divide-y divide-slate-100 dark:divide-slate-850 max-h-[300px] select-text">
                  {/* Default Anonyme client item */}
                  {('Anonyme'.toLowerCase().includes(clientSearchQuery.toLowerCase()) || 'Client Anonyme'.toLowerCase().includes(clientSearchQuery.toLowerCase())) && (
                    <div
                      onClick={() => handleSelectClient('Anonyme')}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        newClientName === 'Anonyme'
                          ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-400 font-extrabold border-l-4 border-sky-500'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-xs text-sky-600 dark:text-sky-400"><UserIcon size={12} /></div>
                        <div>
                           <div className="font-bold">ANONYME</div>
                           <div className="text-[9px] text-slate-400 font-mono">Client de comptoir</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 font-mono">0 DA</span>
                      </div>
                    </div>
                  )}

                  {/* Filtered Clients list */}
                  {filteredClients.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectClient(c.name)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        newClientName === c.name
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 font-extrabold border-l-4 border-emerald-500'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-slate-150 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-600 dark:text-slate-450"><UserIcon size={12} /></div>
                        <div>
                          <div className="font-bold">{c.name}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{c.code} {c.contact ? `• ${c.contact}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold font-mono ${(c.balance ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {(c.balance ?? 0).toLocaleString('fr-FR')} DA
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Empty state */}
                  {filteredClients.length === 0 && !'Anonyme'.toLowerCase().includes(clientSearchQuery.toLowerCase()) && (
                    <div className="p-8 text-center text-slate-400">
                      Aucun client trouvé pour "{clientSearchQuery}"
                    </div>
                  )}
                </div>

                {mode !== 'create' && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl text-[10px] text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                    ⚠️ Vous visualisez actuellement un bon validé. Pour changer le client, veuillez cliquer sur <strong>"Nouveau bon"</strong> ou <strong>"Modifier le bon"</strong>.
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Create Client */}
              <div className="w-full md:w-[260px] flex flex-col gap-3.5 border-t md:border-t-0 md:border-l border-slate-150 dark:border-slate-800 pt-4 md:pt-0 md:pl-5 select-text">
                <h4 className="font-extrabold text-[10px] text-sky-800 dark:text-sky-400 uppercase tracking-wide">
                  Ajouter un Nouveau Client
                </h4>

                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Nom du Client *</label>
                    <input
                      type="text"
                      placeholder="Ex: Ets Ahmed & Fils"
                      value={clientFormName}
                      onChange={(e) => setClientFormName(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-sky-500 font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Téléphone</label>
                    <input
                      type="text"
                      placeholder="Ex: 0550 12 34 56"
                      value={clientFormPhone}
                      onChange={(e) => setClientFormPhone(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Adresse</label>
                    <input
                      type="text"
                      placeholder="Ex: Alger Centre"
                      value={clientFormAddress}
                      onChange={(e) => setClientFormAddress(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Solde de départ (DA)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={clientFormBalance}
                      onChange={(e) => setClientFormBalance(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:border-sky-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateClient}
                  className="w-full h-9 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-[11px] rounded-lg shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Plus size={14} />
                  {mode === 'create' ? 'Créer & Associer' : 'Créer Client'}
                </button>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="px-5 h-8 text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Product Configuration Pop-up Modal */}
      {isConfigPopupOpen && selectedProductInChooser && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 select-none animate-in fade-in duration-150">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedProductInChooser) {
                const qty = chooserQty === '' ? 1 : Number(chooserQty);
                const price = customSellingPrice === '' ? 0 : Number(customSellingPrice);
                insertProductDirectly(selectedProductInChooser, qty, price);
              }
            }}
            className="w-[500px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-850 dark:from-slate-950 dark:to-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex flex-col text-white font-sans">
                <span className="font-extrabold text-sm flex items-center gap-1.5">
                  <Edit3 size={15} /> Configuration d'Ajout d'Article
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigPopupOpen(false)}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col gap-4 select-text">
              {/* Product Info Banner */}
              <div className="bg-teal-50/40 dark:bg-teal-950/10 border border-teal-100/30 rounded-2xl p-3 flex justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-teal-600 dark:text-teal-450 tracking-wider">Désignation de l'article</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">{selectedProductInChooser.designation}</span>
                </div>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[9px] font-black uppercase text-teal-600 dark:text-teal-450 tracking-wider">Référence (Code)</span>
                  <span className="text-sm font-mono font-black text-slate-900 dark:text-slate-100 mt-0.5">{selectedProductInChooser.code}</span>
                </div>
              </div>

              {/* Grid for Stock & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                {/* Stock Actuel (read-only) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide flex items-center gap-1"><Package size={11} className="text-slate-400" /> Stock Actuel</span>
                  <div className="h-9.5 px-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 rounded-xl flex items-center font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                    {selectedProductInChooser.stock - (chooserQty === '' ? 0 : Number(chooserQty))} unités
                  </div>
                </div>

                {/* Quantité à vendre (editable) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide">🔢 Quantité à vendre</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={chooserQty}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setChooserQty('');
                      } else {
                        setChooserQty(Number(val));
                      }
                    }}
                    className="h-9.5 px-3 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-full focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>
              </div>

              {/* Predefined Prices Buttons */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide">🏷️ Choix du Tarif de Vente (PV)</span>
                <div className="flex gap-2 h-10 select-none">
                  {[
                    { key: 'prixVente1', label: 'PV1 (Détail)' },
                    { key: 'prixVente2', label: 'PV2 (Gros)' },
                    { key: 'prixVente3', label: 'PV3 (Super Gros)' }
                  ].map((item) => {
                    const priceVal = Number(selectedProductInChooser[item.key as keyof Product]) || 0;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setSelectedPriceType(item.key as any);
                          setCustomSellingPrice(priceVal);
                        }}
                        className={`flex-1 text-[10px] font-sans font-extrabold border rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedPriceType === item.key
                            ? 'bg-teal-600 border-teal-600 text-white shadow-sm scale-102 font-black'
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                        }`}
                      >
                        <span className="text-[8px] opacity-75">{item.label}</span>
                        <span className="font-mono mt-0.5">{(priceVal ?? 0).toLocaleString('fr-FR')} DA</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid for Buy Price & Final Sell Price */}
              {(() => {
                const hasRevient = typeof selectedProductInChooser.prixDeRevient === 'number' && 
                                    selectedProductInChooser.prixDeRevient > 0 && 
                                    selectedProductInChooser.prixDeRevient !== selectedProductInChooser.prixAchat;
                return (
                  <div className={`grid ${hasRevient ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                    {/* Prix d'Achat (not editable) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide flex items-center gap-1"><Coins size={11} className="text-slate-400" /> Prix d'Achat</span>
                      <div className="h-9.5 px-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center font-mono font-bold text-slate-500 dark:text-slate-500 text-xs select-none">
                        {(selectedProductInChooser.prixAchat || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                      </div>
                    </div>

                    {/* Prix de Revient (not editable, only shown if different from Prix d'Achat) */}
                    {hasRevient && (
                      <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide flex items-center gap-1"><RefreshCw size={11} className="text-slate-400" /> Prix de Revient</span>
                        <div className="h-9.5 px-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center font-mono font-bold text-slate-500 dark:text-slate-500 text-xs select-none">
                          {(selectedProductInChooser.prixDeRevient || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                        </div>
                      </div>
                    )}

                    {/* Prix de Vente Final (editable) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wide flex items-center gap-1"><Coins size={11} className="text-rose-500" /> Prix de Vente Final</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={customSellingPrice}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          if (valStr === '') {
                            setCustomSellingPrice('');
                          } else {
                            const val = Number(valStr);
                            setCustomSellingPrice(val);
                            if (val !== selectedProductInChooser.prixVente1 && 
                                val !== selectedProductInChooser.prixVente2 && 
                                val !== selectedProductInChooser.prixVente3) {
                              setSelectedPriceType('' as any);
                            }
                          }
                        }}
                        className="h-9.5 px-3 font-mono font-black rounded-xl border border-rose-350 focus:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 w-full focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Benefit Box */}
              {(() => {
                const purchasePrice = selectedProductInChooser.prixDeRevient || selectedProductInChooser.prixAchat || 0;
                const price = customSellingPrice === '' ? 0 : Number(customSellingPrice);
                const qty = chooserQty === '' ? 1 : Number(chooserQty);
                const unitBenefit = price - purchasePrice;
                const totalBenefit = unitBenefit * qty;
                const isLoss = unitBenefit < 0;

                return (
                  <div className={`border rounded-2xl p-3 flex flex-col justify-between transition-colors duration-150 ${
                    isLoss 
                      ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-150 dark:border-rose-900/30' 
                      : 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-150 dark:border-emerald-900/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${isLoss ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isLoss ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle size={12} className="text-rose-600" /> Perte Estimée
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Coins size={12} className="text-emerald-600 dark:text-emerald-450" /> Bénéfice Estimé
                          </span>
                        )}
                      </span>
                      <span className="text-[8px] font-sans font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">
                        {qty} unité(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2 font-mono">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Par Unité</span>
                        <span className={`text-xs font-black ${isLoss ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {(unitBenefit ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Total</span>
                        <span className={`text-sm font-black ${isLoss ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {(totalBenefit ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfigPopupOpen(false)}
                className="px-5 h-9 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 h-9 text-xs font-black bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Insérer au Bon
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- IN-APP ITEM EDIT (PRICE/QTY) MODAL -------------------- */}
      {isItemEditModalOpen && editModalIndex !== -1 && (() => {
        const currentItem = draftItems[editModalIndex];
        if (!currentItem) return null;

        const matchingProduct = products.find(p => p.code === currentItem.code);
        if (!matchingProduct) return null;

        const purchasePrice = matchingProduct.prixDeRevient || matchingProduct.prixAchat || 0;
        const hasRevient = typeof matchingProduct.prixDeRevient === 'number' && 
                            matchingProduct.prixDeRevient > 0 && 
                            matchingProduct.prixDeRevient !== matchingProduct.prixAchat;

        const availableStockBeforeThisItem = matchingProduct.stock + currentItem.qty;
        const projectedStockAfterThisItem = availableStockBeforeThisItem - (editModalQty === '' ? 0 : Number(editModalQty));

        const price = editModalPrice === '' ? 0 : Number(editModalPrice);
        const qty = editModalQty === '' ? 1 : Number(editModalQty);
        const unitBenefit = price - purchasePrice;
        const totalBenefit = unitBenefit * qty;
        const isLoss = unitBenefit < 0;

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 select-none animate-in fade-in duration-150">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newQty = editModalQty === '' ? 1 : Number(editModalQty);
                const newPrice = editModalPrice === '' ? 0 : Number(editModalPrice);

                if (isNaN(newQty) || newQty <= 0) {
                  showRetroAlert("La quantité doit être supérieure à 0.", "Quantité invalide");
                  return;
                }
                if (isNaN(newPrice) || newPrice < 0) {
                  showRetroAlert("Le prix ne peut pas être négatif.", "Prix invalide");
                  return;
                }

                // Check stock warning
                if (projectedStockAfterThisItem <= 0 && availableStockBeforeThisItem > 0) {
                  showRetroConfirm(
                    `⚠️ Stock Épuisé : La modification amènera le produit "${currentItem.designation}" à un stock de ${projectedStockAfterThisItem}.\n\nVoulez-vous modifier quand même ?`,
                    () => {
                      const updated = [...draftItems];
                      const colisage = currentItem.colisage || 12;
                      updated[editModalIndex] = {
                        ...currentItem,
                        qty: newQty,
                        price: newPrice,
                        total: newQty * newPrice,
                        nbreColis: Math.floor(newQty / colisage),
                        pieces: newQty % colisage
                      };
                      setDraftItems(updated);
                      adjustProductStockInParent(currentItem.code, currentItem.qty - newQty);
                      setIsItemEditModalOpen(false);
                    },
                    "Stock Épuisé"
                  );
                  return;
                }

                // Normal update
                const updated = [...draftItems];
                const colisage = currentItem.colisage || 12;
                updated[editModalIndex] = {
                  ...currentItem,
                  qty: newQty,
                  price: newPrice,
                  total: newQty * newPrice,
                  nbreColis: Math.floor(newQty / colisage),
                  pieces: newQty % colisage
                };
                setDraftItems(updated);
                adjustProductStockInParent(currentItem.code, currentItem.qty - newQty);
                setIsItemEditModalOpen(false);
              }}
              className="w-[500px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-teal-700 to-teal-850 dark:from-slate-950 dark:to-slate-900 px-5 py-4 flex items-center justify-between">
                <div className="flex flex-col text-white font-sans">
                  <span className="font-extrabold text-sm flex items-center gap-1.5">
                    <Edit3 size={15} /> Configuration d'Ajout d'Article
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsItemEditModalOpen(false)}
                  className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col gap-4 select-text">
                {/* Product Info Banner */}
                <div className="bg-teal-50/40 dark:bg-teal-950/10 border border-teal-100/30 rounded-2xl p-3 flex justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-teal-600 dark:text-teal-450 tracking-wider">Désignation de l'article</span>
                    <span className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">{matchingProduct.designation}</span>
                  </div>
                  <div className="flex flex-col text-right shrink-0">
                    <span className="text-[9px] font-black uppercase text-teal-600 dark:text-teal-450 tracking-wider">Référence (Code)</span>
                    <span className="text-sm font-mono font-black text-slate-900 dark:text-slate-100 mt-0.5">{matchingProduct.code}</span>
                  </div>
                </div>

                {/* Grid for Stock & Quantity */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Stock Actuel (read-only) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide flex items-center gap-1">
                      <Package size={11} className="text-slate-400" /> Stock Actuel
                    </span>
                    <div className="h-9.5 px-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 rounded-xl flex items-center font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                      {projectedStockAfterThisItem} unités
                    </div>
                  </div>

                  {/* Quantité à vendre (editable) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide">🔢 Quantité à vendre</span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editModalQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditModalQty(val === '' ? '' : Number(val));
                      }}
                      className="h-9.5 px-3 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-full focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                </div>

                {/* Predefined Prices Buttons */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide">🏷️ Choix du Tarif de Vente (PV)</span>
                  <div className="flex gap-2 h-10 select-none">
                    {[
                      { key: 'prixVente1', label: 'PV1 (Détail)' },
                      { key: 'prixVente2', label: 'PV2 (Gros)' },
                      { key: 'prixVente3', label: 'PV3 (Super Gros)' }
                    ].map((item) => {
                      const priceVal = Number(matchingProduct[item.key as keyof Product]) || 0;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setEditPriceType(item.key as any);
                            setEditModalPrice(priceVal);
                          }}
                          className={`flex-1 text-[10px] font-sans font-extrabold border rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                            editPriceType === item.key
                              ? 'bg-teal-600 border-teal-600 text-white shadow-sm scale-102 font-black'
                              : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                          }`}
                        >
                          <span className="text-[8px] opacity-75">{item.label}</span>
                          <span className="font-mono mt-0.5">{(priceVal ?? 0).toLocaleString('fr-FR')} DA</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid for Buy Price & Final Sell Price */}
                <div className={`grid ${hasRevient ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                  {/* Prix d'Achat (not editable) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide flex items-center gap-1">
                      <Coins size={11} className="text-slate-400" /> Prix d'Achat
                    </span>
                    <div className="h-9.5 px-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center font-mono font-bold text-slate-500 dark:text-slate-500 text-xs select-none">
                      {(matchingProduct.prixAchat || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                    </div>
                  </div>

                  {/* Prix de Revient (not editable, only shown if different from Prix d'Achat) */}
                  {hasRevient && (
                    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wide flex items-center gap-1">
                        <RefreshCw size={11} className="text-slate-400" /> Prix de Revient
                      </span>
                      <div className="h-9.5 px-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center font-mono font-bold text-slate-500 dark:text-slate-500 text-xs select-none">
                        {(matchingProduct.prixDeRevient || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                      </div>
                    </div>
                  )}

                  {/* Prix de Vente Final (editable) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wide flex items-center gap-1">
                      <Coins size={11} className="text-rose-500" /> Prix de Vente Final
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={editModalPrice}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        if (valStr === '') {
                          setEditModalPrice('');
                        } else {
                          const val = Number(valStr);
                          setEditModalPrice(val);
                          if (val !== matchingProduct.prixVente1 && 
                              val !== matchingProduct.prixVente2 && 
                              val !== matchingProduct.prixVente3) {
                            setEditPriceType('' as any);
                          }
                        }
                      }}
                      className="h-9.5 px-3 font-mono font-black rounded-xl border border-rose-350 focus:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 w-full focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Benefit Box */}
                <div className={`border rounded-2xl p-3 flex flex-col justify-between transition-colors duration-150 ${
                  isLoss 
                    ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-150 dark:border-rose-900/30' 
                    : 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-150 dark:border-emerald-900/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isLoss ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {isLoss ? (
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={12} className="text-rose-600" /> Perte Estimée
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Coins size={12} className="text-emerald-600 dark:text-emerald-450" /> Bénéfice Estimé
                        </span>
                      )}
                    </span>
                    <span className="text-[8px] font-sans font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">
                      {qty} unité(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2 font-mono">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Par Unité</span>
                      <span className={`text-xs font-black ${isLoss ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {(unitBenefit ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Total</span>
                      <span className={`text-sm font-black ${isLoss ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {(totalBenefit ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsItemEditModalOpen(false)}
                  className="px-5 h-9 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 h-9 text-xs font-black bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Insérer au Bon
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* -------------------- CUSTOM CONFIRM / ALERT DIALOG BOX -------------------- */}
      {retroDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 flex items-center justify-center z-[100100] p-4 backdrop-blur-[2px] select-none">
          <div className="w-[420px] max-w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-150">
            
            {/* Dialog Title Bar */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-slate-850 dark:text-slate-200">
                <MessageSquare size={14} className="text-slate-500" />
                <span className="tracking-wide text-xs uppercase">{retroDialog.title}</span>
              </span>
              <button
                onClick={() => setRetroDialog(prev => ({ ...prev, isOpen: false }))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Dialog Contents */}
            <div className="p-5 flex gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 items-start select-text leading-relaxed bg-white dark:bg-slate-900 m-1">
              {/* Icon */}
              <div className="select-none flex-shrink-0 mt-0.5">
                {retroDialog.type === 'confirm' ? (
                  <HelpCircle size={24} className="text-sky-500" />
                ) : (
                  <AlertTriangle size={24} className="text-amber-500" />
                )}
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

      {/* -------------------- INVOICE PRINT PREVIEW MODAL (A4 PAPER SPECIFICATION) -------------------- */}
      {isFacturePreviewOpen && createPortal(
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
              #print-invoice-sheet {
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
                <Printer size={18} className="text-sky-400" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">Aperçu avant impression</h4>
                  <p className="text-[10px] text-slate-300 font-medium">Facture de Vente au format A4</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Printer size={13} /> Imprimer la Facture
                </button>
                <button
                  type="button"
                  onClick={() => setIsFacturePreviewOpen(false)}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <X size={13} /> Fermer
                </button>
              </div>
            </div>

            {/* A4 Printable Sheet */}
            <div 
              id="print-invoice-sheet"
              className="w-[794px] min-h-[1123px] bg-white text-black p-12 relative shadow-2xl rounded-sm font-sans flex flex-col justify-between print:shadow-none print:p-0 print:w-full print:min-h-0 print:bg-white"
            >
              <div>
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                  {/* Left: Company & Seller */}
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
                      Vendeur :<span className="font-semibold text-slate-700"> {currentUser?.username || previewData.vendeur || 'admin'}</span>
                    </p>
                  </div>

                  {/* Right: Beautiful logo box matching Capture d’écran */}
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

                {/* Subtitle / Document Title & Client Box */}
                <div className="grid grid-cols-12 gap-4 items-end mb-4">
                  {/* Title and ID */}
                  <div className="col-span-7 text-left pb-2">
                    <h2 className="text-lg font-black tracking-tight text-black uppercase leading-none select-text">
                      {factureType === 'proforma' ? 'FACTURE PROFORMA' : 'FACTURE'} N°{previewData.id.padStart(5, '0')}/{previewData.date.split('/')[2] || new Date().getFullYear().toString()}
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 block mt-1">PAGE : 1</span>
                  </div>

                  {/* Client "DOIT" box matching exactly image.png */}
                  <div className="col-span-5 flex flex-col items-start font-sans">
                    <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider mb-1 leading-none">DOIT :</span>
                    <div className="w-full border border-black rounded-lg p-3 min-h-[75px] text-left select-text">
                      <h4 className="font-black text-xs uppercase leading-snug">{previewData.clientName}</h4>
                      {(previewData.clientObj?.address || (previewData.clientName?.toLowerCase() === 'anonyme' && config?.invoiceInfo?.adresse)) && (
                        <p className="text-[10px] text-slate-600 mt-1 font-medium leading-tight">
                          {previewData.clientName?.toLowerCase() === 'anonyme'
                            ? (config?.invoiceInfo?.adresse || '')
                            : (previewData.clientObj?.address || '')}
                        </p>
                      )}
                      {previewData.clientObj?.contact && (
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {previewData.clientObj.contact}
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
                        const itemHt = item.total;
                        const itemTva = itemHt * (previewData.tvaRate / 100);
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
                              {previewData.tvaRate}%
                            </td>
                            <td className="border-r border-black p-1 text-[9px] w-[7%] text-right">
                              {itemTva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-1 text-[9.5px] text-right font-sans font-black">{itemTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                      
                      {/* Empty padded rows for professional ERP document feel */}
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
                      <p className="font-bold text-slate-600">Arrêter le présente facture à la somme de :</p>
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

      {/* -------------------- COMPTABILISEES INVOICES LIST MODAL -------------------- */}
      {showComptabiliseesList && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 select-none animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-slate-900 w-[640px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col font-sans">
            
            {/* Title Bar */}
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 dark:from-slate-950 dark:to-slate-900 p-4.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Folder size={18} className="text-indigo-300" />
                <div className="text-left">
                  <h3 className="font-sans font-black text-xs uppercase tracking-wider">
                    Factures de Ventes Comptabilisées
                  </h3>
                  <p className="text-[10px] opacity-80 font-medium">Invoices validated and stored in the database</p>
                </div>
              </div>
              <button
                onClick={() => setShowComptabiliseesList(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* List Table Content */}
            <div className="p-5 overflow-y-auto max-h-[350px]">
              {sales.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500 font-bold text-xs">
                  Aucune facture validée et comptabilisée enregistrée.
                </div>
              ) : (
                <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs font-bold text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-150 dark:border-slate-800">
                      <tr>
                        <th className="p-3 pl-4">N° Facture</th>
                        <th className="p-3">Client</th>
                        <th className="p-3 text-center">Date</th>
                        <th className="p-3 text-right pr-4">Montant TTC (DA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {sales.map((sale) => (
                        <tr 
                          key={sale.id}
                          onClick={() => {
                            setSelectedSaleId(sale.id);
                            setFactureType('normal');
                            setShowComptabiliseesList(false);
                            setIsFacturePreviewOpen(true);
                          }}
                          className="hover:bg-indigo-50/40 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                        >
                          <td className="p-3 pl-4 font-mono text-indigo-700 dark:text-indigo-400 font-black">
                            {String(sale.id).padStart(5, '0')}
                          </td>
                          <td className="p-3 uppercase text-slate-900 dark:text-white font-bold">{sale.client}</td>
                          <td className="p-3 text-center font-mono text-[11px] text-slate-500">{sale.date}</td>
                          <td className="p-3 text-right pr-4 font-mono text-slate-900 dark:text-slate-100 font-black">
                            {(sale.ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowComptabiliseesList(false)}
                className="px-5 h-8.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- NON COMPTABILISEES INVOICES LIST MODAL -------------------- */}
      {showNonComptabiliseesList && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 select-none animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-slate-900 w-[640px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col font-sans">
            
            {/* Title Bar */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 dark:from-slate-950 dark:to-slate-900 p-4.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-amber-300" />
                <div className="text-left">
                  <h3 className="font-sans font-black text-xs uppercase tracking-wider">
                    Factures de Ventes NON Comptabilisées
                  </h3>
                  <p className="text-[10px] opacity-80 font-medium">Brouillons et sessions de vente en cours</p>
                </div>
              </div>
              <button
                onClick={() => setShowNonComptabiliseesList(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* List Table Content */}
            <div className="p-5 overflow-y-auto max-h-[350px]">
              {openVouchers.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 font-bold text-xs">
                  <span>Aucun brouillon de vente en cours de rédaction.</span>
                  <span className="font-medium text-[10.5px] text-slate-400">Pour rédiger une nouvelle facture, fermez ce menu et basculez en mode Nouveau Bon.</span>
                </div>
              ) : (
                <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs font-bold text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-150 dark:border-slate-800">
                      <tr>
                        <th className="p-3 pl-4">Réf. Brouillon</th>
                        <th className="p-3">Client</th>
                        <th className="p-3 text-center">Nbre d'articles</th>
                        <th className="p-3 text-right pr-4 font-black">Montant Estimé (DA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {openVouchers.map((v) => {
                        const sumDraft = v.draftItems.reduce((sum, i) => sum + i.total, 0);
                        return (
                          <tr 
                            key={v.id}
                            onClick={() => {
                              setActiveDraftId(v.id);
                              setMode('create');
                              setDraftItems([...v.draftItems]);
                              setNewClientName(v.clientName);
                              setNewTime(v.time);
                              setNewDate(v.date);
                              setVendeurName(v.vendeurName);
                              setObservations(v.observations);
                              setVersement(v.versement);
                              setRemise(v.remise);
                              setTvaRate(v.tvaRate);
                              
                              setFactureType('proforma');
                              setShowNonComptabiliseesList(false);
                              setIsFacturePreviewOpen(true);
                            }}
                            className="hover:bg-amber-50/40 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                          >
                            <td className="p-3 pl-4 font-mono text-amber-700 dark:text-amber-400 font-black">
                              DRAFT-{v.id}
                            </td>
                            <td className="p-3 uppercase text-slate-900 dark:text-white font-bold">{v.clientName}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{v.draftItems.length}</td>
                            <td className="p-3 text-right pr-4 font-mono text-slate-900 dark:text-slate-100 font-black">
                              {sumDraft.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowNonComptabiliseesList(false)}
                className="px-5 h-8.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- PORTABLE THERMAL RECEIPT (BON) PRINT PREVIEW MODAL -------------------- */}
      {isBonPreviewOpen && (() => {
        const clientPhone = previewData.clientObj?.phone || '';
        const isAnonyme = previewData.clientName?.toLowerCase() === 'anonyme' || previewData.clientObj?.name?.toLowerCase() === 'anonyme';
        const clientAddress = isAnonyme
          ? (config?.deliveryInfo?.adresse || previewData.clientObj?.address || '')
          : (previewData.clientObj?.address || '');
        const previousBalance = computedMetrics.oldBalance ?? 0;
        const ttcVal = previewData.ttc ?? 0;
        const paidVal = versement ?? 0;
        const currentBalance = computedMetrics.newBalance ?? 0;
        const totalItemsQty = previewData.items.reduce((sum, item) => sum + (item.qty || 0), 0);

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex justify-center items-start overflow-y-auto z-[100250] py-6 select-none print:p-0 print:bg-white print:backdrop-blur-none">
            {/* Inject print-specific CSS dynamically when this modal is open */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #print-bon-receipt-sheet, #print-bon-receipt-sheet * {
                  visibility: visible !important;
                }
                #print-bon-receipt-sheet {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 76mm !important; /* Perfect for 80mm and auto-scales beautifully */
                  margin: 0 !important;
                  padding: 2mm !important;
                  box-shadow: none !important;
                  border: none !important;
                  background: white !important;
                  color: black !important;
                }
                @page {
                  margin: 0 !important;
                  size: auto !important;
                }
              }
            `}} />

            <div className="flex flex-col gap-3 items-center print:gap-0">
              {/* Toolbar */}
              <div className="w-[340px] bg-slate-800 text-white p-3 px-4 rounded-xl flex justify-between items-center shadow-lg print:hidden font-sans">
                <div className="flex items-center gap-1.5">
                  <Printer size={15} className="text-emerald-400" />
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider">Format Ticket (Bon)</h4>
                    <p className="text-[8px] text-slate-300 font-medium">Imprimantes portables 58/80mm</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Printer size={11} /> Imprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBonPreviewOpen(false)}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <X size={11} /> Fermer
                  </button>
                </div>
              </div>

              {/* Thermal Receipt Sheet */}
              <div
                id="print-bon-receipt-sheet"
                className="w-[320px] bg-white text-black p-4 pb-8 shadow-2xl rounded-sm font-mono text-[11px] select-text no-gray-override leading-normal border border-slate-200"
              >
                {/* Header */}
                <div className="text-center mb-2">
                  <h2 className="text-sm font-black uppercase tracking-wider font-sans mb-0.5">
                    {config?.deliveryInfo?.nomRaisonSociale || ''}
                  </h2>
                  <p className="text-[10px] font-bold">{config?.deliveryInfo?.detail1 || ''}</p>
                  <p className="text-[9px] text-slate-700">{config?.deliveryInfo?.detail2 || ''}</p>
                  {config?.deliveryInfo?.detail3 && (
                    <p className="text-[9px] text-slate-700">{config.deliveryInfo.detail3}</p>
                  )}
                  {config?.deliveryInfo?.adresse && (
                    <p className="text-[9px] text-slate-700">{config.deliveryInfo.adresse}</p>
                  )}
                  
                  <div className="border-t border-dashed border-black/80 my-2"></div>
                  
                  <h3 className="text-[11px] font-black uppercase tracking-widest font-sans">
                    {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'فاتورة مبيعات / BON DE VENTE' : 'BON DE VENTE'}
                  </h3>
                </div>

                {/* Metadata block - Algerian standard */}
                <div className={`grid ${config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'grid-cols-2' : 'grid-cols-1'} gap-x-1 gap-y-0.5 text-[9.5px] font-sans`}>
                  <div className="text-left">
                    <span className="font-bold">N° :</span> {String(previewData.id).padStart(5, '0')}
                  </div>
                  {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                    <div className="text-right" dir="rtl">
                      <span className="font-bold">الرقم:</span> {String(previewData.id).padStart(5, '0')}
                    </div>
                  )}

                  <div className="text-left">
                    <span className="font-bold">Date :</span> {previewData.date}
                  </div>
                  {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                    <div className="text-right" dir="rtl">
                      <span className="font-bold">التاريخ:</span> {previewData.date}
                    </div>
                  )}

                  <div className="text-left">
                    <span className="font-bold">Heure :</span> {previewData.time || "00:00"}
                  </div>
                  {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                    <div className="text-right" dir="rtl">
                      <span className="font-bold">الوقت:</span> {previewData.time || "00:00"}
                    </div>
                  )}

                  <div className="text-left">
                    <span className="font-bold">Type :</span> {previewData.clientName === 'Anonyme' ? 'COMPTANT' : 'A TERME'}
                  </div>
                  {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                    <div className="text-right" dir="rtl">
                      <span className="font-bold">النوع:</span> {previewData.clientName === 'Anonyme' ? 'نقدا' : 'أجل'}
                    </div>
                  )}
                </div>

                <div className="border-t border-dashed border-black/80 my-2"></div>

                {/* Client Info */}
                <div className="text-[9.5px] leading-relaxed font-sans mb-2">
                  <div className="flex justify-between">
                    <span>Client: <strong className="uppercase">{previewData.clientName}</strong></span>
                    {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                      <span dir="rtl">العميل: <strong className="uppercase">{previewData.clientName}</strong></span>
                    )}
                  </div>
                  {clientPhone && (
                    <div className="flex justify-between">
                      <span>Tél: <strong>{clientPhone}</strong></span>
                      {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                        <span dir="rtl">الهاتف: <strong>{clientPhone}</strong></span>
                      )}
                    </div>
                  )}
                  {clientAddress && (
                    <div className="flex justify-between">
                      <span>Adresse: <strong>{clientAddress}</strong></span>
                      {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                        <span dir="rtl">العنوان: <strong>{clientAddress}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <table className="w-full text-left font-mono text-[10px] mt-2 border-collapse">
                  <thead>
                    <tr className="border-b border-black/60 font-bold">
                      <th className="pb-1 text-left w-[50%]">
                        {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'المنتج / Désignation' : 'Désignation'}
                      </th>
                      <th className="pb-1 text-center w-[12%]">
                        {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'الكمية' : 'Qté'}
                      </th>
                      <th className="pb-1 text-right w-[18%]">
                        {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'السعر' : 'Prix'}
                      </th>
                      <th className="pb-1 text-right w-[20%]">
                        {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'الإجمالي' : 'Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dotted divide-black/40">
                    {previewData.items.map((item, idx) => (
                      <tr key={idx} className="py-1">
                        <td className="py-1 font-sans text-[9px] leading-tight break-all pr-1">
                          {item.designation}
                        </td>
                        <td className="py-1 text-center font-bold">
                          {item.qty}
                        </td>
                        <td className="py-1 text-right">
                          {item.price.toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
                        </td>
                        <td className="py-1 text-right font-bold">
                          {item.total.toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-dashed border-black/80 my-2"></div>

                {/* Total Quantity */}
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Qté totale: {totalItemsQty}</span>
                  {config?.deliveryInfo?.multiLangueBon === 'arabe' && (
                    <span dir="rtl">إجمالي الكمية: {totalItemsQty}</span>
                  )}
                </div>

                <div className="border-t border-dotted border-black/60 my-1.5"></div>

                {/* Totals Recaps */}
                <div className="space-y-1 text-[10.5px] font-sans">
                  {/* Previous balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">
                      {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'R. Précédent (عليكم) :' : 'R. Précédent :'}
                    </span>
                    <strong className="font-mono text-black">
                      {previousBalance.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                    </strong>
                  </div>

                  {/* Total Invoice */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">
                      {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'Total Facture (إجمالي ف.) :' : 'Total Facture :'}
                    </span>
                    <strong className="font-mono text-black">
                      {ttcVal.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                    </strong>
                  </div>

                  {/* Versement/Paid */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">
                      {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'Versé (المدفوع) :' : 'Versé :'}
                    </span>
                    <strong className="font-mono text-emerald-700">
                      {paidVal.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                    </strong>
                  </div>

                  <div className="border-t border-dotted border-black/60 my-1"></div>

                  {/* Current Balance */}
                  <div className="flex justify-between items-center text-[11px] font-black">
                    <span>
                      {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'N. Solde (الرصيد الحالي) :' : 'N. Solde :'}
                    </span>
                    <span className="font-mono text-blue-900">
                      {currentBalance.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                    </span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black/80 my-3"></div>

                {/* Footer greeting */}
                <div className="text-center font-sans text-[10.5px] space-y-0.5 mt-1">
                  <p className="font-bold">
                    {config?.deliveryInfo?.multiLangueBon === 'arabe' ? 'شكرا على زيارتكم / ' : ''}
                    {config?.deliveryInfo?.messageTicket || "Merci de votre visite"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

export default React.memo(SalesVoucherWindow, (prev, next) => {
  return prev.isOpen === next.isOpen &&
         prev.products === next.products &&
         prev.clients === next.clients &&
         prev.sales === next.sales &&
         prev.config === next.config &&
         prev.currentUser === next.currentUser;
});

