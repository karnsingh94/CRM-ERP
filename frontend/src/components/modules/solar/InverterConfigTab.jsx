'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { IconCpu, IconPlus, IconSearch, IconCheckCircle, IconAlertTriangle } from '@/components/ui/Icons';

export default function InverterConfigTab({ companyId, showToast }) {
  const [inverters, setInverters] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInverter, setSelectedInverter] = useState(null);

  const [formData, setFormData] = useState({
    plantId: '',
    inverterCode: '',
    make: '',
    model: '',
    serialNumber: '',
    ratedCapacityKw: '',
    maxDcPowerKw: '',
    mpptChannels: 2,
    stringsPerMppt: 2,
    ipAddress: '',
    modbusAddress: '',
    gatewayId: '',
    status: 'OFFLINE',
  });

  const fetchPlants = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/solar/plants`);
      if (res.success) {
        setPlants(res.data || []);
      }
    } catch (err) {
      // Non-blocking
    }
  }, [companyId]);

  const fetchInverters = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      let url = `/companies/${companyId}/solar/inverters?`;
      if (selectedPlantId) {
        url = `/companies/${companyId}/solar/plants/${selectedPlantId}/inverters?`;
      }
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const res = await api.get(`${url}${params.toString()}`);
      if (res.success) {
        setInverters(res.data || []);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to load inverters', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedPlantId, search, showToast]);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  useEffect(() => {
    fetchInverters();
  }, [fetchInverters]);

  const handleOpenAdd = () => {
    setFormData({
      plantId: selectedPlantId || (plants[0]?.id || ''),
      inverterCode: `INV-0${inverters.length + 1}`,
      make: 'Sungrow',
      model: 'SG60KTL',
      serialNumber: '',
      ratedCapacityKw: '60.0',
      maxDcPowerKw: '75.0',
      mpptChannels: 6,
      stringsPerMppt: 2,
      ipAddress: '',
      modbusAddress: '1',
      gatewayId: '',
      status: 'OFFLINE',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (inv) => {
    setSelectedInverter(inv);
    setFormData({
      plantId: inv.plantId,
      inverterCode: inv.inverterCode,
      make: inv.make,
      model: inv.model,
      serialNumber: inv.serialNumber,
      ratedCapacityKw: inv.ratedCapacityKw,
      maxDcPowerKw: inv.maxDcPowerKw || '',
      mpptChannels: inv.mpptChannels || 1,
      stringsPerMppt: inv.stringsPerMppt || '',
      ipAddress: inv.ipAddress || '',
      modbusAddress: inv.modbusAddress || '',
      gatewayId: inv.gatewayId || '',
      status: inv.status || 'OFFLINE',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveInverter = async (e) => {
    e.preventDefault();
    if (!formData.plantId || !formData.inverterCode || !formData.make || !formData.model || !formData.serialNumber || !formData.ratedCapacityKw) {
      showToast?.('Please fill all required fields.', 'error');
      return;
    }

    try {
      if (isEditModalOpen && selectedInverter) {
        await api.put(`/companies/${companyId}/solar/inverters/${selectedInverter.id}`, formData);
        showToast?.('Inverter updated successfully.', 'success');
        setIsEditModalOpen(false);
      } else {
        await api.post(`/companies/${companyId}/solar/plants/${formData.plantId}/inverters`, formData);
        showToast?.('Inverter added successfully.', 'success');
        setIsAddModalOpen(false);
      }
      fetchInverters();
    } catch (err) {
      showToast?.(err.message || 'Failed to save inverter', 'error');
    }
  };

  const totalRatedKw = inverters.reduce((sum, i) => sum + (Number(i.ratedCapacityKw) || 0), 0);
  const onlineCount = inverters.filter((i) => ['ONLINE', 'NORMAL'].includes(String(i.status).toUpperCase())).length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Configured Inverters</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{inverters.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total hardware string/central units</div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Online &amp; Normal</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{onlineCount} / {inverters.length}</div>
          <div className="text-xs text-slate-500 mt-1">Actively communicating with cloud</div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Total Inverter Rating</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">{totalRatedKw.toLocaleString()} kW</div>
          <div className="text-xs text-slate-500 mt-1">Cumulative AC rated power output</div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Plants</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-60">
            <IconSearch className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search code, make, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          disabled={plants.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
        >
          <IconPlus size={16} /> Add Inverter
        </button>
      </div>

      {/* Inverters Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading inverters...</div>
        ) : inverters.length === 0 ? (
          <EmptyState
            icon={IconCpu}
            title="No Inverters Configured"
            description="Add solar inverters linked to your plants to track string power and generation metrics."
            actionLabel={plants.length > 0 ? 'Add Inverter' : 'Create Plant First'}
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Inverter Code</th>
                  <th className="py-3 px-4">Solar Plant</th>
                  <th className="py-3 px-4">Make / Model</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Rated AC Power</th>
                  <th className="py-3 px-4">MPPT Channels</th>
                  <th className="py-3 px-4">Communication</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inverters.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                      {inv.inverterCode}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {inv.plant?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-800 text-xs">
                      <span className="font-semibold">{inv.make}</span> {inv.model}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                      {inv.serialNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {Number(inv.ratedCapacityKw).toLocaleString()} kW
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {inv.mpptChannels} MPPTs {inv.stringsPerMppt ? `(${inv.stringsPerMppt} str/ch)` : ''}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {inv.ipAddress ? inv.ipAddress : inv.modbusAddress ? `Modbus #${inv.modbusAddress}` : 'Cloud Gateway'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ['ONLINE', 'NORMAL'].includes(String(inv.status).toUpperCase())
                            ? 'bg-emerald-50 text-emerald-700'
                            : inv.status === 'FAULT'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(inv)}
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

      {/* Add / Edit Inverter Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }}
          title={isEditModalOpen ? `Edit Inverter: ${selectedInverter?.inverterCode}` : 'Add Solar Inverter'}
        >
          <form onSubmit={handleSaveInverter} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Solar Plant *</label>
                <select
                  disabled={isEditModalOpen}
                  value={formData.plantId}
                  onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-100"
                >
                  <option value="">Select Plant</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Inverter Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-A-01"
                  value={formData.inverterCode}
                  onChange={(e) => setFormData({ ...formData, inverterCode: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Manufacturer / Make *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sungrow, Solis, Growatt, Huawei"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Model Name / Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SG60KTL or SOL-50K"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Serial Number *</label>
                <input
                  type="text"
                  required
                  placeholder="Unique Hardware Serial No."
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rated AC Capacity (kW) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. 60.0"
                  value={formData.ratedCapacityKw}
                  onChange={(e) => setFormData({ ...formData, ratedCapacityKw: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">MPPT Channels Count</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formData.mpptChannels}
                  onChange={(e) => setFormData({ ...formData, mpptChannels: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Strings per MPPT</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={formData.stringsPerMppt}
                  onChange={(e) => setFormData({ ...formData, stringsPerMppt: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IP Address (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.101"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="ONLINE">Online / Normal</option>
                  <option value="STANDBY">Standby</option>
                  <option value="FAULT">Fault / Error</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </div>
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
                {isEditModalOpen ? 'Update Inverter' : 'Save Inverter'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

