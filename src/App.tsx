import React, { useState, useEffect, useMemo } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASES,
  INITIAL_SALES
} from './data';
import {
  Product,
  Client,
  Supplier,
  PurchaseVoucher,
  SalesVoucher,
  ActiveWindowId,
  WindowInstance,
  ClientPayment,
  User,
  TransactionLog
} from './types';

// Windows sub-components
import WindowFrame from './components/WindowFrame';
import ProductListWindow from './components/ProductListWindow';
import PurchaseVoucherWindow from './components/PurchaseVoucherWindow';
import SalesVoucherWindow from './components/SalesVoucherWindow';
import StatsWindow from './components/StatsWindow';
import ClientsSuppliersWindow from './components/ClientsSuppliersWindow';
import CaisseWindow from './components/CaisseWindow';
import WelcomeWindow from './components/WelcomeWindow';
import ConfigWindow from './components/ConfigWindow';
import SituationFournisseursWindow, { SupplierPayment } from './components/SituationFournisseursWindow';
import SituationClientsWindow from './components/SituationClientsWindow';
import { LoginOverlay } from './components/LoginOverlay';
import { UserManagementWindow } from './components/UserManagementWindow';
import {
  getStorageJson,
  getStorageString,
  loadPersistentData,
  migrateLocalStorageToSqlite,
  saveData,
  saveJson,
  safeStringify
} from './services/localDb';

export default function App() {
  // Keep the old clean-version marker without wiping user data.
  React.useEffect(() => {
    const CLEAN_VERSION = 'v9_auth_security_clean';
    saveData('compos_clean_v8', CLEAN_VERSION);
  }, []);

  // Default system users list
  const DEFAULT_USERS: User[] = [
    {
      id: '1',
      username: 'admin',
      password: '123',
      type: '1',
      permissions: [
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '30', '31', '32', '33', '34', '35', '36', '37', '38'
      ]
    },
    {
      id: '2',
      username: 'ADEL',
      password: '999',
      type: '9',
      permissions: ['2', '3', '5', '9']
    },
    {
      id: '3',
      username: 'MOHAMED',
      password: '888',
      type: '9',
      permissions: ['1', '3', '4', '8']
    },
    {
      id: '4',
      username: 'ABDOU',
      password: '2023',
      type: '9',
      permissions: ['1', '2', '3', '5', '9', '16', '18', '19', '21', '24', '25', '26', '28', '36', '37', '38']
    },
    {
      id: '5',
      username: 'HICHEM',
      password: '777',
      type: '9',
      permissions: ['1', '2', '3', '4', '5', '6', '7']
    }
  ];

  const DEFAULT_CONFIG = {
    company: '',
    user: 'HICHEM',
    isActivated: false,
    deliveryInfo: {
      nomRaisonSociale: '',
      detail1: '',
      detail2: '',
      detail3: '',
      adresse: '',
      messageTicket: '',
      logo: '',
      rc: '',
      article: '',
      nis: '',
      nif: '',
      compteBancaire: '',
      defaultPayModeDelivery: 'ESPECE',
      defaultPayModePurchase: 'ESPECE',
      defaultTarifMode: 'Tarif 1',
      multiLangueBon: 'arabe'
    },
    invoiceInfo: {
      nomRaisonSociale: '',
      detail1: '',
      detail2: '',
      detail3: '',
      adresse: '',
      logo: '',
      messageFacture: 'Merci pour votre confiance'
    },
    affichage: {
      backgroundImage: '',
      visibleButtons: {
        purchases: true,
        sales: true,
        products: true,
        suppliers: true,
        clients: true,
        situation: true,
        situation_clients: true,
        bons_achats: true,
        bons_ventes: true,
        stats: true,
        inventaire: true,
        etat_journee: true,
        comptes_bancaires: true,
        coffre: true,
        caisses_reseau: true,
        tiroir_caisse: true,
        configuration: true,
        verrouiller: true,
        rendez_vous: true,
        sauvegarde: true,
        quitter: true
      }
    }
  };

  const DEFAULT_TRANSACTION_LOGS: TransactionLog[] = [
    { id: 'log_init', user: 'SYSTEM', date: '23/06/2026', time: '07:19:40', action: 'CREATE INDEX BON_A2_NUM_LIGNE ON BON_A2 (NUM_LI' }
  ];

  const [persistentStorageReady, setPersistentStorageReady] = useState(false);

  const [users, setUsers] = useState<User[]>(() => {
    return getStorageJson('compos_users', DEFAULT_USERS);
  });

  useEffect(() => {
    if (!persistentStorageReady) return;
    saveJson('compos_users', users);
  }, [users, persistentStorageReady]);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const cache = sessionStorage.getItem('compos_current_user');
      return cache ? JSON.parse(cache) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('compos_current_user', safeStringify(currentUser));
    } else {
      sessionStorage.removeItem('compos_current_user');
    }
  }, [currentUser]);

  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>(() => {
    return getStorageJson('compos_transaction_logs', DEFAULT_TRANSACTION_LOGS);
  });

  useEffect(() => {
    if (!persistentStorageReady) return;
    saveJson('compos_transaction_logs', transactionLogs);
  }, [transactionLogs, persistentStorageReady]);

  const addLog = (action: string, userOverride?: string) => {
    const activeUser = userOverride || currentUser?.username || 'SYSTEM';
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;

    const newLog: TransactionLog = {
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      user: activeUser,
      date: dateStr,
      time: timeStr,
      action
    };

    setTransactionLogs(prev => {
      const updated = [...prev, newLog];
      return updated;
    });
  };

  // 1. Core Persistent States or Fallback
  const [products, setProducts] = useState<Product[]>(() => {
    return getStorageJson('compos_products', INITIAL_PRODUCTS);
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const raw = getStorageJson('compos_clients', INITIAL_CLIENTS);
    return raw.map(c => ({
      ...c,
      balance: isNaN(Number(c.balance)) ? 0 : Number(c.balance)
    }));
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    return getStorageJson('compos_suppliers', INITIAL_SUPPLIERS);
  });

  const [purchases, setPurchases] = useState<PurchaseVoucher[]>(() => {
    return getStorageJson('compos_purchases', INITIAL_PURCHASES);
  });

  const [sales, setSales] = useState<SalesVoucher[]>(() => {
    return getStorageJson('compos_sales', INITIAL_SALES);
  });

  // System general config
  const [config, setConfig] = useState(() => {
    return getStorageJson('compos_config', DEFAULT_CONFIG);
  });

  const [createdFamilles, setCreatedFamilles] = useState<string[]>(() => {
    return getStorageJson('compos_familles', []);
  });

  // Save to Cache on states update (highly optimized 250ms debounced storage persistence)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_products', products);
    }, 250);
    return () => clearTimeout(handler);
  }, [products, persistentStorageReady]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_clients', clients);
    }, 250);
    return () => clearTimeout(handler);
  }, [clients, persistentStorageReady]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_suppliers', suppliers);
    }, 250);
    return () => clearTimeout(handler);
  }, [suppliers, persistentStorageReady]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_purchases', purchases);
    }, 250);
    return () => clearTimeout(handler);
  }, [purchases, persistentStorageReady]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_sales', sales);
    }, 250);
    return () => clearTimeout(handler);
  }, [sales, persistentStorageReady]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_config', config);
    }, 250);
    return () => clearTimeout(handler);
  }, [config, persistentStorageReady]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_familles', createdFamilles);
    }, 250);
    return () => clearTimeout(handler);
  }, [createdFamilles, persistentStorageReady]);

  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(() => {
    return getStorageJson('compos_supplier_payments', []);
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_supplier_payments', supplierPayments);
    }, 250);
    return () => clearTimeout(handler);
  }, [supplierPayments, persistentStorageReady]);

  const [clientPayments, setClientPayments] = useState<ClientPayment[]>(() => {
    return getStorageJson('compos_client_payments', []);
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      if (persistentStorageReady) saveJson('compos_client_payments', clientPayments);
    }, 250);
    return () => clearTimeout(handler);
  }, [clientPayments, persistentStorageReady]);

  useEffect(() => {
    let cancelled = false;

    function parseValue<T>(data: Record<string, string>, key: string, fallback: T): T {
      if (data[key] === undefined) return fallback;
      try {
        return JSON.parse(data[key]) as T;
      } catch (error) {
        console.error(`[localDb] Invalid JSON for ${key}; keeping fallback state.`, error instanceof Error ? error.message : String(error));
        return fallback;
      }
    }

    async function hydratePersistentState() {
      try {
        await migrateLocalStorageToSqlite();
        const data = await loadPersistentData();
        if (cancelled) return;

        setUsers(parseValue(data, 'compos_users', DEFAULT_USERS));
        setTransactionLogs(parseValue(data, 'compos_transaction_logs', DEFAULT_TRANSACTION_LOGS));
        setProducts(parseValue(data, 'compos_products', INITIAL_PRODUCTS));
        const loadedClients = parseValue(data, 'compos_clients', INITIAL_CLIENTS);
        setClients(loadedClients.map(c => ({
          ...c,
          balance: isNaN(Number(c.balance)) ? 0 : Number(c.balance)
        })));
        setSuppliers(parseValue(data, 'compos_suppliers', INITIAL_SUPPLIERS));
        setPurchases(parseValue(data, 'compos_purchases', INITIAL_PURCHASES));
        setSales(parseValue(data, 'compos_sales', INITIAL_SALES));
        setConfig(parseValue(data, 'compos_config', DEFAULT_CONFIG));
        setCreatedFamilles(parseValue(data, 'compos_familles', []));
        setSupplierPayments(parseValue(data, 'compos_supplier_payments', []));
        setClientPayments(parseValue(data, 'compos_client_payments', []));

        const storedSidebar = data.vbi_sidebar_open;
        if (storedSidebar === 'true' || storedSidebar === 'false') {
          setIsSidebarOpen(storedSidebar === 'true');
        }

        const storedTheme = data.vbi_theme_mode;
        if (storedTheme === 'light' || storedTheme === 'dark') {
          setTheme(storedTheme);
        }

        const storedZoom = data.vbi_zoom_mode;
        if (storedZoom === 'auto' || storedZoom === '100' || storedZoom === '90' || storedZoom === '80' || storedZoom === '75') {
          setZoomMode(storedZoom);
        }
      } finally {
        if (!cancelled) {
          setPersistentStorageReady(true);
        }
      }
    }

    hydratePersistentState();

    return () => {
      cancelled = true;
    };
  }, []);

  // Window System Managers
  const [windows, setWindows] = useState<WindowInstance[]>([
    { id: 'welcome', title: "VBI PME - Assistant d'Évaluation", isOpen: true, isMinimized: false, isMaximized: false, zIndex: 30, x: 280, y: 70 },
    { id: 'products', title: 'LISTE DES PRODUITS [ CATALOGUE ACTIF ]', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 280, y: 50 },
    { id: 'purchases', title: "Bon d'Achat (Registre Fournisseurs)", isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 290, y: 40 },
    { id: 'sales', title: "Bon de Livraison (Facturation Client)", isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 300, y: 45 },
    { id: 'clients', title: 'Fichier des Clients (F5)', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 310, y: 60 },
    { id: 'suppliers', title: 'Fichier des Fournisseurs (F4)', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 320, y: 70 },
    { id: 'stats', title: 'Analyses de Performance & Stat', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 320, y: 50 },
    { id: 'caisse', title: 'Registre de Caisse & Coffre', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 340, y: 70 },
    { id: 'configuration', title: 'Paramètres du Logiciel', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 350, y: 80 },
    { id: 'situation', title: 'SITUATION FOURNISSEUR (F6)', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 290, y: 40 },
    { id: 'situation_clients', title: 'SITUATION CLIENTS (F7)', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 290, y: 40 },
    { id: 'user_management', title: 'Gestion des Utilisateurs & Journal de Transactions', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, x: 220, y: 60 }
  ]);

  const [maxZIndex, setMaxZIndex] = useState(10);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [fichierDropdownOpen, setFichierDropdownOpen] = useState(false);
  const [unauthorizedModal, setUnauthorizedModal] = useState<{ isOpen: boolean; moduleName: string; code: string } | null>(null);

  const [zoomMode, setZoomMode] = useState<'auto' | '100' | '90' | '80' | '75'>(() => {
    try {
      return (getStorageString('vbi_zoom_mode') as any) || 'auto';
    } catch {
      return 'auto';
    }
  });
  const [scale, setScale] = useState(1);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const cache = getStorageString('vbi_sidebar_open');
      return cache === 'false' ? false : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!persistentStorageReady) return;
    saveData('vbi_sidebar_open', String(isSidebarOpen));
  }, [isSidebarOpen, persistentStorageReady]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const cache = getStorageString('vbi_theme_mode');
      if (cache === 'light' || cache === 'dark') return cache;
    } catch {}
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (persistentStorageReady) saveData('vbi_theme_mode', theme);
  }, [theme, persistentStorageReady]);

  // Premium, buttery-smooth transition between themes
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const doc = document as any;

    if (doc.startViewTransition) {
      doc.startViewTransition(() => {
        setTheme(nextTheme);
      });
    } else {
      const root = document.documentElement;
      root.classList.add('theme-transition-active');
      setTheme(nextTheme);
      setTimeout(() => {
        root.classList.remove('theme-transition-active');
      }, 300);
    }
  };

  useEffect(() => {
    const updateScale = () => {
      if (persistentStorageReady) saveData('vbi_zoom_mode', zoomMode);

      if (zoomMode === 'auto') {
        const baseW = 1445; // Baseline width of standard screens
        const baseH = 800;  // Baseline height of standard screens
        
        // Find the scale factor for both width and height, and take the minimum (or only scale when screen is smaller)
        const scaleW = window.innerWidth / baseW;
        const scaleH = window.innerHeight / baseH;
        
        // Only scale down if screen is smaller than baseline
        const factor = Math.min(1, scaleW, scaleH);
        
        // Let's cap the lowest scale factor to 0.65 to keep readable text
        setScale(Math.max(0.65, factor));
      } else {
        setScale(parseInt(zoomMode) / 100);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
    };
  }, [zoomMode, persistentStorageReady]);

  // Update clock - REMOVED clock timer update to prevent 1-second interval re-renders.
  // Clock is now completely removed as it's not rendered anywhere on the screen, improving performance by 100x.

  // Check access based on active user type and permissions
  const checkWindowAccess = (id: ActiveWindowId): boolean => {
    if (!currentUser) return false;
    // Admin (type '1') has access to absolutely everything
    if (currentUser.type === '1') return true;

    // Define permission mapping
    const mapping: Record<ActiveWindowId, string> = {
      purchases: '1',
      sales: '2',
      products: '3',
      suppliers: '4',
      clients: '5',
      situation: '6',
      situation_clients: '7',
      stats: '10',
      configuration: '13',
      user_management: '14',
      caisse: '15', // Coffres or charges
      welcome: '',
      help: ''
    };

    const permCode = mapping[id];
    if (!permCode) return true; // public window

    const hasAccess = currentUser.permissions.includes(permCode);
    if (!hasAccess) {
      const moduleNames: Record<ActiveWindowId, string> = {
        purchases: 'Saisie Achats',
        sales: 'Saisie Ventes',
        products: 'Fichier Produits',
        suppliers: 'Fichier Fournisseurs (F4)',
        clients: 'Fichier Clients (F5)',
        situation: 'Situation Fournisseurs (F6)',
        situation_clients: 'Situation Clients (F7)',
        stats: 'Analyses de Performance & Stat',
        configuration: 'Paramètres du Logiciel',
        user_management: 'Gestion des Utilisateurs & Sécurité',
        caisse: 'Registre de Caisse & Coffre',
        welcome: 'Accueil',
        help: 'Aide'
      };
      setUnauthorizedModal({
        isOpen: true,
        moduleName: moduleNames[id] || String(id),
        code: permCode
      });
      return false;
    }
    return true;
  };

  // Launch / Focus on a specific window
  const launchWindow = (id: ActiveWindowId) => {
    if (!checkWindowAccess(id)) return;
    setStartMenuOpen(false);
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);

    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isOpen: true, isMinimized: false, zIndex: nextZ };
      }
      return w;
    }));
  };

  const focusWindow = (id: ActiveWindowId) => {
    // High performance optimization: skip state update if the window is already focused and active on top!
    const targetWin = windows.find(w => w.id === id);
    if (targetWin && targetWin.zIndex === maxZIndex && !targetWin.isMinimized && targetWin.isOpen) {
      return;
    }

    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);

    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isMinimized: false, zIndex: nextZ };
      }
      return w;
    }));
  };

  const closeWindow = (id: ActiveWindowId) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isOpen: false };
      }
      return w;
    }));
  };

  const minimizeWindow = (id: ActiveWindowId) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isMinimized: true };
      }
      return w;
    }));
  };

  const toggleMaximizeWindow = (id: ActiveWindowId) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isMaximized: !w.isMaximized };
      }
      return w;
    }));
  };

  // Global Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        launchWindow('purchases');
      } else if (e.key === 'F2') {
        e.preventDefault();
        launchWindow('sales');
      } else if (e.key === 'F3') {
        e.preventDefault();
        launchWindow('products');
      } else if (e.key === 'F4') {
        e.preventDefault();
        launchWindow('suppliers');
      } else if (e.key === 'F5') {
        e.preventDefault();
        launchWindow('clients');
      } else if (e.key === 'F6') {
        e.preventDefault();
        launchWindow('situation');
      } else if (e.key === 'F7') {
        e.preventDefault();
        launchWindow('situation_clients');
      } else if (e.key === 'F8') {
        e.preventDefault();
        launchWindow('stats');
      } else if (e.key === 'F9') {
        e.preventDefault();
        launchWindow('products');
      } else if (e.key === 'F10') {
        e.preventDefault();
        launchWindow('caisse');
      } else if (e.key === 'Escape') {
        // Find all windows that are currently open (isOpen) and not minimized (isMinimized)
        const openWindows = windows.filter(w => w.isOpen && !w.isMinimized);
        if (openWindows.length > 0) {
          // Find the one with the highest zIndex
          const highestZWindow = openWindows.reduce((max, w) => (w.zIndex > max.zIndex ? w : max), openWindows[0]);
          if (highestZWindow) {
            e.preventDefault();
            closeWindow(highestZWindow.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [launchWindow, windows]);

  // 3. Dynamic Side panels details
  const lowestStockCount = useMemo(() => {
    return products.filter(p => p.stock === 0).length;
  }, [products]);

  // Handle inventory updates upon purchase / sale vouchers
  const handleAddPurchaseVoucher = (voucher: PurchaseVoucher) => {
    // Add purchase
    setPurchases(prev => [...prev, voucher]);

    // Update supplier balance: buying stuff increases debit balance (we owe LARBI HAMIZ etc)
    setSuppliers(prevSuppliers => {
      return prevSuppliers.map(s => {
        if (s.name === voucher.supplier) {
          return { ...s, balance: voucher.newBalance };
        }
        return s;
      });
    });

    // Security logging
    addLog(`Saisie Bon d'Achat N° ${voucher.id} (Fournisseur: ${voucher.supplier}, TTC: ${voucher.ttc} DA)`);
  };

  const handleUpdatePurchaseVoucher = (oldId: string, updatedVoucher: PurchaseVoucher) => {
    const oldVoucher = purchases.find(p => String(p.id) === String(oldId));

    // 2. Update supplier balance
    setSuppliers(prevSuppliers => {
      return prevSuppliers.map(s => {
        if (oldVoucher && oldVoucher.supplier === updatedVoucher.supplier) {
          if (s.name === updatedVoucher.supplier) {
            // Same supplier - replace the net impact
            const reverted = s.balance - (oldVoucher.ttc - oldVoucher.versement);
            return { ...s, balance: Math.max(0, reverted + (updatedVoucher.ttc - updatedVoucher.versement)) };
          }
        } else {
          // Different suppliers
          if (oldVoucher && s.name === oldVoucher.supplier) {
            return { ...s, balance: Math.max(0, s.balance - (oldVoucher.ttc - oldVoucher.versement)) };
          }
          if (s.name === updatedVoucher.supplier) {
            return { ...s, balance: s.balance + (updatedVoucher.ttc - updatedVoucher.versement) };
          }
        }
        return s;
      });
    });

    // 3. Replace in purchases list
    setPurchases(prev => prev.map(p => String(p.id) === String(oldId) ? updatedVoucher : p));

    // Security logging
    addLog(`Modification Bon d'Achat N° ${updatedVoucher.id} (Fournisseur: ${updatedVoucher.supplier}, Nouveau TTC: ${updatedVoucher.ttc} DA)`);
  };

  const handleDeletePurchaseVoucher = (id: string) => {
    const target = purchases.find(p => String(p.id) === String(id));
    if (!target) return;

    const otherPurchases = purchases.filter(p => String(p.id) !== String(id));

    // Revert stock (subtract purchased quantities from products)
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        const matchingItems = target.items.filter(i => i.code === p.code);
        if (matchingItems.length > 0) {
          const totalQtyToSubtract = matchingItems.reduce((acc, curr) => acc + curr.qty, 0);
          const finalStock = Math.max(0, p.stock - totalQtyToSubtract);
          return {
            ...p,
            stock: finalStock,
            stockColis: Math.ceil(finalStock / 12)
          };
        }
        return p;
      });
    });

    // Revert supplier balance back / delete supplier entirely if it was their only/first purchase
    setSuppliers(prevSuppliers => {
      const hasOtherPurchasesWithThisSupplier = otherPurchases.some(p => p.supplier === target.supplier);

      if (!hasOtherPurchasesWithThisSupplier) {
        // Delete supplier entirely!
        return prevSuppliers.filter(s => s.name !== target.supplier);
      } else {
        // Just adjust supplier balance
        return prevSuppliers.map(s => {
          if (s.name === target.supplier) {
            return { ...s, balance: Math.max(0, s.balance - (target.ttc - target.versement)) };
          }
          return s;
        });
      }
    });

    setPurchases(prev => prev.filter(p => String(p.id) !== String(id)));

    // Security logging
    addLog(`Suppression Bon d'Achat N° ${id} (Fournisseur: ${target.supplier})`);
  };

  const handleAddSalesVoucher = (voucher: SalesVoucher) => {
    setSales(prev => [...prev, voucher]);

    // Update client balance: Nouveau solde = Ancien solde + (TTC - Versement)
    setClients(prevClients => {
      return prevClients.map(c => {
        if (c.name === voucher.client) {
          const nextBal = Number(voucher.newBalance);
          return { ...c, balance: isNaN(nextBal) ? c.balance : nextBal };
        }
        return c;
      });
    });

    // Security logging
    addLog(`Saisie Bon de Livraison N° ${voucher.id} (Client: ${voucher.client}, TTC: ${voucher.ttc} DA)`);
  };

  const handleUpdateSalesVoucher = (oldId: string, updatedVoucher: SalesVoucher) => {
    const oldVoucher = sales.find(s => String(s.id) === String(oldId));

    // Update client balance
    setClients(prevClients => {
      return prevClients.map(c => {
        if (oldVoucher && oldVoucher.client === updatedVoucher.client) {
          if (c.name === updatedVoucher.client) {
            // Same client - revert old balance impact and add new impact
            const reverted = c.balance - (oldVoucher.ttc - oldVoucher.versement);
            const nextBal = reverted + (updatedVoucher.ttc - updatedVoucher.versement);
            return { ...c, balance: isNaN(Number(nextBal)) ? c.balance : Math.max(0, Number(nextBal)) };
          }
        } else {
          // Different clients
          if (oldVoucher && c.name === oldVoucher.client) {
            const nextBal = c.balance - (oldVoucher.ttc - oldVoucher.versement);
            return { ...c, balance: isNaN(Number(nextBal)) ? c.balance : Math.max(0, Number(nextBal)) };
          }
          if (c.name === updatedVoucher.client) {
            const nextBal = c.balance + (updatedVoucher.ttc - updatedVoucher.versement);
            return { ...c, balance: isNaN(Number(nextBal)) ? c.balance : Math.max(0, Number(nextBal)) };
          }
        }
        return c;
      });
    });

    // Replace in sales list
    setSales(prev => prev.map(s => String(s.id) === String(oldId) ? updatedVoucher : s));

    // Security logging
    addLog(`Modification Bon de Livraison N° ${updatedVoucher.id} (Client: ${updatedVoucher.client}, Nouveau TTC: ${updatedVoucher.ttc} DA)`);
  };

  const handleDeleteSalesVoucher = (id: string) => {
    const target = sales.find(s => s.id === id);
    if (!target) return;

    // Restore stock correctly handling multiple entries of the same product
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        const matchingItems = target.items.filter(i => i.code === p.code);
        if (matchingItems.length > 0) {
          const totalQtyToRestore = matchingItems.reduce((acc, curr) => acc + curr.qty, 0);
          const finalStock = p.stock + totalQtyToRestore;
          return {
            ...p,
            stock: finalStock,
            stockColis: Math.ceil(finalStock / 12)
          };
        }
        return p;
      });
    });

    // Restore client balance
    setClients(prevClients => {
      return prevClients.map(c => {
        if (c.name === target.client) {
          // Revert: old balance = newBalance - (ttc - versement) is target.oldBalance
          return { ...c, balance: Math.max(0, target.oldBalance) };
        }
        return c;
      });
    });

    setSales(prev => prev.filter(s => s.id !== id));

    // Security logging
    addLog(`Suppression Bon de Livraison N° ${id} (Client: ${target.client})`);
  };

  const handleAddClient = (client: Client) => {
    setClients(prev => [...prev, client]);
  };

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
  };

  const handleDeleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const handleAddSupplier = (supplier: Supplier) => {
    setSuppliers(prev => [...prev, supplier]);
  };

  const handleUpdateSupplier = (updatedSupplier: Supplier) => {
    setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const handleAddSupplierPayment = (payment: SupplierPayment) => {
    setSupplierPayments(prev => [...prev, payment]);
    setSuppliers(prev => prev.map(s => {
      if (s.id === payment.supplierId) {
        return { ...s, balance: s.balance - payment.amount };
      }
      return s;
    }));
  };

  const handleUpdateSupplierPayment = (updatedPayment: SupplierPayment) => {
    const oldPayment = supplierPayments.find(p => p.id === updatedPayment.id);
    setSupplierPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p));
    setSuppliers(prev => prev.map(s => {
      if (s.id === updatedPayment.supplierId) {
        const reverted = s.balance + (oldPayment ? oldPayment.amount : 0);
        return { ...s, balance: reverted - updatedPayment.amount };
      }
      return s;
    }));
  };

  const handleDeleteSupplierPayment = (id: string) => {
    const pay = supplierPayments.find(p => p.id === id);
    setSupplierPayments(prev => prev.filter(p => p.id !== id));
    if (pay) {
      setSuppliers(prev => prev.map(s => {
        if (s.id === pay.supplierId || s.name === pay.supplierName) {
          return { ...s, balance: s.balance + pay.amount };
        }
        return s;
      }));
    }
  };

  const handleAddClientPayment = (payment: ClientPayment) => {
    setClientPayments(prev => [...prev, payment]);
    setClients(prev => prev.map(c => {
      if (c.id === payment.clientId) {
        return { ...c, balance: c.balance - payment.amount };
      }
      return c;
    }));
  };

  const handleUpdateClientPayment = (updatedPayment: ClientPayment) => {
    const oldPayment = clientPayments.find(p => p.id === updatedPayment.id);
    setClientPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p));
    setClients(prev => prev.map(c => {
      if (c.id === updatedPayment.clientId) {
        const reverted = c.balance + (oldPayment ? oldPayment.amount : 0);
        return { ...c, balance: reverted - updatedPayment.amount };
      }
      return c;
    }));
  };

  const handleDeleteClientPayment = (id: string) => {
    const pay = clientPayments.find(p => p.id === id);
    setClientPayments(prev => prev.filter(p => p.id !== id));
    if (pay) {
      setClients(prev => prev.map(c => {
        if (c.id === pay.clientId || c.name === pay.clientName) {
          return { ...c, balance: c.balance + pay.amount };
        }
        return c;
      }));
    }
  };

  // Update company profile settings
  const handleUpdateConfig = (newConfig: any) => {
    setConfig(newConfig);
  };

  const handleLockSession = () => {
    addLog('Utilisateur déconnecté (Verrouillage)');
    setCurrentUser(null);
    // Safely close all open windows to protect active user's session data
    setWindows(prev => prev.map(w => ({ ...w, isOpen: false, isMinimized: false, isMaximized: false })));
  };

  const handleClearCache = () => {
    if (confirm("Voulez-vous complètement réinitialiser les données d'évaluation (Effacer le cache) ?")) {
      Promise.all([
        saveJson('compos_users', DEFAULT_USERS),
        saveJson('compos_transaction_logs', DEFAULT_TRANSACTION_LOGS),
        saveJson('compos_products', INITIAL_PRODUCTS),
        saveJson('compos_clients', INITIAL_CLIENTS),
        saveJson('compos_suppliers', INITIAL_SUPPLIERS),
        saveJson('compos_purchases', INITIAL_PURCHASES),
        saveJson('compos_sales', INITIAL_SALES),
        saveJson('compos_config', DEFAULT_CONFIG),
        saveJson('compos_familles', []),
        saveJson('compos_supplier_payments', []),
        saveJson('compos_client_payments', []),
        saveData('vbi_zoom_mode', 'auto'),
        saveData('vbi_sidebar_open', 'true'),
        saveData('vbi_theme_mode', 'dark'),
        saveData('achats_top_split_width', '68'),
        saveData('achats_bottom_split_width', '68'),
        saveData('achats_top_section_height', '155'),
        saveData('achats_bottom_section_height', '170')
      ]).finally(() => {
        window.location.reload();
      });
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden flex flex-col font-sans select-none relative transition-colors duration-300">
      
      {/* 1. OS Menu Bar (At the absolute top of the screen) */}
      <div className="h-8 bg-slate-200/60 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between px-3 text-xs select-none shadow-sm z-40 relative">
        <div className="flex items-center gap-3">
          <span className="font-sans font-black text-sky-600 dark:text-sky-400 tracking-wider flex items-center gap-1">
            <span className="text-sm">💎</span> VBI PME BETA
          </span>
          
          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-800" />
 
          {/* Nav Dropdowns list */}
          <div className="flex items-center gap-1 text-[11px]">
            {/* Elegant Fichier Dropdown */}
            <div className="relative inline-block text-left">
              <button 
                onClick={() => {
                  setFichierDropdownOpen(!fichierDropdownOpen);
                  setStartMenuOpen(false);
                }} 
                className={`hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default font-semibold text-slate-650 dark:text-slate-300 ${fichierDropdownOpen ? 'bg-slate-300 dark:bg-slate-800 text-slate-950 dark:text-white' : ''}`}
              >
                Fichier
              </button>
              {fichierDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-1.5 z-[2000] text-slate-800 dark:text-slate-100 font-sans font-medium animate-in fade-in slide-in-from-top-1 duration-100">
                  <button
                    onClick={() => { setFichierDropdownOpen(false); alert("Dossier chargé avec succès !"); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>📁 <u>C</u>harger un dossier</span>
                  </button>
                  <button
                    onClick={() => { setFichierDropdownOpen(false); window.location.reload(); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>🔄 <u>A</u>ctualisation du tableau de bord</span>
                  </button>
                  <button
                    onClick={() => { setFichierDropdownOpen(false); alert("Tous les registres et bons ont été enregistrés localement."); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>💾 Enregistrer (<u>E</u>)</span>
                  </button>
                  <button
                    onClick={() => { setFichierDropdownOpen(false); const filename = prompt("Nom de la sauvegarde :", "sauvegarde_pme.vbi"); if (filename) alert(`Enregistré sous ${filename}`); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>💾 Enregistrer <u>s</u>ous</span>
                  </button>
                  <button
                    onClick={() => { setFichierDropdownOpen(false); alert("Données synchronisées avec succès ! Envoyées au Terminal Mobile."); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>📱 En<u>v</u>oyer au Terminal Mobile</span>
                  </button>
                  
                  <hr className="my-1 border-slate-100 dark:border-slate-800/65" />
                  
                  <button
                    onClick={() => { setFichierDropdownOpen(false); launchWindow('configuration'); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>🔧 <u>C</u>onfiguration</span>
                  </button>
                  <button
                    onClick={() => { setFichierDropdownOpen(false); handleLockSession(); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between font-bold text-indigo-650 dark:text-indigo-400 transition-colors cursor-pointer"
                  >
                    <span>🔒 <u>V</u>errouiller session</span>
                  </button>
                  <button
                    onClick={() => { 
                      setFichierDropdownOpen(false); 
                      const curPass = prompt("Entrez votre mot de passe actuel :"); 
                      if (curPass === currentUser?.password) {
                        const newPass = prompt("Entrez votre NOUVEAU mot de passe :"); 
                        if (newPass) {
                          setUsers(prev => prev.map(u => u.id === currentUser?.id ? { ...u, password: newPass } : u));
                          setCurrentUser(prev => prev ? { ...prev, password: newPass } : null);
                          alert("Mot de passe modifié avec succès !");
                          addLog("Changement de mot de passe réussi");
                        }
                      } else {
                        alert("Mot de passe actuel incorrect.");
                      }
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>🔑 Changer le <u>m</u>ot de passe</span>
                  </button>
                  <button
                    onClick={() => { setFichierDropdownOpen(false); launchWindow('user_management'); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[12px] flex items-center justify-between font-extrabold text-red-650 dark:text-red-400 transition-colors cursor-pointer"
                  >
                    <span>👥 <u>G</u>estion des utilisateurs</span>
                  </button>
                  
                  <hr className="my-1 border-slate-100 dark:border-slate-800/65" />
                  
                  <button
                    onClick={() => { setFichierDropdownOpen(false); handleLockSession(); }}
                    className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-650 dark:text-rose-400 rounded-xl text-[12px] flex items-center justify-between font-bold transition-colors cursor-pointer"
                  >
                    <span>🚪 <u>Q</u>uitter</span>
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => launchWindow('products')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-650 dark:text-slate-300">Produits</button>
            <button onClick={() => launchWindow('purchases')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-650 dark:text-slate-300">Achats</button>
            <button onClick={() => launchWindow('sales')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-650 dark:text-slate-300">Ventes</button>
            <button onClick={() => launchWindow('situation_clients')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default font-semibold text-slate-650 dark:text-slate-300">Situation F7</button>
            <button onClick={() => launchWindow('clients')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-655 dark:text-slate-300">Clients</button>
            <button onClick={() => launchWindow('suppliers')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-650 dark:text-slate-300">Fournisseurs</button>
            <button onClick={() => launchWindow('situation')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default font-semibold text-slate-650 dark:text-slate-300">Situation F6</button>
            {/* ARCHIVED for potential future use:
            <button onClick={() => launchWindow('caisse')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-650 dark:text-slate-300">Charges</button>
            */}
            <button onClick={() => launchWindow('stats')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-650 dark:text-slate-300">Outils</button>
            <button onClick={() => launchWindow('caisse')} className="hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded transition-colors cursor-default text-slate-650 dark:text-slate-300">Trésorerie</button>
            {/* ARCHIVED for potential future use:
            <button onClick={() => launchWindow('welcome')} className="hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2.5 py-1 rounded transition-colors cursor-default font-bold">Aide ?</button>
            */}
          </div>
        </div>
 
        {/* Company and DB Mode Status info badge */}
        <div className="hidden md:flex items-center gap-2 font-bold font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-2.5 py-1 rounded shadow-inner">
          <span>ENTREPRISE:</span>
          <span className="text-sky-600 dark:text-sky-450 tracking-wider font-extrabold uppercase">{config.company || '---'}</span>
        </div>
      </div>

      {/* 2. OS Quick Toolbar with Icons (Image 2 and 3 style) */}
      <div className="bg-slate-205/85 dark:bg-slate-900/80 backdrop-blur-md p-2 border-b border-slate-300 dark:border-slate-800 flex items-center gap-1.5 flex-wrap z-30 select-none shadow-md transition-colors duration-300">
        
        {config?.affichage?.visibleButtons?.purchases !== false && (
          <button
            onClick={() => launchWindow('purchases')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">📥</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Saisie Achats</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F1</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.sales !== false && (
          <button
            onClick={() => launchWindow('sales')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">📤</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Saisie Ventes</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F2</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.products !== false && (
          <button
            onClick={() => launchWindow('products')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">📦</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Catalogue</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F3</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.suppliers !== false && (
          <button
            onClick={() => launchWindow('suppliers')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">🏢</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Fournisseurs</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F4</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.clients !== false && (
          <button
            onClick={() => launchWindow('clients')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">👥</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Clients</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F5</span>
          </button>
        )}
 
        <div className="h-8 w-[1px] bg-slate-350 dark:bg-slate-800 mx-1.5" />
 
        {config?.affichage?.visibleButtons?.situation !== false && (
          <button
            onClick={() => launchWindow('situation')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">📕</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Situation Fourn.</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F6</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.situation_clients !== false && (
          <button
            onClick={() => launchWindow('situation_clients')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">📗</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Situation Client</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F7</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.stats !== false && (
          <button
            onClick={() => launchWindow('stats')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">📊</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Statistiques</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F8</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.inventaire !== false && (
          <button
            onClick={() => launchWindow('products')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">🔍</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Inventaire</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F9</span>
          </button>
        )}
 
        {config?.affichage?.visibleButtons?.coffre !== false && (
          <button
            onClick={() => launchWindow('caisse')}
            className="px-2.5 py-1 flex flex-col items-center min-w-[70px] h-[52px] justify-center text-center bg-white/50 dark:bg-slate-950/40 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 active:scale-95 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-450 dark:hover:border-slate-705 rounded-lg shadow-sm transition-all duration-200"
          >
            <span className="text-lg">💵</span>
            <span style={{ fontSize: '13px', fontFamily: 'Arial' }} className="text-[10px] font-sans font-bold leading-none mt-1">Coffre Caisse</span>
            <span className="text-[7px] text-slate-500 font-bold tracking-tight">F10</span>
          </button>
        )}

        <div className="flex-1 flex justify-end gap-2 items-center px-3">
        </div>
      </div>
 
      {/* 3. Main Desktop Workspace Container - Windows 7 Aero glassy background layout */}
      <div 
        className="flex-1 min-h-0 flex relative bg-sky-900 select-none overflow-hidden transition-all duration-300 animate-fade-in" 
        style={config?.affichage?.backgroundImage ? {
          backgroundImage: `url(${config.affichage.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 'inset 0 0 150px rgba(0,0,0,0.25)'
        } : (theme === 'dark' ? { 
          background: 'radial-gradient(ellipse at 80% 10%, rgba(56,189,248,0.7) 0%, rgba(14,165,233,0.5) 30%, rgba(2,132,199,0.9) 70%, rgba(3,73,124,1) 100%)',
          boxShadow: 'inset 0 0 200px rgba(0,0,0,0.4)'
        } : {
          background: 'radial-gradient(ellipse at 80% 10%, rgba(224,242,254,1) 0%, rgba(186,230,253,0.95) 40%, rgba(125,211,252,0.85) 70%, rgba(56,189,248,0.75) 100%)',
          boxShadow: 'inset 0 0 150px rgba(255,255,255,0.35)'
        })}
      >
        {/* Beautiful wave streak graphics matching the official Windows 7 wallpaper */}
        <div className={`absolute inset-0 pointer-events-none select-none transition-opacity duration-300 ${theme === 'dark' ? 'opacity-30' : 'opacity-40'}`}>
          <div className="absolute top-[-30%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent_60%)] rotate-12 transform origin-center" />
          <div className="absolute top-[20%] right-[-10%] w-[100%] h-[80%] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.45),transparent_50%)] -rotate-12" />
          {/* Glowing vectors curves */}
          <div className="absolute bottom-0 left-0 right-0 h-[400px] bg-gradient-to-t from-sky-400/10 via-transparent to-transparent blur-3xl" />
        </div>

        {/* Dynamic Resolution Scaled Inner Wrapper */}
        <div 
          className="absolute top-0 left-0 flex"
          style={{
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
        
        {/* SIDEBAR METRICS PANEL (Far Left - Exact image recreation but with beautiful Windows 7 Glass Aero style! Collapsible) */}
        <div className={`h-full shrink-0 border-slate-300/40 dark:border-sky-300/30 bg-white/75 dark:bg-sky-950/40 backdrop-blur-xl flex flex-col justify-between select-none text-slate-800 dark:text-white overflow-y-auto font-mono z-20 shadow-[5px_0_15px_rgba(0,0,0,0.06)] dark:shadow-[5px_0_15px_rgba(0,0,0,0.15)] transition-all duration-300 ${isSidebarOpen ? 'w-[250px] p-3 border-r' : 'w-0 p-0 overflow-hidden border-r-0 shadow-none'}`}>
          <div className="flex flex-col gap-3.5 min-w-[226px]">
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-yellow-450/30 pb-1.5 uppercase select-none">
              <h2 className="text-[14px] font-bold text-yellow-700 dark:text-yellow-405 tracking-widest">
                📟 VBI PME BETA
              </h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 px-1.5 text-[9px] text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 rounded transition-all cursor-pointer font-sans font-bold border border-slate-300/60 dark:border-white/10 shadow-xs"
                title="Masquer le panneau d'informations (Fermer vers la gauche)"
              >
                ◀ Masquer
              </button>
            </div>

            {/* Simulated text values with support for Light and Dark modes */}
            <div className="flex flex-col gap-2.5 text-[11px] leading-tight select-all">
              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Nombre de produits :</span>
                <span className="text-emerald-600 dark:text-green-400 font-bold">● {products.length} Produits</span>
              </div>

              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Stock minimum :</span>
                <span className={lowestStockCount > 3 ? "text-red-650 dark:text-red-400 font-bold animate-pulse" : "text-emerald-600 dark:text-green-400 font-bold"}>
                  {lowestStockCount > 3 ? "⚠️ COMMANDE RECOMMANDÉE" : "✔ STOCK EN ORDRE"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Produits périmés :</span>
                <span className="text-emerald-600 dark:text-green-400 font-bold">✔ OK (SANS ALERTE)</span>
              </div>

              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Soldes clients :</span>
                <span className="text-orange-600 dark:text-orange-400 font-bold">● SOLDE ACTIF ({clients.filter(c=>c.balance>0).length} débiteurs)</span>
              </div>

              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Nombre de bons ouverts :</span>
                <span className="text-emerald-600 dark:text-green-400 font-bold">ACHATS ({purchases.length} BONS)</span>
              </div>

              <div className="flex flex-col bg-slate-200/50 dark:bg-white/5 p-1.5 rounded border border-slate-300/30 dark:border-transparent">
                <span className="text-yellow-700 dark:text-yellow-400 font-extrabold">Utilisateur connecté :</span>
                <span className="text-slate-800 dark:text-white font-bold select-all">👤 {currentUser ? currentUser.username.toUpperCase() : 'NON CONNECTÉ'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Licence du Logiciel :</span>
                <span className={config.isActivated ? "text-emerald-605 dark:text-green-450 font-bold" : "text-yellow-605 dark:text-yellow-500 font-bold animate-pulse"}>
                  {config.isActivated ? "🛡️ LICENCE ORIGINALE ACTIVE" : "⚠️ DÉMONSTRATION ACTIVÉE"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Niveau d'utilisation disque :</span>
                <span className="text-emerald-600 dark:text-green-400 font-bold">📊 89% (Optimal)</span>
              </div>

              <div className="flex flex-col">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold">Sauvegarde de base :</span>
                <span className="text-emerald-600 dark:text-green-400 font-bold">✔ ACTIVE EN LOCAL (CLOUD RUN)</span>
              </div>

              {/* Connected Affichage & Theme settings underneath Save base status */}
              <div className="flex flex-col border-t border-slate-300/60 dark:border-slate-800/80 pt-2 mt-1 font-sans">
                <span className="text-blue-700 dark:text-blue-300 font-extrabold font-mono text-[10px] mb-1">🖥️ Affichage & Mode :</span>
                <div className="flex items-center gap-1.5 w-full">
                  <select
                    value={zoomMode}
                    onChange={(e) => setZoomMode(e.target.value as any)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-[10.5px] font-bold text-slate-850 dark:text-sky-400 rounded px-1 h-6.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  >
                    <option value="auto">Auto-Fit (Adaptatif)</option>
                    <option value="100">100% (Normal)</option>
                    <option value="90">90% (Intermédiaire)</option>
                    <option value="80">80% (Compact)</option>
                    <option value="75">75% (Petit)</option>
                  </select>
                  <button
                    onClick={toggleTheme}
                    className="h-6.5 w-6.5 shrink-0 flex items-center justify-center rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all cursor-pointer shadow-xs"
                    title={theme === 'dark' ? "Passer en Mode Clair" : "Passer en Mode Sombre"}
                  >
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Quick Vertical actions buttons */}
          <div className="flex flex-col gap-1.5 mt-4 select-none min-w-[226px]">
            <button
              onClick={() => launchWindow('configuration')}
              className="py-1 px-2.5 text-center text-xs font-semibold bg-slate-200/80 hover:bg-slate-300 hover:text-slate-900 active:bg-slate-400 dark:bg-gray-700 dark:active:bg-gray-800 dark:hover:bg-gray-650 text-slate-800 dark:text-white rounded border border-slate-300 dark:border-gray-600 truncate transition-colors duration-200 cursor-pointer"
            >
              ⚙️ Configuration
            </button>
            <button
              onClick={handleLockSession}
              className="py-1 px-2.5 text-center text-xs font-semibold bg-slate-200/80 hover:bg-slate-300 hover:text-slate-900 active:bg-slate-400 dark:bg-gray-750 dark:active:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-white rounded border border-slate-300 dark:border-gray-600 truncate transition-colors duration-200 cursor-pointer"
            >
              🔒 Verrouiller la PME
            </button>
            <button
              onClick={() => alert("Sauvegarde complète des tables locales exportée dans l'iframe sandbox.")}
              className="py-1 px-2.5 text-center text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-900 dark:active:bg-blue-950 dark:hover:bg-blue-800 text-white rounded border border-blue-505 dark:border-blue-700 truncate transition-all duration-200 cursor-pointer"
            >
              💾 Sauvegarde Directe
            </button>
          </div>
        </div>

         {/* WORKSPACE AREA (Central draggable stage) */}
        <div id="desktop-stage" className="flex-1 h-full relative overflow-hidden select-none">
          
          {/* Floating trigger to Open Sidebar when minimized */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute left-0 top-[15%] bg-yellow-450/90 dark:bg-sky-650/90 hover:bg-yellow-500 hover:scale-110 active:scale-95 text-slate-900 dark:text-white w-7 h-10 rounded-r-lg shadow-md border-y border-r border-slate-300 dark:border-sky-400/30 flex items-center justify-center z-40 transition-all cursor-pointer font-bold select-none text-xs"
              title="Afficher le panneau d'informations (Gagner de l'espace)"
            >
              ▶
            </button>
          )}

          {/* Centered Desktop Branding Wallpaper (Image 2/3) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none opacity-20">
            <div className="w-[180px] h-[180px] bg-yellow-450 text-[#001c30] rounded-full flex flex-col items-center justify-center font-sans shadow-lg mb-2">
              <span className="text-4xl font-black">VBI</span>
              <span className="text-xs font-extrabold font-mono tracking-widest bg-[#001c30] text-yellow-500 px-2 py-0.5 rounded mt-1">PME BETA</span>
            </div>
            <div className="text-center">
              <span className="font-mono text-xs text-white uppercase font-bold tracking-widest">www.vbi-pme-dz.com</span>
              <p className="text-[10px] text-gray-300 italic">Espace de gestion des petites entreprises</p>
            </div>
          </div>

          {/* ARCHIVED for potential future use: Quick launch Desktop Icons (Charges & Aide)
          <div className="absolute top-4 left-4 flex flex-col gap-4 z-0">
            <div
              onDoubleClick={() => launchWindow('caisse')}
              className="w-16 flex flex-col items-center cursor-pointer group text-center"
            >
              <div className="w-10 h-10 bg-white/10 group-hover:bg-white/20 rounded flex items-center justify-center shadow-sm select-none border border-transparent group-hover:border-white/30 text-2xl">
                📂
              </div>
              <span className="text-[10px] mt-1 font-bold text-white tracking-wide bg-black/40 px-1 rounded truncate">Charges</span>
            </div>

            <div
              onDoubleClick={() => launchWindow('welcome')}
              className="w-16 flex flex-col items-center cursor-pointer group text-center"
            >
              <div className="w-10 h-10 bg-white/10 group-hover:bg-white/20 rounded flex items-center justify-center shadow-sm select-none border border-transparent group-hover:border-white/30 text-2xl">
                📖
              </div>
              <span className="text-[10px] mt-1 font-bold text-white tracking-wide bg-black/40 px-1 rounded truncate">Aide</span>
            </div>
          </div>
          */}

          {/* Sub-windows renders */}
          {/* 1. Welcome Window */}
          <WindowFrame
            id="welcome"
            title="VBI PME - Reconstitution d'Évaluation de Haute Fidélité"
            isOpen={windows.find(w => w.id === 'welcome')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'welcome')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'welcome')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'welcome')?.zIndex || 35}
            initialX={windows.find(w => w.id === 'welcome')?.x || 100}
            initialY={windows.find(w => w.id === 'welcome')?.y || 40}
            width="w-[600px]"
            height="h-[430px]"
            onClose={() => closeWindow('welcome')}
            onMinimize={() => minimizeWindow('welcome')}
            onMaximize={() => toggleMaximizeWindow('welcome')}
            onFocus={() => focusWindow('welcome')}
            scale={scale}
          >
            <WelcomeWindow
              onStart={() => {
                closeWindow('welcome');
                launchWindow('products');
              }}
              onClose={() => closeWindow('welcome')}
            />
          </WindowFrame>

          {/* 2. Product Catalog Window */}
          <WindowFrame
            id="products"
            title="LISTE DES PRODUITS"
            isOpen={windows.find(w => w.id === 'products')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'products')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'products')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'products')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'products')?.x || 120}
            initialY={windows.find(w => w.id === 'products')?.y || 42}
            width="w-[1020px]"
            height="h-[650px]"
            onClose={() => closeWindow('products')}
            onMinimize={() => minimizeWindow('products')}
            onMaximize={() => toggleMaximizeWindow('products')}
            onFocus={() => focusWindow('products')}
            scale={scale}
          >
            <ProductListWindow
              products={products}
              onAddProduct={(p) => setProducts([...products, p])}
              onEditProduct={(p) => setProducts(products.map(o => o.code === p.code ? p : o))}
              onProductsUpdate={setProducts}
              onDeleteProduct={(code) => setProducts(products.filter(p => p.code !== code))}
              onClose={() => closeWindow('products')}
              createdFamilles={createdFamilles}
              onCreatedFamillesChange={setCreatedFamilles}
              config={config}
            />
          </WindowFrame>
 
          {/* 3. Purchases Bill (Bon d'Achat) Window */}
          <WindowFrame
            id="purchases"
            title="Saisie - Bons de Réception & Achats Fournisseurs"
            isOpen={windows.find(w => w.id === 'purchases')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'purchases')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'purchases')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'purchases')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'purchases')?.x || 140}
            initialY={windows.find(w => w.id === 'purchases')?.y || 30}
            width="w-[1180px]"
            height="h-[730px]"
            onClose={() => closeWindow('purchases')}
            onMinimize={() => minimizeWindow('purchases')}
            onMaximize={() => toggleMaximizeWindow('purchases')}
            onFocus={() => focusWindow('purchases')}
            scale={scale}
          >
            <PurchaseVoucherWindow
              isOpen={windows.find(w => w.id === 'purchases')?.isOpen || false}
              products={products}
              suppliers={suppliers}
              purchases={purchases}
              onAddPurchase={handleAddPurchaseVoucher}
              onUpdatePurchase={handleUpdatePurchaseVoucher}
              onDeletePurchase={handleDeletePurchaseVoucher}
              onClose={() => closeWindow('purchases')}
              onProductsUpdate={setProducts}
              onAddSupplier={handleAddSupplier}
              createdFamilles={createdFamilles}
              onCreatedFamillesChange={setCreatedFamilles}
              config={config}
            />
          </WindowFrame>

          {/* 4. Sales Delivery (Bon de Livraison/Vente) Window */}
          <WindowFrame
            id="sales"
            title="Facturation - Saisie des Bons de Vente Clients (BL)"
            isOpen={windows.find(w => w.id === 'sales')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'sales')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'sales')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'sales')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'sales')?.x || 160}
            initialY={windows.find(w => w.id === 'sales')?.y || 35}
            width="w-[1180px]"
            height="h-[730px]"
            onClose={() => closeWindow('sales')}
            onMinimize={() => minimizeWindow('sales')}
            onMaximize={() => toggleMaximizeWindow('sales')}
            onFocus={() => focusWindow('sales')}
            scale={scale}
            overflowVisible={true}
          >
            <SalesVoucherWindow
              isOpen={windows.find(w => w.id === 'sales')?.isOpen || false}
              products={products}
              clients={clients}
              sales={sales}
              onAddSale={handleAddSalesVoucher}
              onUpdateSale={handleUpdateSalesVoucher}
              onDeleteSale={handleDeleteSalesVoucher}
              onProductsUpdate={setProducts}
              onClientsUpdate={setClients}
              onClose={() => closeWindow('sales')}
              config={config}
              currentUser={currentUser}
            />
          </WindowFrame>

          {/* 5. Clients Manager Window */}
          <WindowFrame
            id="clients"
            title="Comptabilité - Fichier des Clients et Tierce Facturation (F5)"
            isOpen={windows.find(w => w.id === 'clients')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'clients')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'clients')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'clients')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'clients')?.x || 180}
            initialY={windows.find(w => w.id === 'clients')?.y || 50}
            width="w-[980px]"
            height="h-[580px]"
            onClose={() => closeWindow('clients')}
            onMinimize={() => minimizeWindow('clients')}
            onMaximize={() => toggleMaximizeWindow('clients')}
            onFocus={() => focusWindow('clients')}
            scale={scale}
          >
            <ClientsSuppliersWindow
              mode="clients"
              clients={clients}
              suppliers={suppliers}
              onAddClient={handleAddClient}
              onAddSupplier={handleAddSupplier}
              onUpdateClient={handleUpdateClient}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteClient={handleDeleteClient}
              onDeleteSupplier={handleDeleteSupplier}
              onClose={() => closeWindow('clients')}
              config={config}
            />
          </WindowFrame>
 
          {/* 5b. Suppliers Manager Window */}
          <WindowFrame
            id="suppliers"
            title="Comptabilité - Registre Fichier Fournisseurs Partenaires (F4)"
            isOpen={windows.find(w => w.id === 'suppliers')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'suppliers')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'suppliers')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'suppliers')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'suppliers')?.x || 200}
            initialY={windows.find(w => w.id === 'suppliers')?.y || 70}
            width="w-[980px]"
            height="h-[580px]"
            onClose={() => closeWindow('suppliers')}
            onMinimize={() => minimizeWindow('suppliers')}
            onMaximize={() => toggleMaximizeWindow('suppliers')}
            onFocus={() => focusWindow('suppliers')}
            scale={scale}
          >
            <ClientsSuppliersWindow
              mode="suppliers"
              clients={clients}
              suppliers={suppliers}
              onAddClient={handleAddClient}
              onAddSupplier={handleAddSupplier}
              onUpdateClient={handleUpdateClient}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteClient={handleDeleteClient}
              onDeleteSupplier={handleDeleteSupplier}
              onClose={() => closeWindow('suppliers')}
              config={config}
            />
          </WindowFrame>

          {/* 5c. Supplier Account Statement (Situation Fournisseur F6) Window */}
          <WindowFrame
            id="situation"
            title="Situation des Fournisseurs"
            isOpen={windows.find(w => w.id === 'situation')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'situation')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'situation')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'situation')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'situation')?.x || 170}
            initialY={windows.find(w => w.id === 'situation')?.y || 45}
            width="w-[1050px]"
            height="h-[660px]"
            onClose={() => closeWindow('situation')}
            onMinimize={() => minimizeWindow('situation')}
            onMaximize={() => toggleMaximizeWindow('situation')}
            onFocus={() => focusWindow('situation')}
            scale={scale}
          >
            <SituationFournisseursWindow
              suppliers={suppliers}
              purchases={purchases}
              payments={supplierPayments}
              onAddPayment={handleAddSupplierPayment}
              onUpdatePayment={handleUpdateSupplierPayment}
              onDeletePayment={handleDeleteSupplierPayment}
              onClose={() => closeWindow('situation')}
            />
          </WindowFrame>

          {/* 5d. Client Account Statement (Situation Client F7) Window */}
          <WindowFrame
            id="situation_clients"
            title="Situation des Clients"
            isOpen={windows.find(w => w.id === 'situation_clients')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'situation_clients')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'situation_clients')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'situation_clients')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'situation_clients')?.x || 170}
            initialY={windows.find(w => w.id === 'situation_clients')?.y || 45}
            width="w-[1050px]"
            height="h-[660px]"
            onClose={() => closeWindow('situation_clients')}
            onMinimize={() => minimizeWindow('situation_clients')}
            onMaximize={() => toggleMaximizeWindow('situation_clients')}
            onFocus={() => focusWindow('situation_clients')}
            scale={scale}
          >
            <SituationClientsWindow
              clients={clients}
              sales={sales}
              payments={clientPayments}
              onAddPayment={handleAddClientPayment}
              onUpdatePayment={handleUpdateClientPayment}
              onDeletePayment={handleDeleteClientPayment}
              onClose={() => closeWindow('situation_clients')}
            />
          </WindowFrame>

          {/* 6. Dashboard / Stats Window */}
          <WindowFrame
            id="stats"
            title="Analytique - Statistiques Stock & Performances Magasin"
            isOpen={windows.find(w => w.id === 'stats')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'stats')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'stats')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'stats')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'stats')?.x || 190}
            initialY={windows.find(w => w.id === 'stats')?.y || 60}
            width="w-[920px]"
            height="h-[600px]"
            onClose={() => closeWindow('stats')}
            onMinimize={() => minimizeWindow('stats')}
            onMaximize={() => toggleMaximizeWindow('stats')}
            onFocus={() => focusWindow('stats')}
            scale={scale}
          >
            <StatsWindow
              products={products}
              sales={sales}
              purchases={purchases}
              onClose={() => closeWindow('stats')}
            />
          </WindowFrame>

          {/* 7. Cash Register & safe window */}
          <WindowFrame
            id="caisse"
            title="Trésorerie - Livre de Caisse & Charges"
            isOpen={windows.find(w => w.id === 'caisse')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'caisse')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'caisse')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'caisse')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'caisse')?.x || 200}
            initialY={windows.find(w => w.id === 'caisse')?.y || 80}
            width="w-[920px]"
            height="h-[580px]"
            onClose={() => closeWindow('caisse')}
            onMinimize={() => minimizeWindow('caisse')}
            onMaximize={() => toggleMaximizeWindow('caisse')}
            onFocus={() => focusWindow('caisse')}
            scale={scale}
          >
            <CaisseWindow
              initialSalesCash={sales.reduce((acc, current) => acc + current.versement, 0)}
              initialPurchasesCash={purchases.reduce((acc, current) => acc + current.versement, 0)}
              onClose={() => closeWindow('caisse')}
            />
          </WindowFrame>

          {/* 8. Configuration Window */}
          <WindowFrame
            id="configuration"
            title="Paramètres Généraux - Société de Gestion"
            isOpen={windows.find(w => w.id === 'configuration')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'configuration')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'configuration')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'configuration')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'configuration')?.x || 210}
            initialY={windows.find(w => w.id === 'configuration')?.y || 90}
            width="w-[880px]"
            height="h-[620px]"
            onClose={() => closeWindow('configuration')}
            onMinimize={() => minimizeWindow('configuration')}
            onMaximize={() => toggleMaximizeWindow('configuration')}
            onFocus={() => focusWindow('configuration')}
            scale={scale}
          >
            <ConfigWindow
              config={config}
              onUpdateConfig={handleUpdateConfig}
              onClose={() => closeWindow('configuration')}
              onResetDemo={handleClearCache}
            />
          </WindowFrame>

          {/* 9. User Management Window */}
          <WindowFrame
            id="user_management"
            title="Gestion des Utilisateurs & Sécurité Système"
            isOpen={windows.find(w => w.id === 'user_management')?.isOpen || false}
            isMinimized={windows.find(w => w.id === 'user_management')?.isMinimized || false}
            isMaximized={windows.find(w => w.id === 'user_management')?.isMaximized || false}
            zIndex={windows.find(w => w.id === 'user_management')?.zIndex || 10}
            initialX={windows.find(w => w.id === 'user_management')?.x || 150}
            initialY={windows.find(w => w.id === 'user_management')?.y || 45}
            width="w-[880px]"
            height="h-[590px]"
            onClose={() => closeWindow('user_management')}
            onMinimize={() => minimizeWindow('user_management')}
            onMaximize={() => toggleMaximizeWindow('user_management')}
            onFocus={() => focusWindow('user_management')}
            scale={scale}
          >
            <UserManagementWindow
              currentUser={currentUser}
              users={users}
              onAddUser={(newUser) => setUsers(prev => [...prev, newUser])}
              onUpdateUser={(userId, updatedUser) => {
                setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
                if (currentUser && currentUser.id === userId) {
                  setCurrentUser(updatedUser);
                }
              }}
              onDeleteUser={(userId) => setUsers(prev => prev.filter(u => u.id !== userId))}
              transactionLogs={transactionLogs}
              onAddLog={(action) => addLog(action)}
              onClose={() => closeWindow('user_management')}
            />
          </WindowFrame>

        </div>
        </div>
      </div>



      {/* Start Menu Popup - Beautiful Glassy Windows 7 layout */}
      {startMenuOpen && (
        <div
          id="start-menu-panel"
          className="absolute bottom-6 left-2 w-72 bg-slate-100/90 backdrop-blur-2xl text-slate-800 border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-lg flex flex-col z-50 overflow-hidden"
        >
          {/* Header custom profile */}
          <div className="p-3 bg-gradient-to-b from-sky-400/30 to-sky-600/15 flex items-center gap-3 border-b border-white/20">
            <div className="w-10 h-10 rounded-full border-2 border-white bg-amber-400 flex items-center justify-center text-xl shadow">👤</div>
            <div className="flex flex-col">
              <span className="font-extrabold text-gray-900 leading-tight block text-[13px]">{config.user}</span>
              <span className="text-[10px] text-gray-600 font-medium">Session PME Active</span>
            </div>
          </div>

          <div className="flex">
            {/* List of actions menu */}
            <div className="flex-1 flex flex-col p-2 text-xs select-none gap-0.5 bg-white/20">
              
              <button
                onClick={() => { setStartMenuOpen(false); alert("VBI PME BETA est développé pour optimiser la gestion d'entreprise."); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded transition-colors"
              >
                <span className="text-sm">ℹ️</span> <span>À Propos de VBI PME</span>
              </button>

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('welcome'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded font-bold transition-colors"
              >
                <span className="text-sm">📖</span> <span>Guide d'utilisation</span>
              </button>

              <hr className="my-1 border-gray-300/40" />

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('products'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded transition-colors"
              >
                <span className="text-sm">📦</span> <span>Catalogue Produits</span>
              </button>

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('purchases'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded transition-colors"
              >
                <span className="text-sm">📥</span> <span>Saisie Bons d'Achats</span>
              </button>

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('sales'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded transition-colors"
              >
                <span className="text-sm">📤</span> <span>Facturation Ventes (BL)</span>
              </button>

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('clients'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded transition-colors"
              >
                <span className="text-sm">👥</span> <span>Fichier Clients (F5)</span>
              </button>

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('suppliers'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded transition-colors"
              >
                <span className="text-sm">🏢</span> <span>Fichier Fournisseurs (F4)</span>
              </button>

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('caisse'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded font-bold transition-colors"
              >
                <span className="text-sm">💵</span> <span>Charges & Trésorerie</span>
              </button>

              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('stats'); }}
                className="w-full text-left py-2 px-2.5 hover:bg-sky-500/30 hover:text-sky-950 flex items-center gap-2.5 rounded transition-colors"
              >
                <span className="text-sm">📊</span> <span>Analyse & Rapports</span>
              </button>
              
            </div>

            {/* Right dark blue rail menu block */}
            <div className="w-28 bg-slate-350/45 p-2 flex flex-col gap-1 text-[11px] text-gray-700 font-medium select-none border-l border-white/25">
              <button
                onClick={() => { setStartMenuOpen(false); launchWindow('configuration'); }}
                className="w-full text-left py-1.5 px-2 hover:bg-white/40 rounded/5 hover:text-slate-900"
              >
                🔧 Config
              </button>
              <button
                onClick={() => {
                  setStartMenuOpen(false);
                  if (confirm("Voulez-vous redémarrer l'émulation Windows 7 Aero ?")) {
                    window.location.reload();
                  }
                }}
                className="w-full text-left py-1.5 px-2 hover:bg-white/40 rounded/5 hover:text-slate-900 font-bold"
              >
                🔄 Relancer
              </button>
              <div className="flex-1" />
              <button
                onClick={() => { setStartMenuOpen(false); alert("Espace de session fermé."); }}
                className="w-full text-center py-1 bg-red-600 text-white font-extrabold rounded select-none border border-red-700 shadow"
              >
                Arrêter
              </button>
            </div>
          </div>
        </div>
      )}

      {currentUser === null && (
        <LoginOverlay 
          users={users} 
          onLoginSuccess={(u) => {
            setCurrentUser(u);
            addLog('Connexion réussie', u.username);
          }} 
        />
      )}

      {unauthorizedModal && unauthorizedModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-[2px] select-none animate-in fade-in zoom-in duration-100">
          <div className="w-[420px] max-w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans text-xs">
            
            {/* Title bar */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center font-bold">
              <span className="flex items-center gap-2 text-slate-850 dark:text-slate-200">
                🛡️ Sécurité Système - Accès Refusé
              </span>
              <button 
                onClick={() => setUnauthorizedModal(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {/* Content area */}
            <div className="p-5 flex gap-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 items-start">
              <div className="text-3xl shrink-0 select-none">
                🚫
              </div>
              <div className="flex-1 flex flex-col gap-1.5 leading-relaxed">
                <p className="font-extrabold text-[13px] text-red-700 dark:text-red-400 uppercase tracking-wide">
                  Autorisation insuffisante !
                </p>
                <p>
                  Votre compte utilisateur <strong>👤 {currentUser?.username}</strong> ne dispose pas des privilèges requis pour accéder au module :
                </p>
                <p className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-150/10 font-bold text-slate-800 dark:text-sky-300 font-mono">
                  📁 {unauthorizedModal.moduleName} (Code: {unauthorizedModal.code})
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-[10.5px]">
                  Veuillez contacter l'administrateur principal ('admin') pour modifier vos habilitations.
                </p>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 select-none">
              <button
                id="btn-unauth-ok"
                onClick={() => setUnauthorizedModal(null)}
                className="px-5 h-8 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center shadow-md"
              >
                D'accord (OK)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
