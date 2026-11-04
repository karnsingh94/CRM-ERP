'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingDown,
  Warehouse
} from './solarIcons';

export default function SparesInventoryTab({ companyId, showToast }) {
  const [stocks, setStocks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [issueSuccessData, setIssueSuccessData] = useState(null);

  // Issue Form State
  const [issueForm, setIssueForm] = useState({
    ticketId: '',
    sku: '',
    quantity: 1,
    warehouse: 'Main Solar Warehouse'
  });

  // 1. Fetch Stocks from Phase 4 Inventory
  const fetchStocks = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [stocksRes, ticketsRes] = await Promise.all([
        api.get(`/companies/${companyId}/inventory/stocks`).catch((err) => {
          console.warn('Inventory stocks fetch error:', err);
          return { data: { data: [] } };
        }),
        api.get(`/companies/${companyId}/solar/tickets`, {
          params: { status: 'IN_PROGRESS,ASSIGNED,OPEN' }
        }).catch(() => ({ data: { data: [] } }))
      ]);

      const stockList = stocksRes.data?.data?.stocks || stocksRes.data?.stocks || stocksRes.data?.data || [];
      setStocks(Array.isArray(stockList) ? stockList : []);

      const ticketList = ticketsRes.data?.data?.tickets || ticketsRes.data?.tickets || ticketsRes.data?.data || [];
      setTickets(Array.isArray(ticketList) ? ticketList : []);
    } catch (err) {
      console.error('Failed to load spares data:', err);
      showToast?.('error', 'Failed to retrieve inventory spares');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, [companyId]);

  // Open Issue Modal for a specific stock item
  const handleOpenIssueForStock = (stockItem) => {
    setIssueSuccessData(null);
    setIssueForm({
      ticketId: tickets.length > 0 ? tickets[0].id : '',
      sku: stockItem.sku || stockItem.product?.sku || '',
      quantity: 1,
      warehouse: stockItem.warehouse || 'Main Solar Warehouse'
    });
    setShowIssueModal(true);
  };

  // Submit Issue Spares
  const handleIssueSpares = async (e) => {
    e.preventDefault();
    if (!issueForm.ticketId || !issueForm.sku || issueForm.quantity <= 0) {
      showToast?.('error', 'Please select a ticket, product SKU, and positive quantity');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(
        `/companies/${companyId}/solar/tickets/${issueForm.ticketId}/issue-spares`,
        {
          sku: issueForm.sku,
          quantity: Number(issueForm.quantity),
          warehouse: issueForm.warehouse
        }
      );

      const result = res.data?.data || {};
      setIssueSuccessData(result);
      showToast?.('success', `Issued ${issueForm.quantity} units under movement ${result.movementNumber || ''}`);
      fetchStocks();
    } catch (err) {
      console.error('Failed to issue spares:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to issue spares against ticket');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Stock Items
  const filtered = stocks.filter((s) => {
    const sku = s.sku || s.product?.sku || '';
    const name = s.product?.name || s.name || '';
    const cat = s.product?.category || s.category || '';
    const matchesSearch =
      sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter ? cat.toLowerCase() === categoryFilter.toLowerCase() : true;
    return matchesSearch && matchesCat;
  });

  // Unique categories
  const categories = Array.from(
    new Set(stocks.map((s) => s.product?.category || s.category).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              Solar O&M Spares Inventory & FIFO Consumption
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Phase 4 Connected
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time synchronization with Phase 4 Inventory. Issue solar fuses, MC4 connectors, bypass diodes, and inverter parts to open work orders.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchStocks}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => {
              setIssueSuccessData(null);
              setShowIssueModal(true);
            }}
            disabled={tickets.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Issue Spares to Ticket
          </button>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
        <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Integrated Phase 4 FIFO Stock Issuance:</span> All solar spares issued here execute direct inventory movements under the Phase 4 Stock Engine, deducting available stock using FIFO batch valuation and logging movements against the respective work order.
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search SKU, part name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-semibold border-b">
                <th className="py-3 px-4">Part / Product SKU</th>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Available In-Stock</th>
                <th className="py-3 px-4">Warehouse Location</th>
                <th className="py-3 px-4">UOM</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Querying Phase 4 inventory database...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No spare items found in inventory. Add inventory products in the Inventory module.
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => {
                  const sku = s.sku || s.product?.sku || `SKU-${idx + 1}`;
                  const name = s.product?.name || s.name || 'Spare Part';
                  const cat = s.product?.category || s.category || 'Solar O&M';
                  const available = Number(s.quantityAvailable ?? s.availableStock ?? s.availableQty ?? 0);
                  const uom = s.product?.uom || s.uom || 'PCS';

                  return (
                    <tr key={s.id || idx} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-bold font-mono text-gray-800 text-xs">
                        {sku}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {name}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {cat}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold ${
                            available > 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {available} {uom}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 flex items-center gap-1">
                        <Warehouse className="w-3.5 h-3.5 text-gray-400" />
                        {s.warehouse || 'Solar Spares Bay A'}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-500">
                        {uom}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenIssueForStock(s)}
                          disabled={available <= 0 || tickets.length === 0}
                          className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded font-medium border border-amber-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Issue to Ticket
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

      {/* Issue Spares Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              Issue Spare Parts to Work Order
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Deducts stock from Phase 4 Inventory batches via FIFO and links the material cost directly to the ticket.
            </p>

            {issueSuccessData ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Spares Successfully Issued & Logged!
                  </div>
                  <div className="text-xs space-y-1 font-mono">
                    <div>
                      <span className="font-semibold">Stock Movement:</span>{' '}
                      {issueSuccessData.movementNumber}
                    </div>
                    <div>
                      <span className="font-semibold">Total Cost:</span> ₹
                      {Number(issueSuccessData.totalCost || 0).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-semibold">Quantity Issued:</span>{' '}
                      {issueSuccessData.quantity} units
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIssueModal(false);
                      setIssueSuccessData(null);
                    }}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleIssueSpares} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Select Active Maintenance Work Order *
                  </label>
                  <select
                    required
                    value={issueForm.ticketId}
                    onChange={(e) => setIssueForm({ ...issueForm, ticketId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Choose Work Order</option>
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.ticketNo} — {t.subject} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Part SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={issueForm.sku}
                      onChange={(e) => setIssueForm({ ...issueForm, sku: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 font-mono"
                      placeholder="e.g. SOL-FUSE-1000V-30A"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Quantity to Issue *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={issueForm.quantity}
                      onChange={(e) => setIssueForm({ ...issueForm, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Dispatched From Warehouse
                  </label>
                  <input
                    type="text"
                    value={issueForm.warehouse}
                    onChange={(e) => setIssueForm({ ...issueForm, warehouse: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    placeholder="Main Solar Warehouse"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
                  >
                    {actionLoading ? 'Issuing FIFO...' : 'Issue Spares'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
