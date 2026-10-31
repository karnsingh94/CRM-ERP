'use client';

import { useState } from 'react';
import { IconSun, IconCpu, IconLayers, IconActivity, IconShield, IconClock, IconSearch } from '../ui/Icons';
import EmptyState from '../ui/EmptyState';

export default function SolarModule({ activeCompany, showToast, initialSubTab = 'plants' }) {
  const [activeTab, setActiveTab] = useState(initialSubTab || 'plants');

  const [plants, setPlants] = useState([
    {
      id: 'sol-1',
      name: 'Rooftop Unit 1 (Plant A)',
      capacity: '250 kWp',
      invertersCount: 4,
      todayYield: '1,120 kWh',
      prRatio: '81.4%',
      status: 'NORMAL',
      lastCleaning: '2026-10-24',
    },
    {
      id: 'sol-2',
      name: 'Ground Mount Array (Plant B)',
      capacity: '500 kWp',
      invertersCount: 8,
      todayYield: '2,310 kWh',
      prRatio: '83.2%',
      status: 'NORMAL',
      lastCleaning: '2026-10-28',
    },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
              Service 9 • Blueprint Certified
            </span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Solar Plant Telemetry &amp; Monitoring</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Live power generation, inverter health telemetry, performance ratio (PR), and O&amp;M cleaning schedules for {activeCompany?.organizationName || 'your organization'}
          </p>
        </div>

        <button
          onClick={() => showToast?.('Refreshing inverter live telemetry...', 'info')}
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
          }}
        >
          <IconActivity size={16} /> Refresh Live Telemetry
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Capacity</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>750 kWp</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>2 Solar Plants Connected</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Today&apos;s Generation</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f59e0b', margin: '0.3rem 0' }}>3,430 kWh</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>+4.8% vs benchmark</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Performance Ratio (PR)</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', margin: '0.3rem 0' }}>82.3%</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Design target: 80.0%</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Inverter Grid Status</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', margin: '0.3rem 0' }}>12 / 12 OK</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>0 Active Alarms</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
        {[
          { key: 'plants', label: 'Solar Plants Master', icon: IconSun },
          { key: 'telemetry', label: 'Generation & Telemetry', icon: IconActivity },
          { key: 'maintenance', label: 'O&M & Cleaning Schedules', icon: IconClock },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                color: isActive ? '#f59e0b' : '#64748b',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'plants' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Plant Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>DC Capacity</th>
                <th style={{ padding: '0.85rem 1rem' }}>Inverters</th>
                <th style={{ padding: '0.85rem 1rem' }}>Today&apos;s Generation</th>
                <th style={{ padding: '0.85rem 1rem' }}>Performance Ratio</th>
                <th style={{ padding: '0.85rem 1rem' }}>Health Status</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plants.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#0f172a' }}>{p.name}</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#7f22fe' }}>{p.capacity}</td>
                  <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{p.invertersCount} Units</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a' }}>{p.todayYield}</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#16a34a' }}>{p.prRatio}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <button
                      onClick={() => showToast?.(`Inspecting ${p.name}`, 'info')}
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

      {activeTab === 'telemetry' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Inverter Telemetry Channels</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Real-time Modbus / MQTT telemetry readings</p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#ecfdf5', padding: '3px 9px', borderRadius: '4px' }}>
              ● 100% Data Packet Ingestion
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Inverter Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Rated Capacity</th>
                <th style={{ padding: '0.75rem 1rem' }}>Current AC Power</th>
                <th style={{ padding: '0.75rem 1rem' }}>DC Voltage</th>
                <th style={{ padding: '0.75rem 1rem' }}>Internal Temp</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { code: 'INV-A-01', cap: '60 kW', pwr: '54.2 kW', vdc: '680 V', temp: '42 °C', status: 'ONLINE' },
                { code: 'INV-A-02', cap: '60 kW', pwr: '53.8 kW', vdc: '685 V', temp: '44 °C', status: 'ONLINE' },
                { code: 'INV-A-03', cap: '60 kW', pwr: '55.1 kW', vdc: '682 V', temp: '41 °C', status: 'ONLINE' },
                { code: 'INV-A-04', cap: '60 kW', pwr: '54.0 kW', vdc: '679 V', temp: '43 °C', status: 'ONLINE' },
              ].map((inv) => (
                <tr key={inv.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{inv.code}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{inv.cap}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#f59e0b' }}>{inv.pwr}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{inv.vdc}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{inv.temp}</td>
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

      {activeTab === 'maintenance' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>O&amp;M Module Cleaning &amp; Maintenance Tickets</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Dust washing cycles, soiling mitigation, and breakdown work orders</p>
            </div>
            <button
              onClick={() => showToast?.('Scheduling panel cleaning cycle...', 'info')}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', background: '#f59e0b', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Schedule Cleaning Cycle
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Plant Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Last Washed</th>
                <th style={{ padding: '0.75rem 1rem' }}>Next Scheduled Cycle</th>
                <th style={{ padding: '0.75rem 1rem' }}>Soiling Degradation</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Schedule Status</th>
              </tr>
            </thead>
            <tbody>
              {plants.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{p.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{p.lastCleaning}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 600 }}>2026-11-05</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#16a34a', fontWeight: 700 }}>&lt; 1.2% (Low)</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                      ON SCHEDULE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

