import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, Landmark, Plus, Ticket, Trash2 } from 'lucide-react';
import { SalesVoucher, PurchaseVoucher, ClientPayment } from '../types';
import { SupplierPayment } from './SituationFournisseursWindow';

interface CashFlowLog {
  id: string;
  date: string;
  type: 'RECEIPT' | 'PAYMENT';
  desc: string;
  amount: number;
}

interface CaisseWindowProps {
  sales: SalesVoucher[];
  purchases: PurchaseVoucher[];
  clientPayments: ClientPayment[];
  supplierPayments: SupplierPayment[];
  onClose: () => void;
}

function CaisseWindow({
  sales,
  purchases,
  clientPayments,
  supplierPayments,
  onClose
}: CaisseWindowProps) {
  const [manualLogs, setManualLogs] = useState<CashFlowLog[]>(() => {
    try {
      const raw = localStorage.getItem('compos_manual_cash_logs');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'RECEIPT' | 'PAYMENT'>('PAYMENT'); // Expense / Charge by default

  const saveManualLogs = (newLogs: CashFlowLog[]) => {
    setManualLogs(newLogs);
    try {
      localStorage.setItem('compos_manual_cash_logs', JSON.stringify(newLogs));
    } catch (e) {
      console.error(e);
    }
  };

  const computedCash = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    // 1. Sales (credits/receipts)
    sales.forEach(s => {
      if (s.versement > 0) totalIn += s.versement;
    });

    // 2. Purchases (debits/payments)
    purchases.forEach(p => {
      if (p.versement > 0) totalOut += p.versement;
    });

    // 3. Client payments (credits/receipts)
    clientPayments.forEach(cp => {
      if (cp.amount > 0) totalIn += cp.amount;
    });

    // 4. Supplier payments (debits/payments)
    supplierPayments.forEach(sp => {
      if (sp.amount > 0) totalOut += sp.amount;
    });

    // 5. Manual logs
    manualLogs.forEach(log => {
      if (log.type === 'RECEIPT') totalIn += log.amount;
      else totalOut += log.amount;
    });

    const netSafe = totalIn - totalOut;
    return { totalIn, totalOut, netSafe };
  }, [sales, purchases, clientPayments, supplierPayments, manualLogs]);

  const handleAddFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount || Number(amount) <= 0) return;

    const newLog: CashFlowLog = {
      id: `manual-${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toLocaleDateString('fr-FR'),
      type,
      desc: desc.trim(),
      amount: Number(amount)
    };

    saveManualLogs([newLog, ...manualLogs]);
    setDesc('');
    setAmount('');
  };

  const combinedLogs = useMemo(() => {
    const list: Array<{ id: string; date: string; type: 'RECEIPT' | 'PAYMENT'; desc: string; amount: number; isSystem?: boolean }> = [];

    // 1. Add Sales versement
    sales.forEach(s => {
      if (s.versement > 0) {
        list.push({
          id: `sale-${s.id}`,
          date: s.date,
          type: 'RECEIPT',
          desc: `Versement Client: ${s.client} (BL N° ${s.id})`,
          amount: s.versement,
          isSystem: true
        });
      }
    });

    // 2. Add Purchases versement
    purchases.forEach(p => {
      if (p.versement > 0) {
        list.push({
          id: `purchase-${p.id}`,
          date: p.date,
          type: 'PAYMENT',
          desc: `Versement Fournisseur: ${p.supplier} (Bon N° ${p.id})`,
          amount: p.versement,
          isSystem: true
        });
      }
    });

    // 3. Add Client Payments
    clientPayments.forEach(cp => {
      if (cp.amount > 0) {
        list.push({
          id: `clientpay-${cp.id}`,
          date: cp.date,
          type: 'RECEIPT',
          desc: `Règlement Client: ${cp.clientName} (Réf: ${cp.remark || 'Sans remarque'})`,
          amount: cp.amount,
          isSystem: true
        });
      }
    });

    // 4. Add Supplier Payments
    supplierPayments.forEach(sp => {
      if (sp.amount > 0) {
        list.push({
          id: `supplierpay-${sp.id}`,
          date: sp.date,
          type: 'PAYMENT',
          desc: `Paiement Fournisseur: ${sp.supplierName} (Réf: ${sp.remark || 'Sans remarque'})`,
          amount: sp.amount,
          isSystem: true
        });
      }
    });

    // 5. Add custom manual logs
    manualLogs.forEach(ml => {
      list.push({
        id: ml.id,
        date: ml.date,
        type: ml.type,
        desc: ml.desc,
        amount: ml.amount,
        isSystem: false
      });
    });

    // Sort chronologically by date descending (and then newest ID first)
    return list.sort((a, b) => {
      const parseDate = (dStr: string) => {
        const parts = dStr.split('/');
        if (parts.length === 3) {
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        }
        return 0;
      };
      const timeA = parseDate(a.date);
      const timeB = parseDate(b.date);
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id);
    });
  }, [sales, purchases, clientPayments, supplierPayments, manualLogs]);

  return (
    <div className="flex-1 flex flex-col gap-4 font-sans text-xs select-all text-slate-800 dark:text-slate-100 p-4 h-full overflow-hidden">
      
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 select-none shrink-0">
        
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-transparent border border-emerald-100 dark:border-emerald-950/40 p-4 flex flex-col rounded-2xl shadow-sm relative">
          <div className="absolute top-3 right-3 p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
            <ArrowUpRight size={16} />
          </div>
          <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-1">Encaissements (Entrées)</span>
          <span className="text-lg font-display font-black text-emerald-900 dark:text-emerald-400">
            {computedCash.totalIn.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
          </span>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-transparent border border-rose-100 dark:border-rose-950/40 p-4 flex flex-col rounded-2xl shadow-sm relative">
          <div className="absolute top-3 right-3 p-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-450 rounded-full">
            <ArrowDownLeft size={16} />
          </div>
          <span className="text-[10px] font-extrabold text-rose-800 dark:text-rose-300 uppercase tracking-wider mb-1">Décaissements (Charges/Paiements)</span>
          <span className="text-lg font-display font-black text-rose-900 dark:text-rose-450">
            {computedCash.totalOut.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
          </span>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-150/40 dark:from-slate-950/40 dark:to-transparent border border-indigo-100 dark:border-slate-800 p-4 flex flex-col rounded-2xl shadow-sm relative">
          <div className="absolute top-3 right-3 p-1.5 bg-m3-primary/10 text-m3-primary dark:text-sky-400 rounded-full">
            <Landmark size={16} />
          </div>
          <span className="text-[10px] font-extrabold text-m3-primary dark:text-indigo-300 uppercase tracking-wider mb-1">Solde Coffre (En caisse réel)</span>
          <span className={`text-lg font-display font-black ${computedCash.netSafe >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'}`}>
            {computedCash.netSafe.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
          </span>
        </div>
      </div>

      {/* Main split: Ledger table + Forms */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
        
        {/* Ledger */}
        <div className="flex-1 flex flex-col border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm min-h-0">
          <div className="bg-slate-50 dark:bg-slate-950/60 font-bold px-4 py-3 border-b border-slate-150 dark:border-slate-805 text-slate-800 dark:text-slate-200 select-none flex items-center gap-2 font-display shrink-0">
            <Ticket size={14} className="text-m3-primary" /> Journal dynamique de Trésorerie
          </div>
          
          <div className="flex-1 overflow-auto flex flex-col min-h-0">
            <table className="w-full text-left font-sans text-xs border-collapse table-fixed">
              <thead className="bg-[#f8fafc] dark:bg-slate-950/30 text-slate-500 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-100 dark:border-slate-800 select-none z-10 text-[9.5px] uppercase tracking-wider font-display">
                <tr>
                  <th style={{ width: '90px' }} className="px-4 py-3">Date</th>
                  <th style={{ width: '80px' }} className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3">Description du mouvement</th>
                  <th style={{ width: '150px' }} className="px-4 py-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800/60">
                {combinedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">
                      Aucun mouvement de caisse enregistré.
                    </td>
                  </tr>
                ) : (
                  combinedLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors group h-10">
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400 font-sans">{log.date}</td>
                      <td className="px-4 py-2 text-center">
                        {log.type === 'RECEIPT' ? (
                          <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-sans text-[8.5px] font-extrabold uppercase">Crédit</span>
                        ) : (
                          <span className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-350 px-2 py-0.5 rounded-full font-sans text-[8.5px] font-extrabold uppercase">Débit</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-sans text-slate-900 dark:text-slate-100 font-semibold truncate" title={log.desc}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{log.desc}</span>
                          {log.isSystem ? (
                            <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-1 py-0.2 rounded font-sans uppercase">Auto</span>
                          ) : (
                            <span className="text-[8px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 px-1 py-0.2 rounded font-sans uppercase">Manuel</span>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-2 text-right font-black text-xs ${log.type === 'RECEIPT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-450'}`}>
                        <div className="flex items-center justify-end gap-2.5">
                          <span>{log.type === 'RECEIPT' ? '+' : '-'} {Math.round(log.amount).toLocaleString()} DA</span>
                          {!log.isSystem ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const filtered = manualLogs.filter(m => m.id !== log.id);
                                saveManualLogs(filtered);
                              }}
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              title="Supprimer ce flux manuel"
                            >
                              <Trash2 size={12} />
                            </button>
                          ) : (
                            <div className="w-6 h-6" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Input panel */}
        <div className="w-full lg:w-[260px] bg-slate-50 dark:bg-slate-950/30 p-3 border border-slate-200/65 dark:border-slate-800 rounded-2xl flex flex-col gap-3 shadow-inner shrink-0">
          
          <form onSubmit={handleAddFlow} className="flex flex-col gap-3.5 p-4 border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl shadow-xs">
            <div className="font-bold text-[10px] text-m3-primary dark:text-sky-305 border-b border-slate-100 dark:border-slate-850 pb-2 uppercase tracking-wider select-none font-display">
              Saisie Manuelle de Flux
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[9.5px] uppercase tracking-wide">Type de flux</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'RECEIPT' | 'PAYMENT')}
                className="h-9 rounded-xl px-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-m3-primary font-sans outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <option value="PAYMENT">Consommation & Charge</option>
                <option value="RECEIPT">Apport de fonds liquide</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[9.5px] uppercase tracking-wide">Libellé (Motif)</span>
              <input
                type="text"
                required
                placeholder="Description..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="h-9 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/10 transition-all font-sans text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[9.5px] uppercase tracking-wide">Montant (Dinar DA)</span>
              <input
                type="number"
                required
                min="1"
                placeholder="Ex. 1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="h-9 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/10 transition-all text-slate-800 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="w-full h-9.5 mt-2 rounded-xl bg-m3-primary text-white font-bold hover:opacity-90 active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border-none"
            >
              <Plus size={14} /> Enregistrer le flux
            </button>
          </form>

          <button
            onClick={onClose}
            className="w-full h-9.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-slate-200/40 dark:border-slate-800/40 mt-auto"
          >
            Fermer l'onglet
          </button>
        </div>

      </div>
    </div>
  );
}

export default React.memo(CaisseWindow, (prev, next) => {
  return prev.sales === next.sales &&
         prev.purchases === next.purchases &&
         prev.clientPayments === next.clientPayments &&
         prev.supplierPayments === next.supplierPayments;
});
