// ========================================================================
// SKU / Barcode Master Module
// Standalone Inventory Item Master (SKU Code, Name, Barcodes, Taxonomy, Attributes & Pricing)
// Single Source of Truth for Sellable / Consumable School Inventory Items
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  RefreshCw,
  AlertCircle,
  Package,
  Layers,
  Sliders,
  Award,
  FolderTree,
  Boxes,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import {
  SKU,
  InventoryCategory,
  InventorySubcategory,
  InventoryUOM,
  InventoryBrand,
} from '../../types/index.js';

interface AttributeRow {
  key: string;
  value: string;
}

export const SkuMasterModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, formatCurrency } = useCurrency();
  const [skus, setSkus] = useState<SKU[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [subcategories, setSubcategories] = useState<InventorySubcategory[]>([]);
  const [uoms, setUoms] = useState<InventoryUOM[]>([]);
  const [brands, setBrands] = useState<InventoryBrand[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSku, setEditingSku] = useState<SKU | null>(null);

  // Form Fields
  const [formSkuCode, setFormSkuCode] = useState<string>('');
  const [formSkuName, setFormSkuName] = useState<string>('');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formAlternateBarcode, setFormAlternateBarcode] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formSubcategoryId, setFormSubcategoryId] = useState<string>('');
  const [formUomId, setFormUomId] = useState<string>('');
  const [formBrandId, setFormBrandId] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);
  const [formReorderLevel, setFormReorderLevel] = useState<number>(10);
  const [formMinOrderQty, setFormMinOrderQty] = useState<number>(1);
  const [formMaxStock, setFormMaxStock] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>([]);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [skusRes, catsRes, subcatsRes, uomsRes, brandsRes] = await Promise.all([
        api.get<SKU[]>('/inventory/skus'),
        api.get<InventoryCategory[]>('/inventory/categories'),
        api.get<InventorySubcategory[]>('/inventory/subcategories'),
        api.get<InventoryUOM[]>('/inventory/uoms'),
        api.get<InventoryBrand[]>('/inventory/brands'),
      ]);
      setSkus(skusRes || []);
      setCategories(catsRes || []);
      setSubcategories(subcatsRes || []);
      setUoms(uomsRes || []);
      setBrands(brandsRes || []);
    } catch (err) {
      console.error('Failed to load SKUs master:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSku(null);
    setFormSkuCode('');
    setFormSkuName('');
    setFormBarcode('');
    setFormAlternateBarcode('');
    setFormCategoryId('');
    setFormSubcategoryId('');
    setFormUomId('');
    setFormBrandId('');
    setFormDescription('');
    setFormCostPrice(0);
    setFormSellingPrice(0);
    setFormReorderLevel(10);
    setFormMinOrderQty(1);
    setFormMaxStock('');
    setFormStatus('ACTIVE');
    setAttributeRows([]);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (sku: SKU) => {
    setEditingSku(sku);
    setFormSkuCode(sku.sku_code);
    setFormSkuName(sku.sku_name || sku.product?.name || '');
    setFormBarcode(sku.barcode || '');
    setFormAlternateBarcode(sku.alternate_barcode || '');
    setFormCategoryId(sku.category_id || sku.product?.category_id || '');
    setFormSubcategoryId(sku.subcategory_id || sku.product?.subcategory_id || '');
    setFormUomId(sku.uom_id || sku.product?.uom_id || '');
    setFormBrandId(sku.brand_id || sku.product?.brand_id || '');
    setFormDescription(sku.description || sku.product?.description || '');
    setFormCostPrice(sku.cost_price);
    setFormSellingPrice(sku.selling_price);
    setFormReorderLevel(sku.reorder_level);
    setFormMinOrderQty(sku.min_order_qty);
    setFormMaxStock(sku.max_stock !== null && sku.max_stock !== undefined ? String(sku.max_stock) : '');
    setFormStatus(sku.status);

    const attrs = sku.attributes || {};
    const rows = Object.entries(attrs).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    setAttributeRows(rows);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleAddAttributeRow = () => {
    setAttributeRows(prev => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveAttributeRow = (idx: number) => {
    setAttributeRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAttributeChange = (idx: number, field: 'key' | 'value', val: string) => {
    setAttributeRows(prev =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      const cleanCode = formSkuCode.trim().toUpperCase();
      if (!cleanCode) {
        setErrorMsg('SKU Code is required');
        return;
      }

      const attributesObj: Record<string, string> = {};
      for (const row of attributeRows) {
        const k = row.key.trim();
        if (k) {
          attributesObj[k] = row.value.trim();
        }
      }

      const payload = {
        sku_code: cleanCode,
        sku_name: formSkuName.trim() || cleanCode,
        barcode: formBarcode.trim() || null,
        alternate_barcode: formAlternateBarcode.trim() || null,
        category_id: formCategoryId || null,
        subcategory_id: formSubcategoryId || null,
        uom_id: formUomId || null,
        brand_id: formBrandId || null,
        description: formDescription.trim() || null,
        cost_price: Number(formCostPrice) || 0,
        selling_price: Number(formSellingPrice) || 0,
        reorder_level: Number(formReorderLevel) || 0,
        min_order_qty: Number(formMinOrderQty) || 1,
        max_stock: formMaxStock.trim() ? Number(formMaxStock) : null,
        attributes: attributesObj,
        status: formStatus,
      };

      if (editingSku) {
        await api.put(`/inventory/skus/${editingSku.id}`, payload);
      } else {
        await api.post('/inventory/skus', payload);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to save SKU');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this SKU?')) return;
    try {
      await api.delete(`/inventory/skus/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to delete SKU');
    }
  };

  const filteredSubcategories = subcategories.filter(
    sub => !formCategoryId || sub.category_id === formCategoryId
  );

  const filteredSkus = skus.filter(s => {
    if (selectedCategory && s.category_id !== selectedCategory && s.product?.category_id !== selectedCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const code = (s.sku_code || '').toLowerCase();
      const name = (s.sku_name || s.product?.name || '').toLowerCase();
      const bc = (s.barcode || '').toLowerCase();
      const alt = (s.alternate_barcode || '').toLowerCase();
      return code.includes(q) || name.includes(q) || bc.includes(q) || alt.includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            SKU / Barcode Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single authoritative master for sellable & consumable inventory items, barcodes, pricing, and reorder levels.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadData} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={openCreateModal} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add SKU
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by SKU code, item name, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end items-center text-xs text-slate-500 font-medium">
            Showing {filteredSkus.length} of {skus.length} SKUs
          </div>
        </div>
      </Card>

      {/* SKU Table */}
      <Card className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Item Name & Taxonomy</th>
                <th className="py-3 px-4">Barcode(s)</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-center">Total Stock</th>
                <th className="py-3 px-4 text-center">Reorder Level</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading SKU Master...
                  </td>
                </tr>
              ) : filteredSkus.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No SKUs found. Click "Add SKU" to define a new inventory item.
                  </td>
                </tr>
              ) : (
                filteredSkus.map((s) => {
                  const displayName = s.sku_name || s.product?.name || s.sku_code;
                  const categoryName = s.category?.name || s.product?.category?.name;
                  const uomSymbol = s.uom?.symbol || s.product?.uom?.symbol;
                  const isLow = Number(s.total_stock || 0) <= s.reorder_level;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {s.sku_code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{displayName}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          {categoryName && <span>{categoryName}</span>}
                          {s.brand?.name && <span>• {s.brand.name}</span>}
                          {uomSymbol && <span className="bg-slate-100 px-1 rounded font-mono">{uomSymbol}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {s.barcode ? (
                          <div className="flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{s.barcode}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        {s.alternate_barcode && (
                          <div className="text-[10px] text-slate-400 pl-4.5">Alt: {s.alternate_barcode}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700 font-mono">
                        {formatCurrency(s.cost_price)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-indigo-700 font-mono">
                        {formatCurrency(s.selling_price)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            Number(s.total_stock || 0) === 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {s.total_stock || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">
                        {s.reorder_level}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.status === 'ACTIVE' ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="slate">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit SKU"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Deactivate SKU"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Create / Edit SKU */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSku ? `Edit SKU: ${editingSku.sku_code}` : 'Add New SKU / Barcode Item'}
      >
        <form onSubmit={handleSave} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU Code *</label>
              <input
                type="text"
                disabled={!!editingSku}
                required
                placeholder="e.g. UNIF-SHIRT-M-BLU"
                value={formSkuCode}
                onChange={(e) => setFormSkuCode(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono uppercase disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item / SKU Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Boys Uniform Shirt - M (Navy Blue)"
                value={formSkuName}
                onChange={(e) => setFormSkuName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>
          </div>

          {/* Barcode & Alternate Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Barcode (EAN / UPC)</label>
              <input
                type="text"
                placeholder="e.g. 8901234000101"
                value={formBarcode}
                onChange={(e) => setFormBarcode(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate / Internal Barcode</label>
              <input
                type="text"
                placeholder="Optional secondary barcode"
                value={formAlternateBarcode}
                onChange={(e) => setFormAlternateBarcode(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Taxonomy: Category, Subcategory, UOM, Brand */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => {
                  setFormCategoryId(e.target.value);
                  setFormSubcategoryId('');
                }}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategory</label>
              <select
                value={formSubcategoryId}
                onChange={(e) => setFormSubcategoryId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value="">None</option>
                {filteredSubcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">UOM</label>
              <select
                value={formUomId}
                onChange={(e) => setFormUomId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value="">None</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
              <select
                value={formBrandId}
                onChange={(e) => setFormBrandId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Stock Levels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price ({symbol}) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formCostPrice}
                onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price ({symbol}) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formSellingPrice}
                onChange={(e) => setFormSellingPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Point</label>
              <input
                type="number"
                min="0"
                value={formReorderLevel}
                onChange={(e) => setFormReorderLevel(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Stock Limit</label>
              <input
                type="number"
                min="0"
                placeholder="Unlimited"
                value={formMaxStock}
                onChange={(e) => setFormMaxStock(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              placeholder="Detailed specifications, storage instructions, etc."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
            />
          </div>

          {/* Attributes JSONB (Size, Color, Pages, etc.) */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Item Attributes (Size, Color, Specs)</span>
              <Button type="button" size="sm" variant="outline" onClick={handleAddAttributeRow} className="text-[11px] py-1 h-7">
                <Plus className="w-3 h-3 mr-1" /> Add Attribute
              </Button>
            </div>
            {attributeRows.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">No custom attributes added (e.g. Size: M, Color: Navy, Pages: 200).</p>
            ) : (
              <div className="space-y-2">
                {attributeRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Attribute (e.g. Size, Color)"
                      value={row.key}
                      onChange={(e) => handleAttributeChange(idx, 'key', e.target.value)}
                      className="w-1/2 px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. XL, Blue)"
                      value={row.value}
                      onChange={(e) => handleAttributeChange(idx, 'value', e.target.value)}
                      className="w-1/2 px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttributeRow(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-700 mr-2">Status:</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="px-2 py-1 text-xs rounded border border-slate-200 bg-white font-medium"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? 'Saving...' : editingSku ? 'Update SKU' : 'Create SKU'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
