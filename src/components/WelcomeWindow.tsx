import React from 'react';
import { BookOpen, ShieldCheck, Zap, Lightbulb } from 'lucide-react';

interface WelcomeWindowProps {
  onStart: () => void;
  onClose: () => void;
}

export default function WelcomeWindow({
  onStart,
  onClose
}: WelcomeWindowProps) {
  return (
    <div className="flex-1 flex flex-col gap-4 font-sans text-xs select-none">
      
      {/* Hero Banner header */}
      <div className="bg-gradient-to-br from-indigo-600 via-m3-primary to-purple-800 text-white p-5 text-center rounded-2xl shadow-md relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
        <h1 className="text-xl font-extrabold tracking-tight font-display mb-1">
          VBI PME <span className="font-light text-indigo-200">Expressive Workspace</span>
        </h1>
        <p className="text-[11px] opacity-90 max-w-lg mx-auto font-sans leading-relaxed">
          Suite Professionnelle de Gestion Commerciale, Stocks, Achats, Ventes & Comptabilité de Tiers
        </p>
      </div>

      {/* Main Feature grid layout */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-m3-outline-variant/10 p-5 flex flex-col gap-5 rounded-2xl overflow-auto shadow-sm">
        
        {/* Intro */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <BookOpen size={24} />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-display">
              Espace Moderne de Simulation PME
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
              Bienvenue dans la version moderne de la suite logicielle professionnelle <strong className="text-m3-primary dark:text-sky-400 font-bold">VBI PME</strong>. 
              Cette interface est propulsée par le design system <strong className="font-semibold">Material 3 Expressive</strong>, 
              garantissant des transitions fluides, des alignements lisibles et une performance d'exécution instantanée.
            </p>
          </div>
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Feature Grid */}
        <div className="flex flex-col gap-3">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider flex items-center gap-1.5 font-display">
            <Zap size={13} className="text-amber-500 fill-amber-500" /> Fonctionnalités clés à évaluer :
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col gap-1">
              <span className="font-bold text-slate-800 dark:text-slate-200">📤 Registre de Vente (BL Client)</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">Facturation, suivi comptable des encours clients, et fenêtres de versement.</p>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col gap-1">
              <span className="font-bold text-slate-800 dark:text-slate-200">📥 Registre d’Achat (BA Fournisseur)</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">Approvisionnements, évaluation des stocks, colisages et coûts de revient.</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col gap-1">
              <span className="font-bold text-slate-800 dark:text-slate-200">📦 Catalogue Central Produit</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">Suivi d’inventaire dynamique, valorisation de stocks, alertes niveau zéro.</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col gap-1">
              <span className="font-bold text-slate-800 dark:text-slate-200">📊 Analyse de Performance</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">Statistiques de rentabilité, chiffre d'affaires cumulé et santé de caisse.</p>
            </div>
          </div>
        </div>

        {/* Dynamic tips element */}
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/10 text-indigo-900 dark:text-indigo-300 p-3.5 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
          <Lightbulb className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={16} />
          <div>
            <strong className="font-bold">Astuce de navigation Workspace:</strong> Toutes les fenêtres d'information peuvent être glissées dans l'espace de travail et redimensionnées via la poignée en bas à droite pour s'adapter à votre écran.
          </div>
        </div>

      </div>

      {/* Modern Dialog Footer Buttons */}
      <div className="flex justify-end items-center gap-3 mt-1.5 select-none md:p-1">
        <button
          onClick={onClose}
          className="px-5 h-9 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-transparent"
        >
          Fermer
        </button>
        <button
          onClick={onStart}
          className="px-6 h-9 text-xs font-extrabold bg-m3-primary dark:bg-m3-primary-container text-white dark:text-slate-950 hover:opacity-90 rounded-full active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-m3-primary/20 dark:shadow-none"
        >
          🚀 Commencer !
        </button>
      </div>

    </div>
  );
}
