import React, { useState, useMemo, useEffect } from 'react';
import { Product, PurchaseVoucher } from '../types';
import { getStorageJson, saveJson } from '../services/localDb';
import { 
  ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, 
  Search, Plus, Edit3, Edit, Check, X, Tag, Trash2, Calendar, 
  Sparkles, AlertTriangle, ArrowRight, FolderPlus
} from 'lucide-react';

interface ProductListWindowProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct?: (code: string) => void;
  onSelectProduct?: (product: Product) => void;
  onClose: () => void;
  onProductsUpdate?: (updatedProducts: Product[]) => void;
  createdFamilles?: string[];
  onCreatedFamillesChange?: (familles: string[] | ((prev: string[]) => string[])) => void;
  config?: any;
}

// Helper to convert DD/MM/YYYY to YYYY-MM-DD (ISO format for date inputs)
const ddmmyyyyToYyyymmdd = (str?: string) => {
  if (!str) return '';
  const parts = str.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return '';
};

// Helper to convert YYYY-MM-DD to DD/MM/YYYY for data storage
const yyyymmddToDdmmyyyy = (str: string) => {
  if (!str) return '';
  const parts = str.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return str;
};

function ProductListWindow({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onSelectProduct,
  onClose,
  onProductsUpdate,
  createdFamilles: propCreatedFamilles,
  onCreatedFamillesChange,
  config
}: ProductListWindowProps) {
  const [searchTermName, setSearchTermName] = useState('');
  const [searchTermCode, setSearchTermCode] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Load manually created families from cache as fallback
  const [localCreatedFamilles, setLocalCreatedFamilles] = useState<string[]>(() => {
    return getStorageJson('compos_familles', []);
  });

  const createdFamilles = propCreatedFamilles !== undefined ? propCreatedFamilles : localCreatedFamilles;

  const setCreatedFamilles = (updater: string[] | ((prev: string[]) => string[])) => {
    if (onCreatedFamillesChange) {
      onCreatedFamillesChange(updater);
    } else {
      const resolved = typeof updater === 'function' ? updater(localCreatedFamilles) : updater;
      setLocalCreatedFamilles(resolved);
      saveJson('compos_familles', resolved);
    }
  };

  // Combine with actual categories from existing products to form the full "familles" list
  const familles = useMemo(() => {
    const fromProducts = products
      .map(p => p.category)
      .filter((cat): cat is string => !!cat && cat.trim().length > 0)
      .map(cat => cat.toUpperCase());
    return Array.from(new Set([...createdFamilles, ...fromProducts])).sort();
  }, [createdFamilles, products]);

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Family Management Popup Modal states
  const [isManagingFamilies, setIsManagingFamilies] = useState(false);
  const [newFamilyInputName, setNewFamilyInputName] = useState('');
  const [editingFamilyName, setEditingFamilyName] = useState<string | null>(null);
  const [editingFamilyValue, setEditingFamilyValue] = useState('');
  const [confirmDeleteFam, setConfirmDeleteFam] = useState<string | null>(null);

  const handleRenameFamily = (oldName: string, newName: string) => {
    const normalizedOld = oldName.trim().toUpperCase();
    const normalizedNew = newName.trim().toUpperCase();
    if (!normalizedNew || normalizedOld === normalizedNew) return;

    // 1. Update createdFamilles list
    setCreatedFamilles(prev => {
      const updated = prev.map(f => f.toUpperCase() === normalizedOld ? normalizedNew : f);
      if (!updated.includes(normalizedNew)) {
        updated.push(normalizedNew);
      }
      return Array.from(new Set(updated)).sort();
    });

    // 2. Update products in parent state
    if (onProductsUpdate) {
      const updatedProducts = products.map(p => {
        if (p.category && p.category.toUpperCase() === normalizedOld) {
          return { ...p, category: normalizedNew };
        }
        return p;
      });
      onProductsUpdate(updatedProducts);
    }

    // Update active form's category if it matches
    if (formCategory && formCategory.toUpperCase() === normalizedOld) {
      setFormCategory(normalizedNew);
    }
  };

  const handleDeleteFamily = (famName: string) => {
    const normalizedFam = famName.trim().toUpperCase();

    // 1. Update createdFamilles list
    setCreatedFamilles(prev => prev.filter(f => f.toUpperCase() !== normalizedFam));

    // 2. Update products in parent state
    if (onProductsUpdate) {
      const updatedProducts = products.map(p => {
        if (p.category && p.category.toUpperCase() === normalizedFam) {
          return { ...p, category: '' };
        }
        return p;
      });
      onProductsUpdate(updatedProducts);
    }

    // Update active form's category if it matches
    if (formCategory && formCategory.toUpperCase() === normalizedFam) {
      setFormCategory('');
    }
  };

  // Form states for add / edit
  const [formCode, setFormCode] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formStock, setFormStock] = useState(0);
  const [formDate, setFormDate] = useState('');
  
  // Specific Pricing States
  const [formPrixAchat, setFormPrixAchat] = useState(0);       // Prix d'Achat
  const [formPrixDeRevient, setFormPrixDeRevient] = useState(0); // Prix de Revient
  const [formPrixVente1, setFormPrixVente1] = useState(0);       // Prix de Vente Tarif 1 (Gros)
  const [formPrixVente2, setFormPrixVente2] = useState(0);       // Prix de Vente Tarif 2 (Demi-gros)
  const [formPrixVente3, setFormPrixVente3] = useState(0);       // Prix de Vente Tarif 3 (Détail)
  const [formDetail, setFormDetail] = useState('');

  // Tabbed form and advanced product states
  const [activeFormTab, setActiveFormTab] = useState<'general' | 'plusInfo' | 'photo'>('general');
  const [formBlocked, setFormBlocked] = useState(false);
  const [formExpirationDate, setFormExpirationDate] = useState('');
  const [formHasExpiration, setFormHasExpiration] = useState(false);
  const [formAlertDays, setFormAlertDays] = useState(0);
  const [formStockMin, setFormStockMin] = useState<number | ''>('');
  const [formColissage, setFormColissage] = useState('');
  const [formUnitOfMeasure, setFormUnitOfMeasure] = useState('U');
  const [formTva, setFormTva] = useState(19);
  const [formPriceLimit, setFormPriceLimit] = useState<number | ''>('');
  const [formProductType, setFormProductType] = useState('Normal');
  const [formDestockBarcode, setFormDestockBarcode] = useState('');
  const [formDestockQtyDeduced, setFormDestockQtyDeduced] = useState<number | ''>('');
  const [formDestockSur, setFormDestockSur] = useState<number | ''>('');
  const [formDestockQtyToDestock, setFormDestockQtyToDestock] = useState<number | ''>('');
  const [formImage, setFormImage] = useState('');
  const [isCodeReadOnly, setIsCodeReadOnly] = useState(true);
  const [showCodeMenu, setShowCodeMenu] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [displayLimit, setDisplayLimit] = useState(100);

  useEffect(() => {
    setDisplayLimit(100);
  }, [searchTermName, searchTermCode]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchName = p.designation.toLowerCase().includes(searchTermName.toLowerCase());
      const matchCode = p.code.includes(searchTermCode);
      return matchName && matchCode;
    });
  }, [products, searchTermName, searchTermCode]);

  const visibleProducts = useMemo(() => {
    const mapped = filteredProducts.map((p, idx) => ({ ...p, originalIndex: idx }));
    const limit = Math.max(displayLimit, selectedIndex + 1);
    return mapped.slice(0, limit);
  }, [filteredProducts, displayLimit, selectedIndex]);

  const selectedProduct = filteredProducts[selectedIndex] || null;

  const handleNext = () => {
    if (selectedIndex < filteredProducts.length - 1) {
      setSelectedIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (selectedIndex > 0) {
      setSelectedIndex((prev) => prev - 1);
    }
  };

  const handleFirst = () => {
    setSelectedIndex(0);
  };

  const handleLast = () => {
    if (filteredProducts.length > 0) {
      setSelectedIndex(filteredProducts.length - 1);
    }
  };

  const generateRandomCode = () => {
    const existingCodes = new Set(products.map(p => p.code));
    let code = '';
    const min = 1000000000000;
    const max = 1019999999999;
    for (let attempt = 0; attempt < 10000; attempt++) {
      const randVal = Math.floor(Math.random() * (max - min + 1)) + min;
      const candidate = randVal.toString();
      if (!existingCodes.has(candidate)) {
        code = candidate;
        break;
      }
    }
    setFormCode(code);
    return code;
  };

  const startAddNew = () => {
    setFormCode(generateRandomCode());
    setFormDesignation('');
    setFormCategory(familles[0] || '');
    setFormStock(0);
    
    // Default form date is today in YYYY-MM-DD
    const todayISO = ddmmyyyyToYyyymmdd(new Date().toLocaleDateString('fr-FR'));
    setFormDate(todayISO);

    setFormPrixAchat(0);
    setFormPrixDeRevient(0);
    setFormPrixVente1(0);
    setFormPrixVente2(0);
    setFormPrixVente3(0);
    setFormDetail('');

    // Reset advanced product fields
    setActiveFormTab('general');
    setFormBlocked(false);
    setFormExpirationDate('');
    setFormHasExpiration(false);
    setFormAlertDays(0);
    setFormStockMin('');
    setFormColissage('');
    setFormUnitOfMeasure('U');
    setFormTva(19);
    setFormPriceLimit('');
    setFormProductType('Normal');
    setFormDestockBarcode('');
    setFormDestockQtyDeduced('');
    setFormDestockSur('');
    setFormDestockQtyToDestock('');
    setFormImage('');
    setIsCodeReadOnly(false); // Editable for new products
    setShowCodeMenu(false);

    setIsAddingNew(true);
  };

  const startEdit = (productToEdit?: Product) => {
    const target = productToEdit || selectedProduct;
    if (!target) return;
    setFormCode(target.code);
    setFormDesignation(target.designation);
    setFormCategory(target.category || familiasDefault());
    setFormStock(target.stock);

    // Get date or fallback to today
    const currentISO = target.date 
      ? ddmmyyyyToYyyymmdd(target.date) 
      : ddmmyyyyToYyyymmdd(new Date().toLocaleDateString('fr-FR'));
    setFormDate(currentISO);

    // Set prices with correct fallbacks
    setFormPrixAchat(target.prixAchat !== undefined ? target.prixAchat : (target.prixDeRevient ?? 0));
    setFormPrixDeRevient(target.prixDeRevient !== undefined ? target.prixDeRevient : (target.prixAchat ?? 0));
    setFormPrixVente1(target.prixVente1);
    setFormPrixVente2(target.prixVente2);
    setFormPrixVente3(target.prixVente3);
    setFormDetail(target.detail || '');

    // Reset advanced product fields
    setActiveFormTab('general');
    setFormBlocked(target.blocked || false);
    setFormExpirationDate(target.expirationDate ? ddmmyyyyToYyyymmdd(target.expirationDate) : '');
    setFormHasExpiration(target.hasExpiration || false);
    setFormAlertDays(target.alertDays || 0);
    setFormStockMin(target.stockMin !== undefined ? target.stockMin : '');
    setFormColissage(target.colissage || '');
    setFormUnitOfMeasure(target.unitOfMeasure || 'U');
    setFormTva(target.tva !== undefined ? target.tva : 19);
    setFormPriceLimit(target.priceLimit !== undefined ? target.priceLimit : '');
    setFormProductType(target.productType || 'Normal');
    setFormDestockBarcode(target.destockBarcode || '');
    setFormDestockQtyDeduced(target.destockQtyDeduced !== undefined ? target.destockQtyDeduced : '');
    setFormDestockSur(target.destockSur !== undefined ? target.destockSur : '');
    setFormDestockQtyToDestock(target.destockQtyToDestock !== undefined ? target.destockQtyToDestock : '');
    setFormImage(target.image || '');
    setIsCodeReadOnly(true); // Read-only by default for edited products, unlocked via Action menu
    setShowCodeMenu(false);

    setIsEditing(true);
  };

  const familiasDefault = () => {
    return familles[0] || '';
  };

  // Add category handler
  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim().toUpperCase();
    if (!name) return;
    
    if (!createdFamilles.includes(name)) {
      const updated = [...createdFamilles, name];
      setCreatedFamilles(updated);
    }
    setFormCategory(name);
    setNewCategoryName('');
    setIsCreatingCategory(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode || !formDesignation) return;

    const cleanCode = formCode.trim();
    const cleanDesignation = formDesignation.trim();

    // Check if another product already has the same designation (case-insensitive)
    const duplicateProduct = products.find(
      p => p.designation.trim().toLowerCase() === cleanDesignation.toLowerCase()
    );

    if (duplicateProduct && duplicateProduct.code !== cleanCode) {
      alert(`Impossible d'enregistrer l'article : un produit avec la désignation "${duplicateProduct.designation}" existe déjà dans la base (Code: ${duplicateProduct.code}).`);
      return;
    }

    const payload: Product = {
      code: cleanCode,
      designation: cleanDesignation.toUpperCase(),
      category: formCategory || undefined,
      stock: Number(formStock),
      date: yyyymmddToDdmmyyyy(formDate) || undefined,
      prixAchat: Number(formPrixAchat),
      prixDeRevient: Number(formPrixDeRevient),
      prixVente1: Number(formPrixVente1),
      prixVente2: Number(formPrixVente2),
      prixVente3: Number(formPrixVente3),
      detail: formDetail.trim() || undefined,
      blocked: formBlocked,
      expirationDate: formExpirationDate ? yyyymmddToDdmmyyyy(formExpirationDate) : undefined,
      hasExpiration: formHasExpiration,
      alertDays: formAlertDays,
      stockMin: formStockMin !== '' ? Number(formStockMin) : undefined,
      colissage: formColissage.trim() || undefined,
      unitOfMeasure: formUnitOfMeasure || undefined,
      tva: formTva,
      priceLimit: formPriceLimit !== '' ? Number(formPriceLimit) : undefined,
      productType: formProductType || undefined,
      destockBarcode: formDestockBarcode.trim() || undefined,
      destockQtyDeduced: formDestockQtyDeduced !== '' ? Number(formDestockQtyDeduced) : undefined,
      destockSur: formDestockSur !== '' ? Number(formDestockSur) : undefined,
      destockQtyToDestock: formDestockQtyToDestock !== '' ? Number(formDestockQtyToDestock) : undefined,
      image: formImage || undefined,
    };

    if (isAddingNew && !config?.isActivated && products.length >= 1) {
      alert("⚠️ Limite Démo : Vous ne pouvez pas créer plus de 1 produit en mode évaluation (démo). Veuillez activer l'application avec un code d'activation dans les configurations pour débloquer toutes les fonctionnalités.");
      return;
    }

    if (isAddingNew) {
      onAddProduct(payload);
    } else {
      onEditProduct(payload);
    }

    setIsAddingNew(false);
    setIsEditing(false);
  };

  const selectAndConfirm = () => {
    if (selectedProduct) {
      if (onSelectProduct) {
        onSelectProduct(selectedProduct);
      }
      onClose();
    }
  };

  // Real Delete confirm
  const handleConfirmDelete = () => {
    if (deletingProduct && onDeleteProduct) {
      onDeleteProduct(deletingProduct.code);
      setDeletingProduct(null);
      if (selectedIndex >= filteredProducts.length - 1 && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedIndex(-1);
        }
      }}
      className="flex-1 flex flex-col gap-3.5 relative h-full font-sans text-slate-800 dark:text-slate-100"
    >
      
      {/* Search Header layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center shrink-0">
        
        {/* Navigation control pills */}
        <div className="md:col-span-4 flex bg-slate-100 dark:bg-slate-950 p-1 rounded-full border border-slate-200/50 dark:border-slate-800 shadow-inner">
          <button
            onClick={handleFirst}
            className="flex-1 h-8 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 active:scale-95 transition-all select-none cursor-pointer border border-transparent shadow-xs"
            title="Premier produit"
          >
            <ChevronFirst size={14} />
          </button>
          <button
            onClick={handlePrev}
            className="flex-1 h-8 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 active:scale-95 transition-all select-none cursor-pointer border border-transparent shadow-xs"
            title="Précédent"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-8 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 active:scale-95 transition-all select-none cursor-pointer border border-transparent shadow-xs"
            title="Suivant"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={handleLast}
            className="flex-1 h-8 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 active:scale-95 transition-all select-none cursor-pointer border border-transparent shadow-xs"
            title="Dernier produit"
          >
            <ChevronLast size={14} />
          </button>
        </div>

        {/* Inputs */}
        <div className="md:col-span-4 flex flex-col relative">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchTermName}
            onChange={(e) => {
              setSearchTermName(e.target.value);
              setSelectedIndex(-1);
            }}
            className="h-8.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-200/50 dark:border-slate-800 rounded-full px-3.5 pr-8 text-xs outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-semibold"
          />
          <Search size={13} className="absolute right-3.5 top-2.5 text-slate-400" />
        </div>

        <div className="md:col-span-4 flex flex-col relative">
          <input
            type="text"
            placeholder="Rechercher par code..."
            value={searchTermCode}
            onChange={(e) => {
              setSearchTermCode(e.target.value);
              setSelectedIndex(-1);
            }}
            className="h-8.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-200/50 dark:border-slate-800 rounded-full px-3.5 pr-8 text-xs outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-semibold"
          />
          <Search size={13} className="absolute right-3.5 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* Main product catalogue table */}
      <div 
        onClick={() => setSelectedIndex(-1)}
        className="flex-1 border border-m3-outline-variant/15 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-auto relative min-h-[160px] shadow-sm cursor-default"
      >
        <table 
          onClick={(e) => e.stopPropagation()}
          className="w-full text-left border-collapse table-fixed font-sans"
        >
          <thead className="sticky top-0 bg-[#f8fafc] dark:bg-slate-950/60 text-xs font-bold border-b border-slate-200 dark:border-slate-800 text-slate-600 select-none z-10 shadow-xs font-display">
            <tr>
              <th className="w-32 px-4 py-3 text-slate-500 truncate">Référence</th>
              <th className="px-4 py-3 text-slate-500 truncate">Désignation / Article</th>
              <th className="w-24 px-3 py-3 text-right text-slate-505 truncate">Famille</th>
              <th className="w-28 px-3 py-3 text-right text-slate-500 truncate">Prix d'Achat</th>
              <th className="w-28 px-3 py-3 text-right text-slate-500 truncate">Prix de Revient</th>
              <th className="w-28 px-3 py-3 text-right text-slate-500 truncate">Prix de Vente</th>
              <th className="w-20 px-3 py-3 text-center text-slate-500 truncate">Stock</th>
              <th className="w-20 px-3 py-3 text-center text-slate-500 truncate font-sans">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs font-mono text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
            {visibleProducts.map((p) => {
              const reqSelected = p.originalIndex === selectedIndex;
              
              // Map pricing properties dynamically
              const displayPrixAchat = p.prixAchat ?? p.prixDeRevient ?? 0;
              const displayPrixDeRevient = p.prixDeRevient ?? p.prixAchat ?? 0;
              const displayPrixVente = p.prixVente1 ?? 0;

              return (
                <tr
                  key={p.code}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(p.originalIndex);
                  }}
                  onDoubleClick={startEdit}
                  className={`cursor-pointer transition-colors ${
                    reqSelected 
                      ? 'bg-m3-primary text-white font-medium shadow-xs' 
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-850/60 odd:bg-slate-50/20 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <td className={`px-4 py-2.5 font-bold truncate ${p.blocked ? (reqSelected ? 'text-rose-200 font-extrabold bg-rose-900/45 rounded-lg' : 'text-rose-600 dark:text-rose-400 font-extrabold') : ''}`}>
                    {p.code}
                  </td>
                  <td className="px-4 py-2.5 truncate font-sans font-bold select-text">{p.designation}</td>
                  <td className="px-3 py-2.5 text-right font-sans font-bold text-slate-500 dark:text-slate-400 text-[10px] truncate">{p.category || 'DIVERS'}</td>
                  <td className="px-3 py-2.5 text-right truncate font-sans">
                    {displayPrixAchat.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </td>
                  <td className="px-3 py-2.5 text-right truncate font-sans">
                    {displayPrixDeRevient.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </td>
                  <td className="px-3 py-2.5 text-right truncate font-sans">
                    {displayPrixVente.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} DA
                  </td>
                  <td className="px-3 py-2.5 text-center truncate">
                    <span className={`px-2.5 py-0.5 rounded-full font-sans text-[10px] font-extrabold ${p.stock <= 5 ? 'bg-rose-150 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}`}>
                      {p.stock} U
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center flex items-center justify-center gap-1.5 h-10 select-none">
                    {/* Modify Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        startEdit(p);
                      }}
                      className={`p-1.5 rounded-lg active:scale-90 transition-all cursor-pointer inline-flex items-center justify-center ${
                        reqSelected 
                          ? 'hover:bg-white/25 text-white' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                      title="Modifier la fiche produit"
                      type="button"
                    >
                      <Edit size={13} />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDeletingProduct(p);
                      }}
                      className={`p-1.5 rounded-lg active:scale-90 transition-all cursor-pointer inline-flex items-center justify-center ${
                        reqSelected 
                          ? 'hover:bg-white/25 text-white' 
                          : 'hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                      }`}
                      title="Supprimer définitivement du catalogue"
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length > visibleProducts.length && (
              <tr>
                <td colSpan={8} className="text-center p-3 bg-slate-50/50 dark:bg-slate-900/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDisplayLimit(prev => prev + 150);
                    }}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Afficher plus de produits ({filteredProducts.length - visibleProducts.length} restants)
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tech Description box */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
          <Tag size={12} /> Descriptif Technique & Code-barres de l'article sélectionné
        </label>
        <textarea
          readOnly
          value={(() => {
            if (!selectedProduct) return '';
            
            // Get purchases from local storage
            const purchases = getStorageJson<PurchaseVoucher[]>('compos_purchases', []);
            
            // Find all purchase vouchers containing this product
            const productVouchers = purchases.filter(p => 
              p.items && p.items.some(item => item.code === selectedProduct.code)
            );

            // Sort vouchers chronologically from oldest to newest
            const sortedVouchers = [...productVouchers].sort((a, b) => {
              const parseDateTime = (dStr: string, tStr?: string) => {
                try {
                  const [d, m, y] = dStr.split('/').map(Number);
                  const [hr, min, sec] = (tStr || '00:00:00').split(':').map(Number);
                  return new Date(y, m - 1, d, hr, min, sec).getTime();
                } catch {
                  return 0;
                }
              };
              return parseDateTime(a.date, a.time) - parseDateTime(b.date, b.time);
            });

            // Extract unique suppliers in order of appearance
            const supplierSequence: string[] = [];
            for (const v of sortedVouchers) {
              if (v.supplier) {
                const supplierName = v.supplier.trim();
                if (supplierName && !supplierSequence.includes(supplierName)) {
                  supplierSequence.push(supplierName);
                }
              }
            }

            // Construct chronological suppliers text
            let supplierText = '';
            if (supplierSequence.length === 1) {
              supplierText = supplierSequence[0];
            } else if (supplierSequence.length > 1) {
              supplierText = supplierSequence.map((sup, index) => `${sup} (${index + 1})`).join(', ');
            } else {
              supplierText = 'Aucun achat enregistré';
            }

            const headerLine = `${selectedProduct.designation} (${selectedProduct.category || 'DIVERS'}) ${selectedProduct.date ? `| Créé le: ${selectedProduct.date}` : ''}`;
            const supplierLine = `Fournisseur(s): ${supplierText}`;
            const detailsLine = selectedProduct.detail || '';

            return `${headerLine}\n${supplierLine}${detailsLine ? `\n${detailsLine}` : ''}`;
          })()}
          className="h-16 w-full resize-none p-2 rounded-xl text-xs outline-none font-sans bg-slate-50 dark:bg-slate-950/40 border border-slate-250 dark:border-slate-850 text-slate-600 dark:text-slate-400 select-all"
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center gap-2 mt-0.5 select-none shrink-0 border-t border-slate-100 dark:border-slate-800/80 pt-3 flex-nowrap overflow-x-auto scrollbar-none">
        <div className="flex gap-2 shrink-0 flex-nowrap">
          <button
            onClick={startAddNew}
            className="h-9.5 px-4.5 bg-m3-primary hover:bg-m3-primary/95 text-white font-bold text-xs rounded-xl border border-transparent shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <Plus size={14} /> Nouveau
          </button>
        </div>

        <div className="flex gap-2 shrink-0 flex-nowrap">
          <button
            onClick={onClose}
            className="h-9.5 w-28 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full flex items-center justify-center gap-1 hover:opacity-90 transition-all cursor-pointer border border-transparent shadow-xs whitespace-nowrap shrink-0"
          >
            Annuler
          </button>
          <button
            onClick={selectAndConfirm}
            disabled={!selectedProduct}
            className="h-9.5 w-32 text-xs font-black bg-m3-primary text-white rounded-full shadow-md flex items-center justify-center gap-1 hover:opacity-95 transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:pointer-events-none"
          >
            <Check size={14} /> OK
          </button>
        </div>
      </div>

      {/* Add / Edit Dialog overlay */}
      {(isAddingNew || isEditing) && (
        <div className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-[100] p-4 select-none">
          <div className="w-[520px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative max-h-[95%]">
            
            {/* Header */}
            <div className="bg-slate-50/50 dark:bg-slate-950/20 px-5 py-4 text-slate-800 dark:text-slate-100 text-xs font-bold flex justify-between select-none border-b border-slate-150 dark:border-slate-800/80">
              <span className="text-sm font-black font-sans text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                📦 {isAddingNew ? 'Créer un nouveau produit' : 'Modifier la fiche produit'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(false);
                  setIsEditing(false);
                }}
                className="hover:bg-slate-200 dark:hover:bg-slate-800 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-colors text-slate-400 hover:text-slate-655"
              >
                <X size={15} />
              </button>
            </div>

            {/* Tabs Header */}
            <div className="flex bg-slate-100/80 dark:bg-slate-950 p-1 gap-1 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveFormTab('general')}
                className={`flex-1 h-11 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer ${
                  activeFormTab === 'general'
                    ? 'bg-white dark:bg-slate-900 text-m3-primary dark:text-sky-400 shadow-sm'
                    : 'text-slate-500 hover:bg-white/40 dark:hover:bg-slate-900/30'
                }`}
              >
                <span className="text-base">📁</span>
                <div className="flex flex-col text-left">
                  <span className="leading-tight">Général</span>
                  <span className="text-[8px] font-sans opacity-60 font-medium">F1</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('plusInfo')}
                className={`flex-1 h-11 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer ${
                  activeFormTab === 'plusInfo'
                    ? 'bg-white dark:bg-slate-900 text-m3-primary dark:text-sky-400 shadow-sm'
                    : 'text-slate-500 hover:bg-white/40 dark:hover:bg-slate-900/30'
                }`}
              >
                <span className="text-base">ℹ️</span>
                <div className="flex flex-col text-left">
                  <span className="leading-tight">Plus d'info.</span>
                  <span className="text-[8px] font-sans opacity-60 font-medium">F2</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('photo')}
                className={`flex-1 h-11 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer ${
                  activeFormTab === 'photo'
                    ? 'bg-white dark:bg-slate-900 text-m3-primary dark:text-sky-400 shadow-sm'
                    : 'text-slate-500 hover:bg-white/40 dark:hover:bg-slate-900/30'
                }`}
              >
                <span className="text-base">📷</span>
                <div className="flex flex-col text-left">
                  <span className="leading-tight">Photo Produit</span>
                  <span className="text-[8px] font-sans opacity-60 font-medium">F3</span>
                </div>
              </button>
            </div>
            
            {/* Form */}
            <form onSubmit={handleSave} className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[460px]">
              
              {/* TAB CONTENT: GENERAL */}
              {activeFormTab === 'general' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  {/* Reference and Block fields (Only visible under Général tab) */}
                  <div className="grid grid-cols-3 gap-3 items-end border-b border-slate-100 dark:border-slate-800/60 pb-3">
                    <div className="col-span-2 flex flex-col gap-1 relative">
                      <span className="font-extrabold text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-wide">Code unique / Référence</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Code unique de l'article"
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value)}
                          readOnly={isCodeReadOnly}
                          className={`flex-1 h-9 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl px-3 font-mono text-xs outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/10 ${isCodeReadOnly ? 'opacity-70 bg-slate-100/50 dark:bg-slate-900/40 cursor-not-allowed' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCodeMenu(!showCodeMenu)}
                          className="h-9 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs rounded-xl flex items-center gap-1 border border-indigo-200/20 active:scale-95 transition-all cursor-pointer relative"
                          title="Modifier ou générer un code"
                        >
                          <Sparkles size={12} /> Action
                        </button>
                        {showCodeMenu && (
                          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 w-48 text-left animate-in fade-in duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCodeReadOnly(false);
                                setShowCodeMenu(false);
                              }}
                              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer text-left w-full"
                            >
                              ✏️ Saisir manuellement
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                generateRandomCode();
                                setShowCodeMenu(false);
                              }}
                              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer text-left w-full"
                            >
                              🔄 Générer code aléatoire
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Blocked checkbox */}
                    <div className="col-span-1 h-9 flex items-center justify-end">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer border border-rose-200/40 dark:border-rose-900/30 px-3 h-full rounded-xl bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/20 select-none transition-all">
                        <input
                          type="checkbox"
                          checked={formBlocked}
                          onChange={(e) => setFormBlocked(e.target.checked)}
                          className="rounded border-rose-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                        />
                        Bloquer
                      </label>
                    </div>
                  </div>

                  {/* Designation */}
                  <div className="flex flex-col gap-1">
                    <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wide">Désignation / Article</span>
                    <input
                      type="text"
                      required
                      autoFocus={isAddingNew}
                      placeholder="EX. HUILE DE TOURNESOL ELIO 1L"
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                      className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 text-xs font-bold outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/10"
                    />
                  </div>

                  {/* Category Selection */}
                  <div className="flex flex-col gap-1.5 relative">
                    <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wide">Famille / Catégorie de l'article</span>
                    {isCreatingCategory ? (
                      <div className="flex gap-2 animate-in slide-in-from-top-1 duration-150">
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="Nom de la nouvelle famille..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="flex-1 h-9 bg-slate-50 dark:bg-slate-950 border border-emerald-350 dark:border-emerald-600/40 rounded-xl px-3 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddNewCategory}
                          className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer active:scale-95"
                        >
                          Ajouter
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(false)}
                          className="h-9 px-2.5 bg-slate-100 hover:bg-slate-150 text-slate-600 text-xs rounded-xl border border-transparent"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="flex-1 h-9 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 text-xs font-sans font-bold outline-none focus:border-m3-primary"
                        >
                          {familles.map((fam) => (
                            <option key={fam} value={fam}>{fam}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCategoryName('');
                            setIsCreatingCategory(true);
                          }}
                          className="h-9 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                          title="Créer une nouvelle famille"
                        >
                          <FolderPlus size={13} /> Créer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsManagingFamilies(true);
                          }}
                          className="h-9 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                          title="Gérer les familles (Modifier / Supprimer)"
                        >
                          Gérer
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stock and Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wide">Quantité en Stock</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formStock || ''}
                        onChange={(e) => setFormStock(Number(e.target.value))}
                        className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 font-mono text-xs outline-none text-center focus:border-m3-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-slate-500 dark:text-slate-400 text-[9px] uppercase tracking-wide flex items-center gap-1">
                        <Calendar size={11} /> Date d'Entrée / Fiche
                      </span>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 font-mono text-xs outline-none focus:border-m3-primary"
                      />
                    </div>
                  </div>

                  {/* Pricing section: Prix Achat & Prix Revient */}
                  <div className="grid grid-cols-2 gap-3.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 text-[9px] uppercase tracking-wide">💰 Prix d'Achat (DA)</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        value={formPrixAchat || ''}
                        onChange={(e) => setFormPrixAchat(Number(e.target.value))}
                        className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl px-3 font-mono text-xs outline-none text-right focus:border-blue-500 font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 text-[9px] uppercase tracking-wide">📦 Prix de Revient (DA)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={formPrixDeRevient || ''}
                        onChange={(e) => setFormPrixDeRevient(Number(e.target.value))}
                        className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl px-3 font-mono text-xs outline-none text-right focus:border-amber-500 font-bold"
                      />
                    </div>
                  </div>

                  {/* Sales Pricing section: Prix Vente 1, 2, 3 */}
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-[9.5px] uppercase tracking-wide">📈 Grille Tarifs de Vente (M3)</span>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center font-bold">Tarif Gros (V1)</span>
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="0.0"
                          value={formPrixVente1 || ''}
                          onChange={(e) => setFormPrixVente1(Number(e.target.value))}
                          className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl px-2 font-mono text-xs outline-none text-right focus:border-emerald-500 font-bold"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center font-bold">Tarif Demi (V2)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.0"
                          value={formPrixVente2 || ''}
                          onChange={(e) => setFormPrixVente2(Number(e.target.value))}
                          className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl px-2 font-mono text-xs outline-none text-right focus:border-emerald-500 font-bold"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[8.5px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center font-bold">Détail (V3)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.0"
                          value={formPrixVente3 || ''}
                          onChange={(e) => setFormPrixVente3(Number(e.target.value))}
                          className="h-9 w-full bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl px-2 font-mono text-xs outline-none text-right focus:border-emerald-500 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: PLUS D'INFO */}
              {activeFormTab === 'plusInfo' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  {/* Detail Produit */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Détail Produit</label>
                    <textarea
                      value={formDetail}
                      onChange={(e) => setFormDetail(e.target.value)}
                      className="w-full h-20 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl text-xs font-mono outline-none focus:border-m3-primary resize-none"
                      placeholder="Saisissez les détails de l'article (EX. CODE COULEUR, COMPOSITION, ETC.)"
                    />
                  </div>

                  {/* Expiration date block */}
                  <div className="flex flex-col gap-2 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-2xl bg-slate-50/40 dark:bg-slate-950/20">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-705 dark:text-slate-205 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formHasExpiration}
                        onChange={(e) => setFormHasExpiration(e.target.checked)}
                        className="rounded border-slate-300 text-m3-primary focus:ring-m3-primary w-3.5 h-3.5"
                      />
                      Date de péremption
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase">Date de péremption</span>
                        <input
                          type="date"
                          disabled={!formHasExpiration}
                          value={formExpirationDate}
                          onChange={(e) => setFormExpirationDate(e.target.value)}
                          className="h-8.5 px-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs disabled:opacity-40"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase">Nombre de jours d'alerte</span>
                        <input
                          type="number"
                          min="0"
                          disabled={!formHasExpiration}
                          value={formAlertDays}
                          onChange={(e) => setFormAlertDays(Number(e.target.value))}
                          className="h-8.5 px-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-center disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Horizontal parameters row */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">Stock min.</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formStockMin}
                        onChange={(e) => setFormStockMin(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-1 text-xs text-center font-mono font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">Colissage</span>
                      <input
                        type="text"
                        placeholder="EX. 12"
                        value={formColissage}
                        onChange={(e) => setFormColissage(e.target.value)}
                        className="h-8 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-1 text-xs text-center"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">Unité</span>
                      <select
                        value={formUnitOfMeasure}
                        onChange={(e) => setFormUnitOfMeasure(e.target.value)}
                        className="h-8 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-0.5 text-xs font-bold text-center"
                      >
                        <option value="U">U</option>
                        <option value="KG">KG</option>
                        <option value="L">L</option>
                        <option value="PCS">PCS</option>
                        <option value="M">M</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">TVA %</span>
                      <select
                        value={formTva}
                        onChange={(e) => setFormTva(Number(e.target.value))}
                        className="h-8 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-0.5 text-xs font-bold text-center"
                      >
                        <option value={0}>0</option>
                        <option value={9}>9</option>
                        <option value={19}>19</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">Limite PV</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formPriceLimit}
                        onChange={(e) => setFormPriceLimit(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-1 text-xs text-right font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Type of Product and Destockage parameters */}
                  <div className="flex flex-col gap-2.5 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl bg-slate-50/40 dark:bg-slate-950/20">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Type de produit</span>
                      <select
                        value={formProductType}
                        onChange={(e) => setFormProductType(e.target.value)}
                        className="h-8.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 text-xs font-bold"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Déstock un autre produit">Déstock un autre produit</option>
                      </select>
                    </div>

                    {formProductType === 'Déstock un autre produit' && (
                      <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 items-end">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">C.Barre à déstocker</span>
                          <input
                            type="text"
                            value={formDestockBarcode}
                            onChange={(e) => setFormDestockBarcode(e.target.value)}
                            placeholder="C.Barre"
                            className="h-8 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-xs font-mono text-center"
                          />
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">Qté déduite</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={formDestockQtyDeduced}
                            onChange={(e) => setFormDestockQtyDeduced(e.target.value === '' ? '' : Number(e.target.value))}
                            className="h-8 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-xs text-center font-mono"
                          />
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">Sur</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={formDestockSur}
                            onChange={(e) => setFormDestockSur(e.target.value === '' ? '' : Number(e.target.value))}
                            className="h-8 w-full bg-teal-50 dark:bg-teal-950/30 border border-teal-200/30 rounded-lg px-2 text-xs text-center text-teal-700 dark:text-teal-400 font-bold font-mono"
                          />
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8.5px] font-bold text-slate-400 uppercase text-center">Qté à déstocker</span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold text-[10px]">=</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={formDestockQtyToDestock}
                              onChange={(e) => setFormDestockQtyToDestock(e.target.value === '' ? '' : Number(e.target.value))}
                              className="h-8 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-xs text-center font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: PHOTO */}
              {activeFormTab === 'photo' && (
                <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in duration-150 py-4">
                  <div className="w-44 h-44 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 overflow-hidden flex items-center justify-center relative shadow-inner group">
                    {formImage ? (
                      <>
                        <img referrerPolicy="no-referrer" src={formImage} alt="Fiche produit" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormImage('')}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                        >
                          ❌ Supprimer la photo
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-4 flex flex-col items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <span className="text-4xl">📷</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Aucune photo enregistrée</span>
                      </div>
                    )}
                  </div>

                  <label className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer transition-colors shadow-xs active:scale-95 inline-flex items-center gap-1.5">
                    📁 Sélectionner une image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Prise en charge locale JPG, PNG, GIF</span>
                </div>
              )}

              {/* Form Actions footer */}
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setIsEditing(false);
                  }}
                  className="px-5 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-all cursor-pointer border border-transparent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 h-10 bg-m3-primary hover:opacity-95 text-white font-bold rounded-xl active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Check size={14} /> Enregistrer
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog modal */}
      {deletingProduct && (
        <div className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[110] p-4 select-none">
          <div className="w-[340px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Warning Header */}
            <div className="flex items-center gap-3 text-rose-500 dark:text-rose-400 mb-2">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-2xl">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-sans font-black text-sm text-slate-900 dark:text-white">
                Supprimer de la Base
              </h3>
            </div>

            <p className="font-sans text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 my-2">
              Êtes-vous sûr de vouloir supprimer définitivement ce produit du catalogue ?
              <strong className="text-slate-900 dark:text-white font-sans text-xs font-bold leading-none break-all block mt-1.5 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
                {deletingProduct.designation} <span className="font-mono text-[10px] text-slate-400">({deletingProduct.code})</span>
              </strong>
            </p>

            <p className="text-[9.5px] text-rose-505 dark:text-rose-400/90 font-sans font-bold italic mb-4">
              ⚠️ Attention : Cette action supprimera définitivement la référence. Les statistiques et documents archivés utiliseront des données de secours.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="flex-1 h-9 bg-slate-100 hover:bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 size={13} /> Confirmer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Manage Families Modal */}
      {isManagingFamilies && (
        <div className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-[120] p-4">
          <div className="w-[450px] max-w-full bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-400 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Tag size={18} className="text-m3-primary" />
                <h3 className="font-sans font-black text-sm uppercase tracking-wider">
                  Gérer les Familles
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManagingFamilies(false);
                  setNewFamilyInputName('');
                  setEditingFamilyName(null);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[350px]">
              
              {/* Quick Add Form */}
              <div className="flex flex-col gap-1.5 p-3 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="font-extrabold text-[9px] uppercase tracking-wider text-slate-500">Ajouter une Nouvelle Famille</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: BOISSONS, BISCUITS..."
                    value={newFamilyInputName}
                    onChange={(e) => setNewFamilyInputName(e.target.value)}
                    className="flex-1 h-9 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 text-xs font-bold outline-none uppercase"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newFamilyInputName.trim().toUpperCase();
                        if (trimmed) {
                          setCreatedFamilles(prev => {
                            if (prev.includes(trimmed)) return prev;
                            return [...prev, trimmed].sort();
                          });
                          setFormCategory(trimmed);
                          setNewFamilyInputName('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newFamilyInputName.trim().toUpperCase();
                      if (trimmed) {
                        setCreatedFamilles(prev => {
                          if (prev.includes(trimmed)) return prev;
                          return [...prev, trimmed].sort();
                        });
                        setFormCategory(trimmed);
                        setNewFamilyInputName('');
                      }
                    }}
                    className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>
              </div>

              {/* Families List */}
              <div className="flex flex-col gap-1.5">
                <span className="font-extrabold text-[9px] uppercase tracking-wider text-slate-500">Familles Existantes ({familles.length})</span>
                {familles.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic">
                    Aucune famille enregistrée.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 bg-slate-50 dark:bg-slate-955/20">
                    {familles.map((fam) => {
                      const isEditingThis = editingFamilyName === fam;
                      return (
                        <div
                          key={fam}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                        >
                          {isEditingThis ? (
                            <div className="flex-1 flex gap-2 items-center">
                              <input
                                type="text"
                                value={editingFamilyValue}
                                onChange={(e) => setEditingFamilyValue(e.target.value)}
                                className="flex-1 h-8 bg-slate-50 dark:bg-slate-950 border border-emerald-350 rounded-lg px-2 text-xs font-bold outline-none uppercase"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleRenameFamily(fam, editingFamilyValue);
                                    setEditingFamilyName(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingFamilyName(null);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  handleRenameFamily(fam, editingFamilyValue);
                                  setEditingFamilyName(null);
                                }}
                                className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-all cursor-pointer"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingFamilyName(null)}
                                className="w-7 h-7 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-all cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate uppercase">
                                {fam}
                              </span>
                              <div className="flex items-center gap-1">
                                {confirmDeleteFam === fam ? (
                                  <div className="flex items-center gap-1.5 animate-in fade-in duration-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteFamily(fam);
                                        setConfirmDeleteFam(null);
                                      }}
                                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                      title="Confirmer la suppression"
                                    >
                                      Oui
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteFam(null)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                    >
                                      Non
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingFamilyName(fam);
                                        setEditingFamilyValue(fam);
                                        setConfirmDeleteFam(null);
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                                      title="Renommer la famille"
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmDeleteFam(fam);
                                      }}
                                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-955/30 rounded-lg transition-all cursor-pointer"
                                      title="Supprimer la famille"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsManagingFamilies(false);
                  setNewFamilyInputName('');
                  setEditingFamilyName(null);
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all"
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

export default React.memo(ProductListWindow, (prev, next) => {
  return prev.products === next.products &&
         prev.createdFamilles === next.createdFamilles &&
         prev.config === next.config;
});

