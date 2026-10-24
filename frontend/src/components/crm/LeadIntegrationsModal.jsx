'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export default function LeadIntegrationsModal({ companyId, isOpen, onClose, showToast, onLeadsSynced }) {
  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [isSyncingIndiaMart, setIsSyncingIndiaMart] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (!isOpen || !companyId) return;

    let isCurrent = true;
    const fetchIntegrations = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/companies/${companyId}/crm/lead-integrations`);
        if (isCurrent && res.data) {
          setIntegrations(res.data);
        }
      } catch (err) {
        if (showToast) showToast('Failed to Load Integrations', err.message, 'danger');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    fetchIntegrations();
    return () => { isCurrent = false; };
  }, [isOpen, companyId]);

  if (!isOpen) return null;

  const handleSyncIndiaMart = async () => {
    setIsSyncingIndiaMart(true);
    try {
      const res = await api.post(`/companies/${companyId}/crm/lead-integrations/sync-indiamart`, {});
      if (showToast) {
        showToast('IndiaMART Sync Complete! 🇮🇳', res.message || 'Leads successfully fetched.', 'success');
      }
      if (onLeadsSynced) onLeadsSynced();
      // Refresh list
      const updated = await api.get(`/companies/${companyId}/crm/lead-integrations`);
      if (updated.data) setIntegrations(updated.data);
    } catch (err) {
      if (showToast) showToast('IndiaMART Sync Failed', err.message, 'danger');
    } finally {
      setIsSyncingIndiaMart(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    const fullUrl = text.startsWith('http') ? text : `${window.location.origin}${text}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(true);
    if (showToast) showToast('Copied to Clipboard! 📋', 'Universal Webhook URL copied.', 'info');
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const websiteProvider = integrations.find((i) => i.id === 'WEBSITE_WEBHOOK');
  const activeCount = integrations.filter((i) => i.status === 'ACTIVE' && i.configured).length;

  const filteredIntegrations = integrations.filter((i) => {
    const isActive = i.status === 'ACTIVE' && i.configured;
    if (activeTab === 'ACTIVE') return isActive;
    if (activeTab === 'INACTIVE') return !isActive;
    return true;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f5f0ff 100%)',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.6rem' }}>⚡</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  Connected Lead Channels &amp; Ingestion Hub
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: activeCount > 0 ? '#dcfce7' : '#f1f5f9',
                    color: activeCount > 0 ? '#15803d' : '#64748b',
                    border: activeCount > 0 ? '1px solid #86efac' : '1px solid #cbd5e1',
                  }}
                >
                  {activeCount} Active by Super Admin
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                External lead APIs (IndiaMART, Meta, Webhooks) provisioned and secured by Super Admin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.4rem 0.65rem',
              cursor: 'pointer',
              fontWeight: 700,
              color: '#64748b',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Security & Role Policy Banner */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: '#faf5ff',
            borderBottom: '1px solid #e9d5ff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.78rem',
            color: '#6b21a8',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🛡️</span>
          <div>
            <strong>Super Admin Managed:</strong> External Lead API channels and credentials are strictly configured by the Super Admin. If you need any additional channel activated or keys updated, please contact your Super Admin.
          </div>
        </div>

        {/* Universal Webhook Banner (if active) */}
        {websiteProvider && websiteProvider.configured && websiteProvider.status === 'ACTIVE' && websiteProvider.webhookUrl && (
          <div
            style={{
              padding: '0.85rem 1.5rem',
              background: '#ecfdf5',
              borderBottom: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🌐</span>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>
                  Your Company&apos;s Active Universal Webhook URL:
                </span>
                <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#047857', fontWeight: 700 }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}${websiteProvider.webhookUrl}` : websiteProvider.webhookUrl}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(websiteProvider.webhookUrl)}
              style={{
                background: copiedToken ? '#059669' : '#ffffff',
                color: copiedToken ? '#ffffff' : '#059669',
                border: '1px solid #059669',
                borderRadius: '7px',
                padding: '0.35rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copiedToken ? '✓ Copied URL' : '📋 Copy Webhook URL'}
            </button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            Viewing lead source channels:
          </span>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              style={{
                padding: '3px 9px',
                fontSize: '0.74rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'ALL' ? '#ffffff' : 'transparent',
                color: activeTab === 'ALL' ? '#0f172a' : '#64748b',
                boxShadow: activeTab === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              All ({integrations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ACTIVE')}
              style={{
                padding: '3px 9px',
                fontSize: '0.74rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'ACTIVE' ? '#ffffff' : 'transparent',
                color: activeTab === 'ACTIVE' ? '#15803d' : '#64748b',
                boxShadow: activeTab === 'ACTIVE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              🟢 Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('INACTIVE')}
              style={{
                padding: '3px 9px',
                fontSize: '0.74rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'INACTIVE' ? '#ffffff' : 'transparent',
                color: activeTab === 'INACTIVE' ? '#64748b' : '#94a3b8',
                boxShadow: activeTab === 'INACTIVE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              ⚪ Inactive ({integrations.length - activeCount})
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Loading lead channels...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
              {filteredIntegrations.map((provider) => {
                const isActive = provider.status === 'ACTIVE' && provider.configured;
                const isIndiaMart = provider.id === 'INDIAMART';
                const isWebsite = provider.id === 'WEBSITE_WEBHOOK';

                return (
                  <div
                    key={provider.id}
                    style={{
                      border: isActive ? '1.5px solid #a7f3d0' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      background: isActive ? '#ffffff' : '#f8fafc',
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.9rem',
                      boxShadow: isActive ? '0 3px 10px rgba(16, 185, 129, 0.08)' : 'none',
                    }}
                  >
                    <div>
                      {/* Top Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <span style={{ fontSize: '1.4rem' }}>{provider.icon}</span>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                              {provider.name}
                            </h4>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{provider.category}</span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            background: isActive ? '#ecfdf5' : '#f1f5f9',
                            color: isActive ? '#059669' : '#64748b',
                            border: isActive ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isActive ? '🟢 Active by Super Admin' : '🔒 Not Provisioned'}
                        </span>
                      </div>

                      <p style={{ margin: '0.55rem 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                        {provider.description}
                      </p>

                      {/* Stats & Meta */}
                      {isActive ? (
                        <div style={{ marginTop: '0.75rem', padding: '0.55rem 0.7rem', background: '#f0fdf4', borderRadius: '7px', fontSize: '0.74rem', color: '#166534', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div>📊 Leads Synced: <strong>{provider.totalSynced || 0}</strong></div>
                          {provider.lastSyncAt ? (
                            <div>🕒 Last Sync: <strong>{new Date(provider.lastSyncAt).toLocaleString()}</strong></div>
                          ) : (
                            <div>🕒 Auto Ingestion: <strong>Ready &amp; Active</strong></div>
                          )}
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.65rem', background: '#f8fafc', borderRadius: '7px', fontSize: '0.73rem', color: '#94a3b8', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                          Super Admin has not activated this channel.
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
                      {isActive && isIndiaMart && (
                        <button
                          type="button"
                          onClick={handleSyncIndiaMart}
                          disabled={isSyncingIndiaMart}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.75rem',
                            borderRadius: '6px',
                            border: 0,
                            background: '#005b9f',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: isSyncingIndiaMart ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <span>{isSyncingIndiaMart ? 'Syncing...' : '🔄 Sync IndiaMART Leads Now'}</span>
                        </button>
                      )}

                      {isActive && isWebsite && provider.webhookUrl && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(provider.webhookUrl)}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #059669',
                            background: '#ffffff',
                            color: '#059669',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <span>{copiedToken ? '✓ URL Copied!' : '📋 Copy Webhook URL'}</span>
                        </button>
                      )}

                      {!isActive && (
                        <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>🔒</span> Managed by Super Admin
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
            External leads ingested here automatically appear in the <strong>Leads Pipeline</strong> tagged by their channel source.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1.1rem',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
