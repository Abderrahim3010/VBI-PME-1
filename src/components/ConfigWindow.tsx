import React, { useEffect, useState, useRef } from 'react';
import { 
  Settings, Save, LogOut, Upload, Trash2, Image, Sliders, 
  CheckSquare, Square, Users, Truck, FileText, Check, HelpCircle, 
  RotateCcw, SlidersHorizontal, Layers, Database, Printer, HardDrive, Cpu,
  AlertTriangle, Smartphone, Monitor, Key, Lock, Shield
} from 'lucide-react';

interface ConfigWindowProps {
  config: any;
  onUpdateConfig: (newConfig: any) => void;
  onClose: () => void;
  onResetDemo?: () => void;
  onOpenUserManagement?: () => void;
  onChangePassword?: (oldPass?: string, newPass?: string) => { success: boolean; message: string } | void;
  currentUser?: any;
}

function ConfigWindow({
  config,
  onUpdateConfig,
  onClose,
  onResetDemo,
  onOpenUserManagement,
  onChangePassword,
  currentUser
}: ConfigWindowProps) {
  window.__vbiPerfRecorder?.render('ConfigWindow');

  const [activeTab, setActiveTab] = useState<'delivery' | 'invoice' | 'affichage' | 'securite'>('delivery');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveSuccessTimeoutRef = useRef<number | null>(null);

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  useEffect(() => {
    return () => {
      if (saveSuccessTimeoutRef.current !== null) {
        window.clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, []);
  
  // Activation modal states
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [activationError, setActivationError] = useState('');
  
  // Tab 1: Informations sur bon de livraison
  const [deliveryNom, setDeliveryNom] = useState(config?.deliveryInfo?.nomRaisonSociale || '');
  const [deliveryDetail1, setDeliveryDetail1] = useState(config?.deliveryInfo?.detail1 || '');
  const [deliveryDetail2, setDeliveryDetail2] = useState(config?.deliveryInfo?.detail2 || '');
  const [deliveryDetail3, setDeliveryDetail3] = useState(config?.deliveryInfo?.detail3 || '');
  const [deliveryAdresse, setDeliveryAdresse] = useState(config?.deliveryInfo?.adresse || '');
  const [messageTicket, setMessageTicket] = useState(config?.deliveryInfo?.messageTicket || '');
  const [deliveryLogo, setDeliveryLogo] = useState(config?.deliveryInfo?.logo || '');
  const [multiLangueBon, setMultiLangueBon] = useState(config?.deliveryInfo?.multiLangueBon || 'arabe');
  
  const [rc, setRc] = useState(config?.deliveryInfo?.rc || '');
  const [article, setArticle] = useState(config?.deliveryInfo?.article || '');
  const [nis, setNis] = useState(config?.deliveryInfo?.nis || '');
  const [nif, setNif] = useState(config?.deliveryInfo?.nif || '');
  const [compteBancaire, setCompteBancaire] = useState(config?.deliveryInfo?.compteBancaire || '');
  
  const [defaultPayModeDelivery, setDefaultPayModeDelivery] = useState(config?.deliveryInfo?.defaultPayModeDelivery || 'ESPECE');
  const [defaultPayModePurchase, setDefaultPayModePurchase] = useState(config?.deliveryInfo?.defaultPayModePurchase || 'ESPECE');
  const [defaultTarifMode, setDefaultTarifMode] = useState(config?.deliveryInfo?.defaultTarifMode || 'Tarif 1');

  // Tab 2: Informations sur la facture
  const [invoiceNom, setInvoiceNom] = useState(config?.invoiceInfo?.nomRaisonSociale || '');
  const [invoiceDetail1, setInvoiceDetail1] = useState(config?.invoiceInfo?.detail1 || '');
  const [invoiceDetail2, setInvoiceDetail2] = useState(config?.invoiceInfo?.detail2 || '');
  const [invoiceDetail3, setInvoiceDetail3] = useState(config?.invoiceInfo?.detail3 || '');
  const [invoiceAdresse, setInvoiceAdresse] = useState(config?.invoiceInfo?.adresse || '');
  const [invoiceLogo, setInvoiceLogo] = useState(config?.invoiceInfo?.logo || '');
  const [messageFacture, setMessageFacture] = useState(config?.invoiceInfo?.messageFacture || 'Merci pour votre confiance');

  // Tab 3: Affichage & Company Settings
  const [companyName, setCompanyName] = useState(config?.company || '');
  const [bgImage, setBgImage] = useState(config?.affichage?.backgroundImage || '');
  const [displayMode, setDisplayMode] = useState<'tactile' | 'compact'>(config?.affichage?.displayMode || 'tactile');

  useEffect(() => {
    if (config?.affichage?.displayMode) {
      setDisplayMode(config.affichage.displayMode);
    }
  }, [config?.affichage?.displayMode]);

  const handleDisplayModeChange = (newMode: 'tactile' | 'compact') => {
    setDisplayMode(newMode);
    onUpdateConfig({
      ...config,
      affichage: {
        ...config?.affichage,
        displayMode: newMode,
      },
    });
  };
  
  // Checked/unchecked buttons mapping (initialized from config?.affichage?.visibleButtons or defaulting to all true)
  const defaultButtons = {
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
    quitter: true,
  };
  const [visibleButtons, setVisibleButtons] = useState<Record<string, boolean>>({
    ...defaultButtons,
    ...(config?.affichage?.visibleButtons || {}),
  });

  const fileInputDeliveryRef = useRef<HTMLInputElement>(null);
  const fileInputInvoiceRef = useRef<HTMLInputElement>(null);
  const fileInputWallpaperRef = useRef<HTMLInputElement>(null);

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBgImage(reader.result as string);
        alert("Image locale chargée avec succès ! Cliquez sur Enregistrer pour l'appliquer.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'delivery' | 'invoice') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'delivery') {
          setDeliveryLogo(reader.result as string);
        } else {
          setInvoiceLogo(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const updatedConfig = {
      ...config,
      company: companyName, // custom enterprise name
      deliveryInfo: {
        nomRaisonSociale: deliveryNom,
        detail1: deliveryDetail1,
        detail2: deliveryDetail2,
        detail3: deliveryDetail3,
        adresse: deliveryAdresse,
        messageTicket: messageTicket,
        logo: deliveryLogo,
        rc,
        article,
        nis,
        nif,
        compteBancaire,
        defaultPayModeDelivery,
        defaultPayModePurchase,
        defaultTarifMode,
        multiLangueBon,
      },
      invoiceInfo: {
        nomRaisonSociale: invoiceNom,
        detail1: invoiceDetail1,
        detail2: invoiceDetail2,
        detail3: invoiceDetail3,
        adresse: invoiceAdresse,
        logo: invoiceLogo,
        messageFacture,
      },
      affichage: {
        backgroundImage: bgImage,
        visibleButtons: visibleButtons,
        displayMode: displayMode,
      }
    };
    onUpdateConfig(updatedConfig);
    setSaveSuccess(true);
    if (saveSuccessTimeoutRef.current !== null) {
      window.clearTimeout(saveSuccessTimeoutRef.current);
    }
    saveSuccessTimeoutRef.current = window.setTimeout(() => {
      setSaveSuccess(false);
      saveSuccessTimeoutRef.current = null;
    }, 3000);
  };

  const handleActivationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = activationCodeInput.trim().toUpperCase();
    const validCodes = ['VBI-PME-2026', 'VBI-PME', 'DEMO-ACTIVATE', '123456', '777'];
    
    if (validCodes.includes(cleanCode)) {
      const updatedConfig = {
        ...config,
        isActivated: true
      };
      onUpdateConfig(updatedConfig);
      setIsActivationOpen(false);
      setActivationCodeInput('');
      setActivationError('');
    } else {
      setActivationError("Code d'activation invalide. Veuillez réessayer ou utiliser le code de démonstration.");
    }
  };

  const handleDeactivate = () => {
    if (confirm("Voulez-vous désactiver la licence et repasser en mode évaluation ?")) {
      const updatedConfig = {
        ...config,
        isActivated: false
      };
      onUpdateConfig(updatedConfig);
    }
  };

  const toggleButtonVisibility = (id: string) => {
    setVisibleButtons(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const checkAllButtons = (val: boolean) => {
    const updated: Record<string, boolean> = {};
    menuButtonsList.forEach(b => {
      updated[b.id] = val;
    });
    setVisibleButtons(updated);
  };

  const menuButtonsList = [
    { id: 'purchases', label: 'Saisie Achats' },
    { id: 'sales', label: 'Saisie Ventes' },
    { id: 'products', label: 'Produits' },
    { id: 'suppliers', label: 'Fournisseurs' },
    { id: 'clients', label: 'Clients' },
    { id: 'situation', label: 'Situation fournisseurs' },
    { id: 'situation_clients', label: 'Situation clients' },
    { id: 'bons_achats', label: "Bons d'achats" },
    { id: 'bons_ventes', label: 'Bons de ventes' },
    { id: 'stats', label: 'Statistiques' },
    { id: 'inventaire', label: 'Inventaire' },
    { id: 'etat_journee', label: 'Etat de la journée' },
    { id: 'comptes_bancaires', label: 'Comptes bancaires' },
    { id: 'coffre', label: 'Coffre' },
    { id: 'caisses_reseau', label: 'Caisses réseau' },
    { id: 'tiroir_caisse', label: 'Ouvrir tiroir caisse' },
    { id: 'configuration', label: 'Configuration' },
    { id: 'verrouiller', label: 'Verrouiller' },
    { id: 'rendez_vous', label: 'Rendez-vous' },
    { id: 'sauvegarde', label: 'Sauvegarde' },
    { id: 'quitter', label: 'Quitter' },
  ];

  const presetsWallpapers = [
    { name: 'Default Wallpaper', value: '' },
    { name: 'Bleu Cosmique Sombre', value: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1600&auto=format&fit=crop&q=80' },
    { name: 'Aurore Boréale', value: 'https://images.unsplash.com/photo-1531315630201-bb15abeb1653?w=1600&auto=format&fit=crop&q=80' },
    { name: 'Charbon & Minimal', value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop&q=80' },
    { name: 'Nuages Pastel', value: 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=1600&auto=format&fit=crop&q=80' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f0f4f9] dark:bg-slate-900 select-none text-slate-800 dark:text-slate-100 font-sans text-xs">
      
      {/* Hidden file inputs */}
      <input 
        type="file" 
        ref={fileInputDeliveryRef} 
        accept="image/*" 
        onChange={(e) => handleLogoUpload(e, 'delivery')} 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={fileInputInvoiceRef} 
        accept="image/*" 
        onChange={(e) => handleLogoUpload(e, 'invoice')} 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={fileInputWallpaperRef} 
        accept="image/*" 
        onChange={handleWallpaperUpload} 
        className="hidden" 
      />

      {/* Main Container Grid */}
      <div className="flex-1 flex min-h-0">
        
        {/* Left Windows 7-style list side rail */}
        <div className="w-[200px] border-r border-slate-300 dark:border-slate-800 bg-[#e3ebf7] dark:bg-slate-950 p-2 flex flex-col gap-1 overflow-y-auto shrink-0 select-none shadow-[inset_-3px_0_10px_rgba(0,0,0,0.03)]">
          <button
            onClick={() => setActiveTab('delivery')}
            className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-semibold transition-all duration-150 ${activeTab === 'delivery' ? 'bg-[#b6d1f7] text-indigo-950 dark:bg-sky-600/30 dark:text-sky-300 shadow-sm border-l-4 border-indigo-650' : 'hover:bg-[#d0dff4] dark:hover:bg-slate-900 text-slate-700 dark:text-slate-400'}`}
          >
            <Printer size={13} className="shrink-0" />
            <span className="truncate">Informations bon livraison</span>
          </button>

          <button
            onClick={() => setActiveTab('invoice')}
            className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-semibold transition-all duration-150 ${activeTab === 'invoice' ? 'bg-[#b6d1f7] text-indigo-950 dark:bg-sky-600/30 dark:text-sky-300 shadow-sm border-l-4 border-indigo-650' : 'hover:bg-[#d0dff4] dark:hover:bg-slate-900 text-slate-700 dark:text-slate-400'}`}
          >
            <FileText size={13} className="shrink-0" />
            <span className="truncate">Informations sur la facture</span>
          </button>

          <button
            onClick={() => setActiveTab('affichage')}
            className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-semibold transition-all duration-150 ${activeTab === 'affichage' ? 'bg-[#b6d1f7] text-indigo-950 dark:bg-sky-600/30 dark:text-sky-300 shadow-sm border-l-4 border-indigo-650' : 'hover:bg-[#d0dff4] dark:hover:bg-slate-900 text-slate-700 dark:text-slate-400'}`}
          >
            <Image size={13} className="shrink-0" />
            <span className="truncate">Affichage & Wallpaper</span>
          </button>

          <button
            onClick={() => setActiveTab('securite')}
            className={`w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-semibold transition-all duration-150 ${activeTab === 'securite' ? 'bg-[#b6d1f7] text-indigo-950 dark:bg-sky-600/30 dark:text-sky-300 shadow-sm border-l-4 border-indigo-650' : 'hover:bg-[#d0dff4] dark:hover:bg-slate-900 text-slate-700 dark:text-slate-400'}`}
          >
            <Shield size={13} className="shrink-0" />
            <span className="truncate">Utilisateurs & Sécurité</span>
          </button>

          {/* Decorative placeholders matching real system menu tabs in image */}
          <div className="h-[1px] bg-slate-300 dark:bg-slate-800 my-2" />
          <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-600 font-bold px-3">Autres Modules</span>

          <button className="w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-medium text-slate-450 dark:text-slate-750 cursor-not-allowed opacity-60">
            <Layers size={13} />
            <span className="truncate">Modules (Inactif)</span>
          </button>

          <button className="w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-medium text-slate-450 dark:text-slate-750 cursor-not-allowed opacity-60">
            <HardDrive size={13} />
            <span className="truncate">Tiroir caisse</span>
          </button>

          <button className="w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-medium text-slate-450 dark:text-slate-750 cursor-not-allowed opacity-60">
            <SlidersHorizontal size={13} />
            <span className="truncate">Tables & Index</span>
          </button>

          <button className="w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-medium text-slate-450 dark:text-slate-750 cursor-not-allowed opacity-60">
            <Cpu size={13} />
            <span className="truncate">Divers & Impressions</span>
          </button>

          <button className="w-full text-left py-2 px-3 rounded-lg flex items-center gap-2.5 font-medium text-slate-450 dark:text-slate-750 cursor-not-allowed opacity-60">
            <Database size={13} />
            <span className="truncate">Base de données</span>
          </button>

          {/* Activation System section at bottom of left panel */}
          <div className="mt-auto pt-3 border-t border-slate-300 dark:border-slate-800 flex flex-col gap-2">
            <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-slate-900/40 border border-indigo-200/40 dark:border-slate-800 flex flex-col gap-1 text-center shadow-xs">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Licence du Système</span>
              {config?.isActivated ? (
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                  🛡️ Version Active
                </span>
              ) : (
                <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 flex items-center justify-center gap-1 animate-pulse">
                  ⚠️ Mode Évaluation
                </span>
              )}
            </div>
            
            {config?.isActivated ? (
              <button
                type="button"
                onClick={onResetDemo}
                className="w-full text-center py-2 px-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all duration-150 text-[10px] uppercase tracking-wider cursor-pointer active:scale-95 shadow-xs border border-red-700/20"
              >
                🛡️ Reset Demo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsActivationOpen(true)}
                className="w-full text-center py-2.5 px-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:brightness-110 text-white rounded-lg flex items-center justify-center gap-1.5 font-extrabold transition-all duration-150 text-[10.5px] uppercase tracking-wide cursor-pointer active:scale-95 shadow-md shadow-rose-900/10"
              >
                🔑 Activer la BETA
              </button>
            )}
          </div>
        </div>

        {/* Right content workspace pane */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden relative">
          
          {/* Top header area with active tab name and SAVE FLOOPY button */}
          <div className="bg-[#fcfdfe] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 p-3 px-5 flex justify-between items-center shrink-0 shadow-xs">
            <div>
              <h1 className="text-sm font-black text-rose-800 dark:text-rose-400 tracking-wider font-display uppercase leading-none drop-shadow-xs">
                {activeTab === 'delivery' && 'INFORMATIONS SUR BON DE LIVRAISON'}
                {activeTab === 'invoice' && 'INFORMATIONS SUR LA FACTURE'}
                {activeTab === 'affichage' && "AFFICHAGE & WALLPAPER DE L'APPLICATION"}
                {activeTab === 'securite' && "UTILISATEURS & SÉCURITÉ DE L'APPLICATION"}
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                Configuration générale de l'ERP VBI PME BETA
              </p>
            </div>

            <div className="flex items-center gap-3">
              {activeTab === 'affichage' && (
                <div className="flex flex-col gap-0.5 select-text">
                  <span className="font-bold text-[9px] text-slate-500 uppercase">Nom de l'entreprise :</span>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nom de votre entreprise..."
                    className="h-8.5 w-48 rounded-xl bg-slate-150 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-800 dark:text-sky-400 focus:border-indigo-500 transition-colors"
                  />
                </div>
              )}

              {/* Giant Floppy Save Button (Image 1 style) */}
              <button
                onClick={handleSave}
                className="flex flex-col items-center justify-center w-[75px] h-[55px] border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
              >
                <Save size={18} className="text-indigo-650 dark:text-sky-450 animate-pulse" />
                <span className="text-[9px] font-black tracking-wide text-slate-650 dark:text-slate-350 uppercase mt-0.5">Enregistrer</span>
              </button>
            </div>
          </div>

          {/* Core Content Area Scrollable */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#fafbfc] dark:bg-slate-900/60">
            
            {saveSuccess && (
              <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11.5px] p-2.5 px-4 rounded-xl font-bold flex items-center gap-2 select-none">
                <Check size={14} className="text-emerald-500 animate-bounce" />
                <span>Les paramètres ont été enregistrés localement avec succès !</span>
              </div>
            )}

            {/* TAB 1: INFORMATIONS BON DE LIVRAISON */}
            {activeTab === 'delivery' && (
              <div className="flex flex-col gap-4 max-w-2xl select-text">
                
                {/* Entête et logo block */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Entête et logo de bon de livraison
                  </span>

                  <div className="flex flex-col gap-2.5 mt-1.5">
                    {/* Nom ou raison sociale */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Nom ou raison sociale</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryNom}
                          onChange={(e) => setDeliveryNom(e.target.value)}
                          placeholder="Nom de l'entreprise"
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800" title="Style de police">A</button>
                      </div>
                    </div>

                    {/* Detail 1 */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Détail 1</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryDetail1}
                          onChange={(e) => setDeliveryDetail1(e.target.value)}
                          placeholder="Détail 1"
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800" title="Style de police">A</button>
                      </div>
                    </div>

                    {/* Detail 2 */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Détail 2</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryDetail2}
                          onChange={(e) => setDeliveryDetail2(e.target.value)}
                          placeholder="Détail 2"
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800" title="Style de police">A</button>
                      </div>
                    </div>

                    {/* Detail 3 */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Détail 3</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryDetail3}
                          onChange={(e) => setDeliveryDetail3(e.target.value)}
                          placeholder="Détail 3"
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800" title="Style de police">A</button>
                      </div>
                    </div>

                    {/* Adresse */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Adresse</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryAdresse}
                          onChange={(e) => setDeliveryAdresse(e.target.value)}
                          placeholder="Adresse de l'entreprise"
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800" title="Style de police">A</button>
                      </div>
                    </div>

                    {/* Message ticket */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Message ticket</span>
                      <input
                        type="text"
                        value={messageTicket}
                        onChange={(e) => setMessageTicket(e.target.value)}
                        placeholder="Message sur le bas du ticket de caisse"
                        className="w-full h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors font-mono"
                      />
                    </div>

                    {/* Multi langue bon de vente */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Multi langue bon de vente</span>
                      <select
                        value={multiLangueBon}
                        onChange={(e) => setMultiLangueBon(e.target.value)}
                        className="w-full h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                      >
                        <option value="off">Off (Français uniquement)</option>
                        <option value="arabe">Arabe (Français & Arabe)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Logo and statutory settings group */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative mt-2">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Logo et variables d'entreprise
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {/* Left: Logo Preview & Operations */}
                    <div className="flex flex-col gap-2">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Logo imprimable</span>
                      
                      <div className="flex gap-2 mb-1.5 select-none">
                        <button
                          type="button"
                          onClick={() => fileInputDeliveryRef.current?.click()}
                          className="h-7.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-300 font-bold rounded-lg border border-indigo-200/60 dark:border-indigo-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Upload size={12} /> Charger un logo
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeliveryLogo('')}
                          className="h-7.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-750 dark:text-rose-300 font-bold rounded-lg border border-rose-200/60 dark:border-rose-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} /> Annuler logo
                        </button>
                      </div>

                      {/* Display circular logo preview container like in image.png */}
                      <div className="h-[130px] rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden p-2">
                        {deliveryLogo ? (
                          <img 
                            src={deliveryLogo} 
                            alt="Logo Bon de Livraison" 
                            className="max-h-full max-w-full object-contain rounded"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">(Aucun logo)</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Statutory fields */}
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-[9px] text-slate-500 uppercase">N° Registre Com.</span>
                          <input 
                            type="text" 
                            value={rc} 
                            onChange={(e) => setRc(e.target.value)} 
                            placeholder="RC..." 
                            className="h-7.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 outline-none font-bold text-[11px] text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-[9px] text-slate-500 uppercase">N° Article</span>
                          <input 
                            type="text" 
                            value={article} 
                            onChange={(e) => setArticle(e.target.value)} 
                            placeholder="Article..." 
                            className="h-7.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 outline-none font-bold text-[11px] text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-[9px] text-slate-500 uppercase">NIS</span>
                          <input 
                            type="text" 
                            value={nis} 
                            onChange={(e) => setNis(e.target.value)} 
                            placeholder="NIS..." 
                            className="h-7.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 outline-none font-bold text-[11px] text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-[9px] text-slate-500 uppercase">NIF</span>
                          <input 
                            type="text" 
                            value={nif} 
                            onChange={(e) => setNif(e.target.value)} 
                            placeholder="NIF..." 
                            className="h-7.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 outline-none font-bold text-[11px] text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 mt-1">
                        <span className="font-bold text-[9px] text-slate-500 uppercase">Compte Bancaire</span>
                        <input 
                          type="text" 
                          value={compteBancaire} 
                          onChange={(e) => setCompteBancaire(e.target.value)} 
                          placeholder="RIB / Code IBAN du compte..." 
                          className="h-7.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 outline-none font-mono font-bold text-[10.5px] text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom default parameters block with exact Image 1 dropdowns */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative mt-2 select-none">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Paramètres de facturation par défaut
                  </span>

                  <div className="flex flex-col gap-3.5 mt-2">
                    
                    {/* Default Pay Mode Delivery */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                      <span className="font-bold text-indigo-950 dark:text-indigo-300 text-[10.5px]">Mode de paiement par défaut pour bon de livraison :</span>
                      <select
                        value={defaultPayModeDelivery}
                        onChange={(e) => setDefaultPayModeDelivery(e.target.value)}
                        className="h-7 px-3.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-black text-xs text-indigo-900 dark:text-sky-300 outline-none"
                      >
                        <option value="ESPECE">ESPECE</option>
                        <option value="A TERME">A TERME</option>
                      </select>
                    </div>

                    {/* Default Pay Mode Purchase */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                      <span className="font-bold text-indigo-950 dark:text-indigo-300 text-[10.5px]">Mode de paiement par défaut pour bon d'achat :</span>
                      <select
                        value={defaultPayModePurchase}
                        onChange={(e) => setDefaultPayModePurchase(e.target.value)}
                        className="h-7 px-3.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-black text-xs text-indigo-900 dark:text-sky-300 outline-none"
                      >
                        <option value="ESPECE">ESPECE</option>
                        <option value="A TERME">A TERME</option>
                      </select>
                    </div>

                    {/* Default Tarif Mode */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-950 dark:text-indigo-300 text-[10.5px]">Mode de tarif par défaut :</span>
                      <select
                        value={defaultTarifMode}
                        onChange={(e) => setDefaultTarifMode(e.target.value)}
                        className="h-7 px-3.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-black text-xs text-indigo-900 dark:text-sky-300 outline-none"
                      >
                        <option value="Tarif 1">Tarif 1</option>
                        <option value="Tarif 2">Tarif 2</option>
                        <option value="Tarif 3">Tarif 3</option>
                      </select>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: INFORMATIONS DE FACTURE */}
            {activeTab === 'invoice' && (
              <div className="flex flex-col gap-4 max-w-2xl select-text">
                
                {/* Invoice headers block */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Entête et logo de facture de vente
                  </span>

                  <div className="flex flex-col gap-2.5 mt-1.5">
                    {/* Nom de la societe */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Nom ou raison sociale</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={invoiceNom}
                          onChange={(e) => setInvoiceNom(e.target.value)}
                          placeholder="Nom de l'entreprise sur facture"
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800">A</button>
                      </div>
                    </div>

                    {/* Detail 1 */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Détail 1</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={invoiceDetail1}
                          onChange={(e) => setInvoiceDetail1(e.target.value)}
                          placeholder="e.g. Adresse de facturation..."
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800">A</button>
                      </div>
                    </div>

                    {/* Detail 2 */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Détail 2</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={invoiceDetail2}
                          onChange={(e) => setInvoiceDetail2(e.target.value)}
                          placeholder="e.g. Tél / Email..."
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800">A</button>
                      </div>
                    </div>

                    {/* Detail 3 */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Détail 3</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={invoiceDetail3}
                          onChange={(e) => setInvoiceDetail3(e.target.value)}
                          placeholder="e.g. Mentions légales, TVA, etc..."
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800">A</button>
                      </div>
                    </div>

                    {/* Adresse */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Adresse</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={invoiceAdresse}
                          onChange={(e) => setInvoiceAdresse(e.target.value)}
                          placeholder="Adresse de l'entreprise"
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800">A</button>
                      </div>
                    </div>

                    {/* Message Facture */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Message facture</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageFacture}
                          onChange={(e) => setMessageFacture(e.target.value)}
                          placeholder="e.g. Merci de votre confiance (affiché en bas de la facture)..."
                          className="flex-1 h-8 rounded-xl bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-250 focus:border-indigo-500 transition-colors"
                        />
                        <button className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center font-black text-indigo-700 border border-slate-200 dark:border-slate-800">A</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice logo configuration */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative mt-2 select-none">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Logo de la facture de vente
                  </span>

                  <div className="flex flex-col gap-2 mt-1.5">
                    <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Logo imprimable sur facture</span>
                    
                    <div className="flex gap-2 mb-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputInvoiceRef.current?.click()}
                        className="h-7.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-300 font-bold rounded-lg border border-indigo-200/60 dark:border-indigo-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Upload size={12} /> Charger un logo
                      </button>

                      <button
                        type="button"
                        onClick={() => setInvoiceLogo('')}
                        className="h-7.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-750 dark:text-rose-300 font-bold rounded-lg border border-rose-200/60 dark:border-rose-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Annuler logo
                      </button>
                    </div>

                    <div className="h-[120px] rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden p-2">
                      {invoiceLogo ? (
                        <img 
                          src={invoiceLogo} 
                          alt="Logo Facture" 
                          className="max-h-full max-w-full object-contain rounded"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Aucun logo (Logo par défaut)</div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: AFFICHAGE & WALLPAPER */}
            {activeTab === 'affichage' && (
              <div className="flex flex-col gap-4 select-none">
                
                {/* Display Mode Options */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Mode d'affichage de l'application
                  </span>

                  <div className="flex flex-col gap-3 mt-1.5">
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Sélectionnez le mode d'affichage de l'interface utilisateur.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
                      {/* Tactile Mode */}
                      <button
                        type="button"
                        onClick={() => handleDisplayModeChange('tactile')}
                        className={`w-full min-w-0 overflow-hidden p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative ${
                          displayMode === 'tactile'
                            ? 'bg-indigo-50/70 border-indigo-500 dark:bg-indigo-950/40 dark:border-indigo-400 shadow-xs ring-1 ring-indigo-500/30'
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full min-w-0">
                          <div className="flex items-center gap-2 font-black text-xs text-indigo-950 dark:text-sky-300 min-w-0">
                            <Smartphone size={16} className="text-indigo-600 dark:text-sky-400 shrink-0" />
                            <span className="truncate">Tactile mode (POS)</span>
                          </div>
                          {displayMode === 'tactile' && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider shrink-0">
                              Actif
                            </span>
                          )}
                        </div>

                        {/* Animated GIF-like UI simulation for Tactile Mode */}
                        <div className="h-28 w-full rounded-lg bg-slate-950 border border-slate-800 overflow-hidden relative flex flex-col justify-between p-2 shadow-inner">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Bureau & Grandes Icônes</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 my-auto px-1">
                            <div className="h-8 rounded-md bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center animate-pulse">
                              <div className="w-3.5 h-3.5 rounded bg-white/80" />
                            </div>
                            <div className="h-8 rounded-md bg-emerald-600/80 border border-emerald-400/40 flex items-center justify-center">
                              <div className="w-3.5 h-3.5 rounded bg-white/80" />
                            </div>
                            <div className="h-8 rounded-md bg-amber-600/80 border border-amber-400/40 flex items-center justify-center">
                              <div className="w-3.5 h-3.5 rounded bg-white/80" />
                            </div>
                            <div className="h-8 rounded-md bg-sky-600/80 border border-sky-400/40 flex items-center justify-center">
                              <div className="w-3.5 h-3.5 rounded bg-white/80" />
                            </div>
                            <div className="h-8 rounded-md bg-purple-600/80 border border-purple-400/40 flex items-center justify-center">
                              <div className="w-3.5 h-3.5 rounded bg-white/80" />
                            </div>
                            <div className="h-8 rounded-md bg-rose-600/80 border border-rose-400/40 flex items-center justify-center">
                              <div className="w-3.5 h-3.5 rounded bg-white/80" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[8px] text-slate-400 font-semibold pt-0.5 border-t border-slate-800/80">
                            <span>Écran tactile POS</span>
                            <span className="text-indigo-400 font-bold">Boutons larges</span>
                          </div>
                        </div>

                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-normal break-words w-full text-left">
                          Interface avec grandes icônes et boutons larges pour écrans tactiles et caisses POS.
                        </p>
                      </button>

                      {/* Compact Mode */}
                      <button
                        type="button"
                        onClick={() => handleDisplayModeChange('compact')}
                        className={`w-full min-w-0 overflow-hidden p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative ${
                          displayMode === 'compact'
                            ? 'bg-indigo-50/70 border-indigo-500 dark:bg-indigo-950/40 dark:border-indigo-400 shadow-xs ring-1 ring-indigo-500/30'
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full min-w-0">
                          <div className="flex items-center gap-2 font-black text-xs text-slate-800 dark:text-slate-200 min-w-0">
                            <Monitor size={16} className="text-slate-500 dark:text-slate-400 shrink-0" />
                            <span className="truncate">Compact mode (Dense)</span>
                          </div>
                          {displayMode === 'compact' ? (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider shrink-0">
                              Actif
                            </span>
                          ) : (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase tracking-wider shrink-0">
                              Disponible
                            </span>
                          )}
                        </div>

                        {/* Animated GIF-like UI simulation for Compact Mode */}
                        <div className="h-28 w-full rounded-lg bg-slate-950 border border-slate-800 overflow-hidden relative flex flex-col justify-between p-2 shadow-inner">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                            <div className="h-3 w-28 rounded bg-slate-800 flex items-center px-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mr-1 animate-pulse" />
                              <span className="text-[7px] text-slate-400">Recherche rapide...</span>
                            </div>
                            <span className="text-[8px] font-bold text-sky-400 uppercase tracking-wider">Liste Dense</span>
                          </div>
                          <div className="flex flex-col gap-1 my-auto px-0.5">
                            <div className="h-3.5 rounded bg-slate-850 border border-slate-700/60 flex items-center justify-between px-1.5">
                              <span className="w-12 h-1.5 rounded bg-sky-400/80" />
                              <span className="w-8 h-1.5 rounded bg-slate-600" />
                            </div>
                            <div className="h-3.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between px-1.5">
                              <span className="w-16 h-1.5 rounded bg-slate-400" />
                              <span className="w-6 h-1.5 rounded bg-emerald-500/80" />
                            </div>
                            <div className="h-3.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between px-1.5">
                              <span className="w-14 h-1.5 rounded bg-slate-400" />
                              <span className="w-8 h-1.5 rounded bg-amber-500/80" />
                            </div>
                            <div className="h-3.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between px-1.5">
                              <span className="w-10 h-1.5 rounded bg-slate-400" />
                              <span className="w-7 h-1.5 rounded bg-slate-600" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[8px] text-slate-400 font-semibold pt-0.5 border-t border-slate-800/80">
                            <span>Usage clavier & souris</span>
                            <span className="text-sky-400 font-bold">Haute densité</span>
                          </div>
                        </div>

                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-normal break-words w-full text-left">
                          Interface condensée en liste dense pour usage au clavier et écrans standards.
                        </p>
                      </button>
                    </div>

                    {displayMode === 'compact' && (
                      <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300/50 text-sky-800 dark:text-sky-300 text-[10.5px] font-semibold flex items-center gap-2 w-full min-w-0 overflow-hidden">
                        <Monitor size={14} className="shrink-0 text-sky-600 dark:text-sky-400" />
                        <span className="break-words min-w-0 flex-1">Mode compact actif : affichage dense optimisé pour clavier et écrans standards.</span>
                      </div>
                    )}
                    {displayMode === 'tactile' && (
                      <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300/50 text-indigo-800 dark:text-indigo-300 text-[10.5px] font-semibold flex items-center gap-2 w-full min-w-0 overflow-hidden">
                        <Smartphone size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                        <span className="break-words min-w-0 flex-1">Mode tactile actif : grandes icônes et boutons larges pour écrans tactiles et POS.</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Background Selector */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Arrière-plan de l'application
                  </span>

                  <div className="flex flex-col gap-3 mt-1.5">
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      Personnalisez l'arrière-plan du bureau principal de l'application avec un papier peint prédéfini ou une image de votre choix.
                    </p>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-1">
                      {presetsWallpapers.map((preset, idx) => (
                        <button
                          key={`preset-${preset.name}-${idx}`}
                          type="button"
                          onClick={() => setBgImage(preset.value)}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${bgImage === preset.value ? 'bg-indigo-50 border-indigo-500 text-indigo-950 dark:bg-indigo-950/45 dark:border-indigo-400 dark:text-sky-300 font-bold' : 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                          <div className="w-full h-8.5 rounded-lg mb-1 bg-sky-600 overflow-hidden relative border border-slate-200 dark:border-slate-800">
                            {preset.value ? (
                              <img src={preset.value} alt={preset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-tr from-sky-800 to-sky-400" />
                            )}
                          </div>
                          <span className="text-[10px] block truncate leading-tight">{preset.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Local Wallpaper Upload */}
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Télécharger une image depuis votre appareil (remplit le panneau principal)</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputWallpaperRef.current?.click()}
                          className="h-8 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-300 font-bold rounded-xl border border-indigo-200/60 dark:border-indigo-900 flex items-center gap-1.5 cursor-pointer text-xs"
                        >
                          <Upload size={12} /> Choisir une image locale...
                        </button>
                        {bgImage && (
                          <button
                            type="button"
                            onClick={() => setBgImage('')}
                            className="px-3.5 h-8 bg-rose-50 hover:bg-rose-100 text-rose-750 dark:bg-rose-950/40 dark:text-rose-400 font-bold rounded-xl text-xs border border-rose-200/50 dark:border-rose-900 transition-colors cursor-pointer"
                          >
                            Réinitialiser le fond
                          </button>
                        )}
                        {bgImage && bgImage.startsWith('data:image/') && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            ✔ Image locale chargée
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visible Main Menu Buttons list matching Image 2 & 3 */}
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-xs relative mt-2">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Boutons du menu principal à afficher
                  </span>

                  <div className="flex flex-col gap-2.5 mt-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1.5 select-none">
                      <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-bold">Cochez les éléments de navigation que vous souhaitez laisser visibles :</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => checkAllButtons(true)}
                          className="px-2 py-0.5 text-[9px] font-black text-indigo-700 dark:text-indigo-400 bg-slate-100 dark:bg-slate-900 rounded hover:bg-slate-200"
                        >
                          Tout cocher
                        </button>
                        <button
                          type="button"
                          onClick={() => checkAllButtons(false)}
                          className="px-2 py-0.5 text-[9px] font-black text-rose-700 dark:text-rose-400 bg-slate-100 dark:bg-slate-900 rounded hover:bg-slate-200"
                        >
                          Tout décocher
                        </button>
                      </div>
                    </div>

                    {/* Checkbox scrollbox container matching Image 2 exactly */}
                    <div className="max-h-[220px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-[#fcfdfe] dark:bg-slate-950 p-3 flex flex-col gap-2 select-none shadow-inner">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {menuButtonsList.map((button, idx) => {
                          const isChecked = visibleButtons[button.id] !== false;
                          return (
                            <button
                              key={`btn-${button.id}-${idx}`}
                              type="button"
                              onClick={() => toggleButtonVisibility(button.id)}
                              className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-900 p-1 rounded-md text-left transition-colors cursor-pointer"
                            >
                              <span className="text-indigo-650 dark:text-indigo-400">
                                {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                              </span>
                              <span className={isChecked ? 'font-black text-slate-900 dark:text-white' : 'text-slate-400 line-through font-medium'}>
                                {button.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-normal mt-1 flex items-start gap-1">
                      <HelpCircle size={12} className="shrink-0 mt-0.5 text-indigo-500" /> Les boutons décochés seront immédiatement masqués du panneau d'accès rapide supérieur ainsi que du menu de démarrage Aero.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'securite' && (
              <div className="flex flex-col gap-4 text-left">
                <div className="border border-indigo-200/50 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-5 shadow-xs relative">
                  <span className="absolute top-[-9px] left-4 px-2 bg-white dark:bg-slate-950 text-[9.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                    Gestion des comptes & Sécurité
                  </span>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                    Gérez ici les comptes utilisateurs de l'application, leurs permissions d'accès aux modules ainsi que les mots de passe et la sécurité.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 font-black text-xs text-indigo-950 dark:text-sky-300 mb-1.5">
                          <Users size={18} className="text-rose-500" />
                          <span>Gestion des utilisateurs</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mb-3">
                          Ajoutez, modifiez ou supprimez des comptes utilisateurs et personnalisez leurs droits d'accès.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenUserManagement?.();
                        }}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                      >
                        <Users size={14} /> Ouvrir la gestion des utilisateurs
                      </button>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 font-black text-xs text-indigo-950 dark:text-sky-300 mb-1.5">
                          <Key size={18} className="text-amber-500" />
                          <span>Changer le mot de passe</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mb-3">
                          Modifiez votre mot de passe administrateur ou utilisateur pour sécuriser votre accès.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPwdCurrent('');
                          setPwdNew('');
                          setPwdConfirm('');
                          setPwdError('');
                          setPwdSuccess('');
                          setIsChangePasswordOpen(true);
                        }}
                        className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                      >
                        <Key size={14} /> Changer le mot de passe
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Change Password Modal */}
          {isChangePasswordOpen && (
            <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 w-full max-w-sm flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                      <Key size={18} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Changer le mot de passe</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Pour le compte : {currentUser?.name || currentUser?.username || 'Utilisateur actuel'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {pwdError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{pwdError}</span>
                  </div>
                )}

                {pwdSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <Check size={15} className="shrink-0" />
                    <span>{pwdSuccess}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Mot de passe actuel</label>
                    <input
                      type="password"
                      value={pwdCurrent}
                      onChange={(e) => setPwdCurrent(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={pwdNew}
                      onChange={(e) => setPwdNew(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordOpen(false)}
                    className="px-4 h-8 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPwdError('');
                      setPwdSuccess('');
                      if (!pwdCurrent || !pwdNew || !pwdConfirm) {
                        setPwdError('Veuillez remplir tous les champs.');
                        return;
                      }
                      if (pwdNew !== pwdConfirm) {
                        setPwdError('Les nouveaux mots de passe ne correspondent pas.');
                        return;
                      }
                      if (onChangePassword) {
                        const res = onChangePassword(pwdCurrent, pwdNew);
                        if (res && typeof res === 'object') {
                          if (res.success) {
                            setPwdSuccess(res.message);
                            setTimeout(() => {
                              setIsChangePasswordOpen(false);
                            }, 1500);
                          } else {
                            setPwdError(res.message);
                          }
                        } else {
                          setPwdSuccess('Mot de passe modifié avec succès !');
                          setTimeout(() => {
                            setIsChangePasswordOpen(false);
                          }, 1500);
                        }
                      }
                    }}
                    className="px-4 h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Key size={13} /> Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom actions footer matching image */}
          <div className="bg-[#f0f4f9] dark:bg-slate-950 p-3 px-5 border-t border-slate-300 dark:border-slate-800 flex justify-center gap-2.5 shrink-0 select-none">
            <button
              onClick={onClose}
              className="px-6 h-8 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-black rounded-lg text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <LogOut size={13} className="rotate-180" /> QUITTER
            </button>
          </div>

        </div>

      </div>

      {/* Embedded Activation Code Dialog/Modal */}
      {isActivationOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="w-[380px] bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-slate-800 shadow-2xl p-5 select-none text-left">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-150 dark:border-slate-850 pb-2">
              <span className="text-base">🔑</span>
              <h2 className="text-[13px] font-black uppercase text-indigo-950 dark:text-sky-405 tracking-wider">
                Activation de la Licence
              </h2>
            </div>

            <form onSubmit={handleActivationSubmit} className="flex flex-col gap-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                Saisissez votre clé d'activation pour lever toutes les restrictions du mode évaluation (produits, clients, achats, ventes).
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-700 dark:text-slate-350 uppercase tracking-wide">
                  Code d'activation :
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Ex: VBI-PME-2026"
                  value={activationCodeInput}
                  onChange={(e) => {
                    setActivationCodeInput(e.target.value);
                    if (activationError) setActivationError('');
                  }}
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider focus:outline-hidden focus:ring-1 focus:ring-indigo-500 dark:focus:ring-sky-500"
                />
              </div>

              {activationError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-955/20 border border-rose-200/50 text-rose-700 dark:text-rose-450 font-bold text-[10px] leading-normal flex items-start gap-1">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{activationError}</span>
                </div>
              )}

              {/* Helpful Demo/Trial Activation Codes */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-indigo-950 dark:text-indigo-400 uppercase tracking-wider">
                  💡 Codes de Test Disponibles :
                </span>
                <div className="flex flex-nowrap overflow-x-auto scrollbar-none gap-1.5 mt-0.5 shrink-0">
                  {['VBI-PME-2026', '123456', '777'].map((code, idx) => (
                    <button
                      key={`testcode-${code}-${idx}`}
                      type="button"
                      onClick={() => {
                        setActivationCodeInput(code);
                        setActivationError('');
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-350 border border-slate-200 dark:border-slate-750 font-mono text-[9px] font-bold rounded-md transition-colors shadow-2xs"
                    >
                      {code}
                    </button>
                  ))}
                </div>
                <span className="text-[8.5px] text-slate-400 dark:text-slate-500 italic mt-0.5 leading-none">
                  (Cliquez sur un code pour l'insérer automatiquement)
                </span>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-150 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setIsActivationOpen(false);
                    setActivationCodeInput('');
                    setActivationError('');
                  }}
                  className="px-3.5 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4.5 h-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-extrabold rounded-lg text-xs cursor-pointer shadow-md shadow-emerald-950/10"
                >
                  Activer maintenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default React.memo(ConfigWindow, (prev, next) => prev.config === next.config);
