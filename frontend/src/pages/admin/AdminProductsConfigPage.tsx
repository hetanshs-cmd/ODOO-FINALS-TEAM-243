import React, { useState } from 'react';
import { useDealStore } from '../../hooks/useDealStore';
import { Product, ProductCategory, PriceList } from '../../types';
import {
  Package,
  Plus,
  Edit2,
  Archive,
  Search,
  Filter,
  DollarSign,
  Sparkles,
  X,
  Save,
  Check,
  Tag,
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const AdminProductsConfigPage: React.FC = () => {
  const {
    products,
    priceLists,
    saveProduct,
    archiveProduct,
    savePriceList,
  } = useDealStore();

  const [activeTab, setActiveTab] = useState<'catalog' | 'pricelists'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Product Editing / Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Price List Editing State
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>(priceLists[0]?.id || '');
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);

  const categories: ProductCategory[] = [
    'Hardware',
    'Services',
    'Subscription',
  ];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateProduct = () => {
    setEditingProduct({
      id: `PROD-${Date.now()}`,
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      name: '',
      category: 'Hardware',
      price: 1000,
      basePrice: 1000,
      unit: 'unit',
      taxPercent: 18,
      costBasisPercent: 60,
      discountCeilingPercent: 15,
      isSubscription: false,
      status: 'Active',
      description: '',
      variants: [],
      priceListEntries: [],
    });
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct({ ...prod });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name || !editingProduct.sku) {
      toast.warning('Validation', 'Product Name and SKU are required.');
      return;
    }

    const price = Number(editingProduct.price) || 0;
    const fullProduct: Product = {
      id: editingProduct.id || `PROD-${Date.now()}`,
      sku: editingProduct.sku,
      name: editingProduct.name,
      category: (editingProduct.category as ProductCategory) || 'Hardware',
      price,
      basePrice: price,
      unit: editingProduct.unit || 'unit',
      taxPercent: editingProduct.taxPercent !== undefined ? Number(editingProduct.taxPercent) : 18,
      costBasisPercent: Number(editingProduct.costBasisPercent) || 60,
      discountCeilingPercent: Number(editingProduct.discountCeilingPercent) || 15,
      isSubscription: Boolean(editingProduct.isSubscription),
      recurringCycle: editingProduct.isSubscription ? editingProduct.recurringCycle || 'monthly' : undefined,
      status: editingProduct.status || 'Active',
      description: editingProduct.description || '',
      variants: editingProduct.variants || [],
      priceListEntries: editingProduct.priceListEntries || [],
    };

    saveProduct(fullProduct);
    toast.success('Product Saved', `Product "${fullProduct.name}" (${fullProduct.sku}) updated.`);
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleArchiveProduct = (prod: Product) => {
    if (confirm(`Are you sure you want to archive "${prod.name}"?`)) {
      archiveProduct(prod.id);
      toast.info('Product Archived', `Product ${prod.sku || prod.id} moved to Archived.`);
    }
  };

  const activePriceList =
    editingPriceList ||
    priceLists.find((pl) => pl.id === selectedPriceListId) ||
    priceLists[0];

  const handlePriceListChange = (plId: string) => {
    setSelectedPriceListId(plId);
    setEditingPriceList(null);
  };

  const handleUpdatePriceListItem = (productId: string, customPrice: number) => {
    if (!activePriceList) return;
    const existingItem = activePriceList.items.find((i) => i.productId === productId);
    let updatedItems = [...activePriceList.items];

    if (existingItem) {
      updatedItems = updatedItems.map((i) =>
        i.productId === productId ? { ...i, customPrice } : i
      );
    } else {
      const prod = products.find((p) => p.id === productId);
      updatedItems.push({
        productId,
        productName: prod?.name || 'Item',
        customPrice,
      });
    }

    setEditingPriceList({
      ...activePriceList,
      items: updatedItems,
    });
  };

  const handleSavePriceList = () => {
    if (!activePriceList) return;
    savePriceList(activePriceList);
    setEditingPriceList(null);
    toast.success('Price List Updated', `Saved custom pricing overrides for "${activePriceList.name}".`);
  };

  return (
    <div id="admin-products-container" className="space-y-4">
      {/* Sub-Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E5E7EB] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wide">
              Catalog & Pricing Governance
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F3F4F6] text-[#4B5563]">
              {products.length} Products • {priceLists.length} Price Lists
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Manage master product definitions, baseline unit prices, margin cost bases, and tier-specific price overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Tab Switcher */}
          <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-md border border-[#E5E7EB] text-xs font-medium">
            <button
              id="tab-product-catalog"
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Master Catalog
            </button>
            <button
              id="tab-price-lists"
              onClick={() => setActiveTab('pricelists')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'pricelists'
                  ? 'bg-white text-[#714B67] font-semibold shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              Price Lists & Tier Overrides
            </button>
          </div>

          {activeTab === 'catalog' && (
            <button
              id="btn-create-product"
              onClick={handleCreateProduct}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Product</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'catalog' ? (
        /* ================= MASTER CATALOG VIEW ================= */
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
          {/* Table Filters */}
          <div className="p-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                id="search-products-input"
                type="text"
                placeholder="Filter by SKU or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded-md text-[#1F2937] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#714B67]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280] font-medium flex items-center gap-1">
                <Filter className="w-3 h-3" /> Category:
              </span>
              <select
                id="select-product-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs bg-white border border-[#D1D5DB] rounded-md px-2.5 py-1.5 text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table id="products-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                  <th className="py-2.5 px-4">SKU / Product</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Base Price</th>
                  <th className="py-2.5 px-4 text-right">Cost Basis</th>
                  <th className="py-2.5 px-4 text-right">Target Margin</th>
                  <th className="py-2.5 px-4 text-center">Ceiling Limit</th>
                  <th className="py-2.5 px-4 text-center">Type</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredProducts.map((p) => {
                  const price = p.price ?? p.basePrice;
                  const costBasis = p.costBasisPercent || 60;
                  const targetMargin = 100 - costBasis;
                  const isArchived = p.status === 'Archived';

                  return (
                    <tr
                      key={p.id}
                      id={`product-row-${p.id}`}
                      className={`hover:bg-[#F9FAFB] transition-colors ${
                        isArchived ? 'opacity-50 bg-[#FAFAFA]' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#1F2937]">{p.name}</div>
                        <div className="text-[11px] font-mono text-[#6B7280]">{p.sku || p.id}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#1F2937]">
                        ₹{price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#6B7280]">
                        {costBasis}% (₹{((price * costBasis) / 100).toFixed(2)})
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#059669]">
                        {targetMargin}%
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                          {p.discountCeilingPercent}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {p.isSubscription ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                            Recurring ({p.recurringCycle || 'monthly'})
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#6B7280]">One-off</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isArchived
                              ? 'bg-[#F3F4F6] text-[#4B5563]'
                              : 'bg-[#ECFDF5] text-[#065F46]'
                          }`}
                        >
                          {p.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            id={`btn-edit-product-${p.id}`}
                            onClick={() => handleEditProduct(p)}
                            title="Edit Product"
                            className="p-1 text-[#6B7280] hover:text-[#714B67] hover:bg-[#F3F4F6] rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isArchived && (
                            <button
                              id={`btn-archive-product-${p.id}`}
                              onClick={() => handleArchiveProduct(p)}
                              title="Archive Product"
                              className="p-1 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= PRICE LISTS VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Price Lists Sidebar */}
          <div className="bg-white p-3 rounded-lg border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="text-xs font-bold text-[#1F2937] uppercase tracking-wide border-b border-[#E5E7EB] pb-2">
              Customer Price Lists
            </div>
            <div className="space-y-1">
              {priceLists.map((pl) => {
                const isSelected = pl.id === activePriceList?.id;
                return (
                  <button
                    key={pl.id}
                    id={`btn-select-pricelist-${pl.id}`}
                    onClick={() => handlePriceListChange(pl.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#714B67] text-white font-semibold'
                        : 'text-[#374151] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    <div>
                      <div>{pl.name}</div>
                      <div
                        className={`text-[10px] font-mono ${
                          isSelected ? 'text-[#E5E7EB]' : 'text-[#6B7280]'
                        }`}
                      >
                        Tier: {pl.tier} ({pl.items.length} overrides)
                      </div>
                    </div>
                    {pl.active && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-emerald-300' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price List Items Table */}
          <div className="md:col-span-3 bg-white rounded-lg border border-[#E5E7EB] shadow-2xs overflow-hidden">
            <div className="p-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#714B67]" />
                  <span>{activePriceList.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-[#E0E7FF] text-[#3730A3]">
                    Customer Tier: {activePriceList.tier}
                  </span>
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {activePriceList.notes || 'Configured custom price list overrides applied during Quotation Builder.'}
                </p>
              </div>

              {editingPriceList && (
                <div className="flex items-center gap-2">
                  <button
                    id="btn-save-pricelist"
                    onClick={handleSavePriceList}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Overrides</span>
                  </button>
                  <button
                    id="btn-cancel-pricelist-edit"
                    onClick={() => setEditingPriceList(null)}
                    className="px-2.5 py-1.5 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#ECFDF5] border-b border-[#A7F3D0] text-xs text-[#065F46] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#059669] shrink-0" />
              <span>
                <strong>Runtime Influence:</strong> When adding any product below to a quotation for a{' '}
                <strong>{activePriceList.tier}</strong> customer, the Quotation Builder automatically uses the custom
                override price as the line item default!
              </span>
            </div>

            <div className="overflow-x-auto">
              <table id="pricelist-items-table" className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] font-semibold">
                    <th className="py-2.5 px-4">Product Name / SKU</th>
                    <th className="py-2.5 px-4 text-right">Standard Catalog Base</th>
                    <th className="py-2.5 px-4 text-right">Custom Price Override</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {products
                    .filter((p) => p.status !== 'Archived')
                    .map((p) => {
                      const standardPrice = p.price ?? p.basePrice;
                      const customItem = activePriceList.items.find((i) => i.productId === p.id);
                      const hasOverride = typeof customItem?.customPrice === 'number';
                      const activePrice = hasOverride ? customItem.customPrice : standardPrice;

                      return (
                        <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-[#1F2937]">{p.name}</div>
                            <div className="text-[11px] font-mono text-[#6B7280]">
                              {p.sku || p.id} • {p.category}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-[#6B7280]">
                            ₹{standardPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <span className="text-[#6B7280] font-mono">$</span>
                              <input
                                id={`input-custom-price-${p.id}`}
                                type="number"
                                step="10"
                                value={activePrice}
                                onChange={(e) =>
                                  handleUpdatePriceListItem(p.id, parseFloat(e.target.value) || 0)
                                }
                                className={`w-28 text-right px-2 py-1 text-xs font-mono font-bold rounded border focus:outline-hidden ${
                                  hasOverride
                                    ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#92400E] focus:border-[#B45309]'
                                    : 'bg-white border-[#D1D5DB] text-[#1F2937] focus:border-[#714B67]'
                                }`}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {hasOverride ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                                Override Active
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#9CA3AF]">Default Catalog</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRODUCT EDIT / CREATE MODAL ================= */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-3.5 bg-[#714B67] text-white">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  {editingProduct.id ? 'Edit Product Specification' : 'New Product Definition'}
                </h3>
              </div>
              <button
                id="btn-close-product-modal"
                onClick={() => setIsProductModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Product Name *
                  </label>
                  <input
                    id="product-modal-name"
                    type="text"
                    required
                    value={editingProduct.name || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                    placeholder="e.g. Edge Computing Hub"
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    SKU Code *
                  </label>
                  <input
                    id="product-modal-sku"
                    type="text"
                    required
                    value={editingProduct.sku || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sku: e.target.value })
                    }
                    placeholder="e.g. SKU-EDGE-200"
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Category
                  </label>
                  <select
                    id="product-modal-category"
                    value={editingProduct.category || 'Hardware'}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        category: e.target.value as ProductCategory,
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Base Unit Price ($) *
                  </label>
                  <input
                    id="product-modal-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingProduct.price ?? ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Ceiling Limit (%)
                  </label>
                  <input
                    id="product-modal-ceiling"
                    type="number"
                    min="0"
                    max="100"
                    value={editingProduct.discountCeilingPercent ?? 15}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        discountCeilingPercent: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Cost Basis (% of revenue)
                  </label>
                  <input
                    id="product-modal-cost-basis"
                    type="number"
                    min="0"
                    max="100"
                    value={editingProduct.costBasisPercent ?? 60}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        costBasisPercent: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  />
                  <span className="text-[10px] text-[#6B7280]">
                    Implied default profit margin: {100 - (editingProduct.costBasisPercent ?? 60)}%
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Billing Structure
                  </label>
                  <div className="flex items-center gap-2 pt-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        id="product-modal-is-subscription"
                        type="checkbox"
                        checked={Boolean(editingProduct.isSubscription)}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            isSubscription: e.target.checked,
                          })
                        }
                        className="rounded border-[#D1D5DB] text-[#714B67] focus:ring-[#714B67]"
                      />
                      <span className="text-xs text-[#374151]">Recurring Subscription</span>
                    </label>
                  </div>
                </div>
              </div>

              {editingProduct.isSubscription && (
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Subscription Cycle
                  </label>
                  <select
                    id="product-modal-cycle"
                    value={editingProduct.recurringCycle || 'monthly'}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        recurringCycle: e.target.value as 'monthly' | 'quarterly' | 'yearly',
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                  >
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Description
                </label>
                <textarea
                  id="product-modal-description"
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                  placeholder="Operational SKU details..."
                  className="w-full px-2.5 py-1.5 border border-[#D1D5DB] rounded-md text-xs text-[#1F2937] focus:outline-hidden focus:border-[#714B67]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  id="btn-modal-cancel"
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  id="btn-modal-save"
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#593952] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
