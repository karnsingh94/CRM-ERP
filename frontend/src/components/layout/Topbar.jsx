'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import { apiRequest } from '../../lib/api';
import styles from '../company-admin/CompanyAdminPortal.module.css';

export default function Topbar({
  activeTab,
  activeCompany,
  allCompanies = [],
  hasMultipleCompanies = false,
  currentUser = null,
  accentColor,
  onSelectCompany,
  onSelectTab,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  onLogout,
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const profileRef = useRef(null);
  const companyRef = useRef(null);
  const notificationRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (companyRef.current && !companyRef.current.contains(e.target)) {
        setShowCompanyMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications for the active company tenant
  const loadNotifications = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      setLoadingNotifications(true);
      const res = await apiRequest(`/companies/${activeCompany.id}/notifications?limit=10`, { noCache: true });
      if (res?.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Keep UI functional if backend notifications route is temporarily unavailable
    } finally {
      setLoadingNotifications(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId, e) => {
    if (e) e.stopPropagation();
    if (!activeCompany?.id) return;
    try {
      await apiRequest(`/companies/${activeCompany.id}/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!activeCompany?.id) return;
    try {
      await apiRequest(`/companies/${activeCompany.id}/notifications/mark-all-read`, {
        method: 'POST',
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

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
  const roleLabels = {
    DEPARTMENT_HEAD: 'Department Head',
    SERVICE_HEAD: 'Department Head',
    TEAM_LEADER: 'Team Leader',
    EMPLOYEE: 'Employee',
  };
  const displayRole = currentUser?.roleTitle || roleLabels[currentUser?.role] || 'Company Admin';
  const isDepartmentHeadPortal = ['DEPARTMENT_HEAD', 'SERVICE_HEAD'].includes(currentUser?.role);
  const isTeamLeaderPortal = currentUser?.role === 'TEAM_LEADER';
  const isEmployeePortal = currentUser?.role === 'EMPLOYEE';
  const isStaffPortal = isDepartmentHeadPortal || isTeamLeaderPortal;
  const settingsHref = isTeamLeaderPortal
    ? '/team-leader/settings'
    : isDepartmentHeadPortal
      ? '/department/settings'
      : isEmployeePortal
        ? '/employee/settings'
        : '/settings';
  const userInitials = getInitials(displayName);
  const brandColor = accentColor || activeCompany?.theme_color || activeCompany?.themeColor || currentUser?.theme_color || currentUser?.themeColor || '#7f22fe';
  const brandGlow = `${brandColor}4d`;

  const getCategoryColor = (category) => {
    switch (category) {
      case 'APPROVAL': return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'TASK': return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
      case 'ALERT': return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
      default: return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
    }
  };

  return (
    <header
      className={styles.topbar}
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
          className={styles.topbarIconButton}
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
          className={styles.companyDropdown}
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

      {/* Right: Notifications + Company Badge + Profile Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
        {/* Universal Topbar Notification Center */}
        <div style={{ position: 'relative' }} ref={notificationRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(prev => !prev)}
            style={{
              position: 'relative',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              backgroundColor: showNotifications ? `${brandColor}10` : '#f8fafc',
              color: showNotifications ? brandColor : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            aria-label="View notifications"
            title="Notifications & Approval Alerts"
          >
            <IconBell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover Dropdown */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '340px',
                maxHeight: '440px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 12px 30px -5px rgba(0, 0, 0, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        backgroundColor: `${brandColor}18`,
                        color: brandColor,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '9999px',
                      }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: brandColor,
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div style={{ overflowY: 'auto', maxHeight: '360px' }}>
                {loadingNotifications && notifications.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                    Loading updates...
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>🔔</div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>No notifications yet</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                      Approval requests and workflow alerts will appear here.
                    </div>
                  </div>
                ) : (
                  notifications.map((item) => {
                    const tagTheme = getCategoryColor(item.category);
                    return (
                      <div
                        key={item.id}
                        onClick={(e) => !item.isRead && handleMarkAsRead(item.id, e)}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: item.isRead ? '#ffffff' : '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: tagTheme.bg,
                              color: tagTheme.text,
                              border: `1px solid ${tagTheme.border}`,
                            }}
                          >
                            {item.category || 'SYSTEM'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: item.isRead ? 600 : 700, color: '#0f172a' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.35 }}>
                          {item.message}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

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
                className={styles.companyDropdownHeading}
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
                      className={`${styles.companyDropdownOption} ${isSelected ? styles.companyDropdownOptionActive : ''}`}
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
                        backgroundColor: isSelected ? `${brandColor}14` : 'transparent',
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
            className={styles.companyContextBadge}
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
            className={styles.profileTrigger}
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
            aria-label={`${displayRole} user profile`}
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
              <span className={styles.profileName} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                {displayName}
              </span>
              <span className={styles.profileRole} style={{ fontSize: '0.7rem', color: '#64748b' }}>
                {displayRole}
              </span>
            </div>
            <IconChevronDown size={13} style={{ color: '#94a3b8' }} />
          </button>

          {showProfileMenu && (
            <div
              className={styles.profileDropdown}
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
                className={styles.profileDropdownHeader}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderBottom: '1px solid #f1f5f9',
                  marginBottom: '0.45rem',
                }}
              >
                <div className={styles.profileDropdownName} style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  {displayName}
                </div>
                <div className={styles.profileDropdownEmail} style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', wordBreak: 'break-all' }}>
                  {displayEmail || 'No email registered'}
                </div>
                {displayOrg && (
                  <div style={{ fontSize: '0.74rem', color: brandColor, fontWeight: 600, marginTop: '2px' }}>
                    {displayOrg}
                  </div>
                )}
                <div
                  className={styles.profileRoleBadge}
                  style={{
                    display: 'inline-block',
                    marginTop: '0.4rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: brandColor,
                    background: `${brandColor}14`,
                    border: `1px solid ${brandColor}33`,
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
                href={settingsHref}
                className={styles.profileDropdownLink}
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
                <span>{isEmployeePortal || isStaffPortal ? 'Settings & Profile' : 'Company Settings & Profile'}</span>
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
