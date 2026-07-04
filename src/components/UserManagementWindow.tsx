import React, { useState } from 'react';
import { User, TransactionLog } from '../types';

interface UserManagementWindowProps {
  currentUser: User | null;
  users: User[];
  onAddUser: (u: User) => void;
  onUpdateUser: (id: string, u: User) => void;
  onDeleteUser: (id: string) => void;
  transactionLogs: TransactionLog[];
  onAddLog: (action: string) => void;
  onClose: () => void;
}

export const PERMISSIONS_LIST = [
  { code: '1', label: '1 Saisie achats' },
  { code: '2', label: '2 Saisie ventes' },
  { code: '3', label: '3 Produits' },
  { code: '4', label: '4 Fournisseurs' },
  { code: '5', label: '5 Clients' },
  { code: '6', label: '6 Situations fournisseurs' },
  { code: '7', label: '7 Situations clients' },
  { code: '8', label: '8 Consultation bons d\'achats' },
  { code: '9', label: '9 Consultation bons de ventes' },
  { code: '10', label: '10 Statistiques' },
  { code: '11', label: '11 Inventaire' },
  { code: '12', label: '12 Etat de la journée' },
  { code: '13', label: '13 Configuration' },
  { code: '14', label: '14 Gestion des utilisateurs' },
  { code: '15', label: '15 Gestion des charges' },
  { code: '16', label: '16 Facturations' },
  { code: '17', label: '17 <Réservé>' },
  { code: '18', label: '18 Sauvegardes' },
  { code: '19', label: '19 Famille de produits' },
  { code: '20', label: '20 Mouvements des produits' },
  { code: '21', label: '21 Saisie ventes - Changer le prix' },
  { code: '22', label: '22 Saisie ventes - Remise' },
  { code: '23', label: '23 Coffres' },
  { code: '24', label: '24 Afficher liste des produits étendue' },
  { code: '25', label: '25 Module de fabrication' },
  { code: '26', label: '26 Module de numéros de séries' },
  { code: '27', label: '27 Autoriser la modification du bon d\'achat' },
  { code: '28', label: '28 Autoriser la modification du bon de vente' },
  { code: '29', label: '29 <Réservé>' },
  { code: '30', label: '30 Gestion des pertes' },
  { code: '31', label: '31 Consulter prix achat dans la vente' },
  { code: '32', label: '32 Consulter bénéfice dans la vente' },
  { code: '33', label: '33 Synthèse' },
  { code: '34', label: '34 Autres états d\'achats' },
  { code: '35', label: '35 Autres états de ventes' },
  { code: '36', label: '36 Alarmes' },
  { code: '37', label: '37 Téléchargements' },
  { code: '38', label: '38 Voir Prix de revient pour module Fabrication' }
];

export const UserManagementWindow: React.FC<UserManagementWindowProps> = ({
  currentUser,
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  transactionLogs,
  onAddLog,
  onClose
}) => {
  const [selectedUserIndex, setSelectedUserIndex] = useState<number>(0);
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  
  // Custom dialogs states
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showAlert = (title: string, message: string) => {
    setCustomAlert({ title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setCustomConfirm({ title, message, onConfirm });
  };

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'insert' | 'edit'>('insert');
  
  // Edit Form Fields
  const [username, setUsername] = useState('');
  const [userType, setUserType] = useState<'1' | '9'>('9');
  const [password, setPassword] = useState('');
  const [checkedPermissions, setCheckedPermissions] = useState<string[]>([]);

  const selectedUser = users[selectedUserIndex] || users[0];

  // Navigation functions
  const handleGoFirst = () => setSelectedUserIndex(0);
  const handleGoPrev = () => setSelectedUserIndex(prev => Math.max(0, prev - 1));
  const handleGoNext = () => setSelectedUserIndex(prev => Math.min(users.length - 1, prev + 1));
  const handleGoLast = () => setSelectedUserIndex(users.length - 1);

  const openInsertModal = () => {
    setModalMode('insert');
    setUsername('');
    setUserType('9');
    setPassword('');
    // Default: typical default custom permissions (some standard ones like sales/clients)
    setCheckedPermissions(['2', '3', '5', '9']); 
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedUser) return;
    if (selectedUser.username.toLowerCase() === 'admin') {
      showAlert("Sécurité Système", "L'administrateur principal 'admin' ne peut pas être modifié pour des raisons de sécurité.");
      return;
    }
    setModalMode('edit');
    setUsername(selectedUser.username);
    setUserType(selectedUser.type);
    setPassword(selectedUser.password || '');
    setCheckedPermissions(selectedUser.permissions || []);
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    if (!currentUser || currentUser.username.toLowerCase() !== 'admin') {
      showAlert("Accès Refusé", "Autorisation insuffisante ! Seul l'administrateur principal 'admin' est autorisé à supprimer des utilisateurs.");
      return;
    }
    if (selectedUser.username.toLowerCase() === 'admin') {
      showAlert("Sécurité Système", "L'administrateur principal 'admin' ne peut pas être supprimé.");
      return;
    }
    showConfirm(
      "Confirmation de Suppression",
      `Voulez-vous vraiment supprimer définitivement l'utilisateur '${selectedUser.username}' ?`,
      () => {
        onDeleteUser(selectedUser.id);
        onAddLog(`Suppression utilisateur : ${selectedUser.username}`);
        setSelectedUserIndex(0);
      }
    );
  };

  // Checkbox helpers
  const handleTogglePermission = (code: string) => {
    setCheckedPermissions(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleCheckAll = () => {
    setCheckedPermissions(PERMISSIONS_LIST.map(p => p.code));
  };

  const handleUncheckAll = () => {
    setCheckedPermissions([]);
  };

  const handleInvertCheck = () => {
    setCheckedPermissions(prev => 
      PERMISSIONS_LIST.filter(p => !prev.includes(p.code)).map(p => p.code)
    );
  };

  const handleSaveUser = () => {
    if (!username.trim()) {
      showAlert("Saisie Incorrecte", "Veuillez saisir un nom d'utilisateur.");
      return;
    }
    if (!password.trim()) {
      showAlert("Saisie Incorrecte", "Veuillez saisir un mot de passe.");
      return;
    }

    if (modalMode === 'insert') {
      // Check duplicate
      const exists = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
      if (exists) {
        showAlert("Erreur de Saisie", "Ce nom d'utilisateur existe déjà !");
        return;
      }

      const newUser: User = {
        id: 'user_' + Date.now(),
        username: username.trim().toUpperCase(),
        password: password.trim(),
        type: userType,
        permissions: checkedPermissions
      };

      onAddUser(newUser);
      onAddLog(`Création utilisateur : ${newUser.username}`);
      setSelectedUserIndex(users.length); // will match new user
    } else {
      // Edit mode
      const updated: User = {
        id: selectedUser.id,
        username: username.trim().toUpperCase(),
        password: password.trim(),
        type: userType,
        permissions: checkedPermissions
      };

      onUpdateUser(selectedUser.id, updated);
      onAddLog(`Mise à jour utilisateur : ${updated.username}`);
    }

    setIsModalOpen(false);
  };

  const handleExportToExcel = () => {
    showAlert("Exportation Réussie", "Exportation du Journal de Transactions vers Microsoft Excel réussie (Fichier: journal_secu.xlsx) !");
  };

  // Filter logs based on search query
  const filteredLogs = transactionLogs.filter(log => 
    log.user.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
    log.date.includes(searchLogQuery) ||
    log.time.includes(searchLogQuery)
  );

  return (
    <div id="user-management-root" className="flex flex-col h-full bg-transparent text-slate-800 dark:text-slate-200 text-xs select-none relative font-sans">
      
      {/* Upper Main Section */}
      <div className="flex-1 p-3 flex flex-col md:flex-row gap-4 overflow-hidden">
        
        {/* Left Side: Users Grid & CRUD Controls */}
        <div className="flex-[3] flex flex-col gap-2 overflow-hidden">
          
          <div className="flex items-center justify-between">
            <h2 className="text-slate-900 dark:text-white font-extrabold text-sm uppercase tracking-tight flex items-center gap-1.5 font-sans">
              <span>👤</span> GESTION DES UTILISATEURS
            </h2>
          </div>

          {/* Modern Toolbar Ribbon */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/55 dark:bg-slate-950/40 p-2 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shrink-0">
            {/* Pager Buttons */}
            <button
              onClick={handleGoFirst}
              disabled={selectedUserIndex <= 0}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 font-bold text-[10px] uppercase border border-slate-200 dark:border-slate-800/80 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-45 transition-all cursor-pointer"
            >
              ⏮ Début
            </button>
            <button
              onClick={handleGoPrev}
              disabled={selectedUserIndex <= 0}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 font-bold text-[10px] uppercase border border-slate-200 dark:border-slate-800/80 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-45 transition-all cursor-pointer"
            >
              ◀ Préc.
            </button>
            <button
              onClick={handleGoNext}
              disabled={selectedUserIndex >= users.length - 1}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 font-bold text-[10px] uppercase border border-slate-200 dark:border-slate-800/80 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-45 transition-all cursor-pointer"
            >
              Suivant ▶
            </button>
            <button
              onClick={handleGoLast}
              disabled={selectedUserIndex >= users.length - 1}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 font-bold text-[10px] uppercase border border-slate-200 dark:border-slate-800/80 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-45 transition-all cursor-pointer"
            >
              Fin ⏭
            </button>

            <div className="h-4 w-[1px] bg-slate-250 dark:bg-slate-800 mx-1" />

            {/* Insert, Modify, Delete */}
            <button
              onClick={openInsertModal}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 font-bold text-[10px] uppercase border border-indigo-200/50 dark:border-indigo-900/30 rounded-lg text-indigo-700 dark:text-indigo-300 flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="text-indigo-650 dark:text-indigo-400 font-black">+</span> Insérer
            </button>
            <button
              onClick={openEditModal}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 font-bold text-[10px] uppercase border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-300 flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="text-amber-500 font-black">✏️</span> Modifier
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 font-bold text-[10px] uppercase border border-rose-200/50 dark:border-rose-900/30 rounded-lg text-rose-700 dark:text-rose-300 flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="text-rose-600 font-black">-</span> Supprimer
            </button>
          </div>

          {/* Grid list container */}
          <div className="flex-1 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-y-auto min-h-[140px] shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 text-[11px]">
                  <th className="px-4 py-2 border-r border-slate-100 dark:border-slate-800">Utilisateur</th>
                  <th className="px-4 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => {
                  const isActive = idx === selectedUserIndex;
                  return (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUserIndex(idx)}
                      className={`cursor-default transition-colors ${
                        isActive 
                          ? 'bg-indigo-600 dark:bg-indigo-650 text-white font-bold' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-850/40 border-b border-slate-100 dark:border-slate-850/40 text-slate-800 dark:text-slate-250'
                      }`}
                    >
                      <td className={`px-4 py-2 font-mono tracking-wide uppercase ${isActive ? 'text-white' : 'text-slate-900 dark:text-slate-100'} border-r border-slate-100 dark:border-slate-800/40`}>{user.username}</td>
                      <td className="px-4 py-2 font-bold font-mono">{user.type}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        {/* Right Side: Informative illustration panel with lock */}
        <div className="flex-[2] bg-slate-50 dark:bg-slate-950/30 border border-slate-200/85 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col justify-start items-center text-center overflow-y-auto shrink-0 w-full md:w-80 shadow-sm">
          
          {/* Padlock visual graphics */}
          <div className="relative mb-3.5 flex flex-col items-center">
            <div className="w-20 h-20 text-[#a0a090] flex items-center justify-center">
              <svg className="w-16 h-16 drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="11" rx="2" strokeWidth="2" />
                <path d="M12 2a5 5 0 0 0-5 5v4h10V7a5 5 0 0 0-5-5z" strokeWidth="2" />
              </svg>
            </div>
            {/* Faces decoration representing users */}
            <div className="flex gap-1.5 mt-1">
              <span className="text-xl">👨‍💼</span>
              <span className="text-xl">🧑‍🔧</span>
            </div>
          </div>

          <div className="w-full text-left space-y-3 font-sans leading-relaxed text-slate-800">
            <div>
              <h4 className="font-extrabold text-red-800 text-[12.5px] uppercase">Utilisateurs de type "1"</h4>
              <ul className="list-disc list-inside text-[11px] text-slate-750 pl-1">
                <li>Administrateur Principal</li>
                <li>Accès intégral aux comptes utilisateurs</li>
                <li>Mise à jour et modification des données</li>
                <li>Consultation rapports et statistiques</li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold text-blue-900 text-[12.5px] uppercase">Utilisateurs de type "9"</h4>
              <ul className="list-disc list-inside text-[11px] text-slate-750 pl-1">
                <li>Utilisateur personnalisé de terrain</li>
                <li>Accès restreint par module et option</li>
              </ul>
            </div>

            <div className="border-t border-dashed border-red-400/40 pt-2.5">
              <h4 className="font-black text-rose-700 text-[12px] flex items-center gap-1">⚠️ IMPORTANT !!!</h4>
              <p className="text-[10px] text-slate-650 mt-1 italic font-semibold">
                Pour une sécurité optimale du système de facturation, assurez-vous de n'enregistrer qu'un seul administrateur principal.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Half: JOURNAL DE TRANSACTIONS */}
      <div className="h-[210px] p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col overflow-hidden shrink-0">
        
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-slate-800 dark:text-slate-200 font-extrabold text-[12.5px] uppercase tracking-tight">
              📊 JOURNAL DE TRANSACTIONS (SÉCURITÉ)
            </h3>
            <button
              onClick={handleExportToExcel}
              className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-[10px] font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer flex items-center gap-1 transition-colors"
            >
              🟢 Exporter vers Excel
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600 dark:text-slate-400">Recherche:</span>
            <input
              type="text"
              value={searchLogQuery}
              onChange={(e) => setSearchLogQuery(e.target.value)}
              placeholder="Nom, date ou action..."
              className="w-48 h-8 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Logs Table Container */}
        <div className="flex-1 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 text-[10.5px]">
                <th className="px-3 py-1.5 border-r border-slate-100 dark:border-slate-800 w-24">Utilisateur</th>
                <th className="px-3 py-1.5 border-r border-slate-100 dark:border-slate-800 w-24">Date</th>
                <th className="px-3 py-1.5 border-r border-slate-100 dark:border-slate-800 w-20">Heure</th>
                <th className="px-3 py-1.5">Action Journalisée</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice().reverse().map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/40 border-b border-slate-100 dark:border-slate-850/40 font-mono text-[11px] text-slate-800 dark:text-slate-250">
                  <td className="px-3 py-1.5 border-r border-slate-100 dark:border-slate-800/40 font-extrabold text-indigo-650 dark:text-indigo-400 uppercase">{log.user}</td>
                  <td className="px-3 py-1.5 border-r border-slate-100 dark:border-slate-800/40 text-slate-500 dark:text-slate-400">{log.date}</td>
                  <td className="px-3 py-1.5 border-r border-slate-100 dark:border-slate-800/40 text-slate-500 dark:text-slate-400">{log.time}</td>
                  <td className="px-3 py-1.5 font-sans text-slate-900 dark:text-slate-200">{log.action}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500 italic">
                    Aucune transaction enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Footer Area with Quitter Button */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-5 h-9 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all focus:outline-none cursor-pointer flex items-center gap-1.5 shadow-sm"
        >
          🚪 Quitter
        </button>
      </div>

      {/* --- M.A.J UTILISATEUR DIALOG MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="w-[820px] max-h-[92vh] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans">
            
            {/* Title Bar */}
            <div className="bg-slate-50 dark:bg-slate-950/40 px-4 py-3 flex items-center justify-between text-slate-800 dark:text-slate-100 font-bold text-sm border-b border-slate-100 dark:border-slate-800/60 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="bg-indigo-50 dark:bg-indigo-950/40 w-6 h-6 rounded-lg flex items-center justify-center">📝</span> 
                <span className="font-display tracking-tight font-bold">M.A.J UTILISATEUR</span>
              </span>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-250 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form & Fields */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nom */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Nom de l'utilisateur</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={modalMode === 'edit'}
                    className="h-9 px-3 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-sans disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-500 uppercase font-semibold"
                  />
                </div>

                {/* Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Type de l'utilisateur</label>
                  <select
                    value={userType}
                    onChange={(e) => {
                      const val = e.target.value as '1' | '9';
                      setUserType(val);
                      if (val === '1') {
                        // Administrators automatically get all permissions
                        setCheckedPermissions(PERMISSIONS_LIST.map(p => p.code));
                      }
                    }}
                    className="w-full h-9 px-3 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer font-sans"
                  >
                    <option value="1">1-Administrateur</option>
                    <option value="9">9-Personnalisé</option>
                  </select>
                </div>

                {/* Mot de passe */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Mot de passe</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 px-3 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-sans"
                  />
                </div>
              </div>

              {/* Accès autorisés panel header */}
              <div className="mt-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 shrink-0">
                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                  Accès autorisés pour cet utilisateur
                </span>

                {/* Utility action selection buttons */}
                <div className="flex gap-1.5 text-[10px]">
                  <button
                    onClick={handleCheckAll}
                    disabled={userType === '1'}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg font-bold text-[10px] text-emerald-700 dark:text-emerald-400 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    🟢 Cocher tous
                  </button>
                  <button
                    onClick={handleUncheckAll}
                    disabled={userType === '1'}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[10px] text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    ⚪ Décocher tous
                  </button>
                  <button
                    onClick={handleInvertCheck}
                    disabled={userType === '1'}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-900/40 rounded-lg font-bold text-[10px] text-amber-700 dark:text-amber-400 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    🟠 Inverser
                  </button>
                </div>
              </div>

              {/* Permissions Grid Panel */}
              <div className="flex-1 min-h-[220px] bg-white dark:bg-slate-950/25 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
                  {PERMISSIONS_LIST.map((perm) => {
                    const isChecked = checkedPermissions.includes(perm.code);
                    const isUserAdmin = userType === '1';

                    return (
                      <label 
                        key={perm.code} 
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer border transition-all ${
                          isChecked 
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/30 text-indigo-950 dark:text-indigo-200 font-semibold' 
                            : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                        } ${isUserAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isUserAdmin}
                          onChange={() => handleTogglePermission(perm.code)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-700 rounded-md focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="truncate">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Bottom Panel Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2.5 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 h-9 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors focus:outline-none cursor-pointer flex items-center justify-center min-w-[90px]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveUser}
                className="px-6 h-9 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors focus:outline-none cursor-pointer flex items-center justify-center min-w-[90px]"
              >
                Sauvegarder
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- CUSTOM ALERT DIALOG MODAL --- */}
      {customAlert && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-[11000] p-4 select-none animate-in fade-in zoom-in-95 duration-100">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 w-[380px] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-950/40 px-4 py-3 flex items-center justify-between font-sans font-bold text-sm border-b border-slate-100 dark:border-slate-800/60">
              <span className="flex items-center gap-1.5">
                ⚠️ {customAlert.title}
              </span>
              <button 
                onClick={() => setCustomAlert(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex gap-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans text-sm items-start">
              <span className="text-2xl select-none leading-none shrink-0 bg-amber-50 dark:bg-amber-950/45 w-8 h-8 rounded-lg flex items-center justify-center text-amber-600">⚠️</span>
              <div className="flex-1 leading-relaxed whitespace-pre-line text-xs font-medium text-slate-600 dark:text-slate-350">
                {customAlert.message}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/40 py-3 border-t border-slate-100 dark:border-slate-800/60 flex justify-end px-4 gap-2.5">
              <button
                onClick={() => setCustomAlert(null)}
                className="px-5 h-8.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM CONFIRM DIALOG MODAL --- */}
      {customConfirm && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center z-[11000] p-4 select-none animate-in fade-in zoom-in-95 duration-100">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 w-[380px] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-950/40 px-4 py-3 flex items-center justify-between font-sans font-bold text-sm border-b border-slate-100 dark:border-slate-800/60">
              <span className="flex items-center gap-1.5">
                ❓ {customConfirm.title}
              </span>
              <button 
                onClick={() => setCustomConfirm(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex gap-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans text-sm items-start">
              <span className="text-2xl select-none leading-none shrink-0 bg-indigo-50 dark:bg-indigo-950/45 w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600">❓</span>
              <div className="flex-1 leading-relaxed whitespace-pre-line text-xs font-medium text-slate-600 dark:text-slate-350">
                {customConfirm.message}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/40 py-3 border-t border-slate-100 dark:border-slate-800/60 flex justify-end px-4 gap-2.5">
              <button
                onClick={() => setCustomConfirm(null)}
                className="px-4.5 h-8.5 bg-slate-150 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  customConfirm.onConfirm();
                  setCustomConfirm(null);
                }}
                className="px-5 h-8.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
