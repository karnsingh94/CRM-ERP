'use client';

import {
  IconCRM,
  IconShoppingBag,
  IconTruck,
  IconLayers,
  IconCpu,
  IconPackage,
  IconCreditCard,
  IconPlus,
  IconCheckCircle,
  IconAlertTriangle,
  IconBuilding,
  IconUsers,
} from '../ui/Icons';

export default function CompanyDashboard({
  activeCompany,
  permittedServices = [],
  onNavigate,
}) {
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate permission tags
  const hasCrm = permittedServices.some(s => s.code === 'crm_sales');
  const hasPurchase = permittedServices.some(s => s.code === 'purchase_vendor');
  const hasInventory = permittedServices.some(s => s.code === 'inventory_warehouse');
  const hasProduction = permittedServices.some(s => s.code === 'manufacturing_production');
  const hasDispatch = permittedServices.some(s => s.code === 'dispatch_returns');
  const hasAccounts = permittedServices.some(s => s.code === 'accounts_banking');
  const hasControls = permittedServices.some(s => s.code === 'permission_controls');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #18181b 0%, #2e1065 60%, #4c1d95 100%)',
          borderRadius: '16px',
          padding: '2rem 2.25rem',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 10px 25px -5px rgba(24, 24, 27, 0.25)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(127, 34, 254, 0.25)',
                color: '#c4b5fd',
                border: '1px solid rgba(127, 34, 254, 0.4)',
                padding: '0.15rem 0.55rem',
                borderRadius: '9999px',
              }}
            >
              Enterprise Tenant
            </span>
            <span suppressHydrationWarning style={{ fontSize: '0.82rem', color: '#a1a1aa' }}>• {todayFormatted}</span>
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#ffffff' }}>
            Welcome, {activeCompany?.name || 'Company Admin'}!
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#e4e4e7', marginTop: '0.25rem' }}>
            Operating Workspace for <strong style={{ color: '#c4b5fd' }}>{activeCompany?.organizationName}</strong>
          </p>
        </div>

        {/* Quick Launch Buttons based on permissions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {hasCrm && (
            <button
              type="button"
              onClick={() => onNavigate('crm_sales')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: '8px',
                background: '#7f22fe',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(127, 34, 254, 0.35)',
              }}
            >
              <IconPlus size={15} /> New Lead / Quote
            </button>
          )}

          {hasPurchase && (
            <button
              type="button"
              onClick={() => onNavigate('purchase_vendor')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <IconTruck size={15} /> Purchase &amp; GRN
            </button>
          )}

          {hasInventory && (
            <button
              type="button"
              onClick={() => onNavigate('inventory_warehouse')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <IconLayers size={15} /> Inventory
            </button>
          )}
        </div>
      </div>

      {/* 2. Real Company Provisioning & Operational Status Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            Company Provisioning &amp; Operational Metrics
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Live status for {activeCompany?.organizationName}
          </span>
        </div>

        {/* Real Summary Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem 1.35rem',
              border: '1px solid #e4e4e7',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: '#71717a', fontWeight: 700, textTransform: 'uppercase' }}>
              Authorized Services
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#7f22fe', margin: '0.2rem 0' }}>
              {permittedServices.length} / 7
            </div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
              Assigned by Super Admin
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem 1.35rem',
              border: '1px solid #e4e4e7',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: '#71717a', fontWeight: 700, textTransform: 'uppercase' }}>
              Permitted Modules
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#18181b', margin: '0.2rem 0' }}>
              {permittedServices.reduce((acc, s) => acc + (s.modules?.length || 0), 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#7f22fe', fontWeight: 600 }}>
              Operational Feature Screens
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem 1.35rem',
              border: '1px solid #e4e4e7',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: '#71717a', fontWeight: 700, textTransform: 'uppercase' }}>
              Panel Status
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: activeCompany?.status === 'ACTIVE' ? '#10b981' : '#f59e0b', margin: '0.2rem 0' }}>
              {activeCompany?.status || 'ACTIVE'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#71717a', fontWeight: 600 }}>
              Tenant ID: #{activeCompany?.id}
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem 1.35rem',
              border: '1px solid #e4e4e7',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: '0.74rem', color: '#71717a', fontWeight: 700, textTransform: 'uppercase' }}>
              Admin Profile
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#18181b', margin: '0.35rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCompany?.name || 'Authorized Admin'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#71717a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCompany?.email || 'Authenticated User'}
            </div>
          </div>
        </div>

        {/* Helpful Empty State Banner for New Tenant Business Records */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📋</span>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                Operational Workspace Ready — Awaiting Initial Transaction Records
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                Your company workspace is initialized. No business orders or leads have been created yet. Navigate to your permitted modules from the sidebar to start creating live records.
              </div>
            </div>
          </div>
          {hasCrm && (
            <button
              type="button"
              onClick={() => onNavigate('crm_sales')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                background: '#7f22fe',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            >
              Start in CRM
            </button>
          )}
        </div>

        {/* Scoped Service Operational Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* CRM & Sales KPIs */}
          {hasCrm && (
            <>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#f5f0ff',
                    color: '#7f22fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCRM size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Active CRM Leads</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>0</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Awaiting initial lead entry</div>
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#ecfdf5',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconShoppingBag size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Sales Orders</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>0</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>No orders recorded</div>
                </div>
              </div>
            </>
          )}

          {/* Purchase & Vendor KPIs */}
          {hasPurchase && (
            <>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#fffbeb',
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconTruck size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Purchase Orders (PO)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>0</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Awaiting supplier orders</div>
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#f5f3ff',
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCheckCircle size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Inward GRNs</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>0</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>No inward receipts</div>
                </div>
              </div>
            </>
          )}

          {/* Inventory & Warehouse KPIs */}
          {hasInventory && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconLayers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Inventory Items</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>0</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Awaiting stock entry</div>
              </div>
            </div>
          )}

          {/* Manufacturing KPIs */}
          {hasProduction && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#fdf2f8',
                  color: '#db2777',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconCpu size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Production Batches</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>0</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>No production orders</div>
              </div>
            </div>
          )}

          {/* Dispatch KPIs */}
          {hasDispatch && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconPackage size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Pending Dispatches</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>0</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>No shipments pending</div>
              </div>
            </div>
          )}

          {/* Accounts KPIs */}
          {hasAccounts && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconCreditCard size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Ledger Balance</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>₹ 0.00</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>No invoices pending</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Assigned Enterprise Services Catalogue Status */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Assigned Services &amp; Permissions Tree
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              Live permissions granted by Super Admin for {activeCompany?.organizationName}
            </p>
          </div>
          <span
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
            }}
          >
            {permittedServices.length} Services Permitted
          </span>
        </div>

        {permittedServices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              No Services Assigned Yet
            </h4>
            <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
              Platform Super Admin has not assigned any operational services to <strong>{activeCompany?.organizationName}</strong> yet. Department management and creation will become available once Super Admin provisions your assigned services.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
            {permittedServices.map((srv) => (
              <div
                key={srv.code}
                onClick={() => onNavigate(srv.code)}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.15rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7f22fe';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(127, 34, 254, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                      {srv.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#7f22fe',
                        background: '#f5f0ff',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                      }}
                    >
                      {srv.modules?.length || 0} Modules
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                    {srv.description}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {srv.modules?.map((m) => (
                      <span
                        key={m.code}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#334155',
                          background: '#f1f5f9',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                        }}
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Service Head Management Quick Action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.85rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                    Assigned Service
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(`services:${srv.code}:departments`);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.32rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#dbeafe';
                      e.currentTarget.style.borderColor = '#93c5fd';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.borderColor = '#bfdbfe';
                    }}
                    title={`Manage teams under ${srv.name}`}
                  >
                    <span>🏢</span>
                    <span>Department Head</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
