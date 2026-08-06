import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  Printer,
  Barcode,
  History,
  Check,
  X,
  Filter,
  Save,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Package,
  Boxes,
  Plus,
  Minus
} from 'lucide-react';
import { Product, InventoryHistoryRecord, InventoryItem } from '../types';

interface InventaireWindowProps {
  products: Product[];
  onProductsUpdate: (updatedProducts: Product[]) => void;
  onClose: () => void;
  createdFamilles?: string[];
}

export default function InventaireWindow({
  products,
  onProductsUpdate,
  onClose,
  createdFamilles = []
}: InventaireWindowProps) {
  window.__vbiPerfRecorder?.render('InventaireWindow');

  // State for physical count entries per product code
  // Maps product.code -> physical count (number or '')
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number | ''>>(() => {
    const initial: Record<string, number | ''> = {};
    products.forEach(p => {
      initial[p.code] = p.stock ?? 0;
    });
    return initial;
  });

  // Keep physical counts synced if products array changes size or new products added
  useEffect(() => {
    setPhysicalCounts(prev => {
      const next = { ...prev };
      products.forEach(p => {
        if (next[p.code] === undefined) {
          next[p.code] = p.stock ?? 0;
        }
      });
      return next;
    });
  }, [products]);

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | 'ECART_ONLY' | 'SURPLUS_ONLY' | 'PERTE_ONLY' | 'CONFORME_ONLY'>('ALL');

  // Scanner douchette mode
  const [scannerMode, setScannerMode] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [lastScannedProduct, setLastScannedProduct] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Validation modal state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [inventoryNote, setInventoryNote] = useState('');

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<InventoryHistoryRecord[]>(() => {
    try {
      const raw = localStorage.getItem('vbi_inventory_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Unique list of categories/familles
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    createdFamilles.forEach(f => set.add(f));
    return Array.from(set).sort();
  }, [products, createdFamilles]);

  // Calculate items with metrics
  const inventoryItems = useMemo(() => {
    return products.map(p => {
      const sTheo = Number(p.stock ?? 0);
      const rawVal = physicalCounts[p.code] !== undefined ? physicalCounts[p.code] : sTheo;
      const sPhys = rawVal === '' || rawVal === undefined ? 0 : Number(rawVal);
      const ecart = sPhys - sTheo;
      const pAchat = Number(p.prixAchat || p.prixDeRevient || 0);
      const valeurEcart = ecart * pAchat;

      return {
        product: p,
        code: p.code,
        designation: p.designation,
        category: p.category || 'Non classé',
        prixAchat: pAchat,
        prixVente1: Number(p.prixVente1 || 0),
        stockTheorique: sTheo,
        stockPhysique: sPhys,
        rawInputVal: rawVal ?? '',
        ecart,
        valeurEcart
      };
    });
  }, [products, physicalCounts]);

  // Filtered Inventory Items
  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // Filter Mode
      if (filterMode === 'ECART_ONLY' && item.ecart === 0) return false;
      if (filterMode === 'SURPLUS_ONLY' && item.ecart <= 0) return false;
      if (filterMode === 'PERTE_ONLY' && item.ecart >= 0) return false;
      if (filterMode === 'CONFORME_ONLY' && item.ecart !== 0) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = item.code.toLowerCase().includes(q);
        const matchDes = item.designation.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        return matchCode || matchDes || matchCat;
      }

      return true;
    });
  }, [inventoryItems, selectedCategory, filterMode, searchQuery]);

  // Compute Overall Inventory Statistics
  const stats = useMemo(() => {
    let totalItems = inventoryItems.length;
    let itemsWithEcart = 0;
    let totalSurplusQty = 0;
    let totalPerteQty = 0;
    let totalEcartQty = 0;
    let totalValeurTheo = 0;
    let totalValeurPhys = 0;
    let totalValeurEcart = 0;

    inventoryItems.forEach(item => {
      totalValeurTheo += item.stockTheorique * item.prixAchat;
      totalValeurPhys += item.stockPhysique * item.prixAchat;
      totalValeurEcart += item.valeurEcart;

      if (item.ecart !== 0) {
        itemsWithEcart++;
        totalEcartQty += item.ecart;
        if (item.ecart > 0) {
          totalSurplusQty += item.ecart;
        } else {
          totalPerteQty += Math.abs(item.ecart);
        }
      }
    });

    return {
      totalItems,
      itemsWithEcart,
      itemsConformes: totalItems - itemsWithEcart,
      totalSurplusQty,
      totalPerteQty,
      totalEcartQty,
      totalValeurTheo,
      totalValeurPhys,
      totalValeurEcart
    };
  }, [inventoryItems]);

  // Handle physical stock count change
  const handleCountChange = (code: string, val: string) => {
    if (val === '') {
      setPhysicalCounts(prev => ({ ...prev, [code]: '' }));
    } else {
      const num = Number(val);
      setPhysicalCounts(prev => ({ ...prev, [code]: isNaN(num) ? 0 : num }));
    }
  };

  // Quick action: Set Physical = Theoretical
  const handleSetConforme = (code: string, sTheo: number) => {
    setPhysicalCounts(prev => ({ ...prev, [code]: sTheo }));
  };

  // Quick action: Set All to Theoretical
  const handleResetAllToTheoretical = () => {
    const reset: Record<string, number | ''> = {};
    products.forEach(p => {
      reset[p.code] = p.stock ?? 0;
    });
    setPhysicalCounts(reset);
  };

  // Quick action: Increment / Decrement
  const handleStepPhysicalCount = (code: string, delta: number) => {
    setPhysicalCounts(prev => {
      const curr = prev[code] === '' || prev[code] === undefined ? 0 : Number(prev[code]);
      const next = Math.max(0, curr + delta);
      return { ...prev, [code]: next };
    });
  };

  // Handle Scanner Code Submission
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;

    const query = scanCode.trim().toLowerCase();
    const matched = products.find(p => p.code.toLowerCase() === query || p.designation.toLowerCase().includes(query));

    if (matched) {
      setPhysicalCounts(prev => {
        const curr = prev[matched.code] === '' || prev[matched.code] === undefined ? 0 : Number(prev[matched.code]);
        return { ...prev, [matched.code]: curr + 1 };
      });
      setLastScannedProduct(`+1 [${matched.code}] ${matched.designation}`);
      setScanCode('');
    } else {
      setLastScannedProduct(`❌ Aucun produit trouvé pour: "${scanCode}"`);
      setScanCode('');
    }

    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  };

  // Confirm and Apply Inventory to Products Database
  const handleApplyInventory = () => {
    const updatedProducts = products.map(p => {
      const rawVal = physicalCounts[p.code];
      const newStock = rawVal === '' || rawVal === undefined ? (p.stock ?? 0) : Number(rawVal);
      return {
        ...p,
        stock: newStock
      };
    });

    // 1. Call parent state updater
    onProductsUpdate(updatedProducts);

    // 2. Log History
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const historyItems: InventoryItem[] = inventoryItems.map(i => ({
      code: i.code,
      designation: i.designation,
      category: i.category,
      prixAchat: i.prixAchat,
      prixVente1: i.prixVente1,
      stockTheorique: i.stockTheorique,
      stockPhysique: i.stockPhysique,
      ecart: i.ecart,
      valeurEcart: i.valeurEcart
    }));

    const newRecord: InventoryHistoryRecord = {
      id: `inv-${Date.now()}`,
      date: dateStr,
      time: timeStr,
      note: inventoryNote.trim() || 'Ajustement d\'inventaire régulier',
      totalArticlesCounted: stats.totalItems,
      totalEcartQty: stats.totalEcartQty,
      totalEcartValue: stats.totalValeurEcart,
      items: historyItems
    };

    const nextHistory = [newRecord, ...historyRecords];
    setHistoryRecords(nextHistory);
    try {
      localStorage.setItem('vbi_inventory_history', JSON.stringify(nextHistory));
    } catch (e) {
      console.error(e);
    }

    setShowValidationModal(false);
    alert("✅ L'inventaire a été validé avec succès ! Le stock physique a été appliqué dans toute l'application.");
  };

  // Export to Excel
  const handleExportExcel = () => {
    const currentDate = new Date().toLocaleDateString('fr-FR');

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <style>
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #334155; text-align: left; padding: 8px; }
          td { border: 1px solid #cbd5e1; padding: 6px; font-family: sans-serif; font-size: 12px; }
          .surplus { color: #15803d; font-weight: bold; }
          .perte { color: #b91c1c; font-weight: bold; }
          .totaux { background-color: #f8fafc; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Rapport de Saisie d'Inventaire Physique</h2>
        <p>Date de l'inventaire: <strong>${currentDate}</strong></p>
        <p>Nombre de références: <strong>${stats.totalItems}</strong> | Articles avec écarts: <strong>${stats.itemsWithEcart}</strong></p>
        
        <table>
          <thead>
            <tr>
              <th>Code Produit</th>
              <th>Désignation</th>
              <th>Famille</th>
              <th style="text-align: right;">Prix Achat (DA)</th>
              <th style="text-align: right;">Stock Théorique</th>
              <th style="text-align: right;">Stock Physique</th>
              <th style="text-align: right;">Écart Quantité</th>
              <th style="text-align: right;">Valeur Écart (DA)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => `
              <tr>
                <td>${item.code}</td>
                <td>${item.designation}</td>
                <td>${item.category}</td>
                <td style="text-align: right;">${item.prixAchat.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right;">${item.stockTheorique}</td>
                <td style="text-align: right; font-weight: bold;">${item.stockPhysique}</td>
                <td style="text-align: right;" class="${item.ecart > 0 ? 'surplus' : item.ecart < 0 ? 'perte' : ''}">
                  ${item.ecart > 0 ? `+${item.ecart}` : item.ecart}
                </td>
                <td style="text-align: right;" class="${item.valeurEcart > 0 ? 'surplus' : item.valeurEcart < 0 ? 'perte' : ''}">
                  ${item.valeurEcart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="totaux">
              <td colspan="4" style="text-align: right;">TOTAUX GÉNÉRAUX :</td>
              <td style="text-align: right;">${stats.totalValeurTheo.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA (S.T)</td>
              <td style="text-align: right;">${stats.totalValeurPhys.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA (S.P)</td>
              <td style="text-align: right;" class="${stats.totalEcartQty >= 0 ? 'surplus' : 'perte'}">
                ${stats.totalEcartQty > 0 ? `+${stats.totalEcartQty}` : stats.totalEcartQty}
              </td>
              <td style="text-align: right;" class="${stats.totalValeurEcart >= 0 ? 'surplus' : 'perte'}">
                ${stats.totalValeurEcart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
              </td>
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
    a.download = `Inventaire_Physique_${currentDate.replace(/\//g, '-')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export to Printable PDF / Official Inventory Report
  const handleExportPDF = () => {
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Inventaire des Stocks - ${currentDate}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; font-size: 11px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
          .subtitle { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 4px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .stat-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background-color: #f8fafc; }
          .stat-label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; }
          .stat-value { font-size: 14px; font-weight: 800; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 9.5px; color: #334155; }
          .surplus { color: #15803d; font-weight: bold; }
          .perte { color: #b91c1c; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">RAPPORT DE CONTRASTE D'INVENTAIRE PHYSIQUE</div>
            <div class="subtitle">Édité le ${currentDate} • Document Officiel d'Ajustement de Stock</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Références</div>
            <div class="stat-value">${stats.totalItems} produits</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Articles avec Écarts</div>
            <div class="stat-value" style="color: ${stats.itemsWithEcart > 0 ? '#b91c1c' : '#15803d'};">
              ${stats.itemsWithEcart} article(s)
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Valeur Stock Théorique</div>
            <div class="stat-value">${stats.totalValeurTheo.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Valeur Écarts Globale</div>
            <div class="stat-value" style="color: ${stats.totalValeurEcart >= 0 ? '#15803d' : '#b91c1c'};">
              ${stats.totalValeurEcart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 100px;">Code</th>
              <th>Désignation & Famille</th>
              <th class="text-right" style="width: 90px;">P. Achat</th>
              <th class="text-center" style="width: 70px;">S. Théorique</th>
              <th class="text-center" style="width: 70px;">S. Physique</th>
              <th class="text-center" style="width: 70px;">Écart</th>
              <th class="text-right" style="width: 110px;">Valeur Écart</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => `
              <tr>
                <td font-weight="bold">${item.code}</td>
                <td>
                  <strong>${item.designation}</strong>
                  <div style="font-size: 9px; color: #64748b;">${item.category}</div>
                </td>
                <td class="text-right">${item.prixAchat.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                <td class="text-center">${item.stockTheorique}</td>
                <td class="text-center" style="font-weight: bold;">${item.stockPhysique}</td>
                <td class="text-center ${item.ecart > 0 ? 'surplus' : item.ecart < 0 ? 'perte' : ''}">
                  ${item.ecart > 0 ? `+${item.ecart}` : item.ecart}
                </td>
                <td class="text-right ${item.valeurEcart > 0 ? 'surplus' : item.valeurEcart < 0 ? 'perte' : ''}">
                  ${item.valeurEcart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  // Print Blank Inventory Worksheet for Warehouse paper counting
  const handlePrintBlankSheet = () => {
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fiche de Comptage Physique - ${currentDate}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #0f172a; font-size: 11px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 16px; font-weight: 800; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #334155; padding: 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; uppercase; font-size: 10px; }
          .blank-col { width: 120px; border-bottom: 2px solid #000; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">FICHE DE COMPTAGE MANUEL D'INVENTAIRE</div>
            <div>Date d'inventaire: ${currentDate} • Opérateur / Agent: ____________________</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 110px;">Code Produit</th>
              <th>Désignation de l'Article</th>
              <th style="width: 120px;">Famille / Rayon</th>
              <th style="width: 90px; text-align: center;">Stock Théorique</th>
              <th style="width: 120px; text-align: center;">Stock Physique Compté</th>
              <th style="width: 100px; text-align: center;">Observations</th>
            </tr>
          </thead>
          <tbody>
            ${inventoryItems.map(item => `
              <tr>
                <td style="font-family: monospace; font-weight: bold;">${item.code}</td>
                <td><strong>${item.designation}</strong></td>
                <td>${item.category}</td>
                <td style="text-align: center; color: #64748b;">${item.stockTheorique}</td>
                <td style="text-align: center; background-color: #f8fafc;"></td>
                <td></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="flex-1 flex flex-col font-sans text-xs select-none text-slate-800 dark:text-slate-100 h-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      
      {/* 1. TOP HEADER BAR: Title Badge, Quick Stats, Action Buttons */}
      <div className="bg-white dark:bg-slate-900 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-600 text-white shadow-xs">
            <ClipboardCheck size={22} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Saisie d'Inventaire Physique & Ajustement de Stock</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-extrabold border border-cyan-300 dark:border-cyan-800">
                F9
              </span>
            </h2>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Audit dynamique des stocks, comptage réel, calcul automatique des écarts et mise à jour direct des produits
            </span>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2">
          {/* Print Blank Sheet Button */}
          <button
            type="button"
            onClick={handlePrintBlankSheet}
            className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Imprimer une fiche d'inventaire vierge pour comptage papier"
          >
            <Printer size={16} />
            <span>Fiche Vierge</span>
          </button>

          {/* History Button */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Consulter l'historique des inventaires enregistrés"
          >
            <History size={16} />
            <span>Historique ({historyRecords.length})</span>
          </button>

          {/* Validate & Apply Inventory Button */}
          <button
            type="button"
            onClick={() => setShowValidationModal(true)}
            className="h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-[0.98] text-white font-black text-xs flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <Save size={18} />
            <span>Valider & Appliquer au Stock</span>
          </button>
        </div>
      </div>

      {/* 2. STATS SUMMARY BAR (5 Metric Cards) */}
      <div className="bg-slate-50 dark:bg-slate-900/80 px-4 py-2 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        
        {/* Card 1: Total References */}
        <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Boxes size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Références</span>
            <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
              {stats.totalItems} articles
            </span>
          </div>
        </div>

        {/* Card 2: Articles avec Écarts */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-3 ${
          stats.itemsWithEcart > 0
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-100'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100'
        }`}>
          <div className={`p-2 rounded-lg ${
            stats.itemsWithEcart > 0 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
          }`}>
            <AlertTriangle size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold uppercase opacity-80">Articles avec Écart</span>
            <span className="font-mono font-black text-sm">
              {stats.itemsWithEcart} / {stats.totalItems}
            </span>
          </div>
        </div>

        {/* Card 3: Valeur Stock Théorique */}
        <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <Package size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Valeur Stock Théorique</span>
            <span className="font-mono font-black text-xs text-blue-900 dark:text-blue-200">
              {stats.totalValeurTheo.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
            </span>
          </div>
        </div>

        {/* Card 4: Valeur Stock Physique */}
        <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400">
            <ClipboardCheck size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Valeur Stock Physique</span>
            <span className="font-mono font-black text-xs text-cyan-900 dark:text-cyan-200">
              {stats.totalValeurPhys.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
            </span>
          </div>
        </div>

        {/* Card 5: Valeur Écart Total */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-3 ${
          stats.totalValeurEcart > 0
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : stats.totalValeurEcart < 0
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
        }`}>
          <div className={`p-2 rounded-lg text-white ${
            stats.totalValeurEcart > 0 ? 'bg-emerald-600' : stats.totalValeurEcart < 0 ? 'bg-rose-600' : 'bg-slate-500'
          }`}>
            {stats.totalValeurEcart >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold uppercase opacity-80">Impact Écart Financier</span>
            <span className="font-mono font-black text-xs">
              {stats.totalValeurEcart >= 0 ? '+' : ''}{stats.totalValeurEcart.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
            </span>
          </div>
        </div>

      </div>

      {/* 3. TOOLBAR: Search, Category Filter, Quick Filter Tabs, Scanner Douchette Toggle, Export Buttons */}
      <div className="bg-white dark:bg-slate-900 p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left Side: Search & Filter Inputs */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[320px]">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher code, désignation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium outline-none focus:border-cyan-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none max-w-[180px]"
          >
            <option value="ALL">Toutes les Familles ({allCategories.length})</option>
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Filter Mode Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                filterMode === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tous ({inventoryItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ECART_ONLY')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1 ${
                filterMode === 'ECART_ONLY'
                  ? 'bg-amber-500 text-white font-extrabold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>Écarts uniquement</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[9px] font-mono">
                {stats.itemsWithEcart}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('SURPLUS_ONLY')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                filterMode === 'SURPLUS_ONLY'
                  ? 'bg-emerald-600 text-white font-extrabold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Surplus (+{stats.totalSurplusQty})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('PERTE_ONLY')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                filterMode === 'PERTE_ONLY'
                  ? 'bg-rose-600 text-white font-extrabold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Pertes (-{stats.totalPerteQty})
            </button>
          </div>

        </div>

        {/* Right Side: Scanner Mode & Exports */}
        <div className="flex items-center gap-2">
          
          {/* Scanner Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !scannerMode;
              setScannerMode(next);
              if (next && scanInputRef.current) {
                setTimeout(() => scanInputRef.current?.focus(), 100);
              }
            }}
            className={`h-9 px-3 rounded-xl border font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              scannerMode
                ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <Barcode size={17} />
            <span>Mode Scanner Douchette</span>
          </button>

          {/* Quick Reset All to Theoretical */}
          <button
            type="button"
            onClick={handleResetAllToTheoretical}
            className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Réinitialiser tous les stocks physiques au stock théorique"
          >
            <RotateCcw size={14} />
            <span>Réinitialiser</span>
          </button>

          {/* Export EXCEL Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-9 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span>EXCEL</span>
          </button>

          {/* Export PDF / Print Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="h-9 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileText size={16} className="text-rose-600 dark:text-rose-400" />
            <span>PDF</span>
          </button>

        </div>

      </div>

      {/* SCANNER DOUCHETTE QUICK INPUT BAR */}
      {scannerMode && (
        <div className="bg-cyan-50 dark:bg-cyan-950/60 p-3 border-b border-cyan-200 dark:border-cyan-800 flex items-center gap-4 shrink-0 font-sans">
          <div className="flex items-center gap-2 text-cyan-900 dark:text-cyan-200 font-extrabold text-xs shrink-0">
            <Barcode size={20} className="animate-pulse" />
            <span>Saisie au Scanner / Code-Barres:</span>
          </div>

          <form onSubmit={handleScanSubmit} className="flex-1 flex items-center gap-2 max-w-lg">
            <input
              ref={scanInputRef}
              type="text"
              placeholder="Scannez le code-barres de l'article ou tapez le code..."
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              className="flex-1 h-9 px-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-cyan-500 font-mono text-xs font-black text-slate-900 dark:text-slate-100 outline-none shadow-sm focus:ring-2 focus:ring-cyan-500/30"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-xl bg-cyan-600 text-white font-extrabold text-xs hover:bg-cyan-700 cursor-pointer"
            >
              +1 Incrementer
            </button>
          </form>

          {lastScannedProduct && (
            <span className="text-xs font-bold text-cyan-800 dark:text-cyan-300 truncate max-w-md bg-white/80 dark:bg-slate-900/80 px-3 py-1 rounded-lg border border-cyan-300 dark:border-cyan-800">
              {lastScannedProduct}
            </span>
          )}
        </div>
      )}

      {/* 4. MAIN INVENTORY TABLE */}
      <div className="flex-1 overflow-auto min-h-0 bg-white dark:bg-slate-900">
        <table className="w-full text-left font-sans text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800 select-none z-10 text-[9.5px] uppercase tracking-wider">
            <tr>
              <th style={{ width: '120px' }} className="px-3.5 py-3">Code / Réf</th>
              <th className="px-3.5 py-3">Désignation de l'Article</th>
              <th style={{ width: '130px' }} className="px-3.5 py-3">Famille</th>
              <th style={{ width: '110px' }} className="px-3.5 py-3 text-right">Prix Achat (DA)</th>
              <th style={{ width: '110px' }} className="px-3.5 py-3 text-center bg-slate-100 dark:bg-slate-900">Stock Théorique</th>
              <th style={{ width: '160px' }} className="px-3.5 py-3 text-center bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-300 font-black">
                Stock Physique (S.P)
              </th>
              <th style={{ width: '110px' }} className="px-3.5 py-3 text-center">Écart (S.P - S.T)</th>
              <th style={{ width: '130px' }} className="px-3.5 py-3 text-right">Valeur Écart (DA)</th>
              <th style={{ width: '90px' }} className="px-3.5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-slate-700 dark:text-slate-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-slate-400 italic font-sans">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ClipboardCheck size={32} className="text-slate-300 dark:text-slate-700" />
                    <span>Aucun article ne correspond aux filtres d'inventaire sélectionnés.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isEcart = item.ecart !== 0;
                const isSurplus = item.ecart > 0;
                const isPerte = item.ecart < 0;

                return (
                  <tr
                    key={item.code}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors h-11 ${
                      isSurplus
                        ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                        : isPerte
                        ? 'bg-rose-50/30 dark:bg-rose-950/10'
                        : ''
                    }`}
                  >
                    {/* Code */}
                    <td className="px-3.5 py-2 font-bold text-slate-900 dark:text-slate-100 text-[11px] font-mono">
                      {item.code}
                    </td>

                    {/* Désignation */}
                    <td className="px-3.5 py-2 font-sans font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      {item.designation}
                    </td>

                    {/* Famille */}
                    <td className="px-3.5 py-2 font-sans text-slate-500 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                        {item.category}
                      </span>
                    </td>

                    {/* Prix d'Achat */}
                    <td className="px-3.5 py-2 text-right font-medium text-slate-600 dark:text-slate-400 text-xs">
                      {item.prixAchat.toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
                    </td>

                    {/* Stock Théorique (S.T) */}
                    <td className="px-3.5 py-2 text-center font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950/50 text-xs">
                      {item.stockTheorique}
                    </td>

                    {/* Stock Physique (S.P) - EDITABLE NUMBER INPUT */}
                    <td className="px-2 py-1.5 text-center bg-cyan-50/40 dark:bg-cyan-950/20">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStepPhysicalCount(item.code, -1)}
                          className="w-6 h-7 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
                          title="Diminuer de 1"
                        >
                          <Minus size={12} />
                        </button>

                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.rawInputVal ?? ''}
                          onChange={(e) => handleCountChange(item.code, e.target.value)}
                          className={`w-20 h-7 text-center rounded-lg border font-mono font-black text-xs outline-none transition-all ${
                            isEcart
                              ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-400 text-amber-900 dark:text-amber-200 focus:ring-2 focus:ring-amber-500/30'
                              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => handleStepPhysicalCount(item.code, 1)}
                          className="w-6 h-7 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
                          title="Augmenter de 1"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Écart (S.P - S.T) */}
                    <td className="px-3.5 py-2 text-center">
                      {item.ecart === 0 ? (
                        <span className="text-slate-400 text-[11px]">0 (Conforme)</span>
                      ) : isSurplus ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px]">
                          +{item.ecart} (Surplus)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-extrabold text-[10px]">
                          {item.ecart} (Perte)
                        </span>
                      )}
                    </td>

                    {/* Valeur Écart (DA) */}
                    <td className={`px-3.5 py-2 text-right font-black text-xs ${
                      isSurplus
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isPerte
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}>
                      {item.valeurEcart === 0
                        ? '0.00 DA'
                        : `${isSurplus ? '+' : ''}${item.valeurEcart.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA`}
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleSetConforme(item.code, item.stockTheorique)}
                        className={`p-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          item.ecart === 0
                            ? 'text-slate-300 opacity-50 cursor-default'
                            : 'text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950'
                        }`}
                        title="Rendre conforme (S.P = S.T)"
                        disabled={item.ecart === 0}
                      >
                        Conforme
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. BOTTOM BAR: Total Summary & Confirm Button */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 px-5 flex items-center justify-between shrink-0 font-sans shadow-lg z-10">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Récapitulatif de Saisie
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {stats.totalItems} articles au catalogue • <span className="text-amber-600 font-extrabold">{stats.itemsWithEcart} ajustement(s) nécessaire(s)</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowValidationModal(true)}
            className="h-9 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-[0.98] text-white font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <CheckCircle2 size={18} />
            <span>Valider l'Inventaire & Mettre à Jour le Stock</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: VALIDATION & APPLICATIVE INVENTORY CONFIRMATION */}
      {showValidationModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden font-sans">
            
            {/* Modal Header */}
            <div className="p-4 bg-cyan-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-extrabold text-sm">
                <ClipboardCheck size={22} />
                <span>Validation Finale de l'Inventaire Physique</span>
              </div>
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                Vous êtes sur le point d'appliquer cette saisie d'inventaire. Cette action remplacera les stocks théoriques actuels par les stocks physiques comptés pour tous les produits du catalogue.
              </p>

              {/* Summary Impact Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Nombre de références ajustées :</span>
                  <span className="font-mono font-black text-amber-600">{stats.itemsWithEcart} article(s)</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Quantité totale d'écarts :</span>
                  <span className="font-mono font-black">{stats.totalEcartQty > 0 ? `+${stats.totalEcartQty}` : stats.totalEcartQty} unité(s)</span>
                </div>
                <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-700 dark:text-slate-200 font-extrabold">Impact Financier Global :</span>
                  <span className={`font-mono font-black text-sm ${stats.totalValeurEcart >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stats.totalValeurEcart >= 0 ? '+' : ''}{stats.totalValeurEcart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                  </span>
                </div>
              </div>

              {/* Note / Remarks Field */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Remarque / Motif d'inventaire (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Inventaire annuel de fin d'exercice, Audit mensuel..."
                  value={inventoryNote}
                  onChange={(e) => setInventoryNote(e.target.value)}
                  className="h-10 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowValidationModal(false)}
                  className="px-4 h-9 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleApplyInventory}
                  className="px-5 h-9 text-xs font-black bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Confirmer & Enregistrer</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: INVENTORY HISTORY LOGS */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden font-sans">
            
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-extrabold text-sm">
                <History size={20} />
                <span>Historique des Inventaires Réalisés</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 max-h-[480px] overflow-y-auto flex flex-col gap-3">
              {historyRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic">
                  Aucun historique d'inventaire enregistré pour le moment.
                </div>
              ) : (
                historyRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-slate-100">
                        <ClipboardCheck size={16} className="text-cyan-600" />
                        <span>Session du {rec.date} à {rec.time}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold">
                        {rec.totalArticlesCounted} articles audités
                      </span>
                    </div>

                    {rec.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        "{rec.note}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500">Impact Écart Financier :</span>
                      <span className={`font-mono font-black ${rec.totalEcartValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {rec.totalEcartValue >= 0 ? '+' : ''}{rec.totalEcartValue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 h-8 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl cursor-pointer"
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
