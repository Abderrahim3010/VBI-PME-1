import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { SalesVoucher, PurchaseVoucher, Client, Supplier, User as UserType } from '../types';
import { getStorageJson } from '../services/localDb';
import {
  Printer,
  Search,
  FileSpreadsheet,
  PieChart,
  LogOut,
  Calendar,
  Users,
  User,
  CreditCard,
  Filter,
  RotateCcw,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface ConsultationBonsViewProps {
  type: 'ventes' | 'achats';
  sales: SalesVoucher[];
  purchases: PurchaseVoucher[];
  clients?: Client[];
  suppliers?: Supplier[];
  users?: UserType[];
  onClose?: () => void;
}

export default function ConsultationBonsView({
  type,
  sales,
  purchases,
  clients = [],
  suppliers = [],
  users = [],
  onClose
}: ConsultationBonsViewProps) {
  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedPaymentModes, setSelectedPaymentModes] = useState<string[]>([]);
  const [selectedParties, setSelectedParties] = useState<string[]>([]);
  const [partySearch, setPartySearch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<'clients' | 'users' | 'payment' | null>(null);

  // Table Navigation & Selection States
  const [selectedVoucherIndex, setSelectedVoucherIndex] = useState<number>(0);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // Target vouchers dataset depending on mode
  const rawVouchers = type === 'ventes' ? sales : purchases;

  // Build unique users list
  const usersList = useMemo(() => {
    const set = new Set<string>();
    set.add('ADMIN');
    users.forEach(u => {
      if (u.username) set.add(u.username.toUpperCase());
    });
    rawVouchers.forEach(v => {
      const u = type === 'ventes' ? (v as SalesVoucher).vendeur || 'ADMIN' : 'ADMIN';
      if (u) set.add(u.toUpperCase());
    });
    return Array.from(set);
  }, [users, rawVouchers, type]);

  // Filtered Users list for the checkable list
  const filteredUsersList = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.trim().toLowerCase();
    return usersList.filter(u => u.toLowerCase().includes(q));
  }, [usersList, userSearch]);

  // Parties list (Clients or Suppliers)
  const partiesList = useMemo(() => {
    if (type === 'ventes') {
      return clients.map(c => ({ id: c.id, name: c.name }));
    } else {
      return suppliers.map(s => ({ id: s.id, name: s.name }));
    }
  }, [type, clients, suppliers]);

  // Filtered Parties list for the checkable list
  const filteredPartiesList = useMemo(() => {
    if (!partySearch.trim()) return partiesList;
    const q = partySearch.trim().toLowerCase();
    return partiesList.filter(p => p.name.toLowerCase().includes(q));
  }, [partiesList, partySearch]);

  // Available Payment Modes
  const availablePaymentModes = useMemo(() => [
    'Espèces',
    'A terme',
    'Chèque',
    'Virement',
    'Versement'
  ], []);

  // Helper date parsing (DD/MM/YYYY)
  const parseVoucherDateToObj = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
  };

  // Filter vouchers
  const filteredVouchers = useMemo(() => {
    return rawVouchers.filter(v => {
      // Date start filter
      if (startDate) {
        const vDate = parseVoucherDateToObj(v.date);
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (vDate && vDate < sDate) return false;
      }

      // Date end filter
      if (endDate) {
        const vDate = parseVoucherDateToObj(v.date);
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (vDate && vDate > eDate) return false;
      }

      // User filter (if any checked)
      if (selectedUsers.length > 0) {
        const u = ((type === 'ventes' ? (v as SalesVoucher).vendeur : 'ADMIN') || 'ADMIN').toUpperCase();
        if (!selectedUsers.some(sel => sel.toUpperCase() === u)) return false;
      }

      // Payment modes filter (if any checked)
      if (selectedPaymentModes.length > 0) {
        let vMode = v.paymentMode || 'Espèces';
        if (vMode === 'À terme') vMode = 'A terme';
        const isMatched = selectedPaymentModes.some(m => {
          if (m.toLowerCase() === vMode.toLowerCase()) return true;
          if (m === 'A terme' && vMode === 'À terme') return true;
          return false;
        });
        if (!isMatched) return false;
      }

      // Parties filter (if any checked)
      if (selectedParties.length > 0) {
        const partyName = type === 'ventes' ? (v as SalesVoucher).client : (v as PurchaseVoucher).supplier;
        if (!selectedParties.includes(partyName)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const idMatch = v.id.toLowerCase().includes(q);
        const itemMatch = v.items?.some(i => i.code.toLowerCase().includes(q) || i.designation.toLowerCase().includes(q));
        const obsMatch = (v as SalesVoucher).observations?.toLowerCase().includes(q);
        if (!idMatch && !itemMatch && !obsMatch) return false;
      }

      return true;
    });
  }, [rawVouchers, type, startDate, endDate, selectedUsers, selectedPaymentModes, selectedParties, searchQuery]);

  // Selected voucher
  const safeVoucherIndex = Math.min(selectedVoucherIndex, Math.max(0, filteredVouchers.length - 1));
  const selectedVoucher = filteredVouchers[safeVoucherIndex] || null;
  const selectedVoucherItems = selectedVoucher?.items || [];

  // Totals calculated on filtered dataset
  const totalAmount = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.amount || 0), 0), [filteredVouchers]);
  const totalRemise = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.remise || 0), 0), [filteredVouchers]);
  const totalHT = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.totalHT || 0), 0), [filteredVouchers]);
  const totalTVA = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.tva || 0), 0), [filteredVouchers]);
  const totalTimbre = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.timbre || 0), 0), [filteredVouchers]);
  const totalTTC = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.ttc || 0), 0), [filteredVouchers]);
  const totalVersement = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.versement || 0), 0), [filteredVouchers]);

  const facturesCount = filteredVouchers.length;
  const productsCount = useMemo(() => filteredVouchers.reduce((acc, v) => acc + (v.itemsCount || v.items?.length || 0), 0), [filteredVouchers]);

  // Format currency
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  // Reset filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedUsers([]);
    setUserSearch('');
    setSelectedPaymentModes([]);
    setSelectedParties([]);
    setPartySearch('');
    setSearchQuery('');
    setOpenDropdown(null);
    setSelectedVoucherIndex(0);
    setSelectedItemIndex(0);
  };

  // Toggle single party selection
  const handleToggleParty = (name: string) => {
    setSelectedParties(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  // Toggle all parties
  const handleToggleAllParties = () => {
    if (selectedParties.length === partiesList.length && partiesList.length > 0) {
      setSelectedParties([]);
    } else {
      setSelectedParties(partiesList.map(p => p.name));
    }
  };

  // Toggle single user
  const handleToggleUser = (name: string) => {
    setSelectedUsers(prev =>
      prev.includes(name) ? prev.filter(u => u !== name) : [...prev, name]
    );
  };

  // Toggle all users
  const handleToggleAllUsers = () => {
    if (selectedUsers.length === usersList.length && usersList.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers([...usersList]);
    }
  };

  // Toggle single payment mode
  const handleTogglePaymentMode = (mode: string) => {
    setSelectedPaymentModes(prev =>
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
  };

  // Toggle all payment modes
  const handleToggleAllPaymentModes = () => {
    if (selectedPaymentModes.length === availablePaymentModes.length) {
      setSelectedPaymentModes([]);
    } else {
      setSelectedPaymentModes([...availablePaymentModes]);
    }
  };

  // Dropdown states for Export Excel
  const [excelMenuOpen, setExcelMenuOpen] = useState(false);
  const [excelMenuPos, setExcelMenuPos] = useState<{ top: number; left: number } | null>(null);
  const exportExcelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExcelMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleExcelMenu = () => {
    if (excelMenuOpen) {
      setExcelMenuOpen(false);
      return;
    }
    const rect = exportExcelBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setExcelMenuPos({
        top: rect.top,
        left: rect.right + 8,
      });
      setExcelMenuOpen(true);
    }
  };

  // Export to Excel / CSV (all vouchers or selected voucher only)
  const handleExportExcel = (mode: 'all' | 'selected') => {
    const vouchersToExport = mode === 'selected'
      ? (selectedVoucher ? [selectedVoucher] : [])
      : filteredVouchers;

    if (vouchersToExport.length === 0) return;

    const title = mode === 'selected' && selectedVoucher
      ? `Bon_${type === 'ventes' ? 'Vente' : 'Achat'}_${selectedVoucher.id}`
      : `Consultation_${type === 'ventes' ? 'Ventes' : 'Achats'}`;

    // Load product map to compute item purchase prices / cost
    const rawProducts = getStorageJson<any[]>('compos_products', []);
    const productMap = new Map<string, any>();
    rawProducts.forEach(p => {
      if (p.code) productMap.set(String(p.code), p);
      if (p.id) productMap.set(String(p.id), p);
    });

    // Headers matching the attached Excel image exactly (25 columns)
    let csvContent = '\uFEFF'; // BOM for proper UTF-8 Excel French accents
    csvContent += `N° BL;N° Facture;Date;Heure;${
      type === 'ventes' ? 'Client' : 'Fournisseur'
    };Montant;Remise;Montant HT;TVA;Timbre;TTC;Verser;Montant achat;Nbre produits;Nbre colis;Utilisateur;Vendeur;Type;Reglement;Observations;Code banque;Libellé de la banque;Date chèque ou du vir;Montant Ach;Benefice\n`;

    vouchersToExport.forEach(v => {
      const party =
        type === 'ventes'
          ? (v as SalesVoucher).client || ''
          : (v as PurchaseVoucher).supplier || '';
      const facture = (v as any).facture || '';
      const dt = v.date || '';
      const tm = v.time || '';
      const montant = Number(v.amount || v.totalHT || 0);
      const remise = Number(v.remise || 0);
      const totalHT = Number(v.totalHT || v.amount || 0);
      const tva = Number(v.tva || 0);
      const timbre = Number(v.timbre || 0);
      const ttc = Number(v.ttc || v.amount || 0);
      const versement = Number(v.versement || v.ttc || 0);

      // Compute total achat for this voucher
      let montantAchat = 0;
      if (v.items && Array.isArray(v.items)) {
        v.items.forEach(item => {
          const prod = productMap.get(String(item.code)) || productMap.get(String(item.id));
          const itemAchat =
            (item as any).purchasePrice ??
            (item as any).costPrice ??
            prod?.prixAchat ??
            prod?.prixDeRevient ??
            0;
          montantAchat += (Number(item.qty) || 0) * Number(itemAchat);
        });
      }
      const nbreProduits = Number(v.itemsCount || v.items?.length || 0);
      const nbreColis = Number(v.colisCount || 0);
      const utilisateur = (v as any).utilisateur || 'admin';
      const vendeur = (v as SalesVoucher).vendeur || '<Aucun>';
      const typeVoucher = v.type || (type === 'ventes' ? 'VENTE' : 'ACHAT');
      const reglement = v.paymentMode || 'ESPECE';
      const observations = (v.observations || '').replace(/"/g, '""');
      const codeBanque = (v as any).codeBanque || '';
      const libelleBanque = ((v as any).libelleBanque || '').replace(/"/g, '""');
      const dateCheque = (v as any).dateCheque || '';
      const montantAch = '';
      const benefice = Math.round(ttc - montantAchat);

      csvContent += `"${v.id}";"${facture}";"${dt}";"${tm}";"${party.replace(/"/g, '""')}";${montant};${remise};${totalHT};${tva};${timbre};${ttc};${versement};${Math.round(montantAchat)};${nbreProduits};${nbreColis};"${utilisateur}";"${vendeur}";"${typeVoucher}";"${reglement}";"${observations}";"${codeBanque}";"${libelleBanque}";"${dateCheque}";"${montantAch}";${benefice}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Report
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex gap-2 font-sans text-xs select-none h-full overflow-hidden p-1.5 bg-slate-100 dark:bg-slate-950">
      
      {/* LEFT SIDE PANEL (Filters & Actions) */}
      <div className="w-72 shrink-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-3 flex flex-col gap-3 shadow-md overflow-y-auto">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 font-black text-[13px] text-slate-800 dark:text-slate-100">
            <Filter size={16} className="text-blue-600 dark:text-blue-400" />
            <span>{type === 'ventes' ? 'Filtres Ventes' : 'Filtres Achats'}</span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            title="Réinitialiser les filtres"
            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-bold text-[11px]"
          >
            <RotateCcw size={12} />
            <span>Réinit.</span>
          </button>
        </div>

        {/* 1. Date "Du" and "Au" boxes */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
            <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Période (Du / Au)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Du</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Au</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Backdrop for closing dropdowns when clicking outside */}
        {openDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenDropdown(null)}
          />
        )}

        {/* 2. Client(s) / Fournisseur(s) Dropdown */}
        <div className="flex flex-col gap-1.5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
              <Users size={14} className="text-blue-600 dark:text-blue-400" />
              <span>{type === 'ventes' ? 'Clients' : 'Fournisseurs'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'clients' ? null : 'clients')}
            className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
          >
            <span className="truncate">
              {selectedParties.length === 0
                ? `Tous les ${type === 'ventes' ? 'clients' : 'fournisseurs'}`
                : `${selectedParties.length} sélectionné(s)`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {selectedParties.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-mono font-black">
                  {selectedParties.length}
                </span>
              )}
              <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
            </div>
          </button>

          {/* Floating Dropdown Menu for Clients */}
          {openDropdown === 'clients' && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Sélection ({selectedParties.length}/{partiesList.length})
                </span>
                <button
                  type="button"
                  onClick={handleToggleAllParties}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {selectedParties.length === partiesList.length && partiesList.length > 0 ? 'Décocher tout' : 'Tout cocher'}
                </button>
              </div>

              <input
                type="text"
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                placeholder={type === 'ventes' ? 'Rechercher client...' : 'Rechercher fournisseur...'}
                className="w-full h-7 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {filteredPartiesList.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-slate-400 italic">
                    Aucun résultat
                  </div>
                ) : (
                  filteredPartiesList.map((p, idx) => {
                    const isChecked = selectedParties.includes(p.name);
                    return (
                      <div
                        key={`party-${p.id || ''}-${p.name}-${idx}`}
                        onClick={() => handleToggleParty(p.name)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none text-xs transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        ) : (
                          <Square size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
                        )}
                        <span className={`truncate ${isChecked ? 'font-bold text-blue-900 dark:text-blue-200' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                          {p.name}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Utilisateurs Dropdown */}
        <div className="flex flex-col gap-1.5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
              <User size={14} className="text-blue-600 dark:text-blue-400" />
              <span>Utilisateurs</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'users' ? null : 'users')}
            className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
          >
            <span className="truncate">
              {selectedUsers.length === 0
                ? 'Tous les utilisateurs'
                : `${selectedUsers.length} sélectionné(s)`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {selectedUsers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-mono font-black">
                  {selectedUsers.length}
                </span>
              )}
              <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
            </div>
          </button>

          {/* Floating Dropdown Menu for Utilisateurs */}
          {openDropdown === 'users' && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Sélection ({selectedUsers.length}/{usersList.length})
                </span>
                <button
                  type="button"
                  onClick={handleToggleAllUsers}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {selectedUsers.length === usersList.length && usersList.length > 0 ? 'Décocher tout' : 'Tout cocher'}
                </button>
              </div>

              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher utilisateur..."
                className="w-full h-7 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {filteredUsersList.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-slate-400 italic">
                    Aucun résultat
                  </div>
                ) : (
                  filteredUsersList.map((u, idx) => {
                    const isChecked = selectedUsers.includes(u);
                    return (
                      <div
                        key={`user-${u}-${idx}`}
                        onClick={() => handleToggleUser(u)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none text-xs transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        ) : (
                          <Square size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
                        )}
                        <span className={`truncate ${isChecked ? 'font-bold text-blue-900 dark:text-blue-200' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                          {u}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Mode de règlement Dropdown */}
        <div className="flex flex-col gap-1.5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
              <CreditCard size={14} className="text-blue-600 dark:text-blue-400" />
              <span>Mode de règlement</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'payment' ? null : 'payment')}
            className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
          >
            <span className="truncate">
              {selectedPaymentModes.length === 0
                ? 'Tous les modes'
                : `${selectedPaymentModes.length} sélectionné(s)`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {selectedPaymentModes.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-mono font-black">
                  {selectedPaymentModes.length}
                </span>
              )}
              <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
            </div>
          </button>

          {/* Floating Dropdown Menu for Mode de règlement (NO search bar) */}
          {openDropdown === 'payment' && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Sélection ({selectedPaymentModes.length}/{availablePaymentModes.length})
                </span>
                <button
                  type="button"
                  onClick={handleToggleAllPaymentModes}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {selectedPaymentModes.length === availablePaymentModes.length ? 'Décocher tout' : 'Tout cocher'}
                </button>
              </div>

              <div className="space-y-1">
                {availablePaymentModes.map((mode, idx) => {
                  const isChecked = selectedPaymentModes.includes(mode);
                  return (
                    <div
                      key={`mode-${mode}-${idx}`}
                      onClick={() => handleTogglePaymentMode(mode)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none text-xs transition-colors"
                    >
                      {isChecked ? (
                        <CheckSquare size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <Square size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
                      )}
                      <span className={`truncate ${isChecked ? 'font-bold text-blue-900 dark:text-blue-200' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                        {mode}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 5. Rechercher */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
            <Search size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Rechercher</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="N° de bon, réf. article, obs..."
            className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        <hr className="border-slate-200 dark:border-slate-800 my-0.5" />

        {/* 6. Action Buttons in Side Panel */}
        <div className="flex flex-col gap-2 mt-auto pt-1">
          <button
            type="button"
            onClick={handlePrintReport}
            className="w-full h-8 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700 rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <Printer size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="truncate">{type === 'ventes' ? "Imprimer Etat des Ventes" : "Imprimer Etat des Achats"}</span>
          </button>

          <button
            ref={exportExcelBtnRef}
            type="button"
            onClick={handleToggleExcelMenu}
            className="w-full h-8 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs transition-all cursor-pointer border border-emerald-700 group"
          >
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet size={15} />
              <span>Export EXCEL</span>
            </div>
            <ChevronRight size={14} className="opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <PieChart size={15} className="text-purple-600 dark:text-purple-400 shrink-0 ml-1" />
            <select className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer">
              <option value="stat">Statistique ▾</option>
              <option value="par_client">Par {type === 'ventes' ? 'Client' : 'Fournisseur'}</option>
              <option value="par_mois">Par Mois</option>
            </select>
          </div>
        </div>
      </div>

      {/* RIGHT MAIN CONTENT AREA (Tables & Summaries) */}
      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        
        {/* Top Vouchers Table */}
        <div className="flex-1 border border-slate-300 dark:border-slate-800 rounded-xl overflow-auto bg-white dark:bg-slate-900 shadow-inner">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 select-none">
              <tr>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center w-16">N°</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-24">Date</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-20">Heure</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700">{type === 'ventes' ? 'Client' : 'Fournisseur'}</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center w-16">Nbre P</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center w-16">Nbre C</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right w-28">Montant</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right w-24">REMISE</th>
                <th className="p-2 text-right w-28">HT</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 dark:text-slate-600 italic">
                    Aucun bon trouvé correspondant aux filtres sélectionnés
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v, idx) => {
                  const isSelected = safeVoucherIndex === idx;
                  const partyName = type === 'ventes' ? (v as SalesVoucher).client : (v as PurchaseVoucher).supplier;
                  return (
                    <tr
                      key={`voucher-${v.id || 'void'}-${idx}`}
                      data-selected={isSelected}
                      onClick={() => {
                        setSelectedVoucherIndex(idx);
                        setSelectedItemIndex(0);
                      }}
                      className={`cursor-pointer transition-colors border-b border-slate-200 dark:border-slate-800/60 font-mono text-[11px] ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold dark:bg-blue-600'
                          : 'hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 even:bg-slate-50/50 dark:even:bg-slate-900/40'
                      }`}
                    >
                      <td className="p-1.5 text-center font-bold border-r border-slate-200/60 dark:border-slate-800">{v.id}</td>
                      <td className="p-1.5 border-r border-slate-200/60 dark:border-slate-800">{v.date}</td>
                      <td className="p-1.5 border-r border-slate-200/60 dark:border-slate-800">{v.time}</td>
                      <td className="p-1.5 border-r border-slate-200/60 dark:border-slate-800 font-sans font-medium truncate">{partyName}</td>
                      <td className="p-1.5 text-center border-r border-slate-200/60 dark:border-slate-800">{v.itemsCount || v.items?.length || 0}</td>
                      <td className="p-1.5 text-center border-r border-slate-200/60 dark:border-slate-800">{v.colisCount || 0}</td>
                      <td className="p-1.5 text-right border-r border-slate-200/60 dark:border-slate-800">{formatMoney(v.amount)}</td>
                      <td className="p-1.5 text-right border-r border-slate-200/60 dark:border-slate-800">{formatMoney(v.remise)}</td>
                      <td className="p-1.5 text-right">{formatMoney(v.totalHT)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Middle Summary Header (No Début/Préc/Suivant/Fin buttons) */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-800 text-xs shrink-0 select-none shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
            <span>Détail du Bon :</span>
            <span className="font-mono text-blue-600 dark:text-blue-400 font-black text-sm">
              {selectedVoucher ? selectedVoucher.id : '---'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">Nombre de Factures</span>
              <div className="bg-slate-100 dark:bg-slate-950 px-3 py-0.5 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold text-blue-700 dark:text-blue-400">
                {facturesCount}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">Nombre de produits</span>
              <div className="bg-slate-100 dark:bg-slate-950 px-3 py-0.5 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold text-blue-700 dark:text-blue-400">
                {productsCount}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section (Items Table & Totals Card) */}
        <div className="grid grid-cols-12 gap-2 flex-1 min-h-[160px] overflow-hidden">
          {/* Bottom Items Table */}
          <div className="col-span-9 border border-slate-300 dark:border-slate-800 rounded-xl overflow-auto bg-white dark:bg-slate-900 shadow-inner">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 select-none">
                <tr>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center w-10">N°</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 w-28">Code à barre</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700">Produit</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center w-16">Nbre colis</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center w-16">Colissage</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right w-16">Qté</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right w-24">{type === 'ventes' ? 'PU vente' : 'PU achat'}</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right w-24">Total HT</th>
                  <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right w-16">Taux TVA</th>
                  <th className="p-1.5 text-right w-24">Montant</th>
                </tr>
              </thead>
              <tbody>
                {selectedVoucherItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-400 dark:text-slate-600 italic">
                      {filteredVouchers.length === 0 ? "Aucun bon disponible" : "Sélectionnez un bon ci-dessus pour afficher la liste des articles"}
                    </td>
                  </tr>
                ) : (
                  selectedVoucherItems.map((item, idx) => {
                    const isSelected = selectedItemIndex === idx;
                    return (
                      <tr
                        key={`item-${item.id || item.code || 'item'}-${idx}`}
                        onClick={() => setSelectedItemIndex(idx)}
                        className={`cursor-pointer transition-colors border-b border-slate-200 dark:border-slate-800/60 font-mono text-[11px] ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 even:bg-slate-50/50 dark:even:bg-slate-900/40'
                        }`}
                      >
                        <td className="p-1.5 text-center font-bold border-r border-slate-200/60 dark:border-slate-800">{idx + 1}</td>
                        <td className="p-1.5 border-r border-slate-200/60 dark:border-slate-800 font-mono">{item.code}</td>
                        <td className="p-1.5 border-r border-slate-200/60 dark:border-slate-800 font-sans font-medium truncate">{item.designation}</td>
                        <td className="p-1.5 text-center border-r border-slate-200/60 dark:border-slate-800">{item.nbreColis || ''}</td>
                        <td className="p-1.5 text-center border-r border-slate-200/60 dark:border-slate-800">{item.colisage || ''}</td>
                        <td className="p-1.5 text-right border-r border-slate-200/60 dark:border-slate-800">{item.qty}</td>
                        <td className="p-1.5 text-right border-r border-slate-200/60 dark:border-slate-800">{formatMoney(item.price)}</td>
                        <td className="p-1.5 text-right border-r border-slate-200/60 dark:border-slate-800">{formatMoney(item.total)}</td>
                        <td className="p-1.5 text-right border-r border-slate-200/60 dark:border-slate-800">0,00</td>
                        <td className="p-1.5 text-right">{formatMoney(item.total)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Summary Panel Right */}
          <div className="col-span-3 bg-blue-50/70 dark:bg-slate-950 p-2.5 rounded-xl border border-blue-200 dark:border-slate-800 flex flex-col gap-1.5 select-none text-xs justify-between shadow-2xs">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Montant</span>
                <div className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                  {formatMoney(totalAmount)}
                </div>
              </div>

              <div className="flex justify-between items-center gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total Remise</span>
                <div className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                  {formatMoney(totalRemise)}
                </div>
              </div>

              <div className="flex justify-between items-center gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total HT</span>
                <div className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                  {formatMoney(totalHT)}
                </div>
              </div>

              <div className="flex justify-between items-center gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total TVA</span>
                <div className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                  {formatMoney(totalTVA)}
                </div>
              </div>

              <div className="flex justify-between items-center gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total timbre</span>
                <div className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                  {formatMoney(totalTimbre)}
                </div>
              </div>

              <div className="flex justify-between items-center gap-1 pt-1">
                <span className="font-bold text-blue-900 dark:text-blue-300">Total TTC (Bons fermés)</span>
                <div className="w-28 bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-700 px-2 py-0.5 rounded font-mono font-bold text-right text-blue-700 dark:text-blue-300">
                  {formatMoney(totalTTC)}
                </div>
              </div>

              <div className="flex justify-between items-center gap-1 pt-1 border-t border-slate-300 dark:border-slate-800">
                <span className="font-bold text-emerald-800 dark:text-emerald-400">Total versement</span>
                <div className="w-28 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-700 px-2 py-0.5 rounded font-mono font-bold text-right text-emerald-700 dark:text-emerald-300">
                  {formatMoney(totalVersement)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Export EXCEL Options Menu (F8-style to the right) */}
        {excelMenuOpen && excelMenuPos && createPortal(
          <>
            <div
              className="fixed inset-0 z-[99998]"
              onClick={() => setExcelMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: -6, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: `${excelMenuPos.top}px`,
                left: `${excelMenuPos.left}px`,
                zIndex: 99999,
              }}
              className="w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-emerald-300 dark:border-emerald-800 p-2 flex flex-col gap-1.5 select-none divide-y divide-slate-100 dark:divide-slate-800/80"
            >
              <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                <span>Choix d'export EXCEL</span>
                <span className="text-[9px] font-mono text-slate-400">2 options</span>
              </div>

              <div className="pt-1.5 flex flex-col gap-1">
                {/* Option 1: Exporter tous les bons */}
                <button
                  type="button"
                  onClick={() => {
                    setExcelMenuOpen(false);
                    handleExportExcel('all');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 flex items-center gap-3 text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Exporter tous les bons ({filteredVouchers.length})
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Générer le fichier Excel pour toute la liste filtrée
                    </span>
                  </div>
                </button>

                {/* Option 2: Exporter le bon sélectionné */}
                <button
                  type="button"
                  onClick={() => {
                    setExcelMenuOpen(false);
                    handleExportExcel('selected');
                  }}
                  disabled={!selectedVoucher}
                  className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left transition-all group ${
                    selectedVoucher
                      ? 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <CheckSquare size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Exporter le bon sélectionné
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      {selectedVoucher
                        ? `Bon N° ${selectedVoucher.id} (${
                            type === 'ventes'
                              ? (selectedVoucher as SalesVoucher).client
                              : (selectedVoucher as PurchaseVoucher).supplier
                          })`
                        : 'Aucun bon sélectionné'}
                    </span>
                  </div>
                </button>
              </div>
            </motion.div>
          </>,
          document.body
        ) }

      </div>
    </div>
  );
}
