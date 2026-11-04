'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
  Activity,
  Zap,
  Sun,
  Thermometer,
  Gauge,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
  PlayCircle,
  CheckCircle2,
  Cpu
} from './solarIcons';

export default function LiveTelemetryTab({ companyId, showToast }) {
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(30);
  const [simulating, setSimulating] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const timerRef = useRef(null);

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
      showToast?.('error', 'Failed to load plants for telemetry');
    }
  };

  useEffect(() => {
    fetchPlants();
  }, [companyId]);

  // 2. Fetch Latest Telemetry Snapshot
  const fetchSnapshot = async () => {
    if (!companyId || !selectedPlantId) return;
    try {
      const res = await api.get(`/companies/${companyId}/solar/plants/${selectedPlantId}/telemetry/latest`);
      setSnapshot(res.data?.data || null);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to load telemetry snapshot:', err);
      showToast?.('error', 'Failed to retrieve live telemetry data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPlantId) {
      setLoading(true);
      fetchSnapshot();
    }
  }, [companyId, selectedPlantId]);

  // Auto-refresh interval management
  useEffect(() => {
    if (autoRefresh && selectedPlantId) {
      timerRef.current = setInterval(() => {
        fetchSnapshot();
      }, refreshIntervalSec * 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, refreshIntervalSec, selectedPlantId]);

  // Simulate Telemetry Packet for quick live testing
  const handleTriggerSimulation = async () => {
    if (!companyId || !selectedPlantId || !snapshot?.inverterSnapshots?.length) {
      showToast?.('warning', 'Please ensure at least one inverter is registered');
      return;
    }
    setSimulating(true);
    try {
      const simulatedReadings = snapshot.inverterSnapshots.map((inv) => {
        const rated = Number(inv.ratedCapacityKw) || 50;
        // Generate random realistic midday reading (65% - 90% of rated capacity)
        const power = (rated * (0.65 + Math.random() * 0.25)).toFixed(2);
        return {
          inverterCode: inv.inverterCode,
          timestamp: new Date().toISOString(),
          currentPowerKw: Number(power),
          dailyEnergyKwh: Number((Number(power) * 4.2).toFixed(2)),
          totalEnergyKwh: 45200 + Math.floor(Math.random() * 50),
          gridVoltageV: (415 + (Math.random() * 6 - 3)).toFixed(1),
          gridCurrentA: ((power * 1000) / (415 * 1.732)).toFixed(1),
          frequencyHz: (50.0 + (Math.random() * 0.1 - 0.05)).toFixed(2),
          temperatureC: (42 + Math.random() * 8).toFixed(1),
          irradianceWm2: (780 + Math.random() * 120).toFixed(0),
          inverterStatus: 'NORMAL',
          isSimulated: true
        };
      });

      await api.post(`/companies/${companyId}/solar/plants/${selectedPlantId}/telemetry/ingest`, {
        readings: simulatedReadings,
        isSimulated: true,
        provider: 'GENERIC_REST'
      });

      showToast?.('success', 'Simulated telemetry pulse ingested successfully');
      await fetchSnapshot();
    } catch (err) {
      console.error('Simulation error:', err);
      showToast?.('error', err.response?.data?.message || 'Failed to send telemetry packet');
    } finally {
      setSimulating(false);
    }
  };

  // Helper to determine status badge for an inverter
  const getInverterTelemetryStatus = (inv) => {
    if (!inv.latestReading) {
      return { label: 'NO DATA', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    }
    const readingTime = new Date(inv.latestReading.timestamp).getTime();
    const now = Date.now();
    const diffMinutes = (now - readingTime) / (1000 * 60);

    if (inv.latestReading.isSimulated) {
      return { label: 'SIMULATED DATA', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    }
    if (diffMinutes > 30) {
      return { label: 'STALE DATA', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    }
    if (inv.status === 'FAULT' || inv.latestReading.inverterStatus === 'FAULT') {
      return { label: 'FAULT', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    }
    return { label: 'LIVE DATA', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  };

  const plantCapacityAc = snapshot?.capacityAcKw || 1;
  const currentGen = snapshot?.totalCurrentPowerKw || 0;
  const capacityPct = Math.min(100, Math.round((currentGen / plantCapacityAc) * 100));

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500 animate-pulse" />
              Live Generation & Telemetry Stream
            </h2>
            {snapshot && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                ACTIVE MONITOR
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time power generation, inverter status, AC grid parameters, and irradiance feed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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

          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border text-xs">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-400"
            />
            <label htmlFor="autoRefresh" className="text-gray-700 font-medium cursor-pointer">
              Auto-poll (30s)
            </label>
          </div>

          <button
            onClick={fetchSnapshot}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          {/* Quick Simulation Injector for Demonstration/Testing */}
          <button
            onClick={handleTriggerSimulation}
            disabled={simulating || loading || !snapshot?.invertersCount}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-50"
            title="Send test telemetry pulse"
          >
            <PlayCircle className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
            {simulating ? 'Pulsing...' : 'Simulate Pulse'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Instant Power */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Instantaneous Power</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-gray-800">
            {snapshot ? snapshot.totalCurrentPowerKw : '--'} <span className="text-lg font-medium text-gray-500">kW</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Plant Load ({capacityPct}%)</span>
              <span>{plantCapacityAc} kW AC</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${capacityPct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Daily Energy */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Today's Yield</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-600">
            {snapshot ? snapshot.totalDailyEnergyKwh : '--'}{' '}
            <span className="text-lg font-medium text-gray-500">kWh</span>
          </div>
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Aggregated since 00:00 hrs
          </p>
        </div>

        {/* Solar Irradiance */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Pyranometer Irradiance</span>
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-gray-800">
            {snapshot?.irradianceWm2 !== null && snapshot?.irradianceWm2 !== undefined ? (
              <>
                {snapshot.irradianceWm2}{' '}
                <span className="text-lg font-medium text-gray-500">W/m²</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-400">SENSOR N/A</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {snapshot?.irradianceWm2 ? 'Plane of Array (POA) Irradiance' : 'Pyranometer not attached'}
          </p>
        </div>

        {/* Inverter Online Fleet */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Inverters Online</span>
            <Cpu className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-extrabold text-blue-600">
            {snapshot ? `${snapshot.onlineInvertersCount} / ${snapshot.invertersCount}` : '--'}
          </div>
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            {snapshot?.onlineInvertersCount === snapshot?.invertersCount ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Inverters Operational
              </span>
            ) : (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Attention needed on offline units
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Inverters Real-Time Cards Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500" />
            Inverter Fleet Telemetry Status ({snapshot?.inverterSnapshots?.length || 0} Units)
          </h3>
          {lastRefreshedAt && (
            <span className="text-xs text-gray-400">
              Last synced: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {loading ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-100 shadow-sm">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
            <p className="text-sm text-gray-500">Connecting to telemetry data bus...</p>
          </div>
        ) : !snapshot?.inverterSnapshots?.length ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-100 shadow-sm">
            <AlertCircle className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-base font-semibold text-gray-700">No Inverters Configured</p>
            <p className="text-xs text-gray-400 mt-1">
              Add inverters in the Inverters tab to begin streaming live telemetry.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {snapshot.inverterSnapshots.map((inv) => {
              const statusBadge = getInverterTelemetryStatus(inv);
              const reading = inv.latestReading;
              const loadPct = reading
                ? Math.min(100, Math.round((reading.currentPowerKw / inv.ratedCapacityKw) * 100))
                : 0;

              return (
                <div
                  key={inv.inverterId}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-gray-800 text-base">{inv.inverterCode}</div>
                      <div className="text-xs text-gray-400">
                        {inv.make} {inv.model} ({inv.ratedCapacityKw} kW)
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Power Display */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-gray-500 font-medium">Power Output</span>
                      <span className="text-xl font-bold text-gray-800 font-mono">
                        {reading ? reading.currentPowerKw : 0}{' '}
                        <span className="text-xs font-normal text-gray-500">kW</span>
                      </span>
                    </div>

                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Rated load</span>
                        <span>{loadPct}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full"
                          style={{ width: `${loadPct}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 border rounded-lg bg-white">
                      <div className="text-gray-400">Today's Yield</div>
                      <div className="font-semibold text-emerald-600 font-mono">
                        {reading ? reading.dailyEnergyKwh : 0} kWh
                      </div>
                    </div>

                    <div className="p-2 border rounded-lg bg-white">
                      <div className="text-gray-400">Grid Voltage</div>
                      <div className="font-semibold text-gray-700 font-mono">
                        {reading?.gridVoltageV ? `${reading.gridVoltageV} V` : '--'}
                      </div>
                    </div>

                    <div className="p-2 border rounded-lg bg-white">
                      <div className="text-gray-400">Grid Current</div>
                      <div className="font-semibold text-gray-700 font-mono">
                        {reading?.gridCurrentA ? `${reading.gridCurrentA} A` : '--'}
                      </div>
                    </div>

                    <div className="p-2 border rounded-lg bg-white">
                      <div className="text-gray-400">Internal Temp</div>
                      <div className="font-semibold text-gray-700 font-mono flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-red-400" />
                        {reading?.temperatureC ? `${reading.temperatureC} °C` : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Timestamp Footer */}
                  <div className="mt-4 pt-3 border-t text-xs text-gray-400 flex justify-between items-center">
                    <span>
                      {reading?.timestamp
                        ? `Reading: ${new Date(reading.timestamp).toLocaleTimeString()}`
                        : 'No timestamp'}
                    </span>
                    {reading?.isSimulated && (
                      <span className="text-purple-600 font-medium">SIM</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
