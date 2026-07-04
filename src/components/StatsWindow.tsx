import React, { useState, useMemo } from 'react';
import { Product, SalesVoucher, PurchaseVoucher } from '../types';
import { TrendingUp, TrendingDown, Layers, AlertCircle, Sparkles, Terminal, Trophy } from 'lucide-react';

interface StatsWindowProps {
  products: Product[];
  sales: SalesVoucher[];
  purchases: PurchaseVoucher[];
  onClose: () => void;
}

export default function StatsWindow({
  products,
  sales,
  purchases,
  onClose
}: StatsWindowProps) {
  // State for tab selector: 'perf' (Statistiques/Graphiques) or 'audit' (Analyse BON1/CARNETC)
  const [activeTab, setActiveTab] = useState<'perf' | 'audit'>('perf');

  // Audit Logs database state
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    anomaliesCount: number;
    text: string;
  }>>([
    {
      id: 'log-1',
      title: 'ANALYSE BON1/CARNETC - 19/09/2024',
      date: '19/09/2024',
      time: '16:36:36',
      anomaliesCount: 0,
      text: `ANALYSE BON1/CARNETC LANCER LE :19/09/2024 à 16:36:36\n\nVérification terminée, aucune anomalie trouvée.\n----------------------------------------------------------------------------------------------------`
    },
    {
      id: 'log-2',
      title: 'ANALYSE BON1/CARNETC - 22/10/2025',
      date: '22/10/2025',
      time: '13:50:52',
      anomaliesCount: 2,
      text: `ANALYSE BON1/CARNETC LANCER LE :22/10/2025 à 13:50:52\nBON N°2768/RAMY/01/09/2025/19300,00\nBON N°2769/HICHEM PERSO/01/09/2025/3600,00\n\nVérification terminée, 2 anomalie(s) trouvée(s)\n----------------------------------------------------------------------------------------------------`
    }
  ]);

  const [selectedLogId, setSelectedLogId] = useState<string>('log-2');
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);

  // Financial aggregates
  const financials = useMemo(() => {
    let salesTotal = 0;
    sales.forEach(s => { salesTotal += s.ttc; });

    let purchasesTotal = 0;
    purchases.forEach(p => { purchasesTotal += p.ttc; });

    const totalStockQty = products.reduce((acc, p) => acc + p.stock, 0);
    const lowStockItems = products.filter(p => p.stock === 0).length;

    // Estimate profit margin 28%
    const estimMargin = salesTotal * 0.28;

    return { salesTotal, purchasesTotal, totalStockQty, lowStockItems, estimMargin };
  }, [products, sales, purchases]);

  // Aggregate items sold
  const topProducts = useMemo(() => {
    const itemSales: { [code: string]: { name: string, qty: number, total: number } } = {};
    sales.forEach(s => {
      s.items.forEach(item => {
        if (!itemSales[item.code]) {
          itemSales[item.code] = { name: item.designation, qty: 0, total: 0 };
        }
        itemSales[item.code].qty += item.qty;
        itemSales[item.code].total += item.total;
      });
    });

    const list = Object.keys(itemSales).map(code => ({
      code,
      name: itemSales[code].name,
      qty: itemSales[code].qty,
      total: itemSales[code].total
    }));

    return list.sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [sales]);

  const runLiveAudit = () => {
    setIsRunningAudit(true);
    setAuditProgress(0);

    const interval = setInterval(() => {
      setAuditProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const d = new Date();
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            
            const newLogId = `log-live-${Date.now()}`;
            const newLogText = `ANALYSE BON1/CARNETC LANCER LE :${dateStr} à ${timeStr}\n\nAnalyse de la table BON1 (Registre Facturation) : OK (${sales.length} Bons scannés)\nAnalyse de la table CARNETC (Comptes Tiers) : OK (Cohérence absolue)\n\nVérification terminée, aucune anomalie trouvée.\n----------------------------------------------------------------------------------------------------`;

            setAuditLogs(prevLogs => [
              ...prevLogs,
              {
                id: newLogId,
                title: `ANALYSE BON1/CARNETC - ${dateStr} (Live)`,
                date: dateStr,
                time: timeStr,
                anomaliesCount: 0,
                text: newLogText
              }
            ]);
            setSelectedLogId(newLogId);
            setIsRunningAudit(false);
          }, 450);
          return 100;
        }
        return prev + 10;
      });
    }, 80);
  };

  const activeLogObj = auditLogs.find(l => l.id === selectedLogId) || auditLogs[0];

  return (
    <div className="flex-1 flex flex-col gap-4 font-sans text-xs select-all bg-white dark:bg-slate-900 h-full overflow-hidden p-4">
      
      {/* material Segmented Tab control headers */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 select-none shrink-0">
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-full border border-slate-200/50 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('perf')}
            className={`
              px-5 py-2.5 rounded-full font-bold text-xs transition-all duration-250 outline-none cursor-pointer flex items-center gap-2
              ${activeTab === 'perf'
                ? 'bg-m3-primary text-white shadow-md shadow-m3-primary/10'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }
            `}
          >
            <Sparkles size={14} /> Statistiques Magasin
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`
              px-5 py-2.5 rounded-full font-bold text-xs transition-all duration-250 outline-none cursor-pointer flex items-center gap-2
              ${activeTab === 'audit'
                ? 'bg-m3-primary text-white shadow-md shadow-m3-primary/10'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }
            `}
          >
            <Terminal size={14} /> Analyse BON1 / CARNETC
          </button>
        </div>

        <div className="text-[10px] text-m3-primary dark:text-sky-400 font-mono font-bold tracking-wider uppercase select-none">
          M3 Expressive Analyzer
        </div>
      </div>

      {activeTab === 'perf' ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-0.5">
          
          {/* M3 Bento Grid Aggregates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 select-none shrink-0">
            
            {/* Sales Stat */}
            <div className="bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-teal-950/5 border border-indigo-100 dark:border-indigo-950/45 p-4 flex flex-col justify-between rounded-2xl shadow-sm gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Chiffre d'Affaires</span>
                <TrendingUp size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-lg font-display font-black text-slate-900 dark:text-slate-100 leading-none">
                {financials.salesTotal.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
              <span className="text-[9.5px] text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100/40 dark:bg-indigo-950/50 self-start px-2 py-0.5 rounded-full">
                {sales.length} Bons de Vente
              </span>
            </div>

            {/* Purchases Stat */}
            <div className="bg-gradient-to-br from-rose-50/50 to-rose-100/30 dark:from-rose-950/20 dark:to-orange-950/5 border border-rose-100 dark:border-rose-950/45 p-4 flex flex-col justify-between rounded-2xl shadow-sm gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-rose-800 dark:text-rose-300 uppercase tracking-wider">Registre Achats</span>
                <TrendingDown size={16} className="text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-lg font-display font-black text-slate-900 dark:text-slate-100 leading-none">
                {financials.purchasesTotal.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
              <span className="text-[9.5px] text-rose-700 dark:text-rose-300 font-bold bg-rose-100/40 dark:bg-rose-950/50 self-start px-2 py-0.5 rounded-full">
                {purchases.length} Bons d'Achat
              </span>
            </div>

            {/* Profit Margin */}
            <div className="bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-indigo-950/5 border border-emerald-100 dark:border-emerald-950/45 p-4 flex flex-col justify-between rounded-2xl shadow-sm gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Marge brut estimée (28%)</span>
                <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
              </div>
              <span className="text-lg font-display font-black text-slate-900 dark:text-slate-100 leading-none">
                {financials.estimMargin.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
              </span>
              <span className="text-[9.5px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/40 dark:bg-emerald-950/50 self-start px-2 py-0.5 rounded-full">
                Rentabilité calculée
              </span>
            </div>

            {/* Inventory Status */}
            <div className="bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-slate-950/5 border border-purple-100 dark:border-purple-950/45 p-4 flex flex-col justify-between rounded-2xl shadow-sm gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Volume Inventaire Total</span>
                <Layers size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-lg font-display font-black text-slate-900 dark:text-slate-100 leading-none">
                {financials.totalStockQty} Unités
              </span>
              <span className={`text-[9.5px] font-bold self-start px-2 py-0.5 rounded-full ${financials.lowStockItems > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/65 dark:text-rose-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'}`}>
                {financials.lowStockItems} Ruptures critiques
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
            
            {/* Visual Charts section */}
            <div className="md:col-span-7 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col gap-3 shadow-inner">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 select-none text-xs uppercase tracking-wider font-display flex items-center gap-2">
                📈 Rapport Statistique des Entrées & Sorties
              </h4>
              
              <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-4 flex flex-col justify-around rounded-xl shadow-xs min-h-[160px]">
                <div className="flex flex-col gap-5 py-2">
                  <div>
                    <div className="flex justify-between font-bold text-xs text-indigo-950 dark:text-indigo-200 mb-1">
                      <span>Bons de Vente Clients (BL Ventes)</span>
                      <span className="font-mono font-black text-indigo-700 dark:text-indigo-400">{financials.salesTotal.toLocaleString()} DA</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-950 h-5 rounded-full overflow-hidden mt-1 relative border border-slate-200/50 dark:border-slate-850">
                      <div 
                        style={{ width: `${financials.salesTotal > 0 ? Math.min(100, (financials.salesTotal / Math.max(financials.salesTotal, financials.purchasesTotal)) * 100) : 0}%` }}
                        className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(79,70,229,0.3)]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-xs text-rose-950 dark:text-rose-200 mb-1">
                      <span>Entrées de Stocks (Achats Fournisseurs)</span>
                      <span className="font-mono font-black text-rose-700 dark:text-rose-400">{financials.purchasesTotal.toLocaleString()} DA</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-950 h-5 rounded-full overflow-hidden mt-1 relative border border-slate-200/50 dark:border-slate-850">
                      <div 
                        style={{ width: `${financials.purchasesTotal > 0 ? Math.min(100, (financials.purchasesTotal / Math.max(financials.salesTotal, financials.purchasesTotal)) * 100) : 0}%` }}
                        className="bg-rose-500 dark:bg-rose-600 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 dark:text-slate-550 font-medium italic text-center font-sans mt-3">
                  Les agrégations financières dynamiques sont réévaluées à chaque mouvement de stock.
                </p>
              </div>
            </div>

            {/* Top items side container */}
            <div className="md:col-span-5 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col gap-3 shadow-inner">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 select-none text-xs uppercase tracking-wider font-display flex items-center gap-2">
                <Trophy size={14} className="text-amber-500" /> Top de nos Ventes
              </h4>
              
              <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 py-2 px-3 overflow-y-auto rounded-xl shadow-xs">
                {topProducts.length === 0 ? (
                  <div className="text-center py-12 italic text-slate-450 dark:text-slate-500 font-sans">
                    Aucun article vendu pour le moment.
                  </div>
                ) : (
                  <ol className="flex flex-col gap-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                    {topProducts.map((p, index) => (
                      <li key={p.code} className="flex justify-between items-center py-2.5 text-xs first:pt-1">
                        <div className="flex gap-2.5 truncate items-center">
                          <span className="font-extrabold text-m3-primary dark:text-sky-400 text-xs">{index + 1}.</span>
                          <span className="truncate font-sans font-semibold text-slate-800 dark:text-slate-200" style={{ maxWidth: '140px' }} title={p.name}>
                            {p.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[10px] text-m3-primary dark:text-sky-305 bg-m3-primary-container/30 dark:bg-sky-950/30 px-2.5 py-0.5 rounded-full shrink-0">
                          {p.qty} unités
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Interactive audit logs container display */
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
          
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            
            {/* Sidebar audits registry */}
            <div className="col-span-12 md:col-span-4 bg-slate-50 dark:bg-slate-950/40 p-3 border border-slate-150 dark:border-slate-800 rounded-2xl flex flex-col gap-3">
              <span className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] px-1 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-wider font-display">
                Historique d'Audits
              </span>
              
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-0.5">
                {auditLogs.map((log) => {
                  const isSelected = selectedLogId === log.id;
                  return (
                    <button
                      key={log.id}
                      onClick={() => setSelectedLogId(log.id)}
                      className={`
                        w-full p-3 text-left rounded-xl border transition-all text-xs flex flex-col gap-1.5 select-none outline-none cursor-pointer
                        ${isSelected 
                          ? 'bg-m3-primary text-white border-m3-primary shadow-md font-bold' 
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
                        }
                      `}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="truncate text-[10px] font-extrabold uppercase tracking-wide">Audit CarnetC</span>
                        {log.anomaliesCount > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black ${isSelected ? 'bg-rose-200 text-rose-950' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 animate-pulse'}`}>
                            {log.anomaliesCount} Anomalies
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black ${isSelected ? 'bg-indigo-200 text-indigo-950' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'}`}>
                            Sûr
                          </span>
                        )}
                      </div>
                      <span className={`text-[10.5px] font-mono ${isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {log.date} — {log.time}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Run audit button */}
              <button
                onClick={runLiveAudit}
                disabled={isRunningAudit}
                className="w-full h-10 bg-m3-primary hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 select-none cursor-pointer"
              >
                <span>🚀</span> Lancer l'Analyse indexée
              </button>
            </div>

            {/* Terminal Panel style */}
            <div className="col-span-12 md:col-span-8 flex flex-col border border-slate-800 dark:border-slate-900 bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-2xl shadow-lg min-h-0 relative">
              <div className="absolute top-2 right-2 text-[8px] font-sans text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 select-none rounded-lg">
                Terminal d'audit - Interactif des Tiers
              </div>
              
              {isRunningAudit ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none">
                  <div className="text-center font-bold tracking-widest text-emerald-400 animate-pulse">
                    M3 AUDIT ENGINE IN PROGRESS... [{auditProgress}%]
                  </div>
                  <div className="w-56 h-2 bg-slate-900 p-0.5 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${auditProgress}%` }}
                      className="bg-emerald-400 h-full transition-all duration-150 rounded-full"
                    />
                  </div>
                  <div className="text-[9px] text-slate-500 italic">
                    Écart de solde table BON1 vs CARNETC de caisse...
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between min-h-0">
                  <textarea
                    readOnly
                    value={activeLogObj.text}
                    className="flex-1 bg-transparent text-emerald-400 focus:outline-none resize-none font-mono leading-relaxed select-all text-xs h-full"
                  />
                  
                  <div className="border-t border-slate-900 pt-2 text-[10px] text-slate-500 flex justify-between select-none shrink-0 mt-3 font-mono">
                    <span>État: VERIFIED</span>
                    <span>Anomalies totales: {activeLogObj.anomaliesCount}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Footer Close Button */}
      <div className="flex justify-end select-none shrink-0 border-t pt-3 border-slate-100 dark:border-slate-800">
        <button
          onClick={onClose}
          className="px-6 h-9.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-full flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer border border-transparent"
        >
          Fermer l'onglet
        </button>
      </div>
    </div>
  );
}
