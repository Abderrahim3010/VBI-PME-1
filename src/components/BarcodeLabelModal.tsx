import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Barcode, Eye, Settings, Tag, Sparkles, Check, Copy } from 'lucide-react';
import JsBarcode from 'jsbarcode';

export interface BarcodeProduct {
  code: string;
  designation: string;
  prixVente1?: number;
  prixAchat?: number;
  stock?: number;
  category?: string;
}

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: BarcodeProduct | null;
  initialQty?: number;
  storeName?: string;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  product,
  initialQty = 1,
  storeName = 'VBI PME'
}) => {
  const [copies, setCopies] = useState<number>(initialQty > 0 ? initialQty : 1);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [priceType, setPriceType] = useState<'vente' | 'achat'>('vente');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [barcodeFormat, setBarcodeFormat] = useState<string>('CODE128');
  const [labelSize, setLabelSize] = useState<'sm' | 'md' | 'lg'>('md'); // sm: 40x25mm, md: 50x30mm, lg: 60x40mm
  const [copiedCode, setCopiedCode] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync initial qty when product or initialQty changes
  useEffect(() => {
    if (product) {
      setCopies(initialQty > 0 ? initialQty : (product.stock && product.stock > 0 ? product.stock : 1));
      setCustomPrice('');
    }
  }, [product, initialQty]);

  // Render main preview barcode
  useEffect(() => {
    if (isOpen && product?.code && svgRef.current) {
      try {
        JsBarcode(svgRef.current, product.code.trim(), {
          format: barcodeFormat,
          width: labelSize === 'sm' ? 1.5 : (labelSize === 'lg' ? 2.5 : 2),
          height: labelSize === 'sm' ? 35 : (labelSize === 'lg' ? 60 : 45),
          displayValue: true,
          fontSize: 12,
          fontOptions: 'bold',
          font: 'monospace',
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000'
        });
      } catch (err) {
        console.warn('JsBarcode render error with format', barcodeFormat, err);
        // Fallback to CODE128 if format failed
        try {
          JsBarcode(svgRef.current, product.code.trim(), {
            format: 'CODE128',
            width: 2,
            height: 45,
            displayValue: true,
            fontSize: 12,
            fontOptions: 'bold',
            font: 'monospace',
            margin: 4
          });
        } catch (e) {
          console.error('Barcode generation failed', e);
        }
      }
    }
  }, [isOpen, product, barcodeFormat, labelSize]);

  if (!isOpen || !product) return null;

  // Determine display price
  let displayPriceStr = '';
  if (customPrice !== '') {
    displayPriceStr = `${Number(customPrice).toLocaleString('fr-FR')} DA`;
  } else if (priceType === 'vente' && product.prixVente1 !== undefined) {
    displayPriceStr = `${product.prixVente1.toLocaleString('fr-FR')} DA`;
  } else if (priceType === 'achat' && product.prixAchat !== undefined) {
    displayPriceStr = `${product.prixAchat.toLocaleString('fr-FR')} DA`;
  }

  const handleCopyCode = () => {
    if (product?.code) {
      navigator.clipboard.writeText(product.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres contextuelles (popups) pour imprimer les étiquettes.");
      return;
    }

    // Get rendered SVG markup
    const svgContent = svgRef.current ? svgRef.current.outerHTML : '';

    // Dimensions CSS based on labelSize
    const dims = labelSize === 'sm' 
      ? { width: '40mm', height: '25mm', fontSize: '9px', priceSize: '11px', titleSize: '9px' }
      : labelSize === 'lg'
      ? { width: '60mm', height: '40mm', fontSize: '12px', priceSize: '15px', titleSize: '12px' }
      : { width: '50mm', height: '30mm', fontSize: '10px', priceSize: '13px', titleSize: '10px' };

    // Build label grid HTML
    let labelsHtml = '';
    for (let i = 0; i < copies; i++) {
      labelsHtml += `
        <div class="label-card">
          ${showStoreName && storeName ? `<div class="store-name">${storeName}</div>` : ''}
          <div class="product-title" title="${product.designation}">${product.designation}</div>
          <div class="barcode-container">
            ${svgContent}
          </div>
          ${showPrice && displayPriceStr ? `<div class="price-tag">PRIX: ${displayPriceStr}</div>` : ''}
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Étiquettes Code-Barres - ${product.designation}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap');
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            body {
              font-family: 'Inter', -apple-system, sans-serif;
              background-color: #ffffff;
              color: #000000;
              padding: 10px;
            }

            .label-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 4mm;
              align-items: flex-start;
            }

            .label-card {
              width: ${dims.width};
              height: ${dims.height};
              border: 1px dashed #cbd5e1;
              padding: 2mm 3mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              page-break-inside: avoid;
              background: #ffffff;
              border-radius: 4px;
              overflow: hidden;
            }

            .store-name {
              font-size: 7px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #475569;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .product-title {
              font-size: ${dims.titleSize};
              font-weight: 800;
              text-transform: uppercase;
              color: #000000;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.1;
            }

            .barcode-container {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              flex: 1;
            }

            .barcode-container svg {
              max-width: 100%;
              max-height: 100%;
              height: auto;
            }

            .price-tag {
              font-size: ${dims.priceSize};
              font-weight: 900;
              color: #000000;
              line-height: 1;
              letter-spacing: -0.3px;
            }

            @media print {
              body {
                padding: 0;
              }

              .label-card {
                border: none; /* Strip border on actual label print */
              }

              @page {
                margin: 5mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="label-grid">
            ${labelsHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[5000] p-4 select-none animate-in fade-in duration-150">
      <div className="w-[520px] max-w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-950/50 px-5 py-4 flex items-center justify-between border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Barcode size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-display">
                Générateur d'Étiquette Code-Barres
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Impression d'étiquettes personnalisées
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          
          {/* Live Preview Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center gap-2 relative">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 self-start mb-1 flex items-center gap-1">
              <Eye size={12} className="text-indigo-500" /> Aperçu avant impression
            </span>

            {/* Simulated Label Card */}
            <div className="bg-white text-black p-3 rounded-xl border border-slate-300 shadow-md flex flex-col items-center justify-between min-w-[220px] max-w-[280px] min-h-[120px] text-center select-text">
              {showStoreName && storeName && (
                <div className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider truncate max-w-full">
                  {storeName}
                </div>
              )}
              <div className="text-xs font-black uppercase text-slate-900 truncate max-w-full my-0.5">
                {product.designation}
              </div>

              {/* Rendered SVG Barcode */}
              <div className="my-1 flex justify-center items-center w-full overflow-hidden">
                <svg ref={svgRef} className="max-w-full h-auto"></svg>
              </div>

              {showPrice && displayPriceStr && (
                <div className="text-sm font-black text-slate-950 tracking-tight mt-0.5">
                  PRIX : {displayPriceStr}
                </div>
              )}
            </div>

            {/* Code Copy Badge */}
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                Code : {product.code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copier le code"
              >
                {copiedCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Configuration Form Options */}
          <div className="space-y-4">
            
            {/* Row 1: Copies count & Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Nombre d'exemplaires :
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 font-mono font-bold text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Taille de l'étiquette :
                </label>
                <select
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value as any)}
                  className="w-full h-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="sm">Petite (40 × 25 mm)</option>
                  <option value="md">Moyenne (50 × 30 mm)</option>
                  <option value="lg">Grande (60 × 40 mm)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Price display options */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Afficher le prix sur l'étiquette</span>
                </label>

                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Nom du magasin</span>
                </label>
              </div>

              {showPrice && (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Source du prix :
                    </label>
                    <select
                      value={priceType}
                      onChange={(e) => setPriceType(e.target.value as any)}
                      className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-xs font-bold outline-none"
                    >
                      <option value="vente">Prix de Vente ({product.prixVente1 || 0} DA)</option>
                      <option value="achat">Prix d'Achat ({product.prixAchat || 0} DA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Prix personnalisé (Optionnel) :
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 1500"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-xs font-mono outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Barcode Encoding choice */}
            <div>
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                Format d'encodage code-barres :
              </label>
              <select
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-xs font-mono font-bold outline-none cursor-pointer"
              >
                <option value="CODE128">CODE128 (Universel / Recommandé)</option>
                <option value="EAN13">EAN-13 (Standard 13 chiffres)</option>
                <option value="CODE39">CODE39 (Alphanumérique standard)</option>
              </select>
            </div>

          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-150 dark:border-slate-800 flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Fermer
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 h-9.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Printer size={15} /> Imprimer {copies} étiquette{copies > 1 ? 's' : ''}
          </button>
        </div>

      </div>
    </div>
  );
};
