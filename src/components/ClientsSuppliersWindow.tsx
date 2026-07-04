import React, { useState } from 'react';
import { Client, Supplier } from '../types';
import { Users, Truck, Plus, Save, X, HelpCircle, Trash2, MapPin, Phone, Edit, AlertTriangle } from 'lucide-react';

interface ClientsSuppliersWindowProps {
  mode: 'clients' | 'suppliers';
  clients: Client[];
  suppliers: Supplier[];
  onAddClient: (client: Client) => void;
  onAddSupplier: (supplier: Supplier) => void;
  onUpdateClient?: (client: Client) => void;
  onUpdateSupplier?: (supplier: Supplier) => void;
  onDeleteClient?: (id: string) => void;
  onDeleteSupplier?: (id: string) => void;
  onClose: () => void;
  config?: any;
}

export default function ClientsSuppliersWindow({
  mode,
  clients,
  suppliers,
  onAddClient,
  onAddSupplier,
  onUpdateClient,
  onUpdateSupplier,
  onDeleteClient,
  onDeleteSupplier,
  onClose,
  config
}: ClientsSuppliersWindowProps) {
  // Modal states
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingItem, setEditingItem] = useState<Client | Supplier | null>(null);
  const [deletingItem, setDeletingItem] = useState<Client | Supplier | null>(null);
  
  // Form input states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');

  // Start adding a new record
  const handleStartAdd = () => {
    setEditingItem(null);
    setName('');
    setAddress('');
    setContact('');
    
    if (mode === 'clients') {
      setCode(`C-${String(clients.length + 1).padStart(3, '0')}`);
    } else {
      setCode(`F-${String(suppliers.length + 1).padStart(3, '0')}`);
    }
    setIsAddingNew(true);
  };

  // Start editing an existing record
  const handleStartEdit = (item: Client | Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setAddress(item.address || '');
    setContact(item.contact || '');
    setIsAddingNew(true);
  };

    // Save (Create or Update) handler
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    if (mode === 'clients' && name.trim().toUpperCase() === 'ANONYME') {
      alert("Le nom 'Anonyme' est réservé au client par défaut du système et ne peut pas être recréé.");
      return;
    }

    if (!editingItem) {
      if (mode === 'clients' && !config?.isActivated && clients.length >= 1) {
        alert("⚠️ Limite Démo : Vous ne pouvez pas créer plus de 1 client en mode évaluation (démo). Veuillez activer l'application avec un code d'activation dans les configurations.");
        return;
      }
      if (mode === 'suppliers' && !config?.isActivated && suppliers.length >= 1) {
        alert("⚠️ Limite Démo : Vous ne pouvez pas créer plus de 1 fournisseur en mode évaluation (démo). Veuillez activer l'application avec un code d'activation dans les configurations.");
        return;
      }
    }

    if (editingItem) {
      // Editing existing
      if (mode === 'clients') {
        const updatedClient: Client = {
          ...editingItem,
          name: name.toUpperCase(),
          address: address.trim() || undefined,
          contact: contact.trim() || undefined
        };
        onUpdateClient?.(updatedClient);
      } else {
        const updatedSupplier: Supplier = {
          ...editingItem,
          name: name,
          address: address.trim() || undefined,
          contact: contact.trim() || undefined
        };
        onUpdateSupplier?.(updatedSupplier);
      }
    } else {
      // Adding new
      if (mode === 'clients') {
        const newClient: Client = {
          id: Math.random().toString(),
          code: code.toUpperCase(),
          name: name.toUpperCase(),
          balance: 0,
          address: address.trim() || undefined,
          contact: contact.trim() || undefined
        };
        onAddClient(newClient);
      } else {
        const newSupplier: Supplier = {
          id: Math.random().toString(),
          code: code.toUpperCase(),
          name: name,
          balance: 0,
          address: address.trim() || undefined,
          contact: contact.trim() || undefined
        };
        onAddSupplier(newSupplier);
      }
    }

    setIsAddingNew(false);
    setEditingItem(null);
  };

  // Confirm delete handler
  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    if (mode === 'clients') {
      onDeleteClient?.(deletingItem.id);
    } else {
      onDeleteSupplier?.(deletingItem.id);
    }
    setDeletingItem(null);
  };

  const titleText = mode === 'clients' ? 'Fichier Clients' : 'Fichier Fournisseurs';
  const recordsList = mode === 'clients' 
    ? clients.filter(c => c.name.toLowerCase() !== 'anonyme' && c.id !== 'client-anonyme') 
    : suppliers;

  return (
    <div className="flex-1 flex flex-col gap-4 font-sans text-xs text-slate-800 dark:text-slate-100 h-full overflow-hidden relative">
      
      {/* Title block with M3 styling */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pt-2 pb-3 px-1.5 select-none shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-m3-primary/10 dark:bg-sky-500/10 text-m3-primary dark:text-sky-400 rounded-xl flex items-center justify-center">
            {mode === 'clients' ? <Users size={16} className="shrink-0" /> : <Truck size={16} className="shrink-0" />}
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white leading-none">
              {titleText}
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold leading-none">
              Gestion et suivi du grand livre ({recordsList.length} enregistrements)
            </p>
          </div>
        </div>

        <div className="flex items-center">
          <button
            onClick={handleStartAdd}
            className="h-9 px-4 bg-m3-primary hover:bg-m3-primary/90 text-white font-bold rounded-xl text-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
          >
            <Plus size={15} /> {mode === 'clients' ? 'Ajouter Client' : 'Ajouter Fournisseur'}
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="flex-1 flex flex-col border border-m3-outline-variant/15 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="bg-slate-50 dark:bg-slate-950/65 font-bold px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 select-none flex items-center justify-between font-display">
          <span className="flex items-center gap-2">
            📊 Registre Comptable {mode === 'clients' ? 'des Clients' : 'des Fournisseurs'}
          </span>
          <span className="text-[10px] bg-slate-200/60 dark:bg-slate-850 px-2 py-0.5 rounded-md font-mono text-slate-500">
            Total Encours: {recordsList.reduce((acc, curr) => acc + (curr.balance ?? 0), 0).toLocaleString('fr-FR')} DA
          </span>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left font-sans text-xs border-collapse">
            <thead className="bg-[#f8fafc] dark:bg-slate-950/30 text-slate-500 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-100 dark:border-slate-800 select-none z-10 text-[9.5px] uppercase tracking-wider font-display">
              <tr>
                <th className="px-4 py-3 w-24">Code</th>
                <th className="px-4 py-3">Nom / Raison Sociale</th>
                <th className="px-4 py-3">Adresse</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-right">Solde Actuel (Encours)</th>
                <th className="px-4 py-3 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
              {recordsList.length > 0 ? (
                recordsList.map(item => {
                  const isClient = mode === 'clients';
                  const balanceVal = item.balance ?? 0;
                  const isPositive = balanceVal > 0;
                  const balanceColor = isClient 
                    ? (isPositive ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')
                    : (balanceVal < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-m3-primary dark:text-sky-400 font-sans">{item.code}</td>
                      <td className="px-4 py-2.5 font-sans font-bold text-slate-900 dark:text-slate-100 select-text">{item.name}</td>
                      <td className="px-4 py-2.5 font-sans text-slate-500 dark:text-slate-400">
                        {item.address ? (
                          <span className="flex items-center gap-1 select-text">
                            <MapPin size={11} className="text-slate-400" /> {item.address}
                          </span>
                        ) : (
                          <span className="text-slate-350 dark:text-slate-600 italic">Non spécifiée</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-sans text-slate-500 dark:text-slate-400">
                        {item.contact ? (
                          <span className="flex items-center gap-1 select-text">
                            <Phone size={11} className="text-slate-400" /> {item.contact}
                          </span>
                        ) : (
                          <span className="text-slate-350 dark:text-slate-600 italic font-medium">Non spécifié</span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${balanceColor}`}>
                        {balanceVal.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                      </td>
                      <td className="px-4 py-2.5 text-center flex items-center justify-center gap-1.5 h-10">
                        {/* Edit Button */}
                        <button
                          onClick={(e) => handleStartEdit(item, e)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-all active:scale-90 cursor-pointer inline-flex items-center justify-center"
                          title="Modifier les informations"
                          type="button"
                        >
                          <Edit size={13} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDeletingItem(item);
                          }}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-all active:scale-90 cursor-pointer inline-flex items-center justify-center"
                          title="Supprimer définitivement"
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-600 font-sans italic">
                    Aucun enregistrement trouvé dans ce fichier.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info/actions */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800 p-3 rounded-2xl select-none shrink-0">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans leading-relaxed flex items-start gap-1.5 max-w-[70%]">
          <HelpCircle size={14} className="shrink-0 text-m3-outline" /> Les comptes sont mis à jour dynamiquement selon les bons de livraison (ventes) ou bons d'achats. Un solde positif désigne un encours ou une créance d'achat/vente restant due.
        </p>
        <button
          onClick={onClose}
          className="h-9 px-5 text-xs font-bold bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer border border-transparent"
        >
          Fermer l'onglet
        </button>
      </div>

      {/* DIALOG MODAL FOR ADDING/EDITING CLIENT/SUPPLIER */}
      {isAddingNew && (
        <div className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-[380px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/10">
              <div className="flex items-center gap-2">
                <span className="text-base">👤</span>
                <span className="font-black text-sm text-slate-900 dark:text-white font-sans">
                  {editingItem 
                    ? (mode === 'clients' ? 'Modifier le Client' : 'Modifier le Fournisseur')
                    : (mode === 'clients' ? 'Nouveau Client' : 'Nouveau Fournisseur')
                  }
                </span>
              </div>
              <button 
                onClick={() => {
                  setIsAddingNew(false);
                  setEditingItem(null);
                }}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-extrabold text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-wide">Code Unique</span>
                <input
                  type="text"
                  required
                  readOnly
                  value={code}
                  className="h-9 rounded-xl px-3 bg-slate-150/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wide">Nom / Raison Sociale</span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={mode === 'clients' ? "Ex. SARL GLOBAL DIST" : "Ex. ETS BOUALEM & CO"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans font-extrabold outline-none focus:border-m3-primary dark:focus:border-sky-500 focus:ring-1 focus:ring-m3-primary/10 transition-all text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wide">Adresse Géo-physique</span>
                <input
                  type="text"
                  placeholder="Ex. 14 Rue de la Liberté, Alger"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans outline-none focus:border-m3-primary dark:focus:border-sky-500 focus:ring-1 focus:ring-m3-primary/10 transition-all text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-extrabold text-slate-505 dark:text-slate-400 text-[9px] uppercase tracking-wide">N° de Contact / Téléphone</span>
                <input
                  type="text"
                  placeholder="Ex. +213 (0) 550 44 33 22"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="h-9 rounded-xl px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans outline-none focus:border-m3-primary dark:focus:border-sky-500 focus:ring-1 focus:ring-m3-primary/10 transition-all text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex gap-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 h-10 bg-slate-100 hover:bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 bg-m3-primary hover:bg-m3-primary/95 text-white font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save size={13} /> {editingItem ? 'Enregistrer' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM OVERLAY DIALOG FOR SECURE DELETION CONFIRMATION */}
      {deletingItem && (
        <div className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="w-[340px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none">
            
            {/* Warning Icon Banner */}
            <div className="flex items-center gap-3 text-rose-500 dark:text-rose-400 mb-2">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-2xl">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-sans font-black text-sm text-slate-900 dark:text-white">
                Confirmer la suppression
              </h3>
            </div>

            <p className="font-sans text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 my-2">
              Êtes-vous absolument sûr de vouloir supprimer définitivement {mode === 'clients' ? 'le client' : 'le fournisseur'}{' '}
              <strong className="text-slate-900 dark:text-white font-sans text-xs font-bold leading-none break-all block mt-1.5 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
                {deletingItem.name} ({deletingItem.code})
              </strong>
            </p>

            <p className="text-[9.5px] text-rose-505 dark:text-rose-400/90 font-sans font-bold italic mb-4">
              ⚠️ Attention : Cette action est irréversible et effacera l'enregistrement de l'historique local immédiatement.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 h-9 bg-slate-100 hover:bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 size={13} /> Supprimer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
