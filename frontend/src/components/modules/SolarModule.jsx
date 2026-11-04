'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/auth';
import {
  Sun,
  Cpu,
  Layers,
  Activity,
  BarChart2,
  AlertTriangle,
  Sparkles,
  Wrench,
  Package
} from './solar/solarIcons';

// 9 Modular Solar Components
import SolarPlantsTab from './solar/SolarPlantsTab';
import InverterConfigTab from './solar/InverterConfigTab';
import PanelLayoutTab from './solar/PanelLayoutTab';
import LiveTelemetryTab from './solar/LiveTelemetryTab';
import YieldAnalyticsTab from './solar/YieldAnalyticsTab';
import InverterAlarmsTab from './solar/InverterAlarmsTab';
import CleaningSchedulesTab from './solar/CleaningSchedulesTab';
import MaintenanceTicketsTab from './solar/MaintenanceTicketsTab';
import SparesInventoryTab from './solar/SparesInventoryTab';

const SOLAR_TABS = [
  { id: 'plants', label: '1. Plants Master', icon: Sun, path: '/solar/plants' },
  { id: 'inverters', label: '2. Inverter Config', icon: Cpu, path: '/solar/inverters' },
  { id: 'panels', label: '3. Panel Layout', icon: Layers, path: '/solar/panels' },
  { id: 'telemetry', label: '4. Live Telemetry', icon: Activity, path: '/solar/generation-live' },
  { id: 'analytics', label: '5. Yield & PR Analytics', icon: BarChart2, path: '/solar/yield-analytics' },
  { id: 'alarms', label: '6. Inverter Alarms', icon: AlertTriangle, path: '/solar/alarms' },
  { id: 'cleaning', label: '7. Cleaning Schedules', icon: Sparkles, path: '/solar/cleaning' },
  { id: 'tickets', label: '8. Maintenance Tickets', icon: Wrench, path: '/solar/maintenance-tickets' },
  { id: 'spares', label: '9. Spares Inventory', icon: Package, path: '/solar/spares' },
];

export default function SolarModule({
  activeCompany,
  showToast,
  initialSubTab = 'plants',
  pathname = '',
}) {
  const router = useRouter();

  const getSubTabFromUrl = useCallback(() => {
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
  }, [pathname, initialSubTab]);

  const [activeTab, setActiveTab] = useState(getSubTabFromUrl());
  const [currentUser, setCurrentUser] = useState(null);

  const companyId = activeCompany?.id || activeCompany?._id;

  useEffect(() => {
    setActiveTab(getSubTabFromUrl());
  }, [getSubTabFromUrl]);

  useEffect(() => {
    const user = getStoredUser();
    if (user) setCurrentUser(user);
  }, []);

  const toast = useCallback(
    (typeOrMsg, msgOrType) => {
      if (typeof showToast === 'function') {
        // Support both showToast(type, msg) and showToast(title, msg, type) / showToast(msg, type)
        if (['success', 'error', 'warning', 'info'].includes(typeOrMsg)) {
          showToast(typeOrMsg, msgOrType);
        } else if (['success', 'error', 'warning', 'info'].includes(msgOrType)) {
          showToast(msgOrType, typeOrMsg);
        } else {
          showToast('info', typeOrMsg);
        }
      } else {
        console.log(`[Toast]:`, typeOrMsg, msgOrType);
      }
    },
    [showToast]
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab.id);
    if (tab.path && router) {
      router.push(tab.path);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800">
              Service 9 • Solar Power Intelligence
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Phase 10 Enterprise Ready
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Solar Power Plant Telemetry &amp; Monitoring System
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time generation SCADA, inverter health diagnostics, Specific Yield ($kWh/kWp$), PR benchmarking, and automated O&amp;M workflows for{' '}
            <strong className="text-gray-800">{activeCompany?.organizationName || activeCompany?.name || 'Your Enterprise'}</strong>
          </p>
        </div>
      </div>

      {/* Responsive Horizontal Tab Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {SOLAR_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Viewport */}
      <div>
        {!companyId ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-2" />
            <p className="text-base font-bold text-gray-800">No Active Company Selected</p>
            <p className="text-xs text-gray-400 mt-1">
              Please select or switch to a company workspace to view solar telemetry.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'plants' && (
              <SolarPlantsTab companyId={companyId} showToast={toast} />
            )}
            {activeTab === 'inverters' && (
              <InverterConfigTab companyId={companyId} showToast={toast} />
            )}
            {activeTab === 'panels' && (
              <PanelLayoutTab companyId={companyId} showToast={toast} />
            )}
            {activeTab === 'telemetry' && (
              <LiveTelemetryTab companyId={companyId} showToast={toast} />
            )}
            {activeTab === 'analytics' && (
              <YieldAnalyticsTab companyId={companyId} showToast={toast} />
            )}
            {activeTab === 'alarms' && (
              <InverterAlarmsTab
                companyId={companyId}
                showToast={toast}
                onNavigateToTicket={() => setActiveTab('tickets')}
              />
            )}
            {activeTab === 'cleaning' && (
              <CleaningSchedulesTab companyId={companyId} showToast={toast} />
            )}
            {activeTab === 'tickets' && (
              <MaintenanceTicketsTab
                companyId={companyId}
                showToast={toast}
                onNavigateToSpares={() => setActiveTab('spares')}
              />
            )}
            {activeTab === 'spares' && (
              <SparesInventoryTab companyId={companyId} showToast={toast} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
