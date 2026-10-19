'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  IconSearch,
  IconChevronDown,
  IconBuilding,
  IconSettings,
  IconLogout,
  IconBell,
  IconMenu,
} from '../ui/Icons';

export default function Topbar({
  activeTab,
  activeCompany,
  allCompanies = [],
  hasMultipleCompanies = false,
  currentUser = null,
  onSelectCompany,
  onSelectTab,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  onLogout,
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const profileRef = useRef(null);
  const companyRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (companyRef.current && !companyRef.current.contains(e.target)) {
        setShowCompanyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute initials dynamically from actual real name
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    const clean = name.trim();
    if (!clean) return 'U';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const displayName = currentUser?.name || activeCompany?.name || 'Authorized User';
  const displayEmail = currentUser?.email || activeCompany?.email || '';
  const displayOrg = activeCompany?.organizationName || currentUser?.organizationName || '';
  const displayRole = currentUser?.roleTitle || (currentUser?.role === 'DEPARTMENT_HEAD' ? 'Department Head' : currentUser?.role === 'EMPLOYEE' ? 'Employee' : 'Company Admin');
  const userInitials = getInitials(displayName);
  const brandColor = activeCompany?.theme_color || activeCompany?.themeColor || currentUser?.theme_color || currentUser?.themeColor || '#7f22fe';
  const brandGlow = `${brandColor}4d`;

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.75rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        gap: '1.25rem',
      }}
    >
      {/* Left: Sidebar Toggle & Global Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, maxWidth: '520px' }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          style={{
            padding: '0.45rem',
            borderRadius: '6px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Toggle navigation sidebar"
        >
          <IconMenu size={18} />
        </button>

        {/* Global Search Bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '12px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            placeholder="Search leads, orders, inventory, products..."
            value={searchQuery || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 1rem 0.55rem 2.25rem',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              fontSize: '0.84rem',
              color: '#0f172a',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = brandColor;
              e.target.style.backgroundColor = '#ffffff';
              e.target.style.boxShadow = `0 0 0 3px ${brandGlow}`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.backgroundColor = '#f8fafc';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right: Company Name Context + Profile Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
        {/* Company Context Presentation */}
        {hasMultipleCompanies && allCompanies.length > 1 ? (
          /* Multi-company switcher dropdown only when multiple authorized companies exist */
          <div style={{ position: 'relative' }} ref={companyRef}>
            <button
              type="button"
              onClick={() => setShowCompanyMenu(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
              }}
              title="Switch Tenant Company"
            >
              <IconBuilding size={16} style={{ color: brandColor }} />
              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeCompany?.organizationName || 'Select Company'}
              </span>
              <IconChevronDown size={13} style={{ color: '#94a3b8' }} />
            </button>

            {showCompanyMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '260px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  padding: '0.5rem',
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    borderBottom: '1px solid #f1f5f9',
                    marginBottom: '0.35rem',
                  }}
                >
                  Authorized Company Panels
                </div>

                {allCompanies.map((c) => {
                  const isSelected = activeCompany && String(c.id) === String(activeCompany.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectCompany(c.id);
                        setShowCompanyMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isSelected ? '#f5f0ff' : 'transparent',
                        color: isSelected ? brandColor : '#334155',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <div>{c.organizationName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.name}</div>
                      </div>
                      {isSelected && <span style={{ color: brandColor, fontWeight: 800 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeCompany ? (
          /* Normal single-company experience: static verified company name badge (no dropdown/chevron) */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#1e293b',
            }}
            title={`Active Tenant: ${activeCompany.organizationName}`}
          >
            <IconBuilding size={16} style={{ color: brandColor }} />
            <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeCompany.organizationName}
            </span>
          </div>
        ) : null}

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.35rem 0.65rem 0.35rem 0.45rem',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
            }}
            aria-label="Company Admin user profile"
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: brandColor,
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 2px 8px ${brandGlow}`,
              }}
            >
              {userInitials}
            </div>
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                {displayName}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                {displayRole}
              </span>
            </div>
            <IconChevronDown size={13} style={{ color: '#94a3b8' }} />
          </button>

          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '260px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                padding: '0.65rem',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: '0.65rem 0.75rem',
                  borderBottom: '1px solid #f1f5f9',
                  marginBottom: '0.45rem',
                }}
              >
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', wordBreak: 'break-all' }}>
                  {displayEmail || 'No email registered'}
                </div>
                {displayOrg && (
                  <div style={{ fontSize: '0.74rem', color: '#7f22fe', fontWeight: 600, marginTop: '2px' }}>
                    {displayOrg}
                  </div>
                )}
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: '0.4rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#7f22fe',
                    background: '#f5f0ff',
                    border: '1px solid #ebdfff',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Role: {displayRole}
                </div>
              </div>

              <Link
                href="/settings"
                onClick={() => setShowProfileMenu(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  borderRadius: '6px',
                  textAlign: 'left',
                  textDecoration: 'none',
                }}
              >
                <IconSettings size={15} />
                <span>Company Settings &amp; Profile</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  onLogout && onLogout();
                  setShowProfileMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  borderRadius: '6px',
                  textAlign: 'left',
                  marginTop: '0.2rem',
                }}
              >
                <IconLogout size={15} />
                <span>Logout Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
