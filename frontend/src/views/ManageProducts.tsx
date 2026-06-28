import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { FuelPump, Product } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
interface ManageProductsProps {
  onBack: () => void;
  pumps: FuelPump[];
}

interface PriceHistoryEntry {
  id: number;
  product_id: number;
  selling_price: number;
  cost_margin: number;
  valid_from: string;
  valid_to: string | null;
}

export const ManageProducts: React.FC<ManageProductsProps> = ({ onBack, pumps }) => {
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generalError, setGeneralError] = useState('');

  // Modals & form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Form Fields

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productMargin, setProductMargin] = useState('');
  const [selectedPumpIds, setSelectedPumpIds] = useState<number[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price History Timeline state
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Delete Product states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProductForDelete, setSelectedProductForDelete] = useState<Product | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [productUsage, setProductUsage] = useState<{ in_use: boolean; tanks_count: number; pumps_count: number } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    const forceScrollToTop = () => {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      setTimeout(() => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 150);
    };
    forceScrollToTop();
  }, []);

  // Scroll to top when loading state finishes and dynamic product content renders
  useEffect(() => {
    if (!isLoading) {
      const forceScrollToTop = () => {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        setTimeout(() => {
          document.documentElement.style.overflow = '';
          document.body.style.overflow = '';
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }, 150);
      };
      forceScrollToTop();
    }
  }, [isLoading]);

  const anyModalOpen = isAddModalOpen || isEditModalOpen || isPriceModalOpen || isHistoryModalOpen || isDeleteModalOpen;
  useBodyScrollLock(anyModalOpen);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    setGeneralError('');
    try {
      const prods = await apiService.getProducts();
      setProductsList(prods);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to retrieve products from database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setProductName('');
    setProductPrice('');
    setProductMargin('');
    setSelectedPumpIds([]);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setSelectedProduct(prod);
    setProductName(prod.name);
    setSelectedPumpIds(prod.pump_ids || []);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenPriceModal = (prod: Product) => {
    setSelectedProduct(prod);
    setProductPrice(prod.current_price.toString());
    setProductMargin(prod.current_margin.toString());
    setFormError('');
    setIsPriceModalOpen(true);
  };

  const handleOpenHistoryModal = async (prod: Product) => {
    setSelectedProduct(prod);
    setPriceHistory([]);
    setIsHistoryLoading(true);
    setIsHistoryModalOpen(true);
    try {
      const history = await apiService.getProductPriceHistory(prod.id);
      // Sort descending by valid_from
      const sortedHistory = [...history].sort(
        (a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime()
      );
      setPriceHistory(sortedHistory);
    } catch (err: any) {
      console.error('Failed to load price history', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleTogglePump = (pumpId: number) => {
    setFormError('');
    setSelectedPumpIds(prev =>
      prev.includes(pumpId) ? prev.filter(id => id !== pumpId) : [...prev, pumpId]
    );
  };

  const handleOpenDeleteModal = async (prod: Product) => {
    setSelectedProductForDelete(prod);
    setIsDeleteModalOpen(true);
    setDeleteStep(1);
    setIsCheckingUsage(true);
    setProductUsage(null);
    setFormError('');
    try {
      const usage = await apiService.getProductUsage(prod.id);
      setProductUsage(usage);
    } catch (err: any) {
      setFormError(err.message || 'Failed to check product usage dependencies.');
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedProductForDelete) return;

    if (deleteStep === 1 && productUsage?.in_use) {
      setDeleteStep(2);
      return;
    }

    setIsDeleting(true);
    setFormError('');
    try {
      await apiService.deleteProduct(selectedProductForDelete.id);
      setIsDeleteModalOpen(false);
      setSelectedProductForDelete(null);
      setProductUsage(null);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to delete product from database.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Add Product Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setFormError('Product name is required');
      return;
    }
    const priceVal = parseFloat(productPrice);
    const marginVal = parseFloat(productMargin);
    if (isNaN(priceVal) || priceVal <= 0) {
      setFormError('Price must be a positive number');
      return;
    }
    if (isNaN(marginVal) || marginVal < 0) {
      setFormError('Margin cannot be negative');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await apiService.createProduct(productName.trim(), priceVal, marginVal, selectedPumpIds);
      setIsAddModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit details (name/pump associations)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!productName.trim()) {
      setFormError('Product name is required');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await apiService.updateProduct(selectedProduct.id, productName.trim(), selectedPumpIds);
      setIsEditModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update product details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Price revision submit
  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const priceVal = parseFloat(productPrice);
    const marginVal = parseFloat(productMargin);
    if (isNaN(priceVal) || priceVal <= 0) {
      setFormError('Price must be a positive number');
      return;
    }
    if (isNaN(marginVal) || marginVal < 0) {
      setFormError('Margin cannot be negative');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await apiService.updateProductPrice(selectedProduct.id, priceVal, marginVal);
      setIsPriceModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to revise product pricing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: map pump IDs to their names
  const getLinkedPumpNames = (pumpIds: number[]) => {
    if (!pumpIds || pumpIds.length === 0) return 'Unassociated';
    return pumpIds
      .map(id => pumps.find(p => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  // Format UTC dates to IST local time strings nicely
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Sorted list rendering
  const sortedProducts = [...productsList].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="animate-fadeIn">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button
              onClick={onBack}
              className="hover:text-emerald-600 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Dashboard
            </button>
            <span>/</span>
            <span className="text-slate-700">Manage Products</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display mt-2">
            Product Inventory & Pricing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure fuel products, adjust real-time pricing levels, and monitor historical pricing revisions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.01] cursor-pointer"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Register Product
          </button>
        </div>
      </div>

      {/* Main product display section */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <svg className="animate-spin h-10 w-10 text-emerald-650" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-slate-500 text-sm mt-4 font-semibold">Loading product master logs...</span>
        </div>
      ) : generalError ? (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {generalError}
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-3xl shadow-sm">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-4 text-sm font-bold text-slate-700">No Products Registered</h3>
          <p className="mt-1 text-xs text-slate-500">Configure fuel product specifications to start assigning them to pump tanks.</p>
          <div className="mt-6">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer shadow-sm"
            >
              Add First Product
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProducts.map((prod) => {
            const purchaseCost = prod.current_price - prod.current_margin;
            return (
              <div
                key={prod.id}
                className="group relative rounded-3xl bg-white border border-slate-200/90 hover:border-slate-300 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Title & Delete Action */}
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-lg font-bold text-slate-900 font-display group-hover:text-emerald-650 transition-colors">
                      {prod.name}
                    </h3>
                    <button
                      onClick={() => handleOpenDeleteModal(prod)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                      title="Delete Product"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Dynamic Cost Stats */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/50 mt-4">
                    <div className="text-center border-r border-slate-200/70">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Price</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-1 block">₹{parseFloat(prod.current_price as any).toFixed(2)}</span>
                    </div>
                    <div className="text-center border-r border-slate-200/70">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Cost</span>
                      <span className="text-xs font-extrabold text-slate-600 mt-1 block">₹{purchaseCost.toFixed(2)}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Margin</span>
                      <span className="text-xs font-extrabold text-emerald-600 mt-1 block">₹{parseFloat(prod.current_margin as any).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Linked Stations list */}
                  <div className="mt-5 space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Associated Pumps</span>
                    <p className="text-xs text-slate-600 truncate font-sans">
                      {getLinkedPumpNames(prod.pump_ids || [])}
                    </p>
                  </div>
                </div>

                {/* Operations Actions */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => handleOpenHistoryModal(prod)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                  >
                    History
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(prod)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-355 hover:bg-slate-50 text-[10px] font-bold text-slate-655 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleOpenPriceModal(prod)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Update Price
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 font-display">Register Fuel Product</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Speed Fuel, Diesel Plus"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-450 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Selling Price (₹/Ltr)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 104.50"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-450 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Margin (₹/Ltr)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 3.20"
                    value={productMargin}
                    onChange={(e) => setProductMargin(e.target.value)}
                    className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-450 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Associate Stations</label>
                <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50">
                  {pumps.map((pump) => (
                    <label key={pump.id} className="flex items-center gap-2.5 text-xs text-slate-750 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPumpIds.includes(pump.id)}
                        onChange={() => handleTogglePump(pump.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>{pump.name}</span>
                    </label>
                  ))}
                  {pumps.length === 0 && (
                    <span className="text-[10px] text-slate-400 italic">No pumps registered to associate</span>
                  )}
                </div>
              </div>

              {formError && (
                <p className="text-xs text-rose-600 font-semibold">{formError}</p>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit details (name/pumps) Modal */}
      {isEditModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 font-display">Edit Product Spec</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Product Name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Associate Stations</label>
                <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50">
                  {pumps.map((pump) => (
                    <label key={pump.id} className="flex items-center gap-2.5 text-xs text-slate-750 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPumpIds.includes(pump.id)}
                        onChange={() => handleTogglePump(pump.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>{pump.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-xs text-rose-600 font-semibold">{formError}</p>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-55 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Price Update Modal */}
      {isPriceModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-950 font-display">Revise Price — {selectedProduct.name}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">This will update pricing on all active nozzles linked to this product</p>
              </div>
              <button
                onClick={() => setIsPriceModalOpen(false)}
                className="text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePriceSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">New Retail Price (₹/Ltr)</label>
                <input
                  type="number"
                  step="0.01"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">New Margin (₹/Ltr)</label>
                <input
                  type="number"
                  step="0.01"
                  value={productMargin}
                  onChange={(e) => setProductMargin(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs"
                />
              </div>

              {formError && (
                <p className="text-xs text-rose-600 font-semibold">{formError}</p>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPriceModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-55 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  {isSubmitting ? 'Updating...' : 'Publish New Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Timeline Modal */}
      {isHistoryModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-950 font-display">Pricing Revision Log</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedProduct.name} price changes timeline (IST)</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 max-h-[350px] overflow-y-auto pr-1">
              {isHistoryLoading ? (
                <div className="flex justify-center py-10">
                  <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : priceHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">No historical price updates recorded.</p>
              ) : (
                <div className="relative border-l border-slate-200 ml-3.5 my-4">
                  {priceHistory.map((hist, index) => {
                    const priceVal = parseFloat(hist.selling_price as any);
                    const marginVal = parseFloat(hist.cost_margin as any);
                    const costVal = priceVal - marginVal;
                    return (
                      <div key={hist.id} className="mb-6 ml-6 relative">
                        {/* Bullet point indicator */}
                        <span className={`absolute -left-[30px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${index === 0 ? 'bg-emerald-500' : 'bg-slate-350'}`} />

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                            <span>{formatDateTime(hist.valid_from)}</span>
                            {index === 0 && (
                              <span className="text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wide">
                                Active Price
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-[9px] text-slate-450 block">Selling Price</span>
                              <span className="font-extrabold text-slate-800">₹{priceVal.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-450 block">Purchase Cost</span>
                              <span className="font-semibold text-slate-600">₹{costVal.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-450 block">Margin</span>
                              <span className="font-semibold text-emerald-600">₹{marginVal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {isDeleteModalOpen && selectedProductForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-955 font-display">
                {deleteStep === 1 ? 'Delete Product' : '⚠️ High-Risk Deletion Warning'}
              </h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
                disabled={isDeleting}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-600">
                  {formError}
                </div>
              )}

              {isCheckingUsage ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-slate-500 text-[11px] mt-2 font-semibold">Checking database dependencies...</span>
                </div>
              ) : (
                <>
                  {deleteStep === 1 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Are you sure you want to delete <strong className="text-slate-800 font-bold">{selectedProductForDelete.name}</strong>?
                      </p>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                        <p className="font-bold text-slate-700">⚠ Note</p>
                        <p className="text-slate-550 leading-normal">
                          Generate a report first to preserve the data regarding this product. You will not be able to get this product's data in future reports.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl space-y-3">
                        <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                          <span>⚠️ Active Connections Found</span>
                        </p>
                        <p className="text-xs text-rose-650 leading-normal font-semibold">
                          This product is currently connected to:
                        </p>
                        <ul className="text-xs text-rose-650 list-disc list-inside space-y-1 pl-1 font-bold">
                          <li>{productUsage?.tanks_count || 0} Underground Storage Tank(s)</li>
                          <li>{productUsage?.pumps_count || 0} Fuel Pump Station(s)</li>
                        </ul>
                        <p className="text-xs text-rose-500 leading-relaxed">
                          Confirming deletion will permanently remove all linked storage tanks, linked dispensing nozzles, shift meter logs, tank dip logs, and price histories. This is irreversible.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(false)}
                      disabled={isDeleting}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={isDeleting}
                      className={`py-2.5 px-4 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer ${deleteStep === 2
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-red-500 hover:bg-red-650'
                        }`}
                    >
                      {isDeleting && (
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      {deleteStep === 1
                        ? (productUsage?.in_use ? 'Proceed' : 'Delete Product')
                        : 'Force Delete Anyway'}
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
