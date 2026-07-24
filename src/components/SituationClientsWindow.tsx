import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, SalesVoucher } from '../types';
import { Plus, Edit, Trash2, Printer, RefreshCw, X, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users, HelpCircle } from 'lucide-react';

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

interface SituationClientsWindowProps {
  clients: Client[];
  sales: SalesVoucher[];
  payments: ClientPayment[];
  onAddPayment: (payment: ClientPayment) => void;
  onUpdatePayment: (payment: ClientPayment) => void;
  onDeletePayment: (id: string) => void;
  onClose: () => void;
}

function SituationClientsWindow({
  clients,
  sales,
  payments,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onClose
}: SituationClientsWindowProps) {
  // Filter out Anonyme from SituationClientsWindow list
  const activeClients = useMemo(() => {
    return clients.filter(c => c.name.toLowerCase() !== 'anonyme' && c.id !== 'client-anonyme');
  }, [clients]);

  // Current chosen client ID
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    return activeClients.length > 0 ? activeClients[0].id : '';
  });

  // Current selected client entity
  const currentClient = useMemo(() => {
    return activeClients.find(c => c.id === selectedClientId) || null;
  }, [activeClients, selectedClientId]);

  // Selected table row key (e.g. `sale-${id}` or `payment-${id}`)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Filters
  const [searchDate, setSearchDate] = useState<string>(''); // YYYY-MM-DD
  const [searchRemark, setSearchRemark] = useState<string>('');

  // Modal open states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ClientPayment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isClientChooserOpen, setIsClientChooserOpen] = useState(false);
  const [chooserSearch, setChooserSearch] = useState('');

  // Payment Form States
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDate, setFormDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [formPaymentMode, setFormPaymentMode] = useState('ESPECE');
  const [formPaymentSource, setFormPaymentSource] = useState('COFFRE N°1');
  const [formUser, setFormUser] = useState('admin');

  // Interactive Resizers split percentage (starts at 50% / 50% split)
  const [splitPercentage, setSplitPercentage] = useState(50);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const splitResizeCleanupRef = useRef<(() => void) | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      splitResizeCleanupRef.current?.();
      if (refreshTimeoutRef.current !== null) window.clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  const startResizeSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    splitResizeCleanupRef.current?.();
    const container = splitContainerRef.current;
    if (!container) return;

    // Use pointer capture to keep dragging smooth even if the mouse cursor goes off the splitter
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    const rect = container.getBoundingClientRect();

    const onPointerMove = (moveEvent: PointerEvent) => {
      const relativeY = moveEvent.clientY - rect.top;
      const percentage = (relativeY / rect.height) * 100;
      // Clamp between 15% and 85% so both top (ledger) and bottom (details) sections remain visible and usable
      setSplitPercentage(Math.max(15, Math.min(85, percentage)));
    };

    function removeResizeListeners() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onPointerUp);
      splitResizeCleanupRef.current = null;
    }

    function onPointerUp() {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      removeResizeListeners();
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onPointerUp);
    splitResizeCleanupRef.current = removeResizeListeners;
  };

  // Sync default client selection if none is loaded
  useEffect(() => {
    if (!selectedClientId && activeClients.length > 0) {
      setSelectedClientId(activeClients[0].id);
    }
  }, [activeClients, selectedClientId]);

  // Convert DD/MM/YYYY to YYYY-MM-DD
  const parseDateToISO = (dateStr: string): string => {
    if (!dateStr || !dateStr.includes('/')) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return '';
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY
  const parseISODateToFrench = (isoStr: string): string => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return '';
  };

  // Navigation logic through client records (pointer moving)
  const handleNavigate = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (activeClients.length === 0) return;
    const currentIndex = activeClients.findIndex(c => c.id === selectedClientId);

    if (direction === 'first') {
      setSelectedClientId(activeClients[0].id);
      setSelectedRowId(null);
    } else if (direction === 'last') {
      setSelectedClientId(activeClients[activeClients.length - 1].id);
      setSelectedRowId(null);
    } else if (direction === 'prev') {
      const idx = currentIndex > 0 ? currentIndex - 1 : activeClients.length - 1;
      setSelectedClientId(activeClients[idx].id);
      setSelectedRowId(null);
    } else if (direction === 'next') {
      const idx = currentIndex < activeClients.length - 1 ? currentIndex + 1 : 0;
      setSelectedClientId(activeClients[idx].id);
      setSelectedRowId(null);
    }
  };

  // Build the chronological unified ledger for the selected client
  const rawLedgerItems = useMemo(() => {
    if (!currentClient) return [];

    const items: Array<{
      id: string; // raw ID
      type: 'sale' | 'payment';
      rowId: string; // unique page level row identifier
      date: string; // DD/MM/YYYY
      time: string; // HH:MM:SS
      ventes: number;
      versements: number;
      remarks: string;
      user: string;
      timestamp: number; // for chronological sorting
    }> = [];

    // 1. Core Sales Vouchers
    sales.forEach(s => {
      if (s.client.toLowerCase().trim() === currentClient.name.toLowerCase().trim()) {
        const dateParts = s.date.split('/');
        const timeParts = s.time ? s.time.split(':') : ['12', '00', '00'];
        const dObj = new Date(
          dateParts.length === 3 ? parseInt(dateParts[2]) : 2026,
          dateParts.length === 3 ? parseInt(dateParts[1]) - 1 : 0,
          dateParts.length === 3 ? parseInt(dateParts[0]) : 1,
          timeParts.length >= 1 ? parseInt(timeParts[0]) : 12,
          timeParts.length >= 2 ? parseInt(timeParts[1]) : 0,
          timeParts.length >= 3 ? parseInt(timeParts[2]) : 0
        );

        items.push({
          id: s.id,
          type: 'sale',
          rowId: `sale-${s.id}`,
          date: s.date,
          time: s.time || '12:00:00',
          ventes: s.ttc,
          versements: s.versement,
          remarks: `[VENTE N° :${s.id}]${s.versement > 0 ? `, [ESPECE, COFFRE N°1]` : ', [A TERME]'}`,
          user: s.vendeur || 'admin',
          timestamp: dObj.getTime()
        });
      }
    });

    // 2. Standalone Cash/Bank Payments
    payments.forEach(pay => {
      if (pay.clientId === currentClient.id || pay.clientName.toLowerCase().trim() === currentClient.name.toLowerCase().trim()) {
        const dateParts = pay.date.split('/');
        const timeParts = pay.time ? pay.time.split(':') : ['12', '00', '00'];
        const dObj = new Date(
          dateParts.length === 3 ? parseInt(dateParts[2]) : 2026,
          dateParts.length === 3 ? parseInt(dateParts[1]) - 1 : 0,
          dateParts.length === 3 ? parseInt(dateParts[0]) : 1,
          timeParts.length >= 1 ? parseInt(timeParts[0]) : 12,
          timeParts.length >= 2 ? parseInt(timeParts[1]) : 0,
          timeParts.length >= 3 ? parseInt(timeParts[2]) : 0
        );

        items.push({
          id: pay.id,
          type: 'payment',
          rowId: `payment-${pay.id}`,
          date: pay.date,
          time: pay.time || '12:00:00',
          ventes: 0,
          versements: pay.amount,
          remarks: pay.remark || '[ESPECE, COFFRE N°1]',
          user: pay.user || 'admin',
          timestamp: dObj.getTime()
        });
      }
    });

    // Chronological sort: oldest transactions first to calculate correct running balances
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [currentClient, sales, payments]);

  // Calculate the running balance on chronological ledger items algebraically
  const ledgerWithBalances = useMemo(() => {
    if (!currentClient) return [];

    const soldeFinal = Number(currentClient.balance) || 0;
    
    let totalVentes = 0;
    let totalVersements = 0;
    rawLedgerItems.forEach(item => {
      totalVentes += item.ventes;
      totalVersements += item.versements;
    });

    // Solve for opening balance: soldeInitial = soldeFinal - totalVentes + totalVersements
    const computedSoldeInitial = soldeFinal - totalVentes + totalVersements;

    let currentSolde = computedSoldeInitial;
    return rawLedgerItems.map(item => {
      currentSolde = currentSolde + item.ventes - item.versements;
      return {
        ...item,
        solde: currentSolde
      };
    });
  }, [rawLedgerItems, currentClient]);

  // Filter chronologically computed ledger items by date and remark search
  const filteredLedger = useMemo(() => {
    let result = ledgerWithBalances;

    if (searchDate) {
      const frenchDateStr = parseISODateToFrench(searchDate); // "DD/MM/YYYY"
      result = result.filter(item => item.date === frenchDateStr);
    }

    if (searchRemark.trim()) {
      const query = searchRemark.toLowerCase().trim();
      result = result.filter(item => item.remarks.toLowerCase().includes(query) || item.user.toLowerCase().includes(query));
    }

    return result;
  }, [ledgerWithBalances, searchDate, searchRemark]);

  const [ledgerLimit, setLedgerLimit] = useState(100);

  useEffect(() => {
    setLedgerLimit(100);
  }, [selectedClientId, searchDate, searchRemark]);

  const visibleLedger = useMemo(() => {
    return filteredLedger.slice(0, ledgerLimit);
  }, [filteredLedger, ledgerLimit]);

  const filteredChooserClients = useMemo(() => {
    const search = chooserSearch.toLowerCase().trim();
    if (!search) return activeClients.slice(0, 100);
    return activeClients.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.code.toLowerCase().includes(search) ||
      (c.contact && c.contact.toLowerCase().includes(search))
    ).slice(0, 100);
  }, [activeClients, chooserSearch]);

  // Unfiltered Ledger Metrics (Bottom totals) - completely consistent!
  const ledgerMetrics = useMemo(() => {
    const soldeFinal = Number(currentClient?.balance) || 0;
    
    let totalVentes = 0;
    let totalVersements = 0;

    rawLedgerItems.forEach(item => {
      totalVentes += item.ventes;
      totalVersements += item.versements;
    });

    const soldeInitial = soldeFinal - totalVentes + totalVersements;

    return {
      soldeInitial,
      totalVentes,
      totalVersements,
      soldeFinal
    };
  }, [rawLedgerItems, currentClient]);

  // Dynamic products list for the selected row under "Détail du bon"
  const selectedVoucherDetails = useMemo(() => {
    if (!selectedRowId || !selectedRowId.startsWith('sale-')) {
      return null;
    }
    const voucherId = selectedRowId.replace('sale-', '');
    const voucher = sales.find(s => String(s.id) === String(voucherId));
    return voucher || null;
  }, [selectedRowId, sales]);

  // Handle opening of Dialog for versement
  const handleOpenAddPayment = () => {
    if (!currentClient) {
      alert("Veuillez sélectionner un client d'abord.");
      return;
    }
    setEditingPayment(null);
    setFormAmount(0);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setFormDate(`${yyyy}-${mm}-${dd}`);
    setFormPaymentMode('ESPECE');
    setFormPaymentSource('COFFRE N°1');
    setFormUser('admin');
    setIsPaymentModalOpen(true);
  };

  const handleOpenEditPayment = () => {
    if (!selectedRowId) {
      alert("Veuillez d'abord sélectionner un versement dans le tableau.");
      return;
    }

    if (selectedRowId.startsWith('sale-')) {
      alert("Ce versement est lié à un Bon de Livraison. Pour le modifier, veuillez ouvrir directement le Bon de Livraison Saisie Ventes (F2).");
      return;
    }

    const payId = selectedRowId.replace('payment-', '');
    const foundPayment = payments.find(p => p.id === payId);
    if (!foundPayment) return;

    // Detect payment mode and source from remark if possible
    let pMode = 'ESPECE';
    if (foundPayment.remark.includes('CHEQUE')) pMode = 'CHEQUE';
    else if (foundPayment.remark.includes('VERSEMENT')) pMode = 'VERSEMENT BANCAIRE';

    let pSource = 'COFFRE N°1';
    if (foundPayment.remark.includes('CAISSE PRINCIPALE')) pSource = 'CAISSE PRINCIPALE';

    setEditingPayment(foundPayment);
    setFormAmount(foundPayment.amount);
    setFormDate(parseDateToISO(foundPayment.date));
    setFormPaymentMode(pMode);
    setFormPaymentSource(pSource);
    setFormUser(foundPayment.user || 'admin');
    setIsPaymentModalOpen(true);
  };

  const handleDeleteSelected = () => {
    if (!selectedRowId) {
      alert("Veuillez d'abord sélectionner une transaction dans le tableau.");
      return;
    }

    if (selectedRowId.startsWith('sale-')) {
      alert("Les transactions de Bons de Livraison ne peuvent pas être supprimées d'ici. Veuillez utiliser le module Registre de Ventes (F2).");
      return;
    }

    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedRowId) return;
    const payId = selectedRowId.replace('payment-', '');
    onDeletePayment(payId);
    setSelectedRowId(null);
    setIsDeleteConfirmOpen(false);
  };

  // Save changes/new versement
  const handleSavePaymentForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient) return;
    if (formAmount <= 0) {
      alert("Le montant doit être supérieur à 0.");
      return;
    }

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const formattedTime = `${hh}:${min}:${sec}`;

    // Compile remark like [ESPECE, COFFRE N°1]
    const finalRemark = `[${formPaymentMode}, ${formPaymentSource}]`;

    if (editingPayment) {
      // Update
      const updated: ClientPayment = {
        ...editingPayment,
        amount: Number(formAmount),
        date: parseISODateToFrench(formDate),
        remark: finalRemark,
        user: formUser
      };
      onUpdatePayment(updated);
    } else {
      // Create
      const created: ClientPayment = {
        id: Math.random().toString(),
        clientId: currentClient.id,
        clientName: currentClient.name,
        date: parseISODateToFrench(formDate),
        time: formattedTime,
        amount: Number(formAmount),
        remark: finalRemark,
        user: formUser
      };
      onAddPayment(created);
    }

    setIsPaymentModalOpen(false);
    setSelectedRowId(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleActualiser = () => {
    setIsRefreshing(true);
    setSearchDate('');
    setSearchRemark('');
    setSelectedRowId(null);
    if (refreshTimeoutRef.current !== null) window.clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = window.setTimeout(() => {
      setIsRefreshing(false);
      refreshTimeoutRef.current = null;
    }, 600);
  };

  // Compute Ancien / Nouveau Solde for payment modal
  const modalAncienSolde = currentClient?.balance || 0;
  const modalNouveauSolde = editingPayment 
    ? modalAncienSolde + editingPayment.amount - formAmount
    : modalAncienSolde - formAmount;

  return (
    <div id="client-situation-window" className="flex-1 flex flex-col font-sans text-xs bg-[#f4f7fc] dark:bg-slate-950 text-slate-800 dark:text-slate-100 h-full overflow-hidden select-text">
      
      <div className="flex-1 p-2.5 flex flex-col gap-2 overflow-hidden min-h-0">
        
        {/* 2. Top Grid: Selected client & Date/Remark Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
          
          {/* Upper Left Box: Nom ou raison social */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-3 shadow-sm flex gap-4">
            
            <button 
              onClick={() => setIsClientChooserOpen(true)}
              className="flex flex-col items-center justify-center bg-emerald-50 dark:bg-slate-800/60 border border-emerald-100 dark:border-slate-800 p-2 rounded-lg w-24 shrink-0 select-none hover:bg-emerald-100 cursor-pointer transition-all hover:scale-105"
            >
              <Users size={28} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-extrabold text-center leading-tight mt-2 uppercase">
                Sélectionner un<br/>client
              </span>
            </button>

            <div className="flex-1 flex flex-col gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1 leading-none">Nom ou raison social</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedRowId(null);
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded p-1.5 font-bold text-xs text-slate-800 dark:text-slate-100"
                >
                  {activeClients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                  {activeClients.length === 0 && (
                    <option value="">Aucun client disponible</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 leading-none">Téléphones</label>
                  <input
                    type="text"
                    readOnly
                    value={currentClient?.contact || 'Non spécifié'}
                    className="w-full bg-slate-100 dark:bg-slate-950/40 border border-slate-300 dark:border-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 leading-none">Adresse d'établissement</label>
                  <input
                    type="text"
                    readOnly
                    value={currentClient?.address || 'Non spécifiée'}
                    className="w-full bg-slate-100 dark:bg-slate-950/40 border border-slate-300 dark:border-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400 text-xs font-bold"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Upper Right Box: Recherche par date and remarque */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-3 shadow-sm flex flex-col justify-between">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1 mb-2">
              🔍 MOTEUR DE RECHERCHE FILTRE
            </h3>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 w-28 uppercase">Recherche par Date</span>
                <div className="flex-1 flex gap-1 items-center">
                  <input
                    type="date"
                    value={searchDate || ''}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-800 px-2 py-1 text-xs font-mono font-bold rounded"
                  />
                  <button
                    onClick={() => {
                      if (!searchDate) {
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const dd = String(today.getDate()).padStart(2, '0');
                        setSearchDate(`${yyyy}-${mm}-${dd}`);
                      } else {
                        const current = new Date(searchDate);
                        current.setDate(current.getDate() - 1);
                        const yyyy = current.getFullYear();
                        const mm = String(current.getMonth() + 1).padStart(2, '0');
                        const dd = String(current.getDate()).padStart(2, '0');
                        setSearchDate(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                    className="p-1 px-[7px] bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 border border-slate-300 dark:border-slate-700 rounded font-bold text-slate-700 dark:text-slate-200"
                    title="Jour précédent"
                  >
                     « 
                  </button>
                  <button
                    onClick={() => {
                      if (!searchDate) {
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const dd = String(today.getDate()).padStart(2, '0');
                        setSearchDate(`${yyyy}-${mm}-${dd}`);
                      } else {
                        const current = new Date(searchDate);
                        current.setDate(current.getDate() + 1);
                        const yyyy = current.getFullYear();
                        const mm = String(current.getMonth() + 1).padStart(2, '0');
                        const dd = String(current.getDate()).padStart(2, '0');
                        setSearchDate(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                    className="p-1 px-[7px] bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 border border-slate-300 dark:border-slate-700 rounded font-bold text-slate-700 dark:text-slate-200"
                    title="Jour suivant"
                  >
                     » 
                  </button>
                  {searchDate && (
                    <button onClick={() => setSearchDate('')} className="bg-rose-50 text-rose-700 hover:bg-rose-100 p-1 px-1.5 rounded font-black text-[10px]" title="Effacer">✕</button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 w-28 uppercase">Par Remarque</span>
                <div className="flex-1 flex gap-1 items-center">
                  <input
                    type="text"
                    placeholder="Filtrer par texte, N° de vente, etc."
                    value={searchRemark}
                    onChange={(e) => setSearchRemark(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-800 px-2 py-1 text-xs font-bold rounded"
                  />
                  {searchRemark && (
                    <button onClick={() => setSearchRemark('')} className="bg-rose-50 text-rose-700 hover:bg-rose-100 p-1 px-1.5 rounded font-black text-[10px]" title="Effacer">✕</button>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* 3. Action toolbar button row */}
        <div className="bg-slate-200/95 dark:bg-slate-900 border border-slate-300 dark:border-slate-800/80 p-1.5 rounded-lg flex items-center justify-between gap-1.5 flex-nowrap overflow-x-auto shrink-0 shadow-sm select-none scrollbar-none">
          
          {/* Navigation record buttons (|<, <, >, >|) */}
          <div className="flex items-center bg-white dark:bg-slate-950 border border-slate-350 dark:border-slate-850 rounded p-0.5 gap-0.5 shadow-sm shrink-0">
            <button
              onClick={() => handleNavigate('first')}
              disabled={activeClients.length === 0}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white px-2 py-1 rounded font-bold disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              title="Premier client (Début)"
            >
              <ChevronsLeft size={13} className="stroke-[2.5]" />
              <span className="text-[8.5px] font-black uppercase">Début</span>
            </button>
            <button
              onClick={() => handleNavigate('prev')}
              disabled={activeClients.length === 0}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white px-2 py-1 rounded font-bold disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              title="Client précédent (Préc.)"
            >
              <ChevronLeft size={13} className="stroke-[2.5]" />
              <span className="text-[8.5px] font-black uppercase">Préc.</span>
            </button>
            <button
              onClick={() => handleNavigate('next')}
              disabled={activeClients.length === 0}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white px-2 py-1 rounded font-bold disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              title="Client suivant (Suivant)"
            >
              <span className="text-[8.5px] font-black uppercase">Suivant</span>
              <ChevronRight size={13} className="stroke-[2.5]" />
            </button>
            <button
              onClick={() => handleNavigate('last')}
              disabled={activeClients.length === 0}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white px-2 py-1 rounded font-bold disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              title="Dernier client (Fin)"
            >
              <span className="text-[8.5px] font-black uppercase">Fin</span>
              <ChevronsRight size={13} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Ledger modifiers & Actions (Ajouter, Modifier, Supprimer versement) */}
          <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
            
            <button
              onClick={handleOpenAddPayment}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded border border-emerald-750 shadow-sm transition-colors text-[9.5px] uppercase cursor-pointer shrink-0"
            >
              <Plus size={13} className="stroke-[3]" />
              <span>Ajouter versement</span>
            </button>

            <button
              onClick={handleOpenEditPayment}
              disabled={!selectedRowId || selectedRowId.startsWith('sale-')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#3ea729] hover:bg-[#318b1f] text-white font-black rounded border border-[#2c7d1c] shadow-sm transition-colors text-[9.5px] uppercase cursor-pointer disabled:bg-[#3ea729]/15 disabled:text-[#2c7d1c] disabled:border-[#2c7d1c]/40 disabled:dark:bg-emerald-950/30 disabled:dark:text-emerald-400 disabled:dark:border-emerald-800/60 disabled:opacity-100 hover:disabled:bg-[#3ea729]/15 shrink-0"
              title={selectedRowId?.startsWith('sale-') ? "Versement lié au bon de livraison, modifiez-le d'abord en F2" : "Modifier le versement sélectionné"}
            >
              <Edit size={13} />
              <span>Modifier versement</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={!selectedRowId || selectedRowId.startsWith('sale-')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#ff0404] hover:bg-[#d40303] text-white font-black rounded border border-[#bf0303] shadow-sm transition-colors text-[9.5px] uppercase cursor-pointer disabled:bg-[#ff0404]/10 disabled:text-[#bf0303] disabled:border-[#bf0303]/40 disabled:dark:bg-rose-950/30 disabled:dark:text-rose-400 disabled:dark:border-rose-800/60 disabled:opacity-100 hover:disabled:bg-[#ff0404]/10 shrink-0"
            >
              <Trash2 size={13} />
              <span>Supprimer versement</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-350 dark:bg-slate-800 mx-0.5 shrink-0" />

            <button
              onClick={handleActualiser}
              className="flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-350 dark:border-slate-700 font-extrabold rounded shadow-inner text-[9.5px] uppercase cursor-pointer shrink-0"
            >
              <RefreshCw size={12} className={`text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Actualiser le solde</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-350 dark:border-slate-700 font-extrabold rounded shadow-inner text-[9.5px] uppercase shrink-0"
            >
              <Printer size={12} className="text-slate-500" />
              <span>Imprimer la situation</span>
            </button>

          </div>

        </div>

        {/* Split Container for Ledger (Master) and Detail (Child) */}
        <div ref={splitContainerRef} className="flex-1 flex flex-col min-h-0 gap-1.5 overflow-hidden">
          
          {/* Section 1: Transaction Ledger Table + Metrics Summary */}
          <div 
            className="flex flex-col min-h-0 gap-1.5 shrink-0 overflow-hidden"
            style={{ height: `${splitPercentage}%` }}
          >
            {/* 4. MASTER: Transaction ledger table */}
            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-inner flex flex-col overflow-hidden min-h-0">
              <div className="overflow-x-auto overflow-y-auto flex-1 flex flex-col min-h-0">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-300 dark:border-slate-800 select-none text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 w-24 text-center">Date</th>
                      <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 w-20 text-center">Heure</th>
                      <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 w-28 text-right">Ventes</th>
                      <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 w-28 text-right">Versements</th>
                      <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 w-32 text-right">Solde</th>
                      <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">Remarques</th>
                      <th className="py-2 px-3 w-24 text-center">Utilisateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px] font-bold">
                    
                    {visibleLedger.map((item, index) => {
                      const isSelected = selectedRowId === item.rowId;
                      const isNegativeSolde = item.solde < 0;

                      return (
                        <tr
                          key={`${item.rowId}-${index}`}
                          data-selected={isSelected}
                          onClick={() => setSelectedRowId(item.rowId)}
                          className={`cursor-pointer hover:bg-[#ebfbf3] dark:hover:bg-emerald-950/20 transition-all ${
                            isSelected 
                              ? 'bg-[#059669] text-white hover:bg-[#059669] dark:bg-emerald-800' 
                              : index % 2 === 0 
                                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100' 
                                : 'bg-[#fafdfc] dark:bg-slate-900/40 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {/* Date */}
                          <td className={`py-1.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-center ${isSelected ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {item.date}
                          </td>

                          {/* Time */}
                          <td className={`py-1.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-center ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                            {item.time}
                          </td>

                          {/* Ventes (DA) */}
                          <td className={`py-1.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right leading-tight ${
                            isSelected 
                              ? 'text-white' 
                              : item.ventes > 0 
                                ? 'text-orange-700 dark:text-orange-400' 
                                : 'text-slate-400'
                          }`}>
                            {item.ventes > 0 
                              ? item.ventes.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '0,00'
                            }
                          </td>

                          {/* Versements (DA) */}
                          <td className={`py-1.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right leading-tight ${
                            isSelected 
                              ? 'text-white' 
                              : item.versements > 0 
                                ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' 
                                : 'text-slate-400'
                          }`}>
                            {item.versements > 0 
                              ? item.versements.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '0,00'
                            }
                          </td>

                          {/* Solde Running progressive */}
                          <td className={`py-1.5 px-3 border-r border-slate-200 dark:border-slate-800 text-right text-[11.5px] leading-tight ${
                            isSelected 
                              ? 'text-white' 
                              : isNegativeSolde 
                                ? 'text-emerald-600 dark:text-emerald-500 font-normal' 
                                : 'text-red-700 dark:text-red-400'
                          }`}>
                            {item.solde.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Remarks */}
                          <td className="py-1.5 px-3 border-r border-slate-200 dark:border-slate-800 truncate max-w-xs font-sans text-xs">
                            {item.remarks}
                          </td>

                          {/* User */}
                          <td className={`py-1.5 px-3 font-sans font-semibold uppercase text-center ${isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                            {item.user}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredLedger.length > visibleLedger.length && (
                      <tr>
                        <td colSpan={7} className="text-center p-3 bg-slate-50/50 dark:bg-slate-900/50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setLedgerLimit(prev => prev + 150);
                            }}
                            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Afficher plus de transactions ({filteredLedger.length - visibleLedger.length} restantes)
                          </button>
                        </td>
                      </tr>
                    )}

                    {filteredLedger.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-450 dark:text-slate-500 font-sans italic text-xs">
                          Aucune transaction trouvée pour cet état de compte client.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. METRICS Summary Row */}
            <div className="bg-[#e4ebd5] dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2 rounded-lg flex flex-nowrap overflow-x-auto scrollbar-none gap-x-5 gap-y-2 items-center justify-between shrink-0 select-none shadow-sm">
              <div className="flex flex-nowrap gap-x-5 gap-y-2 items-center shrink-0">
                {/* Solde Initial */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Solde initial :</span>
                  <div className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1 text-xs font-mono font-black min-w-[90px] text-right text-slate-700 dark:text-slate-200 shadow-inner">
                    {(ledgerMetrics.soldeInitial ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Total des Ventes */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total des Ventes :</span>
                  <div className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1 text-xs font-mono font-black min-w-[110px] text-right text-orange-700 dark:text-orange-400 shadow-inner">
                    {(ledgerMetrics.totalVentes ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Total des Versements */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total des Versements :</span>
                  <div className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1 text-xs font-mono font-black min-w-[110px] text-right text-emerald-700 dark:text-emerald-400 shadow-inner">
                    {(ledgerMetrics.totalVersements ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Current Solde */}
                <div className="flex items-center gap-1.5">
                  {ledgerMetrics.soldeFinal > 0 ? (
                    <>
                      <span className="text-[10px] font-black uppercase text-red-700 dark:text-red-400 bg-red-50 dark:bg-slate-850 px-1.5 py-0.5 rounded">Solde :</span>
                      <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-300 dark:border-red-900 rounded px-3 py-1 text-xs font-mono font-black min-w-[110px] text-right text-red-700 dark:text-red-400 shadow-sm leading-none flex items-center justify-end">
                        {(ledgerMetrics.soldeFinal ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </>
                  ) : ledgerMetrics.soldeFinal < 0 ? (
                    <>
                      <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-slate-850 px-1.5 py-0.5 rounded">Solde :</span>
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-900 rounded px-3 py-1 text-xs font-mono font-black min-w-[110px] text-right text-emerald-700 dark:text-emerald-400 shadow-sm leading-none flex items-center justify-end">
                        {Math.abs(ledgerMetrics.soldeFinal ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CR
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded">Solde :</span>
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-3 py-1 text-xs font-mono font-black min-w-[110px] text-right text-slate-700 dark:text-slate-355 shadow-sm leading-none flex items-center justify-end">
                        0,00
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* SPLITTER BAR BETWEEN SECTION 1 AND SECTION 2 */}
          <div 
            onPointerDown={startResizeSplit}
            className="h-3 cursor-row-resize flex items-center justify-center select-none active:bg-slate-100/10 dark:active:bg-slate-950/10 group shrink-0"
            title="Faites glisser pour redimensionner"
          >
            <div className="w-full h-[1px] bg-slate-350 dark:bg-slate-800/85 flex items-center justify-center">
              <div className="w-20 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full group-hover:bg-emerald-550 dark:group-hover:bg-emerald-500 group-active:bg-emerald-600 transition-all shadow-xs" />
            </div>
          </div>

          {/* Section 2: Detail of selected bill products list ("Détail du bon") */}
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-2 flex flex-col overflow-hidden shadow-sm flex-1 min-h-0"
          >
            <div className="border-b border-slate-200 dark:border-slate-800 pb-1 mb-1 flex items-center justify-between shrink-0">
              <h4 className="text-[11px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>📰 Détail du bon</span>
                {selectedVoucherDetails ? (
                  <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] normal-case">
                    N° {selectedVoucherDetails.id} — {selectedVoucherDetails.client} ({selectedVoucherDetails.date})
                  </span>
                ) : (
                  <span className="text-[9.5px] text-slate-450 dark:text-slate-500 normal-case font-normal">
                    (Rédigez un bon en F2 ou cliquez sur une ligne de vente dans le tableau ci-dessus pour inspecter ses articles)
                  </span>
                )}
              </h4>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded shadow-inner bg-slate-50/50 dark:bg-slate-950/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-800 select-none text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 w-36">Code à barre</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">Produit</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 w-20 text-center">Colis</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 w-24 text-center">Colissage</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 w-20 text-center">Qté</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 w-28 text-right">Prix de vente</th>
                  <th className="py-1.5 px-2.5 w-32 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[10.5px] font-bold">
                {selectedVoucherDetails ? (
                  selectedVoucherDetails.items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-emerald-50/55 dark:hover:bg-slate-800/40 text-slate-850 dark:text-slate-200">
                      {/* Code à barre */}
                      <td className="py-1 px-2.5 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                        {item.code}
                      </td>
                      {/* Produit */}
                      <td className="py-1 px-2.5 border-r border-slate-200 dark:border-slate-800 font-sans text-xs">
                        {item.designation}
                      </td>
                      {/* Colis */}
                      <td className="py-1 px-2.5 border-r border-slate-200 dark:border-slate-800 text-center text-slate-500">
                        {item.nbreColis !== undefined && item.nbreColis > 0 ? item.nbreColis : ''}
                      </td>
                      {/* Colissage */}
                      <td className="py-1 px-2.5 border-r border-slate-200 dark:border-slate-800 text-center text-slate-500">
                        {item.colisage !== undefined && item.colisage > 0 ? item.colisage : ''}
                      </td>
                      {/* Qté */}
                      <td className="py-1 px-2.5 border-r border-slate-200 dark:border-slate-800 text-center text-[#1e3a8a] dark:text-sky-305">
                        {item.qty}
                      </td>
                      {/* Prix de vente */}
                      <td className="py-1 px-2.5 border-r border-slate-200 dark:border-slate-800 text-right">
                        {(item.price || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </td>
                      {/* Total */}
                      <td className="py-1 px-2.5 text-right font-black text-slate-800 dark:text-slate-101">
                        {(item.total || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500 font-sans italic text-xs">
                      Aucune ligne de vente sélectionnée. Cliquez sur une ligne de Bon de Livraison (N° de vente) ci-dessus pour inspecter les articles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      </div>

      {/* 8. Beautiful "RECOUVREMENT CLIENT" Dialog modal */}
      {isPaymentModalOpen && currentClient && (
        <div className="fixed inset-0 bg-slate-900/60 z-55 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-400 dark:border-slate-800 w-full max-w-lg rounded shadow-2xl overflow-hidden flex flex-col font-sans animate-in fade-in zoom-in-95 duration-120">
            
            {/* Header Title Dialog */}
            <div className="bg-emerald-700 dark:bg-slate-950 text-white px-3 py-2 flex justify-between items-center select-none border-b border-emerald-850 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider">
                RECOUVREMENT CLIENT / VERSEMENT
              </h3>
              <button 
                onClick={() => setIsPaymentModalOpen(false)} 
                className="hover:bg-white/10 p-0.5 rounded text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSavePaymentForm} className="p-3.5 flex flex-col gap-3">
              
              {/* Row 1: Date & Mode de paiement */}
              <div className="grid grid-cols-2 gap-4">
                {/* Date field */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-650 dark:text-slate-400 mb-1">Date</span>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-800 p-1.5 focus:border-emerald-500 rounded font-mono text-xs font-bold shadow-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Mode de paiement */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-650 dark:text-slate-400 mb-1">Mode de versement</span>
                  <select
                    value={formPaymentMode}
                    onChange={(e) => setFormPaymentMode(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-800 p-1.5 focus:border-emerald-500 rounded font-bold text-xs shadow-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="ESPECE">ESPECE</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="VERSEMENT">VERSEMENT BANCAIRE</option>
                    <option value="BOURSAL">BOURSAL</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>
              </div>

              {/* Box group mimicking the bordered box in screenshot 2 with "Paiement espèce" tab */}
              <div className="border border-emerald-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 p-3 mt-1.5 shadow-sm relative pt-4">
                
                {/* Tab layout on the left top corner */}
                <span className="absolute -top-[11px] left-3 bg-slate-100 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 border-b-white dark:border-b-slate-950 text-[10.5px] font-black text-emerald-800 dark:text-emerald-400 px-3 py-0.5 rounded-t font-sans shadow-sm leading-none">
                  Mode : {formPaymentMode.toLowerCase()}
                </span>

                <div className="grid grid-cols-12 gap-4">
                  {/* Left Column containing Solde values */}
                  <div className="col-span-7 bg-gradient-to-b from-emerald-50 to-emerald-100/55 dark:from-slate-900 dark:to-slate-900/60 border border-emerald-205 dark:border-slate-800 p-3 rounded flex flex-col gap-3">
                    
                    {/* Ancien Solde */}
                    <div>
                      <span className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 mb-0.5">Dette Actuelle (Ancien Solde)</span>
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 py-1 px-2.5 font-mono font-black text-right text-sm text-slate-800 dark:text-slate-100 rounded leading-tight shadow-sm">
                        {(modalAncienSolde ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Versement */}
                    <div>
                      <span className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 mb-0.5">Montant Versé (Crédit)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={formAmount || ''}
                        onChange={(e) => setFormAmount(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border-2 border-emerald-600 focus:border-emerald-500 py-1 px-2.5 font-mono font-black text-right text-sm text-slate-950 dark:text-slate-150 rounded shadow-inner"
                        placeholder="0,00"
                        autoFocus
                      />
                    </div>

                    {/* Nouveau Solde */}
                    <div>
                      <span className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 mb-0.5">Dette Restante (Nouveau Solde)</span>
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 py-1 px-2.5 font-mono font-black text-right text-sm text-slate-850 dark:text-slate-100 rounded leading-tight shadow-sm">
                        {(modalNouveauSolde ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                  </div>

                  {/* Right Column (White space containing Source de payement select box) */}
                  <div className="col-span-5 flex flex-col justify-start gap-1">
                    <span className="block text-[10px] font-bold text-slate-650 dark:text-slate-400 mb-0.5">Coffre de Réception</span>
                    <select
                      value={formPaymentSource}
                      onChange={(e) => setFormPaymentSource(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-320 dark:border-slate-800 p-1 text-xs font-bold rounded shadow-sm focus:border-emerald-500 text-slate-900 dark:text-slate-100"
                    >
                      <option value="COFFRE N°1">COFFRE N°1</option>
                      <option value="CAISSE PRINCIPALE">CAISSE PRINCIPALE</option>
                      <option value="COMPTE COURANT CHK">COMPTE COURANT CHK</option>
                      <option value="COFFRE DE SÉCURITÉ">COFFRE DE SÉCURITÉ</option>
                    </select>

                    <div className="flex-1 mt-3 flex flex-col gap-1 select-none opacity-80 text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded leading-tight text-slate-500">
                      <span className="font-extrabold uppercase mb-0.5">Client :</span>
                      <span className="truncate font-black text-slate-700 dark:text-slate-300">{currentClient.name}</span>
                      <span className="text-[9px]">Code: {currentClient.code}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Light cyan / light green bar at the bottom */}
              <div className="bg-[#eafbf2] dark:bg-emerald-950/20 border border-[#b2edd3] dark:border-emerald-950/40 h-6 w-full rounded mt-1 shadow-inner flex items-center justify-center">
                <span className="text-[9.5px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Calculateur de solde grand livre du client actif
                </span>
              </div>

              {/* Actions row: OK & Annuler */}
              <div className="flex justify-end gap-2 border-t border-slate-250 dark:border-slate-800 pt-3 mt-1 select-none">
                <button
                  type="submit"
                  className="px-8 py-1 bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-101 font-extrabold text-[12px] rounded shadow-sm leading-tight transition-all cursor-pointer"
                >
                  Ok
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-6 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-350 dark:border-slate-700 font-extrabold text-[12px] rounded text-slate-800 dark:text-slate-100 shadow-sm leading-tight transition-all cursor-pointer"
                >
                  Annuler
                </button>
              </div>

            </form>

          </div>
         </div>
       )}

      {/* 9. Custom Safe Delete Confirmation Dialog Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-55 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans animate-in fade-in zoom-in-95 duration-120">
            {/* Header / Title bar */}
            <div className="bg-red-650 dark:bg-red-800 text-white px-3.5 py-2 flex justify-between items-center select-none border-b border-red-700 dark:border-red-900">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span>⚠️ CONFIRMATION DE SUPPRESSION</span>
              </h3>
              <button 
                onClick={() => setIsDeleteConfirmOpen(false)} 
                className="hover:bg-white/10 p-0.5 rounded text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content body */}
            <div className="p-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                <HelpCircle size={24} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Voulez-vous vraiment supprimer ce versement de client ?
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-semibold">
                  Cette action est définitive et ajustera le solde actuel de votre client.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 bg-slate-50 dark:bg-slate-950 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 h-8 bg-[#ff0404] hover:bg-[#d40303] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                Oui, Supprimer
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold text-xs rounded-lg transition-all cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODERN CLIENT SELECTOR MODAL (NON-RETRO) */}
      {isClientChooserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[100] p-4 text-xs font-sans text-slate-800 dark:text-slate-100 select-none">
          <div className="w-[600px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-emerald-600 dark:bg-slate-950 px-5 py-4 flex items-center justify-between select-none">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <Users size={16} className="text-white" /> Sélectionner un Client
              </span>
              <button 
                onClick={() => {
                  setIsClientChooserOpen(false);
                  setChooserSearch('');
                }}
                className="w-7 h-7 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content & Search */}
            <div className="p-4 flex flex-col gap-3 overflow-hidden min-h-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher par nom, code ou téléphone..."
                  value={chooserSearch}
                  onChange={(e) => setChooserSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-emerald-500 font-sans"
                  autoFocus
                />
                {chooserSearch && (
                  <button
                    onClick={() => setChooserSearch('')}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* List Container */}
              <div className="flex-1 max-h-[350px] overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-0">
                {filteredChooserClients.map(c => {
                    const isSelected = c.id === selectedClientId;
                    return (
                      <div
                        key={c.id}
                        onDoubleClick={() => {
                          setSelectedClientId(c.id);
                          setSelectedRowId(null);
                          setIsClientChooserOpen(false);
                          setChooserSearch('');
                        }}
                        onClick={() => {
                          setSelectedClientId(c.id);
                          setSelectedRowId(null);
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-slate-800/80 border-emerald-400 dark:border-emerald-500 shadow-xs'
                            : 'bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-850'
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              {c.name}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono font-bold rounded">
                              {c.code}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                            Tél: {c.contact || 'Aucun contact'} • Adresse: {c.address || "Aucune adresse"}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="block text-[9px] font-bold text-slate-400 uppercase leading-none">Solde</span>
                            <span className={`font-mono font-black text-xs ${
                              c.balance > 0 
                                ? 'text-red-650 dark:text-red-400' 
                                : c.balance < 0 
                                  ? 'text-green-650 dark:text-green-400' 
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              {(c.balance ?? 0).toLocaleString('fr-FR')} DA
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClientId(c.id);
                              setSelectedRowId(null);
                              setIsClientChooserOpen(false);
                              setChooserSearch('');
                            }}
                            className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            Sélectionner
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {filteredChooserClients.length === 0 && (
                  <div className="text-center py-8 text-slate-400 font-bold">
                    Aucun client ne correspond à votre recherche.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3 border-t border-slate-200 dark:border-slate-850 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsClientChooserOpen(false);
                  setChooserSearch('');
                }}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-300 font-extrabold text-xs rounded-lg transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default React.memo(SituationClientsWindow, (prev, next) => {
  return prev.clients === next.clients &&
         prev.sales === next.sales &&
         prev.payments === next.payments;
});

