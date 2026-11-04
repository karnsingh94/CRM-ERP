'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { IconSun, IconPlus, IconSearch, IconCheckCircle, IconAlertTriangle } from '@/components/ui/Icons';

export default function SolarPlantsTab({ companyId, showToast, userRole }) {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    plantType: 'ROOFTOP_INDUSTRIAL',
    capacityDcKw: '',
    capacityAcKw: '',
    commissionDate: '',
    locationAddress: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    gridVoltage: '415 V (3-Phase)',
    monthlyTargetKwh: '',
    notes: '',
  });

  // API Config state
  const [apiConfig, setApiConfig] = useState({
    provider: 'UNIVERSAL',
    baseUrl: '',
    authType: 'API_KEY',
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    pollingIntervalMinutes: 15,
    isPollingEnabled: false,
    isWebhookEnabled: true,
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchPlants = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/companies/${companyId}/solar/plants?${params.toString()}`);
      if (res.success) {
        setPlants(res.data || []);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to load solar plants', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, search, statusFilter, showToast]);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      code: '',
      plantType: 'ROOFTOP_INDUSTRIAL',
      capacityDcKw: '',
      capacityAcKw: '',
      commissionDate: new Date().toISOString().slice(0, 10),
      locationAddress: '',
      city: '',
      state: '',
      pincode: '',
      latitude: '',
      longitude: '',
      gridVoltage: '415 V (3-Phase)',
      monthlyTargetKwh: '',
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (plant) => {
    setSelectedPlant(plant);
    setFormData({
      name: plant.name,
      code: plant.code,
      plantType: plant.plantType || 'ROOFTOP_INDUSTRIAL',
      capacityDcKw: plant.capacityDcKw,
      capacityAcKw: plant.capacityAcKw,
      commissionDate: plant.commissionDate ? plant.commissionDate.slice(0, 10) : '',
      locationAddress: plant.locationAddress || '',
      city: plant.city || '',
      state: plant.state || '',
      pincode: plant.pincode || '',
      latitude: plant.latitude || '',
      longitude: plant.longitude || '',
      gridVoltage: plant.gridVoltage || '',
      monthlyTargetKwh: plant.monthlyTargetKwh || '',
      notes: plant.notes || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSavePlant = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.capacityDcKw || !formData.capacityAcKw) {
      showToast?.('Please fill all required fields.', 'error');
      return;
    }

    try {
      if (isEditModalOpen && selectedPlant) {
        await api.put(`/companies/${companyId}/solar/plants/${selectedPlant.id}`, formData);
        showToast?.('Solar plant updated successfully.', 'success');
        setIsEditModalOpen(false);
      } else {
        await api.post(`/companies/${companyId}/solar/plants`, formData);
        showToast?.('Solar plant created successfully.', 'success');
        setIsAddModalOpen(false);
      }
      fetchPlants();
    } catch (err) {
      showToast?.(err.message || 'Failed to save solar plant', 'error');
    }
  };

  // API Config Modal
  const handleOpenConfig = async (plant) => {
    setSelectedPlant(plant);
    setTestResult(null);
    setIsConfigModalOpen(true);
    try {
      setConfigLoading(true);
      const res = await api.get(`/companies/${companyId}/solar/plants/${plant.id}/api-config`);
      if (res.success && res.data) {
        setApiConfig({
          provider: res.data.provider || 'UNIVERSAL',
          baseUrl: res.data.baseUrl || '',
          authType: res.data.authType || 'API_KEY',
          apiKey: res.data.maskedApiKey || '',
          apiSecret: res.data.maskedApiSecret || '',
          accessToken: res.data.maskedAccessToken || '',
          pollingIntervalMinutes: res.data.pollingIntervalMinutes || 15,
          isPollingEnabled: Boolean(res.data.isPollingEnabled),
          isWebhookEnabled: res.data.isWebhookEnabled !== undefined ? Boolean(res.data.isWebhookEnabled) : true,
          webhookUrl: res.data.webhookUrl || '',
          status: res.data.status,
          lastSyncAt: res.data.lastSyncAt,
          lastSyncStatus: res.data.lastSyncStatus,
        });
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to load API configuration', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedPlant) return;
    try {
      setConfigLoading(true);
      await api.post(`/companies/${companyId}/solar/plants/${selectedPlant.id}/api-config`, apiConfig);
      showToast?.('API configuration saved successfully.', 'success');
      setIsConfigModalOpen(false);
      fetchPlants();
    } catch (err) {
      showToast?.(err.message || 'Failed to save API configuration', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedPlant) return;
    try {
      setTestingConnection(true);
      setTestResult(null);
      const res = await api.post(`/companies/${companyId}/solar/plants/${selectedPlant.id}/api-config/test`, {});
      setTestResult(res.data || res);
      if (res.data?.success) {
        showToast?.('Connection test passed successfully!', 'success');
      } else {
        showToast?.(res.data?.error || 'Connection failed', 'warning');
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      showToast?.(err.message || 'Connection test failed', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const totalDcCapacity = plants.reduce((sum, p) => sum + (Number(p.capacityDcKw) || 0), 0);
  const totalAcCapacity = plants.reduce((sum, p) => sum + (Number(p.capacityAcKw) || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Solar Plants</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{plants.length}</div>
          <div className="text-xs text-slate-500 mt-1">Operational plant facilities</div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">Installed DC Capacity</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{totalDcCapacity.toLocaleString()} kWp</div>
          <div className="text-xs text-slate-500 mt-1">Cumulative peak panel capacity</div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Rated AC Inverter Capacity</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{totalAcCapacity.toLocaleString()} kW</div>
          <div className="text-xs text-slate-500 mt-1">Grid feed-in maximum rating</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <IconSearch className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search plants by name, code, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition"
        >
          <IconPlus size={16} /> Add Solar Plant
        </button>
      </div>

      {/* Plants Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading solar plants...</div>
        ) : plants.length === 0 ? (
          <EmptyState
            icon={IconSun}
            title="No Solar Plants Found"
            description="Create your first solar plant master record to begin monitoring inverters and energy generation."
            actionLabel="Add Solar Plant"
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Plant Code / Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">DC Capacity</th>
                  <th className="py-3 px-4">AC Capacity</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Inverters</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">API Sync</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plants.map((plant) => (
                  <tr key={plant.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{plant.name}</div>
                      <div className="text-xs text-amber-600 font-mono">{plant.code}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {plant.plantType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {Number(plant.capacityDcKw).toLocaleString()} kWp
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {Number(plant.capacityAcKw).toLocaleString()} kW
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {plant.city ? `${plant.city}, ${plant.state || ''}` : 'Location Not Set'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-semibold text-xs">
                      {plant._count?.inverters || 0} Inverters
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          plant.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : plant.status === 'MAINTENANCE'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {plant.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {plant.apiConfig ? (
                        <span className="text-indigo-600 font-medium">
                          {plant.apiConfig.provider} ({plant.apiConfig.status})
                        </span>
                      ) : (
                        <span className="text-slate-400">Manual / Not Linked</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenConfig(plant)}
                        className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md transition"
                      >
                        API Config
                      </button>
                      <button
                        onClick={() => handleOpenEdit(plant)}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Plant Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }}
          title={isEditModalOpen ? 'Edit Solar Plant' : 'Add New Solar Plant Master'}
        >
          <form onSubmit={handleSavePlant} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Plant Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Factory Rooftop Plant A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Plant Code *</label>
                <input
                  type="text"
                  required
                  disabled={isEditModalOpen}
                  placeholder="e.g. SOL-ROOF-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Installed DC Capacity (kWp) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="250.0"
                  value={formData.capacityDcKw}
                  onChange={(e) => setFormData({ ...formData, capacityDcKw: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rated AC Capacity (kW) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="200.0"
                  value={formData.capacityAcKw}
                  onChange={(e) => setFormData({ ...formData, capacityAcKw: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Plant Type</label>
                <select
                  value={formData.plantType}
                  onChange={(e) => setFormData({ ...formData, plantType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="ROOFTOP_INDUSTRIAL">Industrial Rooftop</option>
                  <option value="ROOFTOP_COMMERCIAL">Commercial Rooftop</option>
                  <option value="GROUND_MOUNT">Ground Mounted Solar</option>
                  <option value="HYBRID">Hybrid Solar + BESS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Commissioning Date</label>
                <input
                  type="date"
                  value={formData.commissionDate}
                  onChange={(e) => setFormData({ ...formData, commissionDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Surat"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Grid Voltage</label>
                <input
                  type="text"
                  placeholder="e.g. 415 V (3-Phase) or 11 kV"
                  value={formData.gridVoltage}
                  onChange={(e) => setFormData({ ...formData, gridVoltage: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Address & Location Details</label>
              <textarea
                rows={2}
                placeholder="Plot/Survey number, building name, physical location..."
                value={formData.locationAddress}
                onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg"
              >
                {isEditModalOpen ? 'Update Plant' : 'Save Plant'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* API Configuration Modal */}
      {isConfigModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsConfigModalOpen(false)}
          title={`Solar Inverter API Integration: ${selectedPlant?.name}`}
        >
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Provider-Independent Architecture:</strong> Supports cloud polling and HTTP webhook ingestion. Credentials are encrypted with AES-256-GCM.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Inverter / Cloud Platform</label>
                <select
                  value={apiConfig.provider}
                  onChange={(e) => setApiConfig({ ...apiConfig, provider: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="UNIVERSAL">Universal / Open JSON Telemetry</option>
                  <option value="SUNGROW">Sungrow (iSolarCloud API)</option>
                  <option value="SOLIS">Solis / Ginlong Cloud API</option>
                  <option value="GROWATT">Growatt ShineServer API</option>
                  <option value="HUAWEI">Huawei FusionSolar API</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Authentication Type</label>
                <select
                  value={apiConfig.authType}
                  onChange={(e) => setApiConfig({ ...apiConfig, authType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="API_KEY">API Key / Header Secret</option>
                  <option value="BEARER_TOKEN">Bearer Token</option>
                  <option value="OAUTH2">OAuth 2.0 Client Credentials</option>
                  <option value="WEBHOOK_HMAC">Universal Webhook Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">API Base URL</label>
                <input
                  type="text"
                  placeholder="https://api.manufacturer.com/v1"
                  value={apiConfig.baseUrl}
                  onChange={(e) => setApiConfig({ ...apiConfig, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Polling Interval (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={apiConfig.pollingIntervalMinutes}
                  onChange={(e) => setApiConfig({ ...apiConfig, pollingIntervalMinutes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">API Key / Token (Masked)</label>
                <input
                  type="password"
                  placeholder="Enter API Key or leave masked"
                  value={apiConfig.apiKey}
                  onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">API Secret / Secret Token (Masked)</label>
                <input
                  type="password"
                  placeholder="Enter API Secret or leave masked"
                  value={apiConfig.apiSecret}
                  onChange={(e) => setApiConfig({ ...apiConfig, apiSecret: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            {/* Ingestion Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apiConfig.isPollingEnabled}
                  onChange={(e) => setApiConfig({ ...apiConfig, isPollingEnabled: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                Enable Background Polling (Pulls telemetry automatically)
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apiConfig.isWebhookEnabled}
                  onChange={(e) => setApiConfig({ ...apiConfig, isWebhookEnabled: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                Enable Inbound Webhook (Accepts telemetry HTTP POST pushes)
              </label>
            </div>

            {/* Webhook Endpoint Display */}
            {apiConfig.webhookUrl && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-xs font-bold text-slate-600">Your Plant Webhook Ingestion URL:</div>
                <div className="text-xs font-mono text-slate-900 bg-white p-2 border border-slate-200 rounded break-all select-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}{apiConfig.webhookUrl}
                </div>
              </div>
            )}

            {/* Live Test Connection */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                disabled={testingConnection}
                onClick={handleTestConnection}
                className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
              >
                {testingConnection ? 'Testing Connection...' : '⚡ Test API Connection'}
              </button>

              {testResult && (
                <span className={`text-xs font-bold flex items-center gap-1 ${testResult.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {testResult.success ? <IconCheckCircle size={14} /> : <IconAlertTriangle size={14} />}
                  {testResult.success ? 'Connected Successfully' : (testResult.error || 'Failed')}
                </span>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={configLoading}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
              >
                {configLoading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

