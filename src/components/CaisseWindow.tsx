import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, Landmark, Plus, Ticket, ArrowRight, HelpCircle } from 'lucide-react';

interface CashFlowLog {
  id: string;
  date: string;
  type: 'RECEIPT' | 'PAYMENT';
  desc: string;
  amount: number;
}

interface CaisseWindowProps {
  initialSalesCash: number;
  initialPurchasesCash: number;
  onClose: () => void;
}

export const INITIAL_CASH_LOGS: CashFlowLog[] = [
  { id: '1', date: '08/06/2026', type: 'PAYMENT', desc: 'Versement Achat imad infinix', amount: 66100 },
  { id: '2', date: '08/06/2026', type: 'PAYMENT', desc: 'Versement Achat ZT TOUFIK', amount: 34700 },
  { id: '3', date: '09/06/2026', type: 'PAYMENT', desc: 'Versement partiel Achat SAMADO (Bon 02099)', amount: 20000 },
  { id: '4', date: '11/06/2026', type: 'PAYMENT', desc: 'Versement Achat LARBI HAMIZ (Bon 02103)', amount: 41125 },
  { id: '5', date: '06/06/2026', type: 'RECEIPT', desc: 'Encaissement Facture ABDOU (BL 3411)', amount: 190450 },
  { id: '6', date: '12/06/2026', type: 'PAYMENT', desc: 'Charges Mensuelles Electricité Sonelgaz', amount: 4500 }
];

export default function CaisseWindow({
  initialSalesCash,
  initialPurchasesCash,
  onClose
}: CaisseWindowProps) {
  const [logs, setLogs] = useState<CashFlowLog[]>(() => {
    return INITIAL_CASH_LOGS;
  });

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [type, setType] = useState<'RECEIPT' | 'PAYMENT'>('PAYMENT'); // Expense / Charge by default

  const computedCash = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    logs.forEach(log => {
      if (log.type === 'RECEIPT') totalIn += log.amount;
      else totalOut += log.amount;
    });

    const netSafe = totalIn - totalOut;
    return { totalIn, totalOut, netSafe };
  }, [logs]);

  const handleAddFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || amount <= 0) return;

    const newLog: CashFlowLog = {
      id: Math.random().toString(),
      date: new Date().toLocaleDateString('fr-FR'),
      type,
      desc,
      amount: Number(amount)
    };

    setLogs([newLog, ...logs]);
    setDesc('');
    setAmount(0);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 font-sans text-xs select-all text-slate-800 dark:text-slate-100">
      
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 select-none">
        
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
          <div className="absolute top-3 right-3 p-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full">
            <ArrowDownLeft size={16} />
          </div>
          <span className="text-[10px] font-extrabold text-rose-800 dark:text-rose-300 uppercase tracking-wider mb-1">Décaissements (Charges)</span>
          <span className="text-lg font-display font-black text-rose-900 dark:text-rose-450">
            {computedCash.totalOut.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
          </span>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-150/40 dark:from-slate-950/40 dark:to-transparent border border-indigo-100 dark:border-slate-800 p-4 flex flex-col rounded-2xl shadow-sm relative">
          <div className="absolute top-3 right-3 p-1.5 bg-m3-primary/10 text-m3-primary dark:text-sky-400 rounded-full">
            <Landmark size={16} />
          </div>
          <span className="text-[10px] font-extrabold text-m3-primary dark:text-indigo-300 uppercase tracking-wider mb-1">Solde Coffre (En caisse)</span>
          <span className="text-lg font-display font-black text-slate-900 dark:text-slate-100">
            {computedCash.netSafe.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
          </span>
        </div>
      </div>

      {/* Main split: Ledger table + Forms */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[200px]">
        
        {/* Ledger */}
        <div className="flex-1 flex flex-col border border-m3-outline-variant/15 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="bg-slate-50 dark:bg-slate-950/60 font-bold px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 select-none flex items-center gap-2 font-display">
            <Ticket size={14} className="text-m3-primary" /> Journal des flux de Trésorerie
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead className="bg-[#f8fafc] dark:bg-slate-950/30 text-slate-500 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-100 dark:border-slate-800 select-none z-10 text-[9.5px] uppercase tracking-wider font-display">
                <tr>
                  <th className="px-4 py-3 w-28">Date</th>
                  <th className="px-4 py-3 w-32 text-center">Type</th>
                  <th className="px-4 py-3">Désignation</th>
                  <th className="px-4 py-3 text-right w-40">Montant</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-sans">{log.date}</td>
                    <td className="px-4 py-2.5 text-center">
                      {log.type === 'RECEIPT' ? (
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-3 py-0.5 rounded-full font-sans text-[9px] font-extrabold uppercase">Crédit</span>
                      ) : (
                        <span className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-350 px-3 py-0.5 rounded-full font-sans text-[9px] font-extrabold uppercase">Débit</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-slate-900 dark:text-slate-100 font-semibold truncate max-w-xs" title={log.desc}>{log.desc}</td>
                    <td className={`px-4 py-2.5 text-right font-black text-xs ${log.type === 'RECEIPT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-450'}`}>
                      {log.type === 'RECEIPT' ? '+' : '-'} {Math.round(log.amount).toLocaleString()} DA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Input panel */}
        <div className="w-full lg:w-[260px] bg-slate-50 dark:bg-slate-950/30 p-3 border border-m3-outline-variant/10 rounded-2xl flex flex-col gap-3 shadow-inner shrink-0">
          
          <form onSubmit={handleAddFlow} className="flex flex-col gap-3.5 p-4 border border-m3-outline-variant/10 bg-white dark:bg-slate-900 rounded-xl shadow-xs">
            <div className="font-bold text-[10px] text-m3-primary dark:text-sky-305 border-b border-slate-100 dark:border-slate-800 pb-2 uppercase tracking-wider select-none font-display">
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
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="h-9 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/10 transition-all text-slate-800 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="w-full h-9.5 mt-2 rounded-xl bg-m3-primary text-white font-bold hover:opacity-90 active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={14} /> Enregistrer le flux
            </button>
          </form>

          <button
            onClick={onClose}
            className="w-full h-9.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-250 dark:hover:bg-slate-705 text-slate-700 dark:text-slate-300 rounded-full flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-transparent mt-auto"
          >
            Fermer l'onglet
          </button>
        </div>

      </div>
    </div>
  );
}
