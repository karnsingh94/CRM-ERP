'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Check,
  TrendingDown
} from './solarIcons';

export default function CleaningSchedulesTab({ companyId, showToast }) {
  const [plants, setPlants] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [plantFilter, setPlantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State - Create
  const [formData, setFormData] = useState({
    plantId: '',
    arrayBlock: 'Block A - Rows 1 to 10',
    frequency: 'FORTNIGHTLY',
    nextDueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    inspectorId: ''
  });

  // Form State - Complete
  const [completeForm, setCompleteForm] = useState({
    waterUsedLiters: 1500,
    soilingLossEstimatedPercent: 2.5,
    cleaningMethod: 'MANUAL_WASH',
    inspectionRemarks: 'Washed and wiped panels; visual inspection clear of microcracks.'
  });

  // 1. Fetch Plants and Employees
  const fetchMetadata = async () => {
    if (!companyId) return;
    try {
      const [plantRes, empRes] = await Promise.all([
        api.get(`/companies/${companyId}/solar/plants`),
        api.get(`/companies/${companyId}/hrms/employees`).catch(() => ({ data: { data: [] } }))
      ]);

      const plantList = plantRes.data?.data?.plants || plantRes.data?.plants || [];
      setPlants(plantList);
      if (plantList.length > 0 && !formData.plantId) {
        setFormData((prev) => ({ ...prev, plantId: plantList[0].id }));
      }

      const empList = empRes.data?.data?.employees || empRes.data?.data || [];
      setEmployees(empList);
    } catch (err) {
      console.error('Failed to load cleaning metadata:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [companyId]);

  // 2. Fetch Schedules
  const fetchSchedules = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = {};
      if (plantFilter) params.plantId = plantFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get(`/companies/${companyId}/solar/cleaning`, { params });
      setSchedules(res.data?.data?.schedules || res.data?.schedules || res.data?.data || []);
    } catch (err) {
      console.error('Failed to load cleaning schedules:', err);
      showToast?.('error', 'Failed to retrieve cleaning schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [companyId, plantFilter, statusFilter]);

  // Handle Create Schedule
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.plantId || !formData.arrayBlock) {
      showToast?.('error', 'Please fill required fields');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/companies/${companyId}/solar/cleaning`, formData);
      showToast?.('success', 'Cleaning schedule created successfully');
      setShowCreateModal(false);
      fetchSchedules();
    } catch (err) {
      console.error('Failed to create schedule:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to create schedule');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Complete Cleaning Cycle
  const handleComplete = async (e) => {
    e.preventDefault();
    if (!selectedSchedule) return;
    setActionLoading(true);
    try {
      await api.put(`/companies/${companyId}/solar/cleaning/${selectedSchedule.id}/complete`, completeForm);
      showToast?.('success', 'Cleaning cycle marked as completed. Next due date updated.');
      setShowCompleteModal(false);
      fetchSchedules();
    } catch (err) {
      console.error('Failed to complete cleaning cycle:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to complete cleaning');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered schedules
  const filtered = schedules.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.arrayBlock?.toLowerCase().includes(q) ||
      s.plant?.name?.toLowerCase().includes(q) ||
      s.inspectorName?.toLowerCase().includes(q)
    );
  });

  const overdueCount = schedules.filter((s) => s.isOverdue).length;
  const scheduledCount = schedules.filter((s) => s.status === 'SCHEDULED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Solar PV Cleaning & Soiling Management
            </h2>
            {overdueCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                {overdueCount} Overdue Wash Cycles
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Automate panel washing cycles, monitor soiling loss recovery, water conservation, and assign inspectors.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchSchedules}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Schedule Cleaning
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Pending Scheduled</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{scheduledCount}</div>
          <p className="text-xs text-gray-400 mt-1">Blocks awaiting upcoming wash cycle</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Overdue Washes</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
          <p className="text-xs text-gray-400 mt-1">Past due date — soiling loss accumulating</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Water Optimization</span>
            <Droplets className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">Eco-Wash</div>
          <p className="text-xs text-gray-400 mt-1">Consolidated water consumption tracking</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search block, plant, inspector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-semibold border-b">
                <th className="py-3 px-4">Array Block / Area</th>
                <th className="py-3 px-4">Plant</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Next Due Date</th>
                <th className="py-3 px-4">Last Cleaned</th>
                <th className="py-3 px-4">Water (L) / Soiling %</th>
                <th className="py-3 px-4">Inspector</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Loading cleaning schedules...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-gray-400">
                    <Sparkles className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No cleaning schedules found. Click "Schedule Cleaning" to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80 transition">
                    <td className="py-3 px-4 font-semibold text-gray-800">
                      {s.arrayBlock}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs font-medium">
                      {s.plant?.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {s.frequency}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        {new Date(s.nextDueDate).toLocaleDateString()}
                        {s.isOverdue && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            OVERDUE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 font-mono">
                      {s.lastCleanedDate ? new Date(s.lastCleanedDate).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-700">
                      {s.waterUsedLiters ? `${s.waterUsedLiters} L` : '--'}
                      {s.soilingLossEstimatedPercent !== null && (
                        <span className="text-amber-600 ml-1.5">
                          ({s.soilingLossEstimatedPercent}% soiling)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {s.inspectorName || s.inspector?.name || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          s.status === 'SCHEDULED'
                            ? s.isOverdue
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {s.status === 'SCHEDULED' && (
                        <button
                          onClick={() => {
                            setSelectedSchedule(s);
                            setShowCompleteModal(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-medium border border-emerald-200 transition"
                        >
                          Mark Completed
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Create Solar Array Cleaning Schedule
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Solar Plant *
                </label>
                <select
                  required
                  value={formData.plantId}
                  onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Plant</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.plantCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Array Block / Section *
                </label>
                <input
                  type="text"
                  required
                  value={formData.arrayBlock}
                  onChange={(e) => setFormData({ ...formData, arrayBlock: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Block A - Strings 01 to 20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Cleaning Frequency *
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="WEEKLY">WEEKLY (7 Days)</option>
                    <option value="FORTNIGHTLY">FORTNIGHTLY (14 Days)</option>
                    <option value="MONTHLY">MONTHLY (30 Days)</option>
                    <option value="QUARTERLY">QUARTERLY (90 Days)</option>
                    <option value="ON_DEMAND">ON DEMAND</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    First Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.nextDueDate}
                    onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Assigned Cleaning Inspector / Technician
                </label>
                <select
                  value={formData.inspectorId}
                  onChange={(e) => setFormData({ ...formData, inspectorId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Unassigned (Open Pool)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Cleaning Cycle Modal */}
      {showCompleteModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Complete Cleaning Cycle — {selectedSchedule.arrayBlock}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Recording completion will automatically advance the next scheduled cleaning date by frequency ({selectedSchedule.frequency}).
            </p>

            <form onSubmit={handleComplete} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Water Consumed (Liters)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={completeForm.waterUsedLiters}
                    onChange={(e) => setCompleteForm({ ...completeForm, waterUsedLiters: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Observed Soiling Loss (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={completeForm.soilingLossEstimatedPercent}
                    onChange={(e) => setCompleteForm({ ...completeForm, soilingLossEstimatedPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Cleaning Method Used
                </label>
                <select
                  value={completeForm.cleaningMethod}
                  onChange={(e) => setCompleteForm({ ...completeForm, cleaningMethod: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="MANUAL_WASH">Manual Pressure Wash & Squeegee</option>
                  <option value="ROBOTIC">Semi-Automated / Robotic Cleaner</option>
                  <option value="DRY_BRUSH">Dry Microfiber Dusting (Waterless)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Inspection Remarks & Module Observations
                </label>
                <textarea
                  rows="3"
                  value={completeForm.inspectionRemarks}
                  onChange={(e) => setCompleteForm({ ...completeForm, inspectionRemarks: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Confirm Completion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
