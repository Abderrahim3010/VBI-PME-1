import React, { useState, useMemo } from 'react';
import { SalesVoucher, PurchaseVoucher, Client, Supplier } from '../types';
import { Printer, Search, X, FileSpreadsheet, PieChart, LogOut } from 'lucide-react';

interface ConsultationBonsViewProps {
  type: 'ventes' | 'achats';
  sales: SalesVoucher[];
  purchases: PurchaseVoucher[];
  clients?: Client[];
  suppliers?: Supplier[];
  onClose?: () => void;
}

export default function ConsultationBonsView({
  type,
  sales,
  purchases,
  clients = [],
  suppliers = [],
  onClose
}: ConsultationBonsViewProps) {
  // Get today's date formatted as YYYY-MM-DD for date inputs
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('<Tous>');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('<Tous>');
  const [selectedParty, setSelectedParty] = useState<string>('<Tous>');
  const [searchVoucherNo, setSearchVoucherNo] = useState<string>('');
  const [searchRef, setSearchRef] = useState<string>('');

  // Table Navigation & Selection States
  const [selectedVoucherIndex, setSelectedVoucherIndex] = useState<number>(0);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // Target vouchers dataset depending on mode
  const rawVouchers = type === 'ventes' ? sales : purchases;

  // Build unique users list
  const usersList = useMemo(() => {
    const set = new Set<string>();
    rawVouchers.forEach(v => {
      const u = type === 'ventes' ? (v as SalesVoucher).vendeur || 'ADMIN' : 'ADMIN';
      if (u) set.add(u);
    });
    return Array.from(set);
  }, [rawVouchers, type]);

  // Parties list (Clients or Suppliers)
  const partiesList = useMemo(() => {
    if (type === 'ventes') {
      return clients.map(c => ({ id: c.id, name: c.name }));
    } else {
      return suppliers.map(s => ({ id: s.id, name: s.name }));
    }
  }, [type, clients, suppliers]);

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

      // User filter
      if (selectedUser !== '<Tous>') {
        const u = type === 'ventes' ? (v as SalesVoucher).vendeur || 'ADMIN' : 'ADMIN';
        if (u !== selectedUser) return false;
      }

      // Payment mode filter
      if (selectedPaymentMode !== '<Tous>') {
        if ((v.paymentMode || 'Espèces') !== selectedPaymentMode) return false;
      }

      // Party filter (Client / Supplier)
      if (selectedParty !== '<Tous>') {
        const partyName = type === 'ventes' ? (v as SalesVoucher).client : (v as PurchaseVoucher).supplier;
        if (partyName !== selectedParty) return false;
      }

      // Search Voucher No
      if (searchVoucherNo.trim()) {
        const q = searchVoucherNo.trim().toLowerCase();
        if (!v.id.toLowerCase().includes(q)) return false;
      }

      // Search Reference
      if (searchRef.trim()) {
        const q = searchRef.trim().toLowerCase();
        const hasItemMatch = v.items?.some(i => i.code.toLowerCase().includes(q) || i.designation.toLowerCase().includes(q));
        const hasObsMatch = (v as SalesVoucher).observations?.toLowerCase().includes(q);
        if (!hasItemMatch && !hasObsMatch) return false;
      }

      return true;
    });
  }, [rawVouchers, type, startDate, endDate, selectedUser, selectedPaymentMode, selectedParty, searchVoucherNo, searchRef]);

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
    setSelectedUser('<Tous>');
    setSelectedPaymentMode('<Tous>');
    setSelectedParty('<Tous>');
    setSearchVoucherNo('');
    setSearchRef('');
    setSelectedVoucherIndex(0);
    setSelectedItemIndex(0);
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (filteredVouchers.length === 0) return;
    const title = type === 'ventes' ? 'Consultation_Ventes' : 'Consultation_Achats';
    let csvContent = `data:text/csv;charset=utf-8,N°;Date;Heure;${type === 'ventes' ? 'Client' : 'Fournisseur'};Nbre P;Montant;Remise;HT;TTC;Versement\n`;
    
    filteredVouchers.forEach(v => {
      const party = type === 'ventes' ? (v as SalesVoucher).client : (v as PurchaseVoucher).supplier;
      csvContent += `"${v.id}";"${v.date}";"${v.time}";"${party}";${v.itemsCount || 0};${v.amount || 0};${v.remise || 0};${v.totalHT || 0};${v.ttc || 0};${v.versement || 0}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrintReport = () => {
    window.print();
  };

  // Table 1 Navigation
  const navFirstVoucher = () => setSelectedVoucherIndex(0);
  const navPrevVoucher = () => setSelectedVoucherIndex(prev => Math.max(0, prev - 1));
  const navNextVoucher = () => setSelectedVoucherIndex(prev => Math.min(filteredVouchers.length - 1, prev + 1));
  const navLastVoucher = () => setSelectedVoucherIndex(Math.max(0, filteredVouchers.length - 1));

  // Table 2 Navigation
  const navFirstItem = () => setSelectedItemIndex(0);
  const navPrevItem = () => setSelectedItemIndex(prev => Math.max(0, prev - 1));
  const navNextItem = () => setSelectedItemIndex(prev => Math.min(selectedVoucherItems.length - 1, prev + 1));
  const navLastItem = () => setSelectedItemIndex(Math.max(0, selectedVoucherItems.length - 1));

  return (
    <div className="flex-1 flex flex-col gap-2 font-sans text-xs select-none h-full overflow-hidden p-1">
      
      {/* Filters Bar Top */}
      <div className="bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-300 dark:border-slate-800 flex flex-col gap-2 shrink-0 shadow-xs">
        {/* Row 1 */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Du */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Du</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-xs focus:ring-1 focus:ring-m3-primary"
              />
            </div>

            {/* Au */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Au</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-xs focus:ring-1 focus:ring-m3-primary"
              />
            </div>

            {/* Utilisateur */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Utilisateur</span>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs cursor-pointer"
              >
                <option value="<Tous>">&lt;Tous&gt;</option>
                {usersList.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Mode de règlement */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Mode de règlement</span>
              <select
                value={selectedPaymentMode}
                onChange={(e) => setSelectedPaymentMode(e.target.value)}
                className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs cursor-pointer"
              >
                <option value="<Tous>">&lt;Tous&gt;</option>
                <option value="Espèces">Espèces</option>
                <option value="Chèque">Chèque</option>
                <option value="Virement">Virement</option>
                <option value="Versement">Versement</option>
              </select>
            </div>

            {/* Rechercher par N° de bon */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Rechercher par N° de bon</span>
              <input
                type="text"
                value={searchVoucherNo}
                onChange={(e) => setSearchVoucherNo(e.target.value)}
                placeholder="Ex: 02098"
                className="h-7 w-28 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-xs focus:ring-1 focus:ring-m3-primary"
              />
            </div>
          </div>

          {/* Top Right Print Button */}
          <button
            onClick={handlePrintReport}
            className="h-8 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold border border-slate-400 dark:border-slate-700 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <Printer size={14} className="text-blue-600 dark:text-blue-400" />
            <span>{type === 'ventes' ? "Imprimer Etat des Factures de vente" : "Imprimer Etat des Factures d'achat"}</span>
          </button>
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Table 1 Nav buttons */}
            <div className="flex items-center gap-0.5 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
              <button onClick={navFirstVoucher} title="Début" className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">{"|< Début"}</button>
              <button onClick={navPrevVoucher} title="Précédent" className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">◄ Préc.</button>
              <button onClick={navNextVoucher} title="Suivant" className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">► Suivant</button>
              <button onClick={navLastVoucher} title="Fin" className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">{"Fin >|"}</button>
            </div>

            {/* Client / Fournisseur */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">{type === 'ventes' ? 'Client' : 'Fournisseur'}</span>
              <select
                value={selectedParty}
                onChange={(e) => setSelectedParty(e.target.value)}
                className="h-7 min-w-[180px] max-w-[260px] px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs cursor-pointer"
              >
                <option value="<Tous>">&lt;Tous&gt;</option>
                {partiesList.map((p) => (
                  <option key={p.id || p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Recherche par Référence */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Recherche par Référence</span>
              <input
                type="text"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                placeholder="Réf / Art..."
                className="h-7 w-32 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-mono focus:ring-1 focus:ring-m3-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Recherche Button */}
            <button
              onClick={() => {}}
              className="h-7 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer border border-blue-700"
            >
              <Search size={13} />
              <span>Recherche</span>
            </button>

            {/* Annuler Button */}
            <button
              onClick={handleResetFilters}
              className="h-7 px-3 bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 text-rose-800 dark:text-rose-300 font-bold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer border border-rose-300 dark:border-rose-800"
            >
              <X size={13} />
              <span>Annuler</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Table & Side Action Panel */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-[170px] overflow-hidden">
        {/* Top Vouchers Table */}
        <div className="col-span-10 border border-slate-300 dark:border-slate-800 rounded-xl overflow-auto bg-white dark:bg-slate-900 shadow-inner">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 select-none">
              <tr>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center w-16">N°</th>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 w-24">Date</th>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 w-20">Heure</th>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700">{type === 'ventes' ? 'Client' : 'Fournisseur'}</th>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center w-16">Nbre P</th>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-center w-16">Nbre C</th>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right w-24">Montant</th>
                <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 text-right w-20">REMISE</th>
                <th className="p-1.5 text-right w-28">HT</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 dark:text-slate-600 italic">
                    Aucun bon trouvé correspondant à vos critères
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v, idx) => {
                  const isSelected = safeVoucherIndex === idx;
                  const partyName = type === 'ventes' ? (v as SalesVoucher).client : (v as PurchaseVoucher).supplier;
                  return (
                    <tr
                      key={v.id || idx}
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

        {/* Top Right Actions Panel */}
        <div className="col-span-2 flex flex-col gap-2 p-2 bg-blue-50/60 dark:bg-slate-950 border border-blue-200 dark:border-slate-800 rounded-xl justify-start shadow-xs select-none">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
            <PieChart size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <select className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer">
              <option value="stat">Statistique ▾</option>
              <option value="par_client">Par Client / Tiers</option>
              <option value="par_mois">Par Mois</option>
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer border border-emerald-700"
          >
            <FileSpreadsheet size={16} />
            <span>EXCEL</span>
          </button>
        </div>
      </div>

      {/* Middle Summary Header */}
      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800 text-xs shrink-0 select-none shadow-2xs">
        {/* Table 2 Nav Buttons */}
        <div className="flex items-center gap-0.5 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
          <button onClick={navFirstItem} className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">{"|< Début"}</button>
          <button onClick={navPrevItem} className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">◄ Préc.</button>
          <button onClick={navNextItem} className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">► Suivant</button>
          <button onClick={navLastItem} className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-pointer">{"Fin >|"}</button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 dark:text-slate-300">Nombre de Factures</span>
            <div className="bg-white dark:bg-slate-950 px-3 py-0.5 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold text-blue-700 dark:text-blue-400">
              {facturesCount}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 dark:text-slate-300">Nombre de produits</span>
            <div className="bg-white dark:bg-slate-950 px-3 py-0.5 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold text-blue-700 dark:text-blue-400">
              {productsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section (Items Table & Totals Card) */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-[150px] overflow-hidden">
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
                      key={item.id || idx}
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
        <div className="col-span-3 bg-blue-50/70 dark:bg-slate-950 p-2 rounded-xl border border-blue-200 dark:border-slate-800 flex flex-col gap-1 select-none text-xs justify-between shadow-2xs">
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

            <div className="flex justify-between items-center gap-1">
              <span className="font-bold text-blue-900 dark:text-blue-300">Total TTC (Bons fermés)</span>
              <div className="w-28 bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-700 px-2 py-0.5 rounded font-mono font-bold text-right text-blue-700 dark:text-blue-300">
                {formatMoney(totalTTC)}
              </div>
            </div>

            <div className="flex justify-between items-center gap-1 pt-0.5 border-t border-slate-300 dark:border-slate-800">
              <span className="font-bold text-emerald-800 dark:text-emerald-400">Total versement</span>
              <div className="w-28 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-700 px-2 py-0.5 rounded font-mono font-bold text-right text-emerald-700 dark:text-emerald-300">
                {formatMoney(totalVersement)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div className="flex items-center justify-center border-t border-slate-200 dark:border-slate-800 pt-1.5 shrink-0 select-none">
        <button
          onClick={onClose}
          className="px-8 h-8 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-400 dark:border-slate-700 shadow-2xs active:scale-95 transition-all cursor-pointer"
        >
          <LogOut size={14} />
          <span>QUITTER</span>
        </button>
      </div>

    </div>
  );
}
