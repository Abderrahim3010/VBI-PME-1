import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Key } from 'lucide-react';

interface LoginOverlayProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export const LoginOverlay: React.FC<LoginOverlayProps> = ({ users, onLoginSuccess }) => {
  const [selectedUser, setSelectedUser] = useState<string>(users[0]?.username || 'admin');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDialogHidden, setIsDialogHidden] = useState<boolean>(false);

  const handleOk = () => {
    const userObj = users.find(u => u.username.toLowerCase() === selectedUser.toLowerCase());
    if (!userObj) {
      setErrorMsg('Utilisateur introuvable.');
      return;
    }

    if (userObj.password === password) {
      setErrorMsg('');
      onLoginSuccess(userObj);
    } else {
      setErrorMsg('Mot de passe incorrect.');
      // Keep classical sound or alert feel
      const audio = new Audio();
      // Simple beep if supported
    }
  };

  const handleCancel = () => {
    setPassword('');
    setErrorMsg('');
    setIsDialogHidden(true);
  };

  if (isDialogHidden) {
    return (
      <div 
        className="fixed inset-0 bg-transparent z-[9999] cursor-default"
        onClick={() => setIsDialogHidden(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] font-sans">
      {/* Modern Window Container */}
      <div className="w-[380px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100">
        
        {/* Title Bar - Modern Clean Style */}
        <div className="bg-slate-50 dark:bg-slate-950/40 px-4 py-3 flex items-center justify-between text-slate-800 dark:text-slate-100 font-bold text-sm border-b border-slate-100 dark:border-slate-800/60 select-none">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0 select-none bg-indigo-50 dark:bg-indigo-950/40 w-6 h-6 rounded-lg flex items-center justify-center">
              🔑
            </span>
            <span className="font-display tracking-tight font-bold text-slate-900 dark:text-slate-100">
              Mot de Passe
            </span>
          </div>
          {/* Modern Close Button */}
          <button 
            onClick={handleCancel}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content area */}
        <div className="p-5 flex flex-col gap-4 relative">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 flex flex-col gap-4">
              {/* Dropdown "Utilisateur" */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Utilisateur</label>
                <select
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full h-9 px-3 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer font-sans"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.username}>{u.username}</option>
                  ))}
                </select>
              </div>

              {/* Input "Mot de Passe" */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Mot de Passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleOk();
                  }}
                  autoFocus
                  className="w-full h-9 px-3 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-sans"
                />
              </div>
            </div>

            {/* Premium key graphic */}
            <div className="w-16 h-16 flex items-center justify-center relative shrink-0 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-2xl border border-slate-100 dark:border-slate-850 p-2 shadow-inner">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <Lock className="w-9 h-9 text-slate-400 dark:text-slate-600 absolute top-0 left-0" />
                <Key className="w-7 h-7 text-amber-500 dark:text-amber-400 absolute bottom-0 right-0 rotate-[135deg]" />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="text-rose-600 dark:text-rose-400 font-semibold text-xs mt-1 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-2 rounded-xl text-center select-text animate-in fade-in duration-100">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* Bottom panel */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2.5">
          <button
            onClick={handleCancel}
            className="px-5 h-9 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors focus:outline-none cursor-pointer"
          >
            Annuler
          </button>
          <button
            onClick={handleOk}
            className="px-6 h-9 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors focus:outline-none cursor-pointer"
          >
            Ok
          </button>
        </div>

      </div>
    </div>
  );
};
