// ========================================================================
// Asset Master Module
// Authoritative Asset Directory, Registration Modal, Placement Management,
// Detailed Lifecycle Drawer with Assignment, Maintenance & Movement History
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  RefreshCw,
  Eye,
  UserCheck,
  Wrench,
  ArrowLeftRight,
  Archive,
  Calendar,
  Building2,
  Tag,
  ShieldCheck,
  AlertCircle,
  Clock,
  QrCode,
  FileText,
  X,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { useCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';
import {
  Asset,
  AssetCategory,
  AssetSubcategory,
  AssetStatus,
  AssetCondition,
  Location,
  User,
  InventoryVendor,
} from '../../types/index.js';

export const AssetMasterModule: React.FC<{ tabId?: string }> = () => {
  const { openTab } = useWorkspace();
  const { symbol, format } = useCurrency();

  // Data states
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [subcategories, setSubcategories] = useState<AssetSubcategory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<Asset | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'assignments' | 'maintenance' | 'movements'>('info');

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formSubcategoryId, setFormSubcategoryId] = useState<string>('');
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formBuilding, setFormBuilding] = useState<string>('');
  const [formRoom, setFormRoom] = useState<string>('');
  const [formBrand, setFormBrand] = useState<string>('');
  const [formModel, setFormModel] = useState<string>('');
  const [formSerial, setFormSerial] = useState<string>('');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formAssetTag, setFormAssetTag] = useState<string>('');
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>('');
  const [formPurchasePrice, setFormPurchasePrice] = useState<string>('0');
  const [formVendorId, setFormVendorId] = useState<string>('');
  const [formWarrantyEnd, setFormWarrantyEnd] = useState<string>('');
  const [formCondition, setFormCondition] = useState<AssetCondition>('NEW');
  const [formStatus, setFormStatus] = useState<AssetStatus>('AVAILABLE');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    loadPrerequisites();
    loadAssets();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [cats, locs, vends] = await Promise.all([
        api.get<AssetCategory[]>('/assets/categories'),
        api.get<Location[]>('/locations'),
        api.get<InventoryVendor[]>('/inventory/vendors').catch(() => []),
      ]);
      setCategories(cats || []);
      setLocations(locs || []);
      setVendors(vends || []);
      if (locs && locs.length > 0 && !formLocationId) {
        setFormLocationId(locs[0].id);
      }
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    }
  };

  const loadSubcategories = async (catId: string) => {
    if (!catId) {
      setSubcategories([]);
      return;
    }
    try {
      const data = await api.get<AssetSubcategory[]>('/assets/subcategories', { category_id: catId });
      setSubcategories(data || []);
    } catch (err) {
      console.error('Failed to load subcategories', err);
    }
  };

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await api.get<Asset[]>('/assets/assets', {
        location_id: selectedLocation || undefined,
        category_id: selectedCategory || undefined,
        status: selectedStatus || undefined,
        condition: selectedCondition || undefined,
        search: searchTerm || undefined,
      });
      setAssets(data || []);
    } catch (err) {
      console.error('Failed to load assets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingAsset(null);
    setFormName('');
    setFormCategoryId(categories[0]?.id || '');
    if (categories[0]?.id) loadSubcategories(categories[0].id);
    setFormSubcategoryId('');
    setFormLocationId(locations[0]?.id || '');
    setFormBuilding('');
    setFormRoom('');
    setFormBrand('');
    setFormModel('');
    setFormSerial('');
    setFormBarcode('');
    setFormAssetTag('');
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setFormPurchasePrice('0');
    setFormVendorId('');
    setFormWarrantyEnd('');
    setFormCondition('NEW');
    setFormStatus('AVAILABLE');
    setFormRemarks('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setFormName(asset.asset_name);
    setFormCategoryId(asset.category_id);
    loadSubcategories(asset.category_id);
    setFormSubcategoryId(asset.subcategory_id || '');
    setFormLocationId(asset.current_location_id);
    setFormBuilding(asset.building || '');
    setFormRoom(asset.room_number || asset.room || '');
    setFormBrand(asset.brand || '');
    setFormModel(asset.model || '');
    setFormSerial(asset.serial_number || '');
    setFormBarcode(asset.barcode || '');
    setFormAssetTag(asset.asset_tag || '');
    setFormPurchaseDate(asset.purchase_date || '');
    setFormPurchasePrice(String(asset.purchase_price || 0));
    setFormVendorId(asset.vendor_id || '');
    setFormWarrantyEnd(asset.warranty_end_date || '');
    setFormCondition(asset.condition);
    setFormStatus(asset.status);
    setFormRemarks(asset.remarks || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Asset name is required.');
      return;
    }
    if (!formCategoryId) {
      setFormError('Category is required.');
      return;
    }
    if (!formLocationId) {
      setFormError('Location/Branch is required.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        asset_name: formName.trim(),
        category_id: formCategoryId,
        subcategory_id: formSubcategoryId || null,
        current_location_id: formLocationId,
        building: formBuilding.trim() || null,
        room: formRoom.trim() || null,
        room_number: formRoom.trim() || null,
        brand: formBrand.trim() || null,
        model: formModel.trim() || null,
        serial_number: formSerial.trim() || null,
        barcode: formBarcode.trim() || null,
        asset_tag: formAssetTag.trim() || null,
        purchase_date: formPurchaseDate || null,
        purchase_price: Number(formPurchasePrice) || 0,
        vendor_id: formVendorId || null,
        warranty_end_date: formWarrantyEnd || null,
        condition: formCondition,
        status: formStatus,
        remarks: formRemarks.trim() || null,
      };

      if (editingAsset) {
        await api.put(`/assets/assets/${editingAsset.id}`, payload);
      } else {
        await api.post('/assets/assets', payload);
      }

      setIsModalOpen(false);
      loadAssets();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save asset record');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetailDrawer = async (asset: Asset) => {
    try {
      const full = await api.get<Asset>(`/assets/assets/${asset.id}`);
      setSelectedAssetDetail(full);
      setDetailTab('info');
    } catch (err) {
      setSelectedAssetDetail(asset);
    }
  };

  const handleDeleteAsset = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to retire/delete asset '${code}'?`)) return;
    try {
      await api.delete(`/assets/assets/${id}`);
      loadAssets();
      if (selectedAssetDetail?.id === id) {
        setSelectedAssetDetail(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset');
    }
  };

  // Helper Badge Colors
  const getStatusBadge = (status: AssetStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <Badge variant="success">Available</Badge>;
      case 'ASSIGNED':
        return <Badge variant="indigo">Assigned</Badge>;
      case 'UNDER_MAINTENANCE':
        return <Badge variant="warning">Under Service</Badge>;
      case 'DAMAGED':
        return <Badge variant="danger">Damaged</Badge>;
      case 'LOST':
        return <Badge variant="slate">Lost</Badge>;
      case 'DISPOSED':
        return <Badge variant="slate">Disposed</Badge>;
      case 'RETIRED':
        return <Badge variant="slate">Retired</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getConditionBadge = (cond: AssetCondition) => {
    switch (cond) {
      case 'NEW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">New</span>;
      case 'GOOD':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Good</span>;
      case 'FAIR':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Fair</span>;
      case 'DAMAGED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Damaged</span>;
      case 'CRITICAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Critical</span>;
      default:
        return <span>{cond}</span>;
    }
  };

  const locationFilterOptions = getLocationSelectOptions(locations, {
    includeAll: true,
    allLabel: 'All Locations / Branches',
  });

  const locationModalOptions = getLocationSelectOptions(locations, {
    activeOnly: true,
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Master Register</h1>
            <Badge variant="slate">{assets.length} Assets</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Centralized inventory of all school-owned physical equipment, lab instruments, furniture & electronics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadAssets} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Register New Asset
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search code, name, serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadAssets()}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Location */}
          <Select
            options={locationFilterOptions}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          />

          {/* Category */}
          <Select
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />

          {/* Status */}
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'AVAILABLE', label: 'Available' },
              { value: 'ASSIGNED', label: 'Assigned' },
              { value: 'UNDER_MAINTENANCE', label: 'Under Service' },
              { value: 'DAMAGED', label: 'Damaged' },
              { value: 'LOST', label: 'Lost' },
              { value: 'DISPOSED', label: 'Disposed' },
            ]}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          />

          {/* Filter apply button */}
          <Button variant="secondary" onClick={loadAssets} className="w-full">
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Assets Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Asset Code & Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Placement / Branch</th>
                <th className="py-3 px-4">Custodian</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Acquisition Cost</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading assets...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <Boxes className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No assets found matching the selected filters.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{asset.asset_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-blue-600">{asset.asset_code}</span>
                        {asset.serial_number && <span>• SN: {asset.serial_number}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900 font-medium">{asset.category?.name || 'Uncategorized'}</div>
                      {asset.subcategory?.name && (
                        <div className="text-xs text-gray-400">{asset.subcategory.name}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900 font-medium">
                        {formatLocationDisplay(asset.location)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {asset.room_number || asset.room || asset.building || 'Not specified'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {asset.custodian ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {asset.custodian.first_name} {asset.custodian.last_name}
                          </div>
                          <div className="text-xs text-gray-400">{asset.custodian.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">None (In Storage)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getConditionBadge(asset.condition)}</td>
                    <td className="py-3 px-4">{getStatusBadge(asset.status)}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {format(asset.purchase_price || 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetailDrawer(asset)}
                          title="View Details & History"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(asset)}
                          title="Edit Asset"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAsset(asset.id, asset.asset_code)}
                          title="Retire/Delete Asset"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Registration / Edit Asset Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAsset ? `Edit Asset: ${editingAsset.asset_code}` : 'Register New Physical Asset'}
      >
        <form onSubmit={handleSaveAsset} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Asset Name *</label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Dell Latitude 5440 Core i7 Laptop"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Category *</label>
              <Select
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={formCategoryId}
                onChange={(e) => {
                  setFormCategoryId(e.target.value);
                  loadSubcategories(e.target.value);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Subcategory</label>
              <Select
                options={[
                  { value: '', label: 'Select Subcategory' },
                  ...subcategories.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={formSubcategoryId}
                onChange={(e) => setFormSubcategoryId(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Campus / Branch *</label>
              <Select
                options={locationModalOptions}
                value={formLocationId}
                onChange={(e) => setFormLocationId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Building / Wing</label>
              <Input
                value={formBuilding}
                onChange={(e) => setFormBuilding(e.target.value)}
                placeholder="e.g. Block A, 2nd Floor"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Room / Lab Number</label>
              <Input
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                placeholder="e.g. Room 102 / Physics Lab"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Brand / Manufacturer</label>
              <Input
                value={formBrand}
                onChange={(e) => setFormBrand(e.target.value)}
                placeholder="e.g. Dell / Epson / Godrej"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Model Number</label>
              <Input
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                placeholder="e.g. EB-E01 / Latitude 5440"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Serial Number</label>
              <Input
                value={formSerial}
                onChange={(e) => setFormSerial(e.target.value)}
                placeholder="e.g. SN-884912"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Barcode / RFID Tag</label>
              <Input
                value={formBarcode}
                onChange={(e) => setFormBarcode(e.target.value)}
                placeholder="e.g. 890100100001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Purchase Price ({symbol}) *</label>
              <Input
                type="number"
                value={formPurchasePrice}
                onChange={(e) => setFormPurchasePrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Purchase Date</label>
              <Input
                type="date"
                value={formPurchaseDate}
                onChange={(e) => setFormPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Warranty End Date</label>
              <Input
                type="date"
                value={formWarrantyEnd}
                onChange={(e) => setFormWarrantyEnd(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Condition</label>
              <Select
                options={[
                  { value: 'NEW', label: 'New' },
                  { value: 'GOOD', label: 'Good' },
                  { value: 'FAIR', label: 'Fair' },
                  { value: 'DAMAGED', label: 'Damaged' },
                  { value: 'CRITICAL', label: 'Critical' },
                ]}
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value as AssetCondition)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Status</label>
              <Select
                options={[
                  { value: 'AVAILABLE', label: 'Available' },
                  { value: 'ASSIGNED', label: 'Assigned' },
                  { value: 'UNDER_MAINTENANCE', label: 'Under Service' },
                  { value: 'DAMAGED', label: 'Damaged' },
                  { value: 'LOST', label: 'Lost' },
                  { value: 'DISPOSED', label: 'Disposed' },
                ]}
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as AssetStatus)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Remarks / Asset Tag</label>
            <Input
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="e.g. Dedicated lab workstation, asset tag DPA-IT-001"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingAsset ? 'Update Asset' : 'Register Asset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Asset Detail Drawer / Modal */}
      {selectedAssetDetail && (
        <Modal
          isOpen={!!selectedAssetDetail}
          onClose={() => setSelectedAssetDetail(null)}
          title={`${selectedAssetDetail.asset_code} — ${selectedAssetDetail.asset_name}`}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Tab navigation */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  detailTab === 'info' ? 'bg-brand-600 text-brand-foreground shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setDetailTab('info')}
              >
                Information
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  detailTab === 'assignments' ? 'bg-brand-600 text-brand-foreground shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setDetailTab('assignments')}
              >
                Custody History ({selectedAssetDetail.assignments?.length || 0})
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  detailTab === 'maintenance' ? 'bg-brand-600 text-brand-foreground shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setDetailTab('maintenance')}
              >
                Service Records ({selectedAssetDetail.maintenance_records?.length || 0})
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  detailTab === 'movements' ? 'bg-brand-600 text-brand-foreground shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setDetailTab('movements')}
              >
                Movement History ({selectedAssetDetail.movements?.length || 0})
              </button>
            </div>

            {/* TAB: INFO */}
            {detailTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block">Status</span>
                    {getStatusBadge(selectedAssetDetail.status)}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Condition</span>
                    {getConditionBadge(selectedAssetDetail.condition)}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Acquisition Cost</span>
                    <span className="font-semibold text-gray-900">{format(selectedAssetDetail.purchase_price)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Branch</span>
                    <span className="font-medium text-gray-900">{formatLocationDisplay(selectedAssetDetail.location)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Building & Room</span>
                    <span className="font-medium text-gray-900">
                      {selectedAssetDetail.room_number || selectedAssetDetail.room || selectedAssetDetail.building || 'Unspecified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Warranty Exp.</span>
                    <span className="font-medium text-gray-900">
                      {selectedAssetDetail.warranty_end_date || 'None'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 border rounded-lg">
                    <span className="text-xs text-gray-500 block font-semibold uppercase">Category</span>
                    <div className="text-gray-900 font-medium mt-1">{selectedAssetDetail.category?.name}</div>
                    <div className="text-xs text-gray-400">{selectedAssetDetail.subcategory?.name || 'General'}</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <span className="text-xs text-gray-500 block font-semibold uppercase">Hardware Specs</span>
                    <div className="text-gray-900 font-medium mt-1">
                      {selectedAssetDetail.brand} {selectedAssetDetail.model}
                    </div>
                    <div className="text-xs text-gray-400">SN: {selectedAssetDetail.serial_number || 'N/A'}</div>
                  </div>
                </div>

                {selectedAssetDetail.remarks && (
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-gray-700">
                    <span className="text-xs font-semibold text-blue-900 block mb-0.5">Asset Notes</span>
                    {selectedAssetDetail.remarks}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ASSIGNMENTS */}
            {detailTab === 'assignments' && (
              <div className="space-y-3">
                {selectedAssetDetail.assignments && selectedAssetDetail.assignments.length > 0 ? (
                  selectedAssetDetail.assignments.map((asg) => (
                    <div key={asg.id} className="p-3 border border-gray-200 rounded-lg text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">
                          {asg.assigned_to_user?.first_name} {asg.assigned_to_user?.last_name}
                        </span>
                        <Badge variant={asg.is_active ? 'indigo' : 'slate'}>
                          {asg.is_active ? 'Active Custody' : 'Returned'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center justify-between">
                        <span>Assigned: {asg.assignment_date}</span>
                        <span>{asg.actual_return_date ? `Returned: ${asg.actual_return_date}` : 'Currently with user'}</span>
                      </div>
                      {asg.remarks && <p className="text-xs text-gray-600 mt-1">{asg.remarks}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">No previous assignment records.</p>
                )}
              </div>
            )}

            {/* TAB: MAINTENANCE */}
            {detailTab === 'maintenance' && (
              <div className="space-y-3">
                {selectedAssetDetail.maintenance_records && selectedAssetDetail.maintenance_records.length > 0 ? (
                  selectedAssetDetail.maintenance_records.map((m) => (
                    <div key={m.id} className="p-3 border border-gray-200 rounded-lg text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{m.issue_description}</span>
                        <Badge variant={m.status === 'COMPLETED' ? 'success' : 'warning'}>
                          {m.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center justify-between">
                        <span>Date: {m.service_date}</span>
                        <span className="font-medium text-gray-800">Cost: {format(m.cost)}</span>
                      </div>
                      {m.work_performed && (
                        <div className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded mt-1">
                          <strong>Work Performed:</strong> {m.work_performed}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">No service or maintenance records logged.</p>
                )}
              </div>
            )}

            {/* TAB: MOVEMENTS */}
            {detailTab === 'movements' && (
              <div className="space-y-3">
                {selectedAssetDetail.movements && selectedAssetDetail.movements.length > 0 ? (
                  selectedAssetDetail.movements.map((mov) => (
                    <div key={mov.id} className="p-3 border border-gray-200 rounded-lg text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{mov.reason || 'Location Transfer'}</span>
                        <span className="text-xs text-gray-500">{mov.movement_date}</span>
                      </div>
                      <div className="text-xs text-gray-600 flex items-center gap-2">
                        <span>{formatLocationDisplay(mov.from_location)} ({mov.from_room || 'Store'})</span>
                        <span>→</span>
                        <span className="font-semibold text-blue-600">
                          {formatLocationDisplay(mov.to_location)} ({mov.to_room || 'Room'})
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">No movement history logged.</p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
