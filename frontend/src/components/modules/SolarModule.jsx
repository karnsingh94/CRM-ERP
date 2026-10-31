'use client';

import { useState, useEffect } from 'react';
import {
  IconSun,
  IconCpu,
  IconLayers,
  IconActivity,
  IconShield,
  IconClock,
  IconSearch,
  IconPlus,
  IconCheckCircle,
  IconAlertTriangle,
  IconPackage,
  IconTruck,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function SolarModule({
  activeCompany,
  showToast,
  initialSubTab = 'plants',
  pathname = '',
}) {
  const getSubTabFromUrl = () => {
    if (pathname.includes('/solar/inverters')) return 'inverters';
    if (pathname.includes('/solar/panels')) return 'panels';
    if (pathname.includes('/solar/generation-live')) return 'telemetry';
    if (pathname.includes('/solar/yield-analytics')) return 'analytics';
    if (pathname.includes('/solar/alarms')) return 'alarms';
    if (pathname.includes('/solar/cleaning')) return 'cleaning';
    if (pathname.includes('/solar/maintenance-tickets')) return 'tickets';
    if (pathname.includes('/solar/spares')) return 'spares';
    if (pathname.includes('/solar/plants')) return 'plants';
    return initialSubTab || 'plants';
  };

  const [activeTab, setActiveTab] = useState(getSubTabFromUrl());

  useEffect(() => {
    setActiveTab(getSubTabFromUrl());
  }, [pathname, initialSubTab]);

  // ================= STATE FOR SOLAR PLANTS =================
  const [plants, setPlants] = useState([
    {
      id: 'sol-1',
      name: 'Rooftop Solar Plant A',
      type: 'Industrial Rooftop',
      capacity: '250 kWp',
      capacityNumeric: 250,
      invertersCount: 4,
      todayYield: 1120,
      prRatio: 81.4,
      status: 'NORMAL',
      commissionDate: '2024-03-15',
      gridVoltage: '415 V (3-Phase)',
      location: 'Main Factory Roof',
    },
    {
      id: 'sol-2',
      name: 'Ground Mount Solar Plant B',
      type: 'Ground Mount',
      capacity: '500 kWp',
      capacityNumeric: 500,
      invertersCount: 8,
      todayYield: 2310,
      prRatio: 83.2,
      status: 'NORMAL',
      commissionDate: '2024-11-20',
      gridVoltage: '11 kV (HT Stepped)',
      location: 'South Yard Open Ground',
    },
  ]);

  // Modal: Add Plant
  const [isAddPlantModalOpen, setIsAddPlantModalOpen] = useState(false);
  const [newPlant, setNewPlant] = useState({
    name: '',
    type: 'Industrial Rooftop',
    capacity: '',
    invertersCount: 2,
    location: '',
  });

  const handleAddPlant = (e) => {
    e.preventDefault();
    if (!newPlant.name.trim() || !newPlant.capacity) {
      showToast?.('Validation Error', 'Plant Name and Capacity are required.', 'error');
      return;
    }
    const cap = Number(newPlant.capacity);
    const plant = {
      id: `sol-${Date.now()}`,
      name: newPlant.name.trim(),
      type: newPlant.type,
      capacity: `${cap} kWp`,
      capacityNumeric: cap,
      invertersCount: Number(newPlant.invertersCount) || 2,
      todayYield: Math.round(cap * 3.8),
      prRatio: 82.0,
      status: 'NORMAL',
      commissionDate: new Date().toISOString().split('T')[0],
      gridVoltage: '415 V (3-Phase)',
      location: newPlant.location.trim() || 'Factory Complex',
    };
    setPlants((prev) => [plant, ...prev]);
    setIsAddPlantModalOpen(false);
    setNewPlant({ name: '', type: 'Industrial Rooftop', capacity: '', invertersCount: 2, location: '' });
    showToast?.('Plant Registered', `${plant.name} added to solar plants master.`, 'success');
  };

  // ================= STATE FOR INVERTERS =================
  const [inverters, setInverters] = useState([
    { code: 'INV-A-01', plant: 'Rooftop Solar Plant A', make: 'Sungrow SG60KTL', rated: '60 kW', currentPwr: '54.2 kW', mppt: '6 Strings', ip: '192.168.10.21', status: 'ONLINE', temp: '42 °C' },
    { code: 'INV-A-02', plant: 'Rooftop Solar Plant A', make: 'Sungrow SG60KTL', rated: '60 kW', currentPwr: '53.8 kW', mppt: '6 Strings', ip: '192.168.10.22', status: 'ONLINE', temp: '44 °C' },
    { code: 'INV-A-03', plant: 'Rooftop Solar Plant A', make: 'Sungrow SG60KTL', rated: '60 kW', currentPwr: '55.1 kW', mppt: '6 Strings', ip: '192.168.10.23', status: 'ONLINE', temp: '41 °C' },
    { code: 'INV-A-04', plant: 'Rooftop Solar Plant A', make: 'Sungrow SG60KTL', rated: '60 kW', currentPwr: '54.0 kW', mppt: '6 Strings', ip: '192.168.10.24', status: 'ONLINE', temp: '43 °C' },
    { code: 'INV-B-01', plant: 'Ground Mount Plant B', make: 'SMA Sunny Tripower', rated: '65 kW', currentPwr: '61.2 kW', mppt: '8 Strings', ip: '192.168.10.31', status: 'ONLINE', temp: '45 °C' },
    { code: 'INV-B-02', plant: 'Ground Mount Plant B', make: 'SMA Sunny Tripower', rated: '65 kW', currentPwr: '60.5 kW', mppt: '8 Strings', ip: '192.168.10.32', status: 'ONLINE', temp: '46 °C' },
  ]);

  // ================= STATE FOR PANEL LAYOUT =================
  const [panelStrings, setPanelStrings] = useState([
    { stringId: 'STR-A-01', plant: 'Rooftop Solar Plant A', modulesCount: 24, wattage: '540W Mono PERC', tilt: '22°', azimuth: '180° (South)', vmp: '720 V' },
    { stringId: 'STR-A-02', plant: 'Rooftop Solar Plant A', modulesCount: 24, wattage: '540W Mono PERC', tilt: '22°', azimuth: '180° (South)', vmp: '722 V' },
    { stringId: 'STR-B-01', plant: 'Ground Mount Plant B', modulesCount: 28, wattage: '550W Bifacial', tilt: '25°', azimuth: '180° (South)', vmp: '840 V' },
    { stringId: 'STR-B-02', plant: 'Ground Mount Plant B', modulesCount: 28, wattage: '550W Bifacial', tilt: '25°', azimuth: '180° (South)', vmp: '838 V' },
  ]);

  // ================= STATE FOR ALARMS =================
  const [alarms, setAlarms] = useState([
    { id: 'alm-1', code: 'W-042', inverter: 'INV-B-02', plant: 'Ground Mount Plant B', severity: 'WARNING', desc: 'String 4 current deviation (> 15%)', time: '10:45 AM', status: 'ACTIVE' },
    { id: 'alm-2', code: 'I-012', inverter: 'INV-A-01', plant: 'Rooftop Solar Plant A', severity: 'INFO', desc: 'Grid frequency normal recovery (50.02 Hz)', time: '09:15 AM', status: 'RESOLVED' },
  ]);

  const handleClearAlarm = (id) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'RESOLVED' } : a)));
    showToast?.('Alarm Cleared', 'Fault event acknowledged and marked resolved.', 'success');
  };

  // ================= STATE FOR CLEANING SCHEDULES =================
  const [cleaningCycles, setCleaningCycles] = useState([
    { id: 'cl-1', plant: 'Rooftop Solar Plant A', array: 'Array Block 1-4', lastCleaned: '2026-10-24', nextDue: '2026-11-04', soiling: '1.2%', status: 'ON_SCHEDULE' },
    { id: 'cl-2', plant: 'Ground Mount Plant B', array: 'Ground Yard East Block', lastCleaned: '2026-10-28', nextDue: '2026-11-08', soiling: '0.8%', status: 'CLEAN' },
  ]);

  const handleMarkCleaned = (id, plantName) => {
    const today = new Date().toISOString().split('T')[0];
    setCleaningCycles((prev) =>
      prev.map((c) => (c.id === id ? { ...c, lastCleaned: today, soiling: '0.2%', status: 'CLEAN' } : c))
    );
    showToast?.('Cleaning Logged', `Washing cycle recorded for ${plantName}.`, 'success');
  };

  // ================= STATE FOR MAINTENANCE TICKETS =================
  const [tickets, setTickets] = useState([
    { id: 'TKT-SOL-101', plant: 'Rooftop Solar Plant A', priority: 'HIGH', category: 'Inverter Cable', desc: 'Replace damaged MC4 connector on String 3', tech: 'Sunil Rao', status: 'IN_PROGRESS', date: '2026-10-30' },
    { id: 'TKT-SOL-102', plant: 'Ground Mount Plant B', priority: 'MEDIUM', category: 'Sensor', desc: 'Clean pyranometer irradiation sensor glass', tech: 'Vikram Sen', status: 'OPEN', date: '2026-10-31' },
  ]);

  const handleResolveTicket = (id) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'RESOLVED' } : t)));
    showToast?.('Ticket Resolved', `${id} closed successfully.`, 'success');
  };

  // ================= STATE FOR SPARES =================
  const [spares, setSpares] = useState([
    { id: 'sp-1', name: 'MC4 Male/Female Connectors (Pairs)', code: 'MC4-1500V', stock: 120, unit: 'Pairs', minLevel: 25, cost: '₹ 85' },
    { id: 'sp-2', name: '1000V DC 15A Cylindrical Fuses', code: 'FUSE-DC-15A', stock: 45, unit: 'Pieces', minLevel: 10, cost: '₹ 180' },
    { id: 'sp-3', name: 'Type II DC Surge Protection Device (SPD)', code: 'SPD-DC-T2', stock: 8, unit: 'Units', minLevel: 4, cost: '₹ 2,400' },
    { id: 'sp-4', name: 'Solar Cable 4 sq mm (Red/Black)', code: 'CBL-SOL-4MM', stock: 350, unit: 'Meters', minLevel: 100, cost: '₹ 45/m' },
  ]);

  const totalCap = plants.reduce((sum, p) => sum + p.capacityNumeric, 0);
  const totalYield = plants.reduce((sum, p) => sum + p.todayYield, 0);
  const avgPr = (plants.reduce((sum, p) => sum + p.prRatio, 0) / plants.length).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Header with Title & Operational Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
              Service 9 • Solar Monitoring
            </span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Solar Power Telemetry &amp; Monitoring</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Live power generation, inverter health telemetry, performance ratio (PR), and O&amp;M cleaning schedules for {activeCompany?.organizationName || 'your company'}
          </p>
        </div>

        {activeTab === 'plants' && (
          <button
            type="button"
            onClick={() => setIsAddPlantModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.15rem',
              background: '#f59e0b',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
            }}
          >
            <IconPlus size={16} /> Register Solar Plant
          </button>
        )}
      </div>

      {/* 2. Top Summary Operational KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Installed DC Capacity</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>{totalCap} kWp</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>{plants.length} Active Solar Plants</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Today&apos;s Generation</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f59e0b', margin: '0.3rem 0' }}>
            {totalYield.toLocaleString('en-IN')} kWh
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Specific Yield: 4.57 kWh/kWp</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>System PR Ratio</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', margin: '0.3rem 0' }}>{avgPr}%</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Benchmark Target: 80.0%</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Inverters Online</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', margin: '0.3rem 0' }}>{inverters.length} / {inverters.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Grid Synchronized: 50.0 Hz</div>
        </div>
      </div>

      {/* 3. Module & Submodule Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {[
          { key: 'plants', label: 'Solar Plants Master', icon: IconSun },
          { key: 'inverters', label: 'Inverter Configuration', icon: IconCpu },
          { key: 'panels', label: 'Panel Layout', icon: IconLayers },
          { key: 'telemetry', label: 'Live Generation Telemetry', icon: IconActivity },
          { key: 'analytics', label: 'Yield Analytics & PR', icon: IconCheckCircle },
          { key: 'alarms', label: 'Inverter Alarms', icon: IconAlertTriangle },
          { key: 'cleaning', label: 'Cleaning Schedules', icon: IconClock },
          { key: 'tickets', label: 'Maintenance Tickets', icon: IconShield },
          { key: 'spares', label: 'O&M Spares Tracking', icon: IconPackage },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 0.95rem',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                color: isActive ? '#f59e0b' : '#64748b',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. TAB PANELS */}

      {/* 4.1 SOLAR PLANTS MASTER */}
      {activeTab === 'plants' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Plant Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                <th style={{ padding: '0.85rem 1rem' }}>DC Capacity</th>
                <th style={{ padding: '0.85rem 1rem' }}>Grid Interconnection</th>
                <th style={{ padding: '0.85rem 1rem' }}>Today&apos;s Generation</th>
                <th style={{ padding: '0.85rem 1rem' }}>PR Ratio</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plants.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    <div>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>{p.location}</div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{p.type}</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#f59e0b' }}>{p.capacity}</td>
                  <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>{p.gridVoltage}</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>{p.todayYield.toLocaleString('en-IN')} kWh</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#16a34a' }}>{p.prRatio}%</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => { setActiveTab('telemetry'); showToast?.('Live Telemetry', `Opening real-time sensors for ${p.name}`, 'info'); }}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: '#fef3c7', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Telemetry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.2 INVERTER CONFIGURATION */}
      {activeTab === 'inverters' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Solar Inverters &amp; String Controllers</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Multi-MPPT channels, IP gateway telemetry and conversion performance</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('Modbus Gateway', 'Polled 6 inverter controllers via RS-485 Modbus TCP.', 'success')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Poll Inverter Registers
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Inverter Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Plant Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Make &amp; Model</th>
                <th style={{ padding: '0.75rem 1rem' }}>Rated / Current AC</th>
                <th style={{ padding: '0.75rem 1rem' }}>MPPT Strings</th>
                <th style={{ padding: '0.75rem 1rem' }}>IP Address</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {inverters.map((inv) => (
                <tr key={inv.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#f59e0b' }}>{inv.code}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 600 }}>{inv.plant}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{inv.make}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 700 }}>
                    {inv.currentPwr} / {inv.rated}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{inv.mppt}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#7f22fe', fontWeight: 600 }}>{inv.ip}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.3 PANEL LAYOUT */}
      {activeTab === 'panels' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Photovoltaic Array &amp; String Configuration</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>Module wattage specs, series string lengths, array tilt angles and azimuth orientation</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>String ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Connected Plant</th>
                <th style={{ padding: '0.75rem 1rem' }}>Modules in Series</th>
                <th style={{ padding: '0.75rem 1rem' }}>Module Technology</th>
                <th style={{ padding: '0.75rem 1rem' }}>Tilt &amp; Azimuth</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Vmp Voltage</th>
              </tr>
            </thead>
            <tbody>
              {panelStrings.map((str) => (
                <tr key={str.stringId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0f172a' }}>{str.stringId}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{str.plant}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#f59e0b' }}>{str.modulesCount} Panels</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{str.wattage}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>{str.tilt} / {str.azimuth}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{str.vmp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.4 LIVE GENERATION TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Real-Time Solar Generation Gauges</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Instantaneous solar irradiation, DC bus voltage and power generation</p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#ecfdf5', padding: '3px 9px', borderRadius: '4px' }}>
              ● Live Telemetry Active
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1.25rem', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>CURRENT AC POWER OUTPUT</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309', margin: '0.3rem 0' }}>338.8 kW</div>
              <div style={{ fontSize: '0.75rem', color: '#78350f' }}>Peak today: 412.5 kW @ 12:45 PM</div>
            </div>
            <div style={{ padding: '1.25rem', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>SOLAR IRRADIATION SENSOR</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#15803d', margin: '0.3rem 0' }}>842 W/m²</div>
              <div style={{ fontSize: '0.75rem', color: '#14532d' }}>Global Horizontal Irradiation (GHI)</div>
            </div>
            <div style={{ padding: '1.25rem', borderRadius: '10px', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#075985' }}>AVERAGE DC BUS VOLTAGE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284c7', margin: '0.3rem 0' }}>682 V DC</div>
              <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>MPPT Trackers within 99.4% efficiency</div>
            </div>
          </div>
        </div>
      )}

      {/* 4.5 YIELD ANALYTICS & PR */}
      {activeTab === 'analytics' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Monthly Generation Yield &amp; PR Benchmarking</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>Compare actual plant generation against P50 meteorological simulation models</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Month</th>
                <th style={{ padding: '0.75rem 1rem' }}>Simulation Target</th>
                <th style={{ padding: '0.75rem 1rem' }}>Actual Generation</th>
                <th style={{ padding: '0.75rem 1rem' }}>Performance Ratio (PR)</th>
                <th style={{ padding: '0.75rem 1rem' }}>CO2 Offset</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {[
                { month: 'October 2026', target: '98,000 kWh', actual: '1,02,400 kWh', pr: '82.3%', co2: '84.0 Tons', var: '+4.5%' },
                { month: 'September 2026', target: '92,000 kWh', actual: '94,100 kWh', pr: '81.8%', co2: '77.2 Tons', var: '+2.3%' },
                { month: 'August 2026', target: '88,000 kWh', actual: '89,500 kWh', pr: '80.9%', co2: '73.4 Tons', var: '+1.7%' },
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{row.month}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{row.target}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#f59e0b' }}>{row.actual}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#16a34a' }}>{row.pr}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0284c7' }}>{row.co2}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{row.var}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.6 INVERTER ALARMS */}
      {activeTab === 'alarms' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Active &amp; Historic Inverter Alarms</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Real-time telemetry faults, insulation drops and grid events</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Alarm Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Inverter</th>
                <th style={{ padding: '0.75rem 1rem' }}>Severity</th>
                <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                <th style={{ padding: '0.75rem 1rem' }}>Time</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0f172a' }}>{a.code}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#7f22fe' }}>{a.inverter}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: a.severity === 'WARNING' ? '#fef3c7' : '#e0f2fe',
                      color: a.severity === 'WARNING' ? '#92400e' : '#0369a1',
                      border: `1px solid ${a.severity === 'WARNING' ? '#fde68a' : '#bae6fd'}`,
                    }}>
                      {a.severity}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{a.desc}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{a.time}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {a.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => handleClearAlarm(a.id)}
                        style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Acknowledge &amp; Clear
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓ Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.7 CLEANING SCHEDULES */}
      {activeTab === 'cleaning' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Solar Panel Cleaning Schedules</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Dust washing cycles, soiling mitigation, and wash rosters</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Plant Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Target Array</th>
                <th style={{ padding: '0.75rem 1rem' }}>Last Washed</th>
                <th style={{ padding: '0.75rem 1rem' }}>Next Scheduled Cycle</th>
                <th style={{ padding: '0.75rem 1rem' }}>Soiling Degradation</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {cleaningCycles.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{c.plant}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{c.array}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{c.lastCleaned}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 600 }}>{c.nextDue}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#16a34a', fontWeight: 700 }}>{c.soiling}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleMarkCleaned(c.id, c.plant)}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: '#fef3c7', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Log Washed Today
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.8 MAINTENANCE TICKETS */}
      {activeTab === 'tickets' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>O&amp;M Breakdown &amp; Preventive Work Orders</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Field engineer tickets, repair tasks and SLA resolution tracking</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('New Ticket', 'Maintenance ticket drawer opened.', 'info')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', background: '#f59e0b', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              + Raise Maintenance Ticket
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Ticket ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Plant</th>
                <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                <th style={{ padding: '0.75rem 1rem' }}>Issue Description</th>
                <th style={{ padding: '0.75rem 1rem' }}>Technician</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0f172a' }}>{t.id}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{t.plant}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: t.priority === 'HIGH' ? '#fee2e2' : '#fef3c7',
                      color: t.priority === 'HIGH' ? '#991b1b' : '#92400e',
                    }}>
                      {t.priority}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 600 }}>{t.desc}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{t.tech}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: t.status === 'RESOLVED' ? '#ecfdf5' : '#eff6ff', color: t.status === 'RESOLVED' ? '#065f46' : '#1d4ed8' }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {t.status !== 'RESOLVED' ? (
                      <button
                        type="button"
                        onClick={() => handleResolveTicket(t.id)}
                        style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Close Ticket
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓ Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.9 O&M SPARES TRACKING */}
      {activeTab === 'spares' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Solar Maintenance Spares &amp; Consumables</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>MC4 connectors, DC fuses, surge arrestors and repair consumables</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('Consume Spare', 'Recorded 2x MC4 connectors used in maintenance.', 'success')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', background: '#f59e0b', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              + Log Spares Consumption
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Spare Item Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Part SKU</th>
                <th style={{ padding: '0.75rem 1rem' }}>Current Stock</th>
                <th style={{ padding: '0.75rem 1rem' }}>Reorder Level</th>
                <th style={{ padding: '0.75rem 1rem' }}>Unit Cost</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Stock Status</th>
              </tr>
            </thead>
            <tbody>
              {spares.map((sp) => (
                <tr key={sp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{sp.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#7f22fe', fontWeight: 600 }}>{sp.code}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0f172a' }}>
                    {sp.stock} {sp.unit}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{sp.minLevel} {sp.unit}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>{sp.cost}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: sp.stock > sp.minLevel ? '#ecfdf5' : '#fef2f2',
                      color: sp.stock > sp.minLevel ? '#065f46' : '#991b1b',
                      border: `1px solid ${sp.stock > sp.minLevel ? '#a7f3d0' : '#fecaca'}`,
                    }}>
                      {sp.stock > sp.minLevel ? 'IN STOCK' : 'LOW STOCK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: ADD SOLAR PLANT */}
      {isAddPlantModalOpen && (
        <Modal
          isOpen={isAddPlantModalOpen}
          onClose={() => setIsAddPlantModalOpen(false)}
          title="Register New Solar Power Plant"
        >
          <form onSubmit={handleAddPlant} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                Plant Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Unit 3 Rooftop Solar"
                value={newPlant.name}
                onChange={(e) => setNewPlant({ ...newPlant, name: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Installation Type
                </label>
                <select
                  value={newPlant.type}
                  onChange={(e) => setNewPlant({ ...newPlant, type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="Industrial Rooftop">Industrial Rooftop</option>
                  <option value="Ground Mount">Ground Mount</option>
                  <option value="Solar Carport">Solar Carport</option>
                  <option value="Floating Solar">Floating Solar</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  DC Capacity (kWp) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 350"
                  value={newPlant.capacity}
                  onChange={(e) => setNewPlant({ ...newPlant, capacity: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Inverter Count
                </label>
                <input
                  type="number"
                  placeholder="e.g. 4"
                  value={newPlant.invertersCount}
                  onChange={(e) => setNewPlant({ ...newPlant, invertersCount: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Location / Physical Area
                </label>
                <input
                  type="text"
                  placeholder="e.g. Warehouse Block D"
                  value={newPlant.location}
                  onChange={(e) => setNewPlant({ ...newPlant, location: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setIsAddPlantModalOpen(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#f59e0b', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Register Plant
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
