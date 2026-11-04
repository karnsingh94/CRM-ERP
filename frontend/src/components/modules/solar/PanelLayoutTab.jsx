'use client';

import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  Layers,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Sun,
  Zap,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Cpu
} from './solarIcons';

export default function PanelLayoutTab({ companyId, showToast }) {
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [inverters, setInverters] = useState([]);
  const [strings, setStrings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inverterFilter, setInverterFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [saving, setSaving] = useState(false);
  const [activeString, setActiveString] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    inverterId: '',
    stringName: '',
    panelModel: '',
    panelWattageWp: 540,
    panelsCount: 24,
    mpptChannel: 'MPPT 1',
    tiltDegrees: 15,
    azimuthDegrees: 180,
    status: 'ACTIVE'
  });

  // 1. Fetch Plants List
  const fetchPlants = async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/solar/plants`);
      const list = res.data?.data?.plants || res.data?.plants || [];
      setPlants(list);
      if (list.length > 0 && !selectedPlantId) {
        setSelectedPlantId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch plants:', err);
      showToast?.('error', 'Failed to load solar plants');
    }
  };

  useEffect(() => {
    fetchPlants();
  }, [companyId]);

  // 2. Fetch Inverters and Strings for Selected Plant
  const fetchPlantData = async () => {
    if (!companyId || !selectedPlantId) return;
    setLoading(true);
    try {
      const [invRes, strRes] = await Promise.all([
        api.get(`/companies/${companyId}/solar/plants/${selectedPlantId}/inverters`),
        api.get(`/companies/${companyId}/solar/plants/${selectedPlantId}/strings`)
      ]);
      setInverters(invRes.data?.data?.inverters || invRes.data?.inverters || []);
      setStrings(strRes.data?.data?.strings || strRes.data?.strings || []);
    } catch (err) {
      console.error('Failed to load string layout:', err);
      showToast?.('error', 'Failed to load panel strings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPlantId) {
      fetchPlantData();
    }
  }, [companyId, selectedPlantId]);

  // Calculate Summary Metrics
  const metrics = useMemo(() => {
    const totalStrings = strings.length;
    let totalPanels = 0;
    let totalWatts = 0;
    let sumTilt = 0;

    strings.forEach((s) => {
      const pCount = Number(s.panelsCount) || 0;
      const pWatt = Number(s.panelWattageWp) || 0;
      totalPanels += pCount;
      totalWatts += pCount * pWatt;
      sumTilt += Number(s.tiltDegrees) || 0;
    });

    return {
      totalStrings,
      totalPanels,
      totalCapacityKwp: (totalWatts / 1000).toFixed(2),
      avgTilt: totalStrings > 0 ? (sumTilt / totalStrings).toFixed(1) : 0
    };
  }, [strings]);

  // Filtered Strings
  const filteredStrings = useMemo(() => {
    return strings.filter((s) => {
      const matchesSearch =
        s.stringName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.panelModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.mpptChannel?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesInverter = inverterFilter ? s.inverterId === inverterFilter : true;
      return matchesSearch && matchesInverter;
    });
  }, [strings, searchQuery, inverterFilter]);

  // Modal Handlers
  const handleOpenAdd = () => {
    setModalMode('add');
    setActiveString(null);
    setFormData({
      inverterId: inverters.length > 0 ? inverters[0].id : '',
      stringName: `STR-${strings.length + 1}`,
      panelModel: 'Mono PERC Bifacial 540W',
      panelWattageWp: 540,
      panelsCount: 24,
      mpptChannel: 'MPPT 1',
      tiltDegrees: 15,
      azimuthDegrees: 180,
      status: 'ACTIVE'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (stringItem) => {
    setModalMode('edit');
    setActiveString(stringItem);
    setFormData({
      inverterId: stringItem.inverterId || '',
      stringName: stringItem.stringName || '',
      panelModel: stringItem.panelModel || '',
      panelWattageWp: stringItem.panelWattageWp || 540,
      panelsCount: stringItem.panelsCount || 24,
      mpptChannel: stringItem.mpptChannel || 'MPPT 1',
      tiltDegrees: stringItem.tiltDegrees || 15,
      azimuthDegrees: stringItem.azimuthDegrees || 180,
      status: stringItem.status || 'ACTIVE'
    });
    setShowModal(true);
  };

  const handleSaveString = async (e) => {
    e.preventDefault();
    if (!formData.inverterId) {
      showToast?.('error', 'Please select an inverter');
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'add') {
        await api.post(`/companies/${companyId}/solar/plants/${selectedPlantId}/strings`, formData);
        showToast?.('success', 'Panel string created successfully');
      } else {
        await api.put(`/companies/${companyId}/solar/strings/${activeString.id}`, formData);
        showToast?.('success', 'Panel string updated successfully');
      }
      setShowModal(false);
      fetchPlantData();
    } catch (err) {
      console.error('Failed to save string:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to save panel string');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Plant Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            Panel Strings & Layout Architecture
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure solar panel string topology, module ratings, tilt, azimuth, and MPPT channels.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 font-medium"
          >
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.plantCode})
              </option>
            ))}
          </select>

          <button
            onClick={fetchPlantData}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={handleOpenAdd}
            disabled={inverters.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add String
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Strings</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{metrics.totalStrings}</div>
          <p className="text-xs text-gray-400 mt-1">Configured in selected plant</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total PV Modules</span>
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-800">{metrics.totalPanels}</div>
          <p className="text-xs text-gray-400 mt-1">Solar PV panels installed</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total DC Capacity</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{metrics.totalCapacityKwp} kWp</div>
          <p className="text-xs text-gray-400 mt-1">Aggregated peak string capacity</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Average Tilt</span>
            <Compass className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{metrics.avgTilt}°</div>
          <p className="text-xs text-gray-400 mt-1">Optimal irradiance angle</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search string, model, MPPT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={inverterFilter}
            onChange={(e) => setInverterFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Inverters</option>
            {inverters.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.inverterCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Strings Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-semibold border-b">
                <th className="py-3 px-4">String Identifier</th>
                <th className="py-3 px-4">Inverter & MPPT</th>
                <th className="py-3 px-4">PV Module Rating</th>
                <th className="py-3 px-4">Panel Count</th>
                <th className="py-3 px-4">String DC Peak</th>
                <th className="py-3 px-4">Tilt / Azimuth</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Loading string architecture...
                  </td>
                </tr>
              ) : filteredStrings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <Layers className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No panel strings found.
                    {inverters.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Please configure an inverter first before adding panel strings.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredStrings.map((s) => {
                  const kwp = (((Number(s.panelsCount) || 0) * (Number(s.panelWattageWp) || 0)) / 1000).toFixed(2);
                  const inv = inverters.find((i) => i.id === s.inverterId);

                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{s.stringName}</div>
                        <div className="text-xs text-gray-400">{s.panelModel || 'Standard PV'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-700 font-medium">
                          {inv ? inv.name : 'Unknown Inverter'}
                        </div>
                        <div className="text-xs text-amber-600 font-mono">
                          {s.mpptChannel || 'MPPT 1'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700">
                        {s.panelWattageWp} Wp
                      </td>
                      <td className="py-3 px-4 text-gray-800 font-medium">
                        {s.panelsCount} modules
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-emerald-600 font-mono">
                          {kwp} kWp
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 font-mono">
                        {s.tiltDegrees}° / {s.azimuthDegrees}°
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {s.status === 'ACTIVE' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 mr-1" />
                          )}
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                          title="Edit String"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit String Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {modalMode === 'add' ? 'Add Panel String' : 'Edit Panel String'}
            </h3>

            <form onSubmit={handleSaveString} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Inverter Mapping *
                </label>
                <select
                  required
                  value={formData.inverterId}
                  onChange={(e) => setFormData({ ...formData, inverterId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Inverter</option>
                  {inverters.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.inverterCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    String Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.stringName}
                    onChange={(e) => setFormData({ ...formData, stringName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. STR-01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    MPPT Channel
                  </label>
                  <input
                    type="text"
                    value={formData.mpptChannel}
                    onChange={(e) => setFormData({ ...formData, mpptChannel: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. MPPT 1 / Tracker A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Panel Model / Technology
                </label>
                <input
                  type="text"
                  value={formData.panelModel}
                  onChange={(e) => setFormData({ ...formData, panelModel: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Mono PERC Bifacial 540W"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Panel Wattage (Wp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.panelWattageWp}
                    onChange={(e) => setFormData({ ...formData, panelWattageWp: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Panels Count in String *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.panelsCount}
                    onChange={(e) => setFormData({ ...formData, panelsCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-800 flex justify-between items-center font-mono">
                <span>Calculated Peak DC Capacity:</span>
                <span className="font-bold text-sm">
                  {(((formData.panelsCount || 0) * (formData.panelWattageWp || 0)) / 1000).toFixed(2)} kWp
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Tilt (°)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.tiltDegrees}
                    onChange={(e) => setFormData({ ...formData, tiltDegrees: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Azimuth (°)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.azimuthDegrees}
                    onChange={(e) => setFormData({ ...formData, azimuthDegrees: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : modalMode === 'add' ? 'Create String' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
