import React, { useState, useMemo, useEffect } from 'react';
import { Product, PurchaseVoucher } from '../types';
import { getStorageJson, saveJson } from '../services/localDb';
import { 
  ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, 
  Search, Plus, Edit3, Edit, Check, X, Tag, Trash2, Calendar, 
  Sparkles, AlertTriangle, ArrowRight, FolderPlus,
  Package, Info, Camera, Folder, Coins, TrendingUp, RefreshCw,
  Filter, ArrowUpDown, FileDown, BarChart3, FileSpreadsheet, FileText,
  TrendingDown, ShieldAlert
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [sortType, setSortType] = useState<'none' | 'a-z' | 'z-a' | 'price-desc' | 'price-asc'>('none');

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

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

  // Suppliers lookup for filtering
  const suppliers = useMemo(() => {
    const fromDb = getStorageJson<any[]>('compos_suppliers', []);
    const namesFromDb = fromDb.map(s => s.name?.trim()).filter(Boolean);
    
    const purchases = getStorageJson<PurchaseVoucher[]>('compos_purchases', []);
    const namesFromPurchases = purchases.map(p => p.supplier?.trim()).filter(Boolean);
    
    return Array.from(new Set([...namesFromDb, ...namesFromPurchases])).sort();
  }, []);

  // Map each product to its suppliers for fast supplier filtering
  const productCodesForSuppliers = useMemo(() => {
    if (selectedSuppliers.length === 0) return null;
    const purchases = getStorageJson<PurchaseVoucher[]>('compos_purchases', []);
    const codes = new Set<string>();
    const upperSuppliers = new Set(selectedSuppliers.map(s => s.trim().toUpperCase()));
    for (const v of purchases) {
      if (v.supplier && upperSuppliers.has(v.supplier.trim().toUpperCase())) {
        if (v.items) {
          for (const item of v.items) {
            codes.add(item.code);
          }
        }
      }
    }
    return codes;
  }, [selectedSuppliers]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [searchQuery, selectedFamilies, selectedSuppliers, sortType]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = p.designation.toLowerCase().includes(q);
        const matchCode = p.code.includes(q);
        if (!matchName && !matchCode) return false;
      }

      // 2. Filter by Famille
      if (selectedFamilies.length > 0) {
        const pFam = (p.category || 'DIVERS').toUpperCase();
        const hasMatch = selectedFamilies.some(fam => fam.toUpperCase() === pFam);
        if (!hasMatch) return false;
      }

      // 3. Filter by Fournisseur
      if (selectedSuppliers.length > 0 && productCodesForSuppliers) {
        if (!productCodesForSuppliers.has(p.code)) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedFamilies, selectedSuppliers, productCodesForSuppliers]);

  const sortedAndFilteredProducts = useMemo(() => {
    let result = [...filteredProducts];
    if (sortType === 'a-z') {
      result.sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
    } else if (sortType === 'z-a') {
      result.sort((a, b) => b.designation.localeCompare(a.designation, 'fr'));
    } else if (sortType === 'price-desc') {
      result.sort((a, b) => {
        const pA = a.prixVente1 ?? 0;
        const pB = b.prixVente1 ?? 0;
        return pB - pA;
      });
    } else if (sortType === 'price-asc') {
      result.sort((a, b) => {
        const pA = a.prixVente1 ?? 0;
        const pB = b.prixVente1 ?? 0;
        return pA - pB;
      });
    }
    return result;
  }, [filteredProducts, sortType]);

  const visibleProducts = useMemo(() => {
    const mapped = sortedAndFilteredProducts.map((p, idx) => ({ ...p, originalIndex: idx }));
    const limit = Math.max(displayLimit, selectedIndex + 1);
    return mapped.slice(0, limit);
  }, [sortedAndFilteredProducts, displayLimit, selectedIndex]);

  const selectedProduct = sortedAndFilteredProducts[selectedIndex] || null;

  const hasActiveFilters = selectedFamilies.length > 0 || selectedSuppliers.length > 0;
  const activeFiltersCount = selectedFamilies.length + selectedSuppliers.length;
  const filterLabel = useMemo(() => {
    if (activeFiltersCount === 0) return 'Filtre par';
    if (activeFiltersCount === 1) {
      return selectedFamilies[0] || selectedSuppliers[0];
    }
    return `Filtres (${activeFiltersCount})`;
  }, [selectedFamilies, selectedSuppliers, activeFiltersCount]);

  const handleNext = () => {
    if (selectedIndex < sortedAndFilteredProducts.length - 1) {
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
    if (sortedAndFilteredProducts.length > 0) {
      setSelectedIndex(sortedAndFilteredProducts.length - 1);
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
      if (selectedIndex >= sortedAndFilteredProducts.length - 1 && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    }
  };

  // --- EXPORTS & STATISTICS ---

  // Export to Excel (CSV format optimized for French locale/Excel)
  const handleExportExcel = () => {
    const listToExport = sortedAndFilteredProducts.length > 0 ? sortedAndFilteredProducts : products;
    
    // Prepare column headers
    const headers = [
      'Code Barres / Réf',
      'Désignation',
      'Famille',
      'Prix Achat (DA)',
      'Prix Vente (DA)',
      'Prix Demi-Gros (DA)',
      'Prix Gros (DA)',
      'Stock Actuel',
      'Unité',
      'Seuil Min Alert',
      'Date d\'expiration',
      'Est Bloqué'
    ];

    // Format data rows
    const rows = listToExport.map(p => [
      p.code || '',
      (p.designation || '').replace(/"/g, '""'), // Escape quotes
      p.category || 'DIVERS',
      p.prixAchat !== undefined ? p.prixAchat : (p.prixDeRevient || 0),
      p.prixVente1 || 0,
      p.prixVente2 || 0,
      p.prixVente3 || 0,
      p.stock !== undefined ? p.stock : 0,
      p.unitOfMeasure || 'U',
      p.stockMin || 0,
      p.expirationDate || '',
      p.blocked ? 'Oui' : 'Non'
    ]);

    // Build CSV content with semicolon separator for European/French Excel compatibility
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(val => typeof val === 'string' ? `"${val}"` : val).join(';'))
    ].join('\r\n');

    // Excel UTF-8 BOM indicator so accents load correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const storePrefix = config?.storeName ? config.storeName.replace(/\s+/g, '_').toLowerCase() : 'catalogue';
    link.href = url;
    link.setAttribute('download', `${storePrefix}_produits_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to beautifully styled Print/PDF document
  const handleExportPDF = () => {
    const listToExport = sortedAndFilteredProducts.length > 0 ? sortedAndFilteredProducts : products;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres contextuelles (popups) pour imprimer le catalogue.");
      return;
    }

    const rowsHtml = listToExport.map((p, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold; color: #475569;">${p.code || ''}</td>
        <td><strong>${p.designation || ''}</strong></td>
        <td>${p.category || 'DIVERS'}</td>
        <td style="text-align: right; font-weight: bold;">${p.stock !== undefined ? p.stock : 0} ${p.unitOfMeasure || 'U'}</td>
        <td style="text-align: right; font-weight: bold; color: #0284c7;">${(p.prixVente1 || 0).toFixed(2)} DA</td>
        <td style="text-align: right; color: #475569;">${p.prixVente2 !== undefined ? p.prixVente2.toFixed(2) + ' DA' : '-'}</td>
        <td style="text-align: right; color: #475569;">${p.prixVente3 !== undefined ? p.prixVente3.toFixed(2) + ' DA' : '-'}</td>
      </tr>
    `).join('');

    const storeName = config?.storeName || 'Ma Boutique';
    const currentDate = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Catalogue Produits - ${storeName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              color: #0f172a;
              background-color: #ffffff;
              margin: 0;
              padding: 30px;
              line-height: 1.4;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .store-title {
              font-size: 22px;
              font-weight: 800;
              color: #1e3a8a;
              margin: 0 0 5px 0;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }
            .doc-title {
              font-size: 13px;
              font-weight: 600;
              color: #4b5563;
              margin: 0;
            }
            .meta-info {
              text-align: right;
              font-size: 11px;
              color: #4b5563;
              line-height: 1.5;
            }
            .summary-cards {
              display: flex;
              gap: 12px;
              margin-bottom: 20px;
            }
            .card {
              flex: 1;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 10px 12px;
              border-radius: 6px;
            }
            .card-title {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 700;
              color: #64748b;
              margin-bottom: 3px;
              letter-spacing: 0.5px;
            }
            .card-value {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 5px;
              font-size: 10px;
            }
            th {
              background-color: #1e3a8a;
              color: #ffffff;
              border: 1px solid #1e3a8a;
              padding: 8px 6px;
              text-align: left;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.5px;
            }
            td {
              border: 1px solid #e2e8f0;
              padding: 6px 6px;
              text-align: left;
            }
            tr:nth-child(even) td {
              background-color: #f8fafc;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1 class="store-title">${storeName}</h1>
              <p class="doc-title">CATALOGUE GÉNÉRAL DES PRODUITS</p>
            </div>
            <div class="meta-info">
              <div>Date d'export : <strong>${currentDate}</strong></div>
              <div>Nombre d'articles : <strong>${listToExport.length}</strong></div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-title">Total Références</div>
              <div class="card-value">${listToExport.length} articles</div>
            </div>
            <div class="card">
              <div class="card-title">Total Quantité en Stock</div>
              <div class="card-value">${listToExport.reduce((acc, p) => acc + (p.stock || 0), 0)} unités</div>
            </div>
            <div class="card">
              <div class="card-title">Valeur Stock (Prix Vente)</div>
              <div class="card-value">${listToExport.reduce((acc, p) => acc + ((p.stock || 0) * (p.prixVente1 || 0)), 0).toLocaleString('fr-FR')} DA</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">N°</th>
                <th style="width: 15%;">Code Barres</th>
                <th style="width: 35%;">Désignation</th>
                <th style="width: 15%;">Famille</th>
                <th style="width: 10%; text-align: right;">Stock</th>
                <th style="width: 10%; text-align: right;">Prix Vente</th>
                <th style="width: 10%; text-align: right;">Demi-gros</th>
                <th style="width: 10%; text-align: right;">Prix Gros</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            Document généré automatiquement depuis l'application de gestion de stock - ${storeName}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Comprehensive analytics calculation
  const stats = useMemo(() => {
    let totalRefs = products.length;
    let totalStockVolume = 0;
    let totalValuePurchase = 0;
    let totalValueSale = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let blockedCount = 0;
    let hasExpirationCount = 0;
    let expiredCount = 0;
    let nearExpirationCount = 0;

    const parseDate = (dStr?: string) => {
      if (!dStr) return null;
      if (dStr.includes('/')) {
        const parts = dStr.split('/');
        if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
      return new Date(dStr);
    };

    const today = new Date();

    const categoryStats: Record<string, { count: number; stock: number; saleVal: number; purchaseVal: number }> = {};

    products.forEach(p => {
      const pStock = p.stock || 0;
      const pPurchase = p.prixAchat ?? p.prixDeRevient ?? 0;
      const pSale = p.prixVente1 || 0;

      totalStockVolume += pStock;
      
      if (pStock > 0) {
        totalValuePurchase += pStock * pPurchase;
        totalValueSale += pStock * pSale;
      }

      if (pStock <= 0) {
        outOfStockCount++;
      } else if (p.stockMin !== undefined && pStock <= p.stockMin) {
        lowStockCount++;
      }

      if (p.blocked) {
        blockedCount++;
      }

      const cat = p.category || 'DIVERS';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, stock: 0, saleVal: 0, purchaseVal: 0 };
      }
      categoryStats[cat].count++;
      categoryStats[cat].stock += pStock;
      categoryStats[cat].saleVal += Math.max(0, pStock) * pSale;
      categoryStats[cat].purchaseVal += Math.max(0, pStock) * pPurchase;

      if (p.hasExpiration && p.expirationDate) {
        hasExpirationCount++;
        const expDate = parseDate(p.expirationDate);
        if (expDate) {
          const diffTime = expDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 0) {
            expiredCount++;
          } else if (diffDays <= (p.alertDays || 30)) {
            nearExpirationCount++;
          }
        }
      }
    });

    const averageMarginVal = totalValueSale - totalValuePurchase;
    const averageMarginPct = totalValueSale > 0 ? (averageMarginVal / totalValueSale) * 100 : 0;

    // Sort categories by product count
    const sortedCategories = Object.entries(categoryStats).map(([name, data]) => ({
      name,
      ...data,
      marginVal: data.saleVal - data.purchaseVal,
    })).sort((a, b) => b.count - a.count);

    // Top 5 products by stock value (selling price * stock)
    const topProductsByStockValue = [...products]
      .map(p => ({
        ...p,
        stockVal: (p.stock || 0) * (p.prixVente1 || 0)
      }))
      .filter(p => p.stockVal > 0)
      .sort((a, b) => b.stockVal - a.stockVal)
      .slice(0, 5);

    // Top 5 highest unit margins
    const topMarginProducts = [...products]
      .filter(p => {
        const purchase = p.prixAchat ?? p.prixDeRevient ?? 0;
        return purchase > 0 && (p.prixVente1 || 0) > purchase;
      })
      .map(p => {
        const purchase = p.prixAchat ?? p.prixDeRevient ?? 0;
        const sale = p.prixVente1 || 0;
        const marginPct = ((sale - purchase) / sale) * 100;
        const marginDA = sale - purchase;
        return { ...p, marginPct, marginDA };
      })
      .sort((a, b) => b.marginDA - a.marginDA)
      .slice(0, 5);

    return {
      totalRefs,
      totalStockVolume,
      totalValuePurchase,
      totalValueSale,
      potentialProfit: averageMarginVal,
      averageMarginPct,
      outOfStockCount,
      lowStockCount,
      blockedCount,
      hasExpirationCount,
      expiredCount,
      nearExpirationCount,
      sortedCategories,
      topProductsByStockValue,
      topMarginProducts
    };
  }, [products]);

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedIndex(-1);
        }
      }}
      className="flex-1 flex flex-col gap-3.5 relative h-full font-sans text-slate-800 dark:text-slate-100"
    >
      {/* Click-away backdrop to close filter/sort/export dropdowns */}
      {(showFilterDropdown || showSortDropdown || showExportDropdown) && (
        <div 
          className="fixed inset-0 z-40 bg-transparent cursor-default" 
          onClick={(e) => {
            e.stopPropagation();
            setShowFilterDropdown(false);
            setShowSortDropdown(false);
            setShowExportDropdown(false);
          }}
        />
      )}
      
      {/* Search Header layout */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded-2xl border border-slate-200/40 dark:border-slate-800/50 z-40 relative">
        
        {/* Navigation control pills - Compact design */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-full border border-slate-200/50 dark:border-slate-800 shadow-inner w-36 shrink-0 h-8.5 items-center select-none">
          <button
            onClick={handleFirst}
            className="flex-1 h-7 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer border border-transparent shadow-xs"
            title="Premier produit"
          >
            <ChevronFirst size={13} />
          </button>
          <button
            onClick={handlePrev}
            className="flex-1 h-7 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer border border-transparent shadow-xs"
            title="Précédent"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-7 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer border border-transparent shadow-xs"
            title="Suivant"
          >
            <ChevronRight size={13} />
          </button>
          <button
            onClick={handleLast}
            className="flex-1 h-7 rounded-full flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer border border-transparent shadow-xs"
            title="Dernier produit"
          >
            <ChevronLast size={13} />
          </button>
        </div>

        {/* Unified Search Input (Designation / Barcode Code in same box) - Compact sizing */}
        <div className="w-48 sm:w-56 relative shrink-0">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            className="w-full h-8.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8.5 pr-8 text-xs outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/10 transition-all text-slate-850 dark:text-slate-100 placeholder:text-slate-400 font-semibold"
          />
          <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedIndex(-1);
              }}
              className="absolute right-3 top-2 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filtre par Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowFilterDropdown(!showFilterDropdown);
              setShowSortDropdown(false);
            }}
            className={`h-8.5 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all select-none border shadow-xs cursor-pointer active:scale-95 ${
              hasActiveFilters
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40'
                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Filter size={12} className={hasActiveFilters ? 'animate-pulse' : ''} />
            <span className="max-w-[140px] truncate">
              {filterLabel}
            </span>
            {hasActiveFilters ? (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFamilies([]);
                  setSelectedSuppliers([]);
                }}
                className="hover:bg-amber-200/50 dark:hover:bg-amber-900/40 p-0.5 rounded-full inline-flex items-center justify-center text-amber-500 hover:text-amber-700"
                title="Réinitialiser tous les filtres"
              >
                <X size={10} />
              </span>
            ) : (
              <span className="text-[10px] opacity-40">▼</span>
            )}
          </button>

          {showFilterDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 w-60 text-left animate-in fade-in duration-100 flex flex-col max-h-[320px] overflow-hidden">
              <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span>Filtrer les articles</span>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSelectedFamilies([]);
                      setSelectedSuppliers([]);
                    }}
                    className="text-rose-500 hover:text-rose-600 font-bold"
                  >
                    Effacer
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto py-1 space-y-2 max-h-[260px] scrollbar-thin">
                {/* Default Option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFamilies([]);
                    setSelectedSuppliers([]);
                  }}
                  className={`w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                    !hasActiveFilters ? 'text-m3-primary bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>🚫 Tous les articles</span>
                  {!hasActiveFilters && <Check size={12} />}
                </button>

                {/* Families Section */}
                <div className="space-y-0.5">
                  <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-t border-slate-50 dark:border-slate-800/40 mt-1 pt-1.5">
                    📂 Par Famille ({familles.length})
                  </div>
                  {familles.map((fam) => {
                    const isSelected = selectedFamilies.includes(fam);
                    return (
                      <button
                        key={fam}
                        type="button"
                        onClick={() => {
                          setSelectedFamilies(prev => 
                            prev.includes(fam) ? prev.filter(f => f !== fam) : [...prev, fam]
                          );
                        }}
                        className={`w-full pl-5 pr-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                          isSelected ? 'text-m3-primary bg-indigo-50/50 dark:bg-indigo-950/20 font-black' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="truncate">{fam}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>

                {/* Suppliers Section */}
                <div className="space-y-0.5">
                  <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-t border-slate-50 dark:border-slate-800/40 mt-1 pt-1.5">
                    👤 Par Fournisseur ({suppliers.length})
                  </div>
                  {suppliers.length === 0 ? (
                    <div className="px-5 py-1 text-[10px] text-slate-450 italic">
                      Aucun fournisseur enregistré
                    </div>
                  ) : (
                    suppliers.map((sup) => {
                      const isSelected = selectedSuppliers.includes(sup);
                      return (
                        <button
                          key={sup}
                          type="button"
                          onClick={() => {
                            setSelectedSuppliers(prev => 
                              prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup]
                            );
                          }}
                          className={`w-full pl-5 pr-2.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                            isSelected ? 'text-m3-primary bg-indigo-50/50 dark:bg-indigo-950/20 font-black' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="truncate">{sup}</span>
                          {isSelected && <Check size={12} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Affichage Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowSortDropdown(!showSortDropdown);
              setShowFilterDropdown(false);
              setShowExportDropdown(false);
            }}
            className="h-8.5 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all select-none border shadow-xs cursor-pointer active:scale-95 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
          >
            <ArrowUpDown size={12} />
            <span>
              {sortType === 'none' && 'Affichage'}
              {sortType === 'a-z' && 'A-Z'}
              {sortType === 'z-a' && 'Z-A'}
              {sortType === 'price-desc' && 'Prix: +cher ➔ -cher'}
              {sortType === 'price-asc' && 'Prix: -cher ➔ +cher'}
            </span>
            <span className="text-[10px] opacity-40">▼</span>
          </button>

          {showSortDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1 w-52 text-left animate-in fade-in duration-100 flex flex-col">
              <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/60">
                Trier l'affichage
              </div>
              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSortType('none');
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                    sortType === 'none' ? 'text-m3-primary bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-350'
                  }`}
                >
                  <span>Par défaut (Référence)</span>
                  {sortType === 'none' && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortType('a-z');
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                    sortType === 'a-z' ? 'text-m3-primary bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-350'
                  }`}
                >
                  <span>Désignation: A ➔ Z</span>
                  {sortType === 'a-z' && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortType('z-a');
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                    sortType === 'z-a' ? 'text-m3-primary bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-350'
                  }`}
                >
                  <span>Désignation: Z ➔ A</span>
                  {sortType === 'z-a' && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortType('price-desc');
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                    sortType === 'price-desc' ? 'text-m3-primary bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-350'
                  }`}
                >
                  <span>Prix: de +cher à -cher</span>
                  {sortType === 'price-desc' && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortType('price-asc');
                    setShowSortDropdown(false);
                  }}
                  className={`w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-left flex items-center justify-between cursor-pointer ${
                    sortType === 'price-asc' ? 'text-m3-primary bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-350'
                  }`}
                >
                  <span>Prix: de -cher à +cher</span>
                  {sortType === 'price-asc' && <Check size={12} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Exporter Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowExportDropdown(!showExportDropdown);
              setShowFilterDropdown(false);
              setShowSortDropdown(false);
            }}
            className="h-8.5 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all select-none border shadow-xs cursor-pointer active:scale-95 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
          >
            <FileDown size={13} className="text-slate-500 dark:text-slate-400" />
            <span>Exporter</span>
            <span className="text-[10px] opacity-40">▼</span>
          </button>

          {showExportDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1 w-44 text-left animate-in fade-in duration-100 flex flex-col">
              <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/60">
                Format d'export
              </div>
              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    handleExportPDF();
                    setShowExportDropdown(false);
                  }}
                  className="w-full px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-xs font-bold text-left flex items-center gap-2 text-rose-600 dark:text-rose-400 cursor-pointer"
                >
                  <FileText size={13} />
                  <span>Document PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportExcel();
                    setShowExportDropdown(false);
                  }}
                  className="w-full px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg text-xs font-bold text-left flex items-center gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  <span>Fichier EXCEL</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Statistique Button */}
        <button
          type="button"
          onClick={() => {
            setShowStatsModal(true);
            setShowFilterDropdown(false);
            setShowSortDropdown(false);
            setShowExportDropdown(false);
          }}
          className="h-8.5 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all select-none border shadow-xs cursor-pointer active:scale-95 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40"
        >
          <BarChart3 size={13} />
          <span>Statistiques</span>
        </button>

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
                  <td className={`px-4 py-2.5 font-bold truncate ${p.blocked ? (reqSelected ? 'text-red-200 font-black bg-red-900/40 rounded-lg' : 'text-red-600 dark:text-red-400 font-black bg-red-50 dark:bg-red-950/20') : ''}`}>
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
            {sortedAndFilteredProducts.length > visibleProducts.length && (
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
                    Afficher plus de produits ({sortedAndFilteredProducts.length - visibleProducts.length} restants)
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tech Description & Product Image Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 shrink-0">
        {/* Tech Description box */}
        <div className="md:col-span-3 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 select-none">
            <Tag size={12} className="text-indigo-500" /> Descriptif Technique & Code-barres de l'article sélectionné
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
            className="h-22 w-full resize-none p-2.5 rounded-xl text-xs outline-none font-sans bg-slate-50 dark:bg-slate-950/40 border border-slate-250 dark:border-slate-850 text-slate-700 dark:text-slate-350 select-all shadow-inner leading-relaxed"
          />
        </div>

        {/* Dedicated Product Image Box */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 select-none">
            <Camera size={12} className="text-indigo-500" /> Photo de l'article sélectionné
          </label>
          <div className="h-22 rounded-xl border border-slate-250 dark:border-slate-850 bg-[#f0f4f9] dark:bg-slate-950/40 overflow-hidden flex items-center justify-center p-1.5 relative shadow-inner group">
            {selectedProduct ? (
              selectedProduct.image ? (
                <div className="w-full h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200/60 dark:border-slate-800/60 shadow-xs transition-transform duration-200 hover:scale-[1.03]">
                  <img 
                    referrerPolicy="no-referrer"
                    src={selectedProduct.image} 
                    alt={selectedProduct.designation} 
                    className="max-h-full max-w-full object-contain rounded-md"
                  />
                </div>
              ) : (
                <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-1">
                  <Camera size={18} className="text-slate-350 dark:text-slate-700" />
                  <span className="font-bold tracking-tight">Aucune photo</span>
                </div>
              )
            ) : (
              <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 italic">
                Sélectionnez un article
              </div>
            )}
          </div>
        </div>
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
                <Package size={16} className="text-indigo-600 dark:text-indigo-400" /> {isAddingNew ? 'Créer un nouveau produit' : 'Modifier la fiche produit'}
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
                <Folder size={16} className="text-current" />
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
                <Info size={16} className="text-current" />
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
                <Camera size={16} className="text-current" />
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
                              <Edit size={12} className="text-slate-500" /> Saisir manuellement
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                generateRandomCode();
                                setShowCodeMenu(false);
                              }}
                              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer text-left w-full"
                            >
                              <RefreshCw size={12} className="text-slate-500" /> Générer code aléatoire
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
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 text-[9px] uppercase tracking-wide flex items-center gap-1"><Coins size={11} /> Prix d'Achat (DA)</span>
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
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 text-[9px] uppercase tracking-wide flex items-center gap-1"><Package size={11} /> Prix de Revient (DA)</span>
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
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-[9.5px] uppercase tracking-wide flex items-center gap-1"><TrendingUp size={12} /> Grille Tarifs de Vente (M3)</span>
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
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold cursor-pointer gap-1"
                        >
                          <Trash2 size={14} /> Supprimer la photo
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-4 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                        <Camera size={40} className="text-slate-300 dark:text-slate-700" />
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">Aucune photo enregistrée</span>
                      </div>
                    )}
                  </div>

                  <label className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer transition-colors shadow-xs active:scale-95 inline-flex items-center gap-1.5">
                    <Folder size={14} /> Sélectionner une image
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

      {/* STATISTICS DASHBOARD MODAL */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          {/* Backdrop click away */}
          <div className="absolute inset-0 cursor-default" onClick={() => setShowStatsModal(false)} />
          
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 z-10 text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 shadow-xs">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white font-display">
                    Statistiques Globales du Catalogue
                  </h2>
                  <p className="text-xs text-slate-500">
                    Aperçu complet de la valeur du stock, des marges prévisionnelles et de la santé du catalogue
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              {/* Grid 1: Metric KPI cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Sale Valuation Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/5 to-sky-500/0 border border-sky-100 dark:border-sky-950/40 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      Valorisation Vente
                    </span>
                    <Coins size={15} className="text-sky-500" />
                  </div>
                  <div>
                    <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      {stats.totalValueSale.toLocaleString('fr-FR')} <span className="text-[10px] font-bold">DA</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Valeur de revente totale estimée
                    </p>
                  </div>
                </div>

                {/* Cost Valuation Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/5 to-amber-500/0 border border-amber-100 dark:border-amber-950/40 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Valorisation Coût
                    </span>
                    <Package size={15} className="text-amber-500" />
                  </div>
                  <div>
                    <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      {stats.totalValuePurchase.toLocaleString('fr-FR')} <span className="text-[10px] font-bold">DA</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Coût d'acquisition du stock
                    </p>
                  </div>
                </div>

                {/* Profit/Margin Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/0 border border-emerald-100 dark:border-emerald-950/40 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Marge Prévisionnelle
                    </span>
                    <TrendingUp size={15} className="text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                      +{stats.potentialProfit.toLocaleString('fr-FR')} <span className="text-[10px] font-bold">DA</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <span>Taux moyen de</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {stats.averageMarginPct.toFixed(1)}%
                      </span>
                    </p>
                  </div>
                </div>

                {/* Global Volumes Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-indigo-500/0 border border-indigo-100 dark:border-indigo-950/40 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Volume Catalogue
                    </span>
                    <Info size={15} className="text-indigo-500" />
                  </div>
                  <div>
                    <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      {stats.totalStockVolume.toLocaleString('fr-FR')} <span className="text-[10px] font-bold">Unités</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>Sur un catalogue de :</span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        {stats.totalRefs} articles
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid 2: Alert Status boxes */}
              <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200/40 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-amber-500" />
                  <span>Alertes de Vigilance & Anomalies</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Out of Stock */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <div className="text-xs font-black text-slate-400 dark:text-slate-500">Rupture totale</div>
                    <div className={`text-xl font-black mt-1 ${stats.outOfStockCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {stats.outOfStockCount}
                    </div>
                    <div className="text-[9px] text-slate-400">produits à stock nul</div>
                  </div>

                  {/* Low Stock alert */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <div className="text-xs font-black text-slate-400 dark:text-slate-500">Stock critique</div>
                    <div className={`text-xl font-black mt-1 ${stats.lowStockCount > 0 ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
                      {stats.lowStockCount}
                    </div>
                    <div className="text-[9px] text-slate-400">sous le seuil d'alerte</div>
                  </div>

                  {/* Blocked Items */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <div className="text-xs font-black text-slate-400 dark:text-slate-500">Bloqués / Bloqués</div>
                    <div className={`text-xl font-black mt-1 ${stats.blockedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {stats.blockedCount}
                    </div>
                    <div className="text-[9px] text-slate-400">articles désactivés</div>
                  </div>

                  {/* Expirations */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <div className="text-xs font-black text-slate-400 dark:text-slate-500">Expirations</div>
                    <div className="text-xl font-black mt-1 flex items-baseline justify-center gap-1.5">
                      {stats.expiredCount > 0 && (
                        <span className="text-rose-600" title="Expirés">
                          {stats.expiredCount}E
                        </span>
                      )}
                      {stats.nearExpirationCount > 0 && (
                        <span className="text-amber-500" title="Proche d'expiration">
                          {stats.nearExpirationCount}P
                        </span>
                      )}
                      {stats.expiredCount === 0 && stats.nearExpirationCount === 0 && (
                        <span className="text-emerald-500">0</span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400">périmés (E) / proches (P)</div>
                  </div>
                </div>
              </div>

              {/* Grid 3: Columns for breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Categories Breakdown */}
                <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950/20 space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-850 pb-1.5 flex items-center justify-between">
                    <span>Répartition par Famille</span>
                    <span className="text-[10px] text-indigo-500 lowercase">({stats.sortedCategories.length} familles)</span>
                  </div>
                  
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                    {stats.sortedCategories.slice(0, 8).map((cat) => {
                      const maxCount = Math.max(...stats.sortedCategories.map(c => c.count), 1);
                      const pctWidth = (cat.count / maxCount) * 100;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="uppercase text-slate-700 dark:text-slate-350 truncate max-w-[180px]">
                              {cat.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {cat.count} réf · {cat.stock} unités · <strong className="text-slate-800 dark:text-slate-200">{cat.saleVal.toLocaleString('fr-FR')} DA</strong>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-300" 
                              style={{ width: `${pctWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Top Products & Top Margin Products */}
                <div className="space-y-4">
                  {/* Top Products by Valuation */}
                  <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950/20 space-y-2">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-850 pb-1.5 flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-sky-500" />
                      <span>Top 5 Stocks les plus valorisés (Revente)</span>
                    </div>
                    <div className="space-y-1.5">
                      {stats.topProductsByStockValue.length === 0 ? (
                        <div className="text-[10px] text-slate-400 italic py-2 text-center">Aucune valorisation active</div>
                      ) : (
                        stats.topProductsByStockValue.map((p, idx) => (
                          <div key={p.code} className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg px-1 transition-colors">
                            <div className="flex items-center gap-2 truncate max-w-[200px]">
                              <span className="w-4 h-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-[9px] text-slate-500">
                                {idx + 1}
                              </span>
                              <span className="font-bold truncate text-slate-800 dark:text-slate-200" title={p.designation}>
                                {p.designation}
                              </span>
                            </div>
                            <div className="text-right font-mono text-[10px]">
                              <span className="text-slate-400 mr-2">({p.stock} {p.unitOfMeasure || 'U'})</span>
                              <strong className="text-sky-600 dark:text-sky-400">{p.stockVal.toLocaleString('fr-FR')} DA</strong>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Top Margin Products */}
                  <div className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950/20 space-y-2">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-850 pb-1.5 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-emerald-500" />
                      <span>Top 5 Marge unitaire en valeur</span>
                    </div>
                    <div className="space-y-1.5">
                      {stats.topMarginProducts.length === 0 ? (
                        <div className="text-[10px] text-slate-400 italic py-2 text-center">Renseignez des prix d'achat pour voir les marges</div>
                      ) : (
                        stats.topMarginProducts.map((p, idx) => (
                          <div key={p.code} className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg px-1 transition-colors">
                            <div className="flex items-center gap-2 truncate max-w-[200px]">
                              <span className="w-4 h-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-[9px] text-slate-500">
                                {idx + 1}
                              </span>
                              <span className="font-bold truncate text-slate-800 dark:text-slate-200" title={p.designation}>
                                {p.designation}
                              </span>
                            </div>
                            <div className="text-right font-mono text-[10px]">
                              <span className="text-emerald-500 mr-2">+{p.marginPct.toFixed(0)}%</span>
                              <strong className="text-emerald-600 dark:text-emerald-400">+{p.marginDA.toFixed(2)} DA</strong>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-black text-xs rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all"
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

