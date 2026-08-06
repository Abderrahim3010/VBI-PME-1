import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  Search,
  PlusCircle,
  MinusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Check
} from 'lucide-react';
import { SalesVoucher, PurchaseVoucher, ClientPayment, CoffreTransaction } from '../types';
import { SupplierPayment } from './SituationFournisseursWindow';

interface UnifiedTransaction {
  id: string;
  coffreId: 'coffre1' | 'coffre2';
  type: 'ENTREE' | 'SORTIE';
  category: 'VENTE' | 'ACHAT' | 'VERSEMENT_CLIENT' | 'REGLEMENT_FOURNISSEUR' | 'APPORT' | 'CHARGE' | 'AUTRE';
  date: string;
  time?: string;
  amount: number;
  label: string;
  reference?: string;
  isSystem: boolean;
  manualTx?: CoffreTransaction;
}

interface CaisseWindowProps {
  sales: SalesVoucher[];
  purchases: PurchaseVoucher[];
  clientPayments: ClientPayment[];
  supplierPayments: SupplierPayment[];
  initialCoffre?: 'coffre1' | 'coffre2';
  onClose: () => void;
}

const FILTER_OPTIONS: { id: string; label: string; color: string }[] = [
  { id: 'ENTREE', label: 'Entrées d\'argent', color: 'bg-emerald-500' },
  { id: 'SORTIE', label: 'Sorties d\'argent', color: 'bg-rose-500' },
  { id: 'VENTE', label: 'Ventes Clients (F2)', color: 'bg-blue-500' },
  { id: 'ACHAT', label: 'Achats Fournisseurs (F1)', color: 'bg-purple-500' },
  { id: 'MANUEL', label: 'Saisies Manuelles', color: 'bg-amber-500' },
  { id: 'VERSEMENT_CLIENT', label: 'Versements Clients', color: 'bg-teal-500' },
  { id: 'REGLEMENT_FOURNISSEUR', label: 'Règlements Fournisseurs', color: 'bg-indigo-500' },
];

export default function CaisseWindow({
  sales,
  purchases,
  clientPayments,
  supplierPayments,
  initialCoffre = 'coffre1',
  onClose
}: CaisseWindowProps) {
  window.__vbiPerfRecorder?.render('CaisseWindow');

  // Active coffre state (coffre1 or coffre2)
  const [activeCoffre, setActiveCoffre] = useState<'coffre1' | 'coffre2'>(initialCoffre);

  useEffect(() => {
    if (initialCoffre) {
      setActiveCoffre(initialCoffre);
    }
  }, [initialCoffre]);

  // Search and quick multi-select filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const toggleFilterOption = (filterId: string) => {
    if (selectedFilters.includes(filterId)) {
      setSelectedFilters(selectedFilters.filter(f => f !== filterId));
    } else {
      setSelectedFilters([...selectedFilters, filterId]);
    }
  };

  const clearFilters = () => {
    setSelectedFilters([]);
  };

  // Manual Coffre transactions persisted in localStorage
  const [manualTxs, setManualTxs] = useState<CoffreTransaction[]>(() => {
    try {
      const raw = localStorage.getItem('vbi_coffre_manual_txs');
      if (raw) return JSON.parse(raw);
      // Fallback for legacy manual cash logs
      const legacyRaw = localStorage.getItem('compos_manual_cash_logs');
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        return parsed.map((m: any) => ({
          id: m.id || `m-${Math.random().toString(36).substring(2, 9)}`,
          coffreId: 'coffre1',
          type: m.type === 'RECEIPT' ? 'ENTREE' : 'SORTIE',
          category: m.type === 'RECEIPT' ? 'APPORT' : 'CHARGE',
          date: m.date || new Date().toLocaleDateString('fr-FR'),
          time: '12:00:00',
          amount: Number(m.amount) || 0,
          label: m.desc || 'Flux manuel',
          reference: 'MIGRATION'
        }));
      }
      return [];
    } catch {
      return [];
    }
  });

  const saveManualTxs = (newTxs: CoffreTransaction[]) => {
    setManualTxs(newTxs);
    try {
      localStorage.setItem('vbi_coffre_manual_txs', JSON.stringify(newTxs));
    } catch (e) {
      console.error(e);
    }
  };

  // Modal dialog state for adding / editing manual ENTRÉE or SORTIE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'ENTREE' | 'SORTIE'>('ENTREE');
  const [editingTx, setEditingTx] = useState<CoffreTransaction | null>(null);

  // Form fields
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formLabel, setFormLabel] = useState('');
  const [formReference, setFormReference] = useState('');
  const [formCategory, setFormCategory] = useState<'APPORT' | 'CHARGE' | 'AUTRE'>('APPORT');

  const openAddModal = (type: 'ENTREE' | 'SORTIE') => {
    setEditingTx(null);
    setModalType(type);
    setFormAmount('');
    setFormLabel('');
    setFormReference('');
    setFormCategory(type === 'ENTREE' ? 'APPORT' : 'CHARGE');
    setIsModalOpen(true);
  };

  const openEditModal = (tx: CoffreTransaction) => {
    setEditingTx(tx);
    setModalType(tx.type);
    setFormAmount(tx.amount);
    setFormLabel(tx.label);
    setFormReference(tx.reference || '');
    setFormCategory((tx.category as 'APPORT' | 'CHARGE' | 'AUTRE') || (tx.type === 'ENTREE' ? 'APPORT' : 'CHARGE'));
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(formAmount);
    if (!numAmt || numAmt <= 0) return;

    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

    if (editingTx) {
      // Update existing
      const updated = manualTxs.map(t => {
        if (t.id === editingTx.id) {
          return {
            ...t,
            type: modalType,
            amount: numAmt,
            label: formLabel.trim() || (modalType === 'ENTREE' ? "Entrée de caisse" : "Sortie de caisse"),
            reference: formReference.trim(),
            category: formCategory
          };
        }
        return t;
      });
      saveManualTxs(updated);
    } else {
      // Create new
      const newTx: CoffreTransaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        coffreId: activeCoffre,
        type: modalType,
        category: formCategory,
        date: dateStr,
        time: timeStr,
        amount: numAmt,
        label: formLabel.trim() || (modalType === 'ENTREE' ? "Apport / Entrée d'argent" : "Charge / Sortie d'argent"),
        reference: formReference.trim()
      };
      saveManualTxs([newTx, ...manualTxs]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteManualTx = (id: string) => {
    const next = manualTxs.filter(t => t.id !== id);
    saveManualTxs(next);
  };

  // Compile all unified transactions for the active coffre
  const allTransactions = useMemo(() => {
    const list: UnifiedTransaction[] = [];

    // Helper to test if a voucher payment source matches active Coffre
    const matchesCoffre = (src?: string) => {
      const normalized = (src || '').toUpperCase().trim();
      if (activeCoffre === 'coffre1') {
        return (
          normalized === 'COFFRE N°1' ||
          normalized === 'COFFRE 1' ||
          normalized === 'CAISSE PRINCIPALE' ||
          !src
        );
      } else {
        return normalized === 'COFFRE N°2' || normalized === 'COFFRE 2';
      }
    };

    // 1. Sales Vouchers (Saisie Ventes F2)
    sales.forEach(s => {
      if (matchesCoffre(s.paymentSource) && s.versement > 0) {
        const isRetour = s.type === 'RETOUR';
        list.push({
          id: `sale-${s.id}`,
          coffreId: activeCoffre,
          type: isRetour ? 'SORTIE' : 'ENTREE',
          category: 'VENTE',
          date: s.date,
          time: s.time,
          amount: s.versement,
          label: `${isRetour ? 'Retour Client' : 'Vente Client'}: ${s.client}`,
          reference: `BL N° ${s.id}`,
          isSystem: true
        });
      }
    });

    // 2. Purchase Vouchers (Saisie Achats F1)
    purchases.forEach(p => {
      if (matchesCoffre(p.paymentSource) && p.versement > 0) {
        list.push({
          id: `purchase-${p.id}`,
          coffreId: activeCoffre,
          type: 'SORTIE',
          category: 'ACHAT',
          date: p.date,
          time: p.time,
          amount: p.versement,
          label: `Achat Fournisseur: ${p.supplier}`,
          reference: `Bon N° ${p.id}`,
          isSystem: true
        });
      }
    });

    // 3. Client Payments
    clientPayments.forEach(cp => {
      if (cp.amount > 0 && activeCoffre === 'coffre1') {
        list.push({
          id: `clientpay-${cp.id}`,
          coffreId: activeCoffre,
          type: 'ENTREE',
          category: 'VERSEMENT_CLIENT',
          date: cp.date,
          time: cp.time,
          amount: cp.amount,
          label: `Règlement Client: ${cp.clientName}`,
          reference: cp.remark || 'Client Pay',
          isSystem: true
        });
      }
    });

    // 4. Supplier Payments
    supplierPayments.forEach(sp => {
      if (sp.amount > 0 && activeCoffre === 'coffre1') {
        list.push({
          id: `supplierpay-${sp.id}`,
          coffreId: activeCoffre,
          type: 'SORTIE',
          category: 'REGLEMENT_FOURNISSEUR',
          date: sp.date,
          time: sp.time,
          amount: sp.amount,
          label: `Paiement Fournisseur: ${sp.supplierName}`,
          reference: sp.remark || 'Fournisseur Pay',
          isSystem: true
        });
      }
    });

    // 5. Manual Coffre Transactions
    manualTxs.forEach(mt => {
      if (mt.coffreId === activeCoffre) {
        list.push({
          id: mt.id,
          coffreId: mt.coffreId,
          type: mt.type,
          category: mt.category,
          date: mt.date,
          time: mt.time,
          amount: mt.amount,
          label: mt.label,
          reference: mt.reference || 'Manuel',
          isSystem: false,
          manualTx: mt
        });
      }
    });

    // Sort chronologically descending
    return list.sort((a, b) => {
      const parseDate = (dStr: string) => {
        const parts = dStr.split('/');
        if (parts.length === 3) {
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        }
        return 0;
      };
      const tA = parseDate(a.date);
      const tB = parseDate(b.date);
      if (tA !== tB) return tB - tA;
      return b.id.localeCompare(a.id);
    });
  }, [sales, purchases, clientPayments, supplierPayments, manualTxs, activeCoffre]);

  // Filtered list based on search and selected multi-filters
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      // Selected Multi-Filters
      if (selectedFilters.length > 0) {
        const matchesAny = selectedFilters.some(filterId => {
          if (filterId === 'ENTREE') return tx.type === 'ENTREE';
          if (filterId === 'SORTIE') return tx.type === 'SORTIE';
          if (filterId === 'VENTE') return tx.category === 'VENTE';
          if (filterId === 'ACHAT') return tx.category === 'ACHAT';
          if (filterId === 'MANUEL') return !tx.isSystem;
          if (filterId === 'VERSEMENT_CLIENT') return tx.category === 'VERSEMENT_CLIENT';
          if (filterId === 'REGLEMENT_FOURNISSEUR') return tx.category === 'REGLEMENT_FOURNISSEUR';
          return false;
        });
        if (!matchesAny) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchLabel = tx.label.toLowerCase().includes(q);
        const matchRef = (tx.reference || '').toLowerCase().includes(q);
        const matchDate = tx.date.toLowerCase().includes(q);
        const matchAmt = tx.amount.toString().includes(q);
        return matchLabel || matchRef || matchDate || matchAmt;
      }
      return true;
    });
  }, [allTransactions, searchQuery, selectedFilters]);

  // Compute Totals for bottom bar
  const totals = useMemo(() => {
    let totalEntrees = 0;
    let totalSorties = 0;

    allTransactions.forEach(tx => {
      if (tx.type === 'ENTREE') {
        totalEntrees += tx.amount;
      } else {
        totalSorties += tx.amount;
      }
    });

    const reste = totalEntrees - totalSorties;
    return { totalEntrees, totalSorties, reste };
  }, [allTransactions]);

  // Excel Export Handler
  const handleExportExcel = () => {
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const coffreTitle = activeCoffre === 'coffre1' ? 'COFFRE 1 (Principal)' : 'COFFRE 2 (Secondaire)';

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${activeCoffre === 'coffre1' ? 'Coffre 1' : 'Coffre 2'}</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          th { background-color: #0284c7; color: #ffffff; font-weight: bold; border: 1px solid #0369a1; text-align: left; padding: 6px; }
          td { border: 1px solid #cbd5e1; padding: 6px; font-family: sans-serif; font-size: 12px; }
          .entree { color: #15803d; font-weight: bold; }
          .sortie { color: #b91c1c; font-weight: bold; }
          .totaux { background-color: #f8fafc; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Relevé de Trésorerie - ${coffreTitle}</h2>
        <p>Date d'exportation: <strong>${currentDate}</strong></p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mouvement</th>
              <th>Catégorie</th>
              <th>Référence</th>
              <th>Libellé / Tiers</th>
              <th style="text-align: right;">Montant (DZD)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.map(tx => `
              <tr>
                <td>${tx.date}</td>
                <td class="${tx.type === 'ENTREE' ? 'entree' : 'sortie'}">${tx.type}</td>
                <td>${tx.category}</td>
                <td>${tx.reference || ''}</td>
                <td>${tx.label}</td>
                <td style="text-align: right;" class="${tx.type === 'ENTREE' ? 'entree' : 'sortie'}">
                  ${tx.type === 'ENTREE' ? '+' : '-'} ${tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="totaux">
              <td colspan="5" style="text-align: right;">Total Entrées:</td>
              <td style="text-align: right; color: #15803d;">+ ${totals.totalEntrees.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>
            </tr>
            <tr class="totaux">
              <td colspan="5" style="text-align: right;">Total Sorties:</td>
              <td style="text-align: right; color: #b91c1c;">- ${totals.totalSorties.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>
            </tr>
            <tr class="totaux" style="background-color: #e2e8f0; font-size: 14px;">
              <td colspan="5" style="text-align: right;">Solde Actuel (Reste):</td>
              <td style="text-align: right;">${totals.reste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mouvements_${activeCoffre === 'coffre1' ? 'Coffre1' : 'Coffre2'}_${currentDate.replace(/\//g, '-')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF / Printable Export Handler
  const handleExportPDF = () => {
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const coffreTitle = activeCoffre === 'coffre1' ? 'COFFRE N°1 (Principal)' : 'COFFRE N°2 (Secondaire)';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Journal Trésorerie - ${coffreTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #475569; }
          .type-entree { color: #15803d; font-weight: bold; }
          .type-sortie { color: #b91c1c; font-weight: bold; }
          .text-right { text-align: right; }
          .summary-container { margin-top: 24px; display: flex; justify-content: flex-end; }
          .summary-box { width: 320px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; background-color: #f8fafc; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-weight: bold; font-size: 12px; }
          .summary-row.total { border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 6px; font-size: 15px; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">RELEVÉ DE MOUVEMENTS - ${coffreTitle}</div>
            <div class="subtitle">Document de gestion de trésorerie interne • Édité le ${currentDate}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Date</th>
              <th style="width: 90px;">Mouvement</th>
              <th style="width: 110px;">Référence</th>
              <th>Libellé / Tiers</th>
              <th class="text-right" style="width: 140px;">Montant (DZD)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.map(tx => `
              <tr>
                <td>${tx.date}</td>
                <td class="${tx.type === 'ENTREE' ? 'type-entree' : 'type-sortie'}">${tx.type}</td>
                <td>${tx.reference || '-'}</td>
                <td>${tx.label}</td>
                <td class="text-right ${tx.type === 'ENTREE' ? 'type-entree' : 'type-sortie'}">
                  ${tx.type === 'ENTREE' ? '+' : '-'} ${tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-container">
          <div class="summary-box">
            <div class="summary-row" style="color: #15803d;">
              <span>Total Entrées:</span>
              <span>+ ${totals.totalEntrees.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</span>
            </div>
            <div class="summary-row" style="color: #b91c1c;">
              <span>Total Sorties:</span>
              <span>- ${totals.totalSorties.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</span>
            </div>
            <div class="summary-row total">
              <span>Solde Actuel (Reste):</span>
              <span>${totals.reste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</span>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="flex-1 flex flex-col font-sans text-xs select-none text-slate-800 dark:text-slate-100 h-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      
      {/* 1. Top Header Bar: Title Badge on Left, Action Buttons (+ ENTRÉE & - SORTIE) on Right */}
      <div className="bg-white dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl text-white shadow-xs ${
            activeCoffre === 'coffre1' ? 'bg-emerald-600' : 'bg-amber-600'
          }`}>
            <Wallet size={20} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Gestion du Coffre & Trésorerie</span>
              <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wide shadow-2xs ${
                activeCoffre === 'coffre1'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}>
                {activeCoffre === 'coffre1' ? 'COFFRE 1 (Principal)' : 'COFFRE 2 (Secondaire)'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold border border-slate-200 dark:border-slate-700">F10</span>
            </h2>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Journal des mouvements, dépôts et charges pour le {activeCoffre === 'coffre1' ? 'Coffre 1' : 'Coffre 2'}
            </span>
          </div>
        </div>

        {/* Action Buttons in Header: Ajouter ENTRÉE & Ajouter SORTIE */}
        <div className="flex items-center gap-2.5">
          {/* Ajouter ENTRÉE Button */}
          <button
            type="button"
            onClick={() => openAddModal('ENTREE')}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-xs flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <PlusCircle size={17} />
            <span>+ Ajouter ENTRÉE</span>
          </button>

          {/* Ajouter SORTIE Button */}
          <button
            type="button"
            onClick={() => openAddModal('SORTIE')}
            className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-extrabold text-xs flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <MinusCircle size={17} />
            <span>- Ajouter SORTIE</span>
          </button>
        </div>
      </div>

      {/* 2. Main Layout (Left Side Panel + Right Table) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* LEFT SIDE PANEL */}
        <div className="w-72 lg:w-80 bg-white dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 p-3.5 flex flex-col gap-4 shrink-0 shadow-xs overflow-y-auto">
          
          {/* Active Coffre Title Badge */}
          <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
            activeCoffre === 'coffre1'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-100'
          }`}>
            <div className={`p-2.5 rounded-xl ${
              activeCoffre === 'coffre1' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}>
              <Wallet size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm uppercase tracking-wide">
                {activeCoffre === 'coffre1' ? 'COFFRE N°1' : 'COFFRE N°2'}
              </span>
              <span className="text-[10px] font-semibold opacity-80">
                {activeCoffre === 'coffre1' ? 'Trésorerie & Caisse Principale' : 'Trésorerie & Caisse Secondaire'}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col gap-1.5">
            <label className="font-extrabold text-[10.5px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Recherche globale</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[9.5px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw size={10} /> Effacer
                </button>
              )}
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par réf, client, motif..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          {/* Filtres Rapides Dropdown Button */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="font-extrabold text-[10.5px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Filtres de mouvement</span>
              {selectedFilters.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[9.5px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Réinitialiser ({selectedFilters.length})
                </button>
              )}
            </label>

            {/* Dropdown Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-slate-500 dark:text-slate-400" />
                <span>
                  {selectedFilters.length === 0
                    ? 'Filtres rapides (Tous)'
                    : `${selectedFilters.length} filtre(s) sélectionné(s)`}
                </span>
              </div>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isFilterDropdownOpen && (
              <div className="mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-30 font-sans">
                <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex justify-between items-center border-b border-slate-100 dark:border-slate-800 mb-1">
                  <span>Sélectionnez vos critères</span>
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>

                {FILTER_OPTIONS.map((opt) => {
                  const isChecked = selectedFilters.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleFilterOption(opt.id)}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                        <span>{opt.label}</span>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {isChecked && <Check size={12} />}
                      </div>
                    </button>
                  );
                })}

                {selectedFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-1 w-full py-1.5 text-center text-[11px] font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer transition-colors"
                  >
                    Effacer tous les filtres
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Export Buttons Section (Replaces note box) */}
          <div className="mt-auto pt-3 border-t border-slate-150 dark:border-slate-800 flex flex-col gap-2">
            <span className="font-extrabold text-[10.5px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Exportation & Impression
            </span>

            {/* Export EXCEL Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full h-10 px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet size={18} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Export EXCEL (.xls)</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-200/60 dark:bg-emerald-900/80 px-2 py-0.5 rounded-md font-bold">
                .XLS
              </span>
            </button>

            {/* Export PDF Button */}
            <button
              type="button"
              onClick={handleExportPDF}
              className="w-full h-10 px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200 font-extrabold text-xs flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                <span>Export PDF / Imprimer</span>
              </div>
              <span className="text-[10px] font-mono bg-rose-200/60 dark:bg-rose-900/80 px-2 py-0.5 rounded-md font-bold">
                .PDF
              </span>
            </button>
          </div>

        </div>

        {/* RIGHT MAIN TABLE */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden min-w-0">
          
          {/* Table Header / Stats Bar */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 font-display">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                Mouvements du {activeCoffre === 'coffre1' ? 'Coffre 1 (Principal)' : 'Coffre 2 (Secondaire)'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                {filteredTransactions.length} opération(s)
              </span>
            </div>

            {(searchQuery || selectedFilters.length > 0) && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {selectedFilters.length > 0 && `${selectedFilters.length} filtre(s) actif(s)`}
                {searchQuery && selectedFilters.length > 0 && ' • '}
                {searchQuery && `Recherche: "${searchQuery}"`}
              </span>
            )}
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead className="bg-[#f8fafc] dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800 select-none z-10 text-[9.5px] uppercase tracking-wider font-display">
                <tr>
                  <th style={{ width: '90px' }} className="px-3.5 py-2.5">Date</th>
                  <th style={{ width: '100px' }} className="px-3.5 py-2.5 text-center">Mouvement</th>
                  <th style={{ width: '120px' }} className="px-3.5 py-2.5">Référence</th>
                  <th className="px-3.5 py-2.5">Libellé / Tiers</th>
                  <th style={{ width: '160px' }} className="px-3.5 py-2.5 text-right">Montant (DZD)</th>
                  <th style={{ width: '80px' }} className="px-3.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-slate-700 dark:text-slate-200">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400 italic">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Wallet size={32} className="text-slate-300 dark:text-slate-700" />
                        <span>Aucune opération trouvée pour ce coffre.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors group h-10">
                      <td className="px-3.5 py-2 text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                        {tx.date}
                      </td>
                      <td className="px-3.5 py-2 text-center">
                        {tx.type === 'ENTREE' ? (
                          <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-sans text-[9px] font-black uppercase flex items-center justify-center gap-1 w-fit mx-auto">
                            <ArrowDownLeft size={10} /> ENTRÉE
                          </span>
                        ) : (
                          <span className="bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-full font-sans text-[9px] font-black uppercase flex items-center justify-center gap-1 w-fit mx-auto">
                            <ArrowUpRight size={10} /> SORTIE
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2 font-sans font-bold text-slate-600 dark:text-slate-300 text-[11px] truncate">
                        {tx.reference}
                      </td>
                      <td className="px-3.5 py-2 font-sans text-slate-900 dark:text-slate-100 font-semibold truncate" title={tx.label}>
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate">{tx.label}</span>
                          {tx.category === 'VENTE' && (
                            <span className="text-[8.5px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">Vente F2</span>
                          )}
                          {tx.category === 'ACHAT' && (
                            <span className="text-[8.5px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">Achat F1</span>
                          )}
                          {!tx.isSystem && (
                            <span className="text-[8.5px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">Saisie Manuelle</span>
                          )}
                        </div>
                      </td>
                      <td className={`px-3.5 py-2 text-right font-black text-xs ${
                        tx.type === 'ENTREE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {tx.type === 'ENTREE' ? '+' : '-'} {tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                      </td>
                      <td className="px-3.5 py-2 text-center">
                        {!tx.isSystem && tx.manualTx ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(tx.manualTx!)}
                              className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Modifier cette opération"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteManualTx(tx.id)}
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Supprimer cette opération"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">Auto</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 3. Bottom Bar: Totals & Solde Actuel (Reste) */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 px-5 flex items-center justify-between shrink-0 shadow-lg z-10 font-sans">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Récapitulatif Coffre ({activeCoffre === 'coffre1' ? 'Coffre 1' : 'Coffre 2'})
          </span>
        </div>

        <div className="flex items-center gap-4">
          
          {/* Total ENTRÉES */}
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 px-3.5 py-1.5 rounded-xl">
            <ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase">Total Entrées</span>
              <span className="font-mono font-black text-xs text-emerald-900 dark:text-emerald-300">
                + {totals.totalEntrees.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
            </div>
          </div>

          {/* Total SORTIES */}
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 px-3.5 py-1.5 rounded-xl">
            <ArrowUpRight size={16} className="text-rose-600 dark:text-rose-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-rose-800 dark:text-rose-300 uppercase">Total Sorties</span>
              <span className="font-mono font-black text-xs text-rose-900 dark:text-rose-300">
                - {totals.totalSorties.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
            </div>
          </div>

          {/* SOLDE ACTUEL / RESTE */}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border shadow-sm ${
            totals.reste >= 0
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-rose-600 text-white border-rose-700'
          }`}>
            <Wallet size={18} />
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase opacity-90">Solde Actuel (Reste)</span>
              <span className="font-mono font-black text-sm">
                {totals.reste.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DIALOG: Ajouter / Modifier ENTRÉE / SORTIE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden font-sans">
            
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between text-white ${
              modalType === 'ENTREE' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              <div className="flex items-center gap-2.5 font-extrabold text-sm">
                {modalType === 'ENTREE' ? <PlusCircle size={20} /> : <MinusCircle size={20} />}
                <span>
                  {editingTx ? 'Modifier' : 'Ajouter une'} {modalType === 'ENTREE' ? "ENTRÉE d'argent" : "SORTIE d'argent"} ({activeCoffre === 'coffre1' ? 'Coffre 1' : 'Coffre 2'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-5 flex flex-col gap-4">
              
              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Catégorie
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="h-10 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                >
                  {modalType === 'ENTREE' ? (
                    <>
                      <option value="APPORT">Apport / Dépôt de fonds</option>
                      <option value="VERSEMENT_CLIENT">Règlement / Versement Client</option>
                      <option value="AUTRE">Autre Entrée</option>
                    </>
                  ) : (
                    <>
                      <option value="CHARGE">Consommation & Charge</option>
                      <option value="REGLEMENT_FOURNISSEUR">Paiement Fournisseur</option>
                      <option value="AUTRE">Autre Sortie</option>
                    </>
                  )}
                </select>
              </div>

              {/* Montant */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Montant (DZD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  autoFocus
                  placeholder="Ex: 50000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-10 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono font-black text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>

              {/* Libellé / Motif */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Libellé / Description
                </label>
                <input
                  type="text"
                  placeholder={modalType === 'ENTREE' ? "Ex: Apport de caisse matinal..." : "Ex: Frais de déplacement, électricité..."}
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="h-10 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Référence */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Référence / N° de pièce (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: CHQ-8821, REC-001..."
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  className="h-10 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 h-9 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 h-9 text-xs font-black text-white rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 ${
                    modalType === 'ENTREE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <CheckCircle2 size={15} />
                  <span>{editingTx ? 'Enregistrer modifications' : modalType === 'ENTREE' ? 'Enregistrer Entrée' : 'Enregistrer Sortie'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
