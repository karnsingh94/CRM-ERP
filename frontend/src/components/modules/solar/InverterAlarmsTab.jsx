'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  CheckCircle,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  ShieldAlert,
  Info
} from './solarIcons';

export default function InverterAlarmsTab({ companyId, showToast, onNavigateToTicket }) {
  const [alarms, setAlarms] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [plantFilter, setPlantFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Forms
  const [raiseForm, setRaiseForm] = useState({
    plantId: '',
    inverterId: '',
    alarmCode: 'INV-GRID-OVERVOLT',
    severity: 'WARNING',
    category: 'GRID',
    description: 'Grid voltage exceeded upper threshold.'
  });
  const [invertersForPlant, setInvertersForPlant] = useState([]);
  const [ackNotes, setAckNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // 1. Fetch Plants List
  const fetchPlants = async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/solar/plants`);
      const list = res.data?.data?.plants || res.data?.plants || [];
      setPlants(list);
    } catch (err) {
      console.error('Failed to load plants:', err);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, [companyId]);

  // 2. Fetch Alarms
  const fetchAlarms = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = {};
      if (plantFilter) params.plantId = plantFilter;
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get(`/companies/${companyId}/solar/alarms`, { params });
      setAlarms(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load alarms:', err);
      showToast?.('error', 'Failed to retrieve alarms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();
  }, [companyId, plantFilter, severityFilter, statusFilter]);

  // When plant is selected in raise modal, load its inverters
  const handlePlantChangeInRaiseModal = async (plantId) => {
    setRaiseForm({ ...raiseForm, plantId, inverterId: '' });
    if (!plantId) {
      setInvertersForPlant([]);
      return;
    }
    try {
      const res = await api.get(`/companies/${companyId}/solar/plants/${plantId}/inverters`);
      const list = res.data?.data?.inverters || res.data?.inverters || [];
      setInvertersForPlant(list);
      if (list.length > 0) {
        setRaiseForm((prev) => ({ ...prev, plantId, inverterId: list[0].id }));
      }
    } catch (err) {
      console.error('Failed to load plant inverters:', err);
    }
  };

  // Actions
  const handleRaiseAlarm = async (e) => {
    e.preventDefault();
    if (!raiseForm.plantId || !raiseForm.inverterId) {
      showToast?.('error', 'Please select both Plant and Inverter');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/companies/${companyId}/solar/alarms`, raiseForm);
      if (res.data?.isDuplicate) {
        showToast?.('warning', 'An active alarm with this code is already open for this inverter.');
      } else {
        showToast?.('success', 'Alarm raised and notifications dispatched');
      }
      setShowRaiseModal(false);
      fetchAlarms();
    } catch (err) {
      console.error('Failed to raise alarm:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to raise alarm');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedAlarm) return;
    setActionLoading(true);
    try {
      await api.put(`/companies/${companyId}/solar/alarms/${selectedAlarm.id}/acknowledge`, {
        notes: ackNotes
      });
      showToast?.('success', `Alarm ${selectedAlarm.alarmCode} acknowledged`);
      setShowAcknowledgeModal(false);
      fetchAlarms();
    } catch (err) {
      console.error('Failed to acknowledge alarm:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to acknowledge alarm');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedAlarm) return;
    setActionLoading(true);
    try {
      await api.put(`/companies/${companyId}/solar/alarms/${selectedAlarm.id}/resolve`, {
        resolutionNotes
      });
      showToast?.('success', `Alarm ${selectedAlarm.alarmCode} resolved successfully`);
      setShowResolveModal(false);
      fetchAlarms();
    } catch (err) {
      console.error('Failed to resolve alarm:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to resolve alarm');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered alarms
  const filteredAlarms = alarms.filter((a) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.alarmCode?.toLowerCase().includes(query) ||
      a.description?.toLowerCase().includes(query) ||
      a.inverter?.inverterCode?.toLowerCase().includes(query) ||
      a.plant?.name?.toLowerCase().includes(query)
    );
  });

  // Severity counts
  const criticalCount = alarms.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
  const warningCount = alarms.filter((a) => a.severity === 'WARNING' && a.status !== 'RESOLVED').length;
  const activeCount = alarms.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Inverter Alarms & Operational Faults
            </h2>
            {criticalCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 animate-pulse">
                {criticalCount} Critical
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Track real-time hardware faults, grid anomalies, thermal trips, and dispatch maintenance actions.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchAlarms}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => {
              if (plants.length > 0) {
                handlePlantChangeInRaiseModal(plants[0].id);
              }
              setShowRaiseModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Raise Fault Alarm
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Critical Unresolved</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          <p className="text-xs text-gray-400 mt-1">Immediate field technician dispatch required</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Warning State</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
          <p className="text-xs text-gray-400 mt-1">Sub-optimal operation or threshold warning</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active (Unacknowledged)</span>
            <Bell className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{activeCount}</div>
          <p className="text-xs text-gray-400 mt-1">Awaiting control room acknowledgment</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search code, description, unit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />

          {/* Plant Filter */}
          <select
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Plants</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>

      {/* Alarms Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-semibold border-b">
                <th className="py-3 px-4">Severity & Code</th>
                <th className="py-3 px-4">Plant & Inverter</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Triggered Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Checking active alarm registers...
                  </td>
                </tr>
              ) : filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <CheckCircle className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                    No active or historical alarms matching filter. All systems normal.
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((a) => {
                  const isCrit = a.severity === 'CRITICAL';
                  const isWarn = a.severity === 'WARNING';

                  return (
                    <tr key={a.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                              isCrit
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : isWarn
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {a.severity}
                          </span>
                          <span className="font-mono font-bold text-gray-800 text-xs">
                            {a.alarmCode}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 capitalize">{a.category?.toLowerCase() || 'inverter'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{a.inverter?.inverterCode}</div>
                        <div className="text-xs text-gray-500">{a.plant?.name}</div>
                      </td>

                      <td className="py-3 px-4 text-gray-700 max-w-xs truncate" title={a.description}>
                        {a.description}
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-500 font-mono">
                        {new Date(a.triggeredAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            a.status === 'ACTIVE'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : a.status === 'ACKNOWLEDGED'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {a.maintenanceTicket ? (
                          <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {a.maintenanceTicket.ticketNo}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1">
                        {a.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setSelectedAlarm(a);
                              setAckNotes('');
                              setShowAcknowledgeModal(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded font-medium border border-amber-200 transition"
                          >
                            Acknowledge
                          </button>
                        )}

                        {a.status !== 'RESOLVED' && (
                          <button
                            onClick={() => {
                              setSelectedAlarm(a);
                              setResolutionNotes('');
                              setShowResolveModal(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-medium border border-emerald-200 transition"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raise Alarm Modal */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Raise Inverter Fault Alarm
            </h3>

            <form onSubmit={handleRaiseAlarm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Solar Plant *
                </label>
                <select
                  required
                  value={raiseForm.plantId}
                  onChange={(e) => handlePlantChangeInRaiseModal(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Plant</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Inverter Unit *
                </label>
                <select
                  required
                  value={raiseForm.inverterId}
                  onChange={(e) => setRaiseForm({ ...raiseForm, inverterId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Inverter</option>
                  {invertersForPlant.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.inverterCode} ({inv.make} {inv.model})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Severity *
                  </label>
                  <select
                    value={raiseForm.severity}
                    onChange={(e) => setRaiseForm({ ...raiseForm, severity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={raiseForm.category}
                    onChange={(e) => setRaiseForm({ ...raiseForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="GRID">GRID</option>
                    <option value="PV">PV / STRING</option>
                    <option value="THERMAL">THERMAL</option>
                    <option value="HARDWARE">HARDWARE</option>
                    <option value="COMMUNICATION">COMMUNICATION</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Alarm Code *
                </label>
                <input
                  type="text"
                  required
                  value={raiseForm.alarmCode}
                  onChange={(e) => setRaiseForm({ ...raiseForm, alarmCode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. INV-ERR-OVERTEMP"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Fault Description *
                </label>
                <textarea
                  rows="3"
                  required
                  value={raiseForm.description}
                  onChange={(e) => setRaiseForm({ ...raiseForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Describe the detected condition or error..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Raising...' : 'Raise Alarm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Acknowledge Modal */}
      {showAcknowledgeModal && selectedAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Acknowledge Alarm</h3>
            <p className="text-xs text-gray-500 mb-4">
              Mark <span className="font-mono font-bold text-gray-700">{selectedAlarm.alarmCode}</span> on {selectedAlarm.inverter?.inverterCode} as acknowledged by the operations team.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                Optional Notes
              </label>
              <textarea
                rows="3"
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Technician John dispatched to check inverter AC disconnect..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAcknowledgeModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={actionLoading}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Confirm Acknowledgment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedAlarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Resolve Alarm
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Close fault alarm <span className="font-mono font-bold text-gray-700">{selectedAlarm.alarmCode}</span>.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                Resolution Notes / Root Cause Action *
              </label>
              <textarea
                rows="3"
                required
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Cleaned air filters and reset cooling fan relay; inverter normal."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolve}
                disabled={actionLoading || !resolutionNotes.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
