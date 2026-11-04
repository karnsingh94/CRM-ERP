'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  User,
  Package,
  Layers,
  FileText,
  AlertTriangle,
  ChevronRight,
  ExternalLink
} from './solarIcons';

export default function MaintenanceTicketsTab({ companyId, showToast, onNavigateToSpares }) {
  const [tickets, setTickets] = useState([]);
  const [plants, setPlants] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [plantFilter, setPlantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create Form State
  const [formData, setFormData] = useState({
    plantId: '',
    inverterId: '',
    category: 'INVERTER',
    priority: 'MEDIUM',
    subject: '',
    description: '',
    assignedTechnicianId: ''
  });
  const [invertersForPlant, setInvertersForPlant] = useState([]);

  // Detail / Update Form State
  const [updateForm, setUpdateForm] = useState({
    status: '',
    assignedTechnicianId: '',
    priority: '',
    rootCause: '',
    actionTaken: '',
    resolutionNotes: ''
  });

  // 1. Fetch Metadata (Plants & Employees)
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
      console.error('Failed to load tickets metadata:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [companyId]);

  // 2. Fetch Tickets
  const fetchTickets = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = {};
      if (plantFilter) params.plantId = plantFilter;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const res = await api.get(`/companies/${companyId}/solar/tickets`, { params });
      setTickets(res.data?.data?.tickets || res.data?.tickets || res.data?.data || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      showToast?.('error', 'Failed to retrieve maintenance tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [companyId, plantFilter, statusFilter, priorityFilter]);

  // When plant is selected in create modal, load inverters
  const handlePlantChangeInCreate = async (plantId) => {
    setFormData((prev) => ({ ...prev, plantId, inverterId: '' }));
    if (!plantId) {
      setInvertersForPlant([]);
      return;
    }
    try {
      const res = await api.get(`/companies/${companyId}/solar/plants/${plantId}/inverters`);
      setInvertersForPlant(res.data?.data?.inverters || res.data?.inverters || []);
    } catch (err) {
      console.error('Failed to load inverters:', err);
    }
  };

  // Open Details Modal
  const handleOpenDetail = (ticket) => {
    setSelectedTicket(ticket);
    setUpdateForm({
      status: ticket.status || 'OPEN',
      assignedTechnicianId: ticket.assignedTechnicianId || '',
      priority: ticket.priority || 'MEDIUM',
      rootCause: ticket.rootCause || '',
      actionTaken: ticket.actionTaken || '',
      resolutionNotes: ticket.resolutionNotes || ''
    });
    setShowDetailModal(true);
  };

  // Create Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.plantId || !formData.subject || !formData.description) {
      showToast?.('error', 'Please fill all required fields');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/companies/${companyId}/solar/tickets`, formData);
      showToast?.('success', 'Maintenance ticket logged successfully');
      setShowCreateModal(false);
      setFormData({
        plantId: plants.length > 0 ? plants[0].id : '',
        inverterId: '',
        category: 'INVERTER',
        priority: 'MEDIUM',
        subject: '',
        description: '',
        assignedTechnicianId: ''
      });
      fetchTickets();
    } catch (err) {
      console.error('Failed to create ticket:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Ticket Details
  const handleUpdateTicket = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      await api.put(`/companies/${companyId}/solar/tickets/${selectedTicket.id}`, updateForm);
      showToast?.('success', `Ticket ${selectedTicket.ticketNo} updated successfully`);
      setShowDetailModal(false);
      fetchTickets();
    } catch (err) {
      console.error('Failed to update ticket:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to update ticket');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered tickets
  const filtered = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.ticketNo?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.plant?.name?.toLowerCase().includes(q) ||
      t.technicianName?.toLowerCase().includes(q)
    );
  });

  const openCount = tickets.filter((t) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length;
  const criticalCount = tickets.filter((t) => t.priority === 'CRITICAL' && t.status !== 'RESOLVED').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-500" />
              Corrective Maintenance & Work Orders
            </h2>
            {criticalCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                {criticalCount} Critical Priority
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Dispatch field technicians, log root cause analyses, record repair actions, and issue inventory spares.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => {
              if (plants.length > 0) {
                handlePlantChangeInCreate(plants[0].id);
              }
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Work Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Work Orders</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{openCount}</div>
          <p className="text-xs text-gray-400 mt-1">Open, Assigned, or In Progress</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Critical Escalations</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          <p className="text-xs text-gray-400 mt-1">Generation-loss critical defects</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Phase 4 Inventory Integration</span>
            <Package className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">FIFO Active</div>
          <p className="text-xs text-gray-400 mt-1">Direct stock issuance backed by inventory</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search ticket #, subject, tech..."
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
            <option value="OPEN">OPEN</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-semibold border-b">
                <th className="py-3 px-4">Ticket #</th>
                <th className="py-3 px-4">Subject & Category</th>
                <th className="py-3 px-4">Plant & Equipment</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assigned Tech</th>
                <th className="py-3 px-4">Spares Consumed</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Loading maintenance work orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <Wrench className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No work orders found. Click "Create Work Order" to log a repair ticket.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const sparesCount = Array.isArray(t.sparePartsDetails) ? t.sparePartsDetails.length : 0;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleOpenDetail(t)}
                      className="hover:bg-gray-50/80 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-bold font-mono text-gray-800 text-xs">
                        {t.ticketNo}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{t.subject}</div>
                        <div className="text-xs text-gray-400 uppercase font-mono">{t.category}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-gray-700 font-medium text-xs">{t.plant?.name}</div>
                        <div className="text-xs text-gray-400">
                          {t.inverter?.inverterCode || 'General Array'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            t.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : t.priority === 'HIGH'
                              ? 'bg-orange-100 text-orange-800 border border-orange-200'
                              : t.priority === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-600">
                        {t.technicianName || t.assignedTechnician?.name || (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs font-mono">
                        {sparesCount > 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                            {sparesCount} parts issued
                          </span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            t.status === 'RESOLVED' || t.status === 'CLOSED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.status === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(t);
                          }}
                          className="p-1.5 text-gray-400 hover:text-amber-600 rounded transition"
                        >
                          <ChevronRight className="w-4 h-4" />
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

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-500" />
              Create Solar Maintenance Work Order
            </h3>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Solar Plant *
                </label>
                <select
                  required
                  value={formData.plantId}
                  onChange={(e) => handlePlantChangeInCreate(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Equipment / Inverter
                  </label>
                  <select
                    value={formData.inverterId}
                    onChange={(e) => setFormData({ ...formData, inverterId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Plant-Wide / None</option>
                    {invertersForPlant.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.inverterCode} ({inv.make})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="INVERTER">INVERTER</option>
                    <option value="MODULE">PV MODULE</option>
                    <option value="STRING_BOX">STRING / COMBINER BOX</option>
                    <option value="TRANSFORMER">TRANSFORMER</option>
                    <option value="GRID_TRIP">GRID / TRANSMISSION</option>
                    <option value="WEATHER_STATION">WEATHER / SENSOR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Priority *
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Assign Technician
                  </label>
                  <select
                    value={formData.assignedTechnicianId}
                    onChange={(e) => setFormData({ ...formData, assignedTechnicianId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Unassigned (Open Queue)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.designation || 'Technician'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Inverter INV-01 AC Contactors Disengaged"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Fault Details & Instructions *
                </label>
                <textarea
                  rows="3"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Describe failure symptoms, safety lockouts, or troubleshooting steps..."
                />
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
                  {actionLoading ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail & Status Update Drawer / Modal */}
      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                    {selectedTicket.ticketNo}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      selectedTicket.priority === 'CRITICAL'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {selectedTicket.priority}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mt-1">{selectedTicket.subject}</h3>
                <p className="text-xs text-gray-500">
                  {selectedTicket.plant?.name} • Equipment:{' '}
                  {selectedTicket.inverter?.inverterCode || 'General Plant'}
                </p>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <div className="py-4 border-b">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Description
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
            </div>

            {/* Spares Issued Section */}
            <div className="py-4 border-b">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-500" />
                  Spare Parts Issued (Phase 4 Inventory Integration)
                </span>
                {onNavigateToSpares && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      onNavigateToSpares();
                    }}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    Issue Spares in Inventory Tab <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {Array.isArray(selectedTicket.sparePartsDetails) &&
              selectedTicket.sparePartsDetails.length > 0 ? (
                <div className="space-y-2">
                  {selectedTicket.sparePartsDetails.map((part, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border bg-gray-50 flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-semibold text-gray-800">{part.productName || part.sku}</span>
                        <div className="text-gray-500 font-mono">
                          Movement #{part.movementNumber} • {part.quantity} units issued
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-emerald-600">
                        ₹{Number(part.totalCost || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No spare parts issued to this ticket yet.</p>
              )}
            </div>

            {/* Status & Resolution Form */}
            <form onSubmit={handleUpdateTicket} className="pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Lifecycle Status
                  </label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Technician
                  </label>
                  <select
                    value={updateForm.assignedTechnicianId}
                    onChange={(e) =>
                      setUpdateForm({ ...updateForm, assignedTechnicianId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={updateForm.priority}
                    onChange={(e) => setUpdateForm({ ...updateForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Root Cause Diagnosis
                </label>
                <input
                  type="text"
                  value={updateForm.rootCause}
                  onChange={(e) => setUpdateForm({ ...updateForm, rootCause: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Dust clogging heat sink ventilation louvers."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Action Taken & Fixes
                </label>
                <input
                  type="text"
                  value={updateForm.actionTaken}
                  onChange={(e) => setUpdateForm({ ...updateForm, actionTaken: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Blown fuse replaced, fans power-cycled and verified."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Final Resolution Notes
                </label>
                <textarea
                  rows="2"
                  value={updateForm.resolutionNotes}
                  onChange={(e) => setUpdateForm({ ...updateForm, resolutionNotes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Detailed verification remarks before ticket closure..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Update Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
