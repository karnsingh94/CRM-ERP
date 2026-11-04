'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  BarChart2,
  TrendingUp,
  Zap,
  Leaf,
  Sun,
  AlertCircle,
  RefreshCw,
  Calendar,
  Layers,
  Award,
  TreeDeciduous,
  Cpu
} from './solarIcons';

export default function YieldAnalyticsTab({ companyId, showToast }) {
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [period, setPeriod] = useState('MONTHLY'); // 'DAILY' | 'MONTHLY' | 'YEARLY'
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [yieldData, setYieldData] = useState(null);
  const [inverterComparison, setInverterComparison] = useState([]);
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to load plants:', err);
      showToast?.('error', 'Failed to load plants for analytics');
    }
  };

  useEffect(() => {
    fetchPlants();
  }, [companyId]);

  // 2. Fetch Analytics Data
  const fetchAnalytics = async () => {
    if (!companyId || !selectedPlantId) return;
    setLoading(true);
    try {
      const [yieldRes, compRes] = await Promise.all([
        api.get(`/companies/${companyId}/solar/plants/${selectedPlantId}/analytics/yield`, {
          params: { period, year, month }
        }),
        api.get(`/companies/${companyId}/solar/plants/${selectedPlantId}/analytics/inverters`)
      ]);

      setYieldData(yieldRes.data?.data || null);
      setInverterComparison(compRes.data?.data?.invertersComparison || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      showToast?.('error', 'Failed to retrieve yield analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPlantId) {
      fetchAnalytics();
    }
  }, [companyId, selectedPlantId, period, year, month]);

  const pr = yieldData?.performanceRatio;
  const impact = yieldData?.environmentalImpact;

  return (
    <div className="space-y-6">
      {/* Top Header & Period Filter Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-amber-500" />
            Solar Generation Yield & Performance Analytics
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Evaluate actual vs estimated solar generation, Specific Yield ($kWh/kWp$), PR, and carbon offset.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Plant Selector */}
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

          {/* Period Selector Tabs */}
          <div className="inline-flex rounded-lg border bg-gray-50 p-1">
            {['DAILY', 'MONTHLY', 'YEARLY'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  period === p
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Month Selector if MONTHLY */}
          {period === 'MONTHLY' && (
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
            >
              {[
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
              ].map((mName, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>
          )}

          {/* Year Selector */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Generation */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Actual Yield</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-gray-800">
            {yieldData ? yieldData.actualGenerationKwh?.toLocaleString() : '--'}{' '}
            <span className="text-base font-medium text-gray-500">kWh</span>
          </div>
          <div className="mt-2 text-xs flex items-center gap-1.5">
            {yieldData?.simulationTargetKwh ? (
              <>
                <span className="text-gray-400">
                  Target: {yieldData.simulationTargetKwh?.toLocaleString()} kWh
                </span>
                {yieldData.targetVariancePercent !== null && (
                  <span
                    className={`font-semibold px-1.5 py-0.5 rounded ${
                      yieldData.targetVariancePercent >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {yieldData.targetVariancePercent >= 0 ? '+' : ''}
                    {yieldData.targetVariancePercent}%
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-400">Target not set</span>
            )}
          </div>
        </div>

        {/* Specific Yield */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Specific Yield</span>
            <Award className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-extrabold text-blue-600">
            {yieldData ? yieldData.specificYieldKwhPerKwp : '--'}{' '}
            <span className="text-base font-medium text-gray-500">kWh/kWp</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Standardized production per peak kilowatt installed
          </p>
        </div>

        {/* Performance Ratio (PR) */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Performance Ratio (PR)</span>
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          {pr?.status === 'CALCULATED' && pr?.ratioPercent !== null ? (
            <>
              <div className="text-3xl font-extrabold text-emerald-600">
                {pr.ratioPercent}%
              </div>
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Scientifically calculated via POA
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-gray-500 mt-1">
                {pr?.status === 'SENSOR_UNAVAILABLE' ? 'SENSOR UNAVAILABLE' : pr?.status || 'N/A'}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                Requires calibrated pyranometer sensor
              </p>
            </>
          )}
        </div>

        {/* Environmental Offset */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>CO₂ Carbon Offset</span>
            <Leaf className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-600">
            {impact ? impact.co2OffsetTons : '--'}{' '}
            <span className="text-base font-medium text-gray-500">Tons</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <TreeDeciduous className="w-3.5 h-3.5 text-emerald-600" />
            Equivalent to ~{impact?.treesEquivalent || 0} mature trees planted
          </p>
        </div>
      </div>

      {/* PR Sensor Status Banner if Unavailable */}
      {pr?.status === 'SENSOR_UNAVAILABLE' && (
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Performance Ratio (PR) Calculation Policy:</span>{' '}
            {pr.explanation} Specific Yield ($kWh/kWp$) serves as the primary benchmark metric until a field pyranometer irradiance sensor is linked.
          </div>
        </div>
      )}

      {/* Inverter-Wise Generation Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              Inverter Fleet Generation Breakdown & Specific Yield
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Compare generation output across all inverters to identify underperforming strings or equipment.
            </p>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {inverterComparison.length} inverters evaluated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-semibold border-b">
                <th className="py-3 px-4">Inverter</th>
                <th className="py-3 px-4">Make / Model</th>
                <th className="py-3 px-4">Rated AC Capacity</th>
                <th className="py-3 px-4">Period Generation</th>
                <th className="py-3 px-4">Specific Yield</th>
                <th className="py-3 px-4">Performance Relative to Max</th>
                <th className="py-3 px-4">Operational Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Calculating inverter fleet analytics...
                  </td>
                </tr>
              ) : inverterComparison.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    No inverter telemetry data recorded for this period.
                  </td>
                </tr>
              ) : (
                (() => {
                  const maxYield = Math.max(
                    ...inverterComparison.map((i) => i.specificYieldKwhPerKw || 0),
                    1
                  );

                  return inverterComparison.map((inv) => {
                    const relativePct = Math.round(
                      ((inv.specificYieldKwhPerKw || 0) / maxYield) * 100
                    );

                    return (
                      <tr key={inv.inverterId} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-4 font-bold text-gray-800">
                          {inv.inverterCode}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {inv.make} {inv.model}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-700">
                          {inv.ratedCapacityKw} kW
                        </td>
                        <td className="py-3 px-4 font-semibold text-emerald-600 font-mono">
                          {inv.totalEnergyKwh?.toLocaleString()} kWh
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-600 font-mono">
                          {inv.specificYieldKwhPerKw} kWh/kW
                        </td>
                        <td className="py-3 px-4 w-48">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  relativePct >= 90
                                    ? 'bg-emerald-500'
                                    : relativePct >= 75
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${relativePct}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-mono text-gray-500 w-8">
                              {relativePct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              ['ONLINE', 'NORMAL'].includes(inv.status)
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
