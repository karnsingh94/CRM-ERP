'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './SuperAdminPortal.module.css';
import SuperAdminBreadcrumbs from '@/components/navigation/SuperAdminBreadcrumbs';

const toCatalogCode = (value) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';

const updateCatalogName = (form, setForm, name) => {
  const previousGeneratedCode = form.name ? toCatalogCode(form.name) : '';
  setForm({
    ...form,
    name,
    code: !form.code || form.code === previousGeneratedCode ? toCatalogCode(name) : form.code,
  });
};

const SEEDED_SERVICE_CODES = new Set([
  'crm_sales',
  'purchase_vendor',
  'inventory_warehouse',
  'manufacturing_production',
  'dispatch_returns',
  'accounts_banking',
  'permission_controls',
]);

// ============================================================================
// CONSISTENT ENTERPRISE SVG ICONS (Consistent stroke weight, dimensions & a11y)
// ============================================================================
const IconDashboard = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const IconGrid = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconUsers = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconBuilding = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </svg>
);

const IconClipboardList = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
    <path d="M9 8h6" />
  </svg>
);

const IconSettings = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconSearch = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconPlus = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconEye = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="23" x2="23" y2="1" />
  </svg>
);

const IconShield = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconTrash = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconPencil = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconUser = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLogout = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconLayers = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const IconScreen = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const IconChevronDown = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconSun = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconMoon = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconPalette = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const IconRotateCcw = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const IconCheck = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconLock = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconSliders = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

// In-memory module cache across client-side route transitions
let globalSuperAdminUser = null;
let globalSuperAdminLoaded = false;
let globalSuperAdminDataCache = null;
let lastSuperAdminDataFetchTime = 0;

export default function SuperAdminPortal({ initialTab, initialServiceId }) {
  const pathname = usePathname();
  const router = useRouter();

  // Helper to resolve active tab from URL path
  const resolveTabFromPath = (path) => {
    if (!path || path === '/super-admin' || path === '/super-admin/dashboard') return 'dashboard';
    if (path === '/super-admin/services') return 'services';
    if (path.startsWith('/super-admin/services/')) return 'service-detail';
    if (path === '/super-admin/clients') return 'clients';
    if (path === '/super-admin/audit-logs') return 'audit-logs';
    if (path === '/super-admin/settings') return 'settings';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(initialTab || resolveTabFromPath(pathname));
  const [apiStatus, setApiStatus] = useState('checking');
  const [dbStatus, setDbStatus] = useState('checking');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  // Super Admin Authenticated Identity State
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => globalSuperAdminUser || {
    name: '',
    email: '',
    role: 'Super Admin',
  });
  const [isProfileLoading, setIsProfileLoading] = useState(() => !globalSuperAdminUser);

  // Generate initials dynamically from user's actual name with neutral fallback
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'SA';
    const clean = name.trim();
    if (!clean) return 'SA';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'SA';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const profileInitials = getInitials(currentUser.name || 'Super Admin');

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoutClick = async () => {
    setShowProfileMenu(false);
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('azzuniqe_super_token');
      sessionStorage.removeItem('azzuniqe_super_token');
      localStorage.removeItem('auth_user');
      sessionStorage.removeItem('auth_user');
      document.cookie = 'azzuniqe_super_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'azzuniqe_super_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    showToast('Session Terminated', 'Super Admin logged out safely.', 'info');
    router.replace('/login');
  };

  // Toasts State
  const [toasts, setToasts] = useState([]);

  // Data states (seeded from memory cache when available)
  const [stats, setStats] = useState(() => globalSuperAdminDataCache?.stats || {
    totalServices: 0,
    activeServices: 0,
    totalModules: 0,
    totalSubModules: 0,
    totalClients: 0,
    activeClients: 0,
    totalAuditLogs: 0
  });

  const [services, setServices] = useState(() => globalSuperAdminDataCache?.services || []);
  const [clients, setClients] = useState(() => globalSuperAdminDataCache?.clients || []);
  const [auditLogs, setAuditLogs] = useState(() => globalSuperAdminDataCache?.auditLogs || []);
  const [selectedService, setSelectedService] = useState(null);
  const [accessCatalog, setAccessCatalog] = useState(() => globalSuperAdminDataCache?.accessCatalog || []);

  // Modals
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddSubModuleModal, setShowAddSubModuleModal] = useState(false);
  const [activeModuleForSub, setActiveModuleForSub] = useState(null);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isDeletingService, setIsDeletingService] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientModalMode, setClientModalMode] = useState('create'); // 'create' | 'permissions' | 'details'
  const [clientToDelete, setClientToDelete] = useState(null);

  // Dynamic Client Panel Simulator
  const [simulatedClient, setSimulatedClient] = useState(null);
  const [simActiveModule, setSimActiveModule] = useState(null);

  // Form states
  const [serviceForm, setServiceForm] = useState({ name: '', code: '', description: '', order_no: 8 });
  const [moduleForm, setModuleForm] = useState({ name: '', code: '', description: '', icon: 'layers', order_no: 1 });
  const [subModuleForm, setSubModuleForm] = useState({ name: '', code: '', order_no: 1 });
  
  // Client Form & Permission tree state
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    mobile: '',
    organization_name: '',
    password: '',
    status: 'ACTIVE',
    theme_color: '#7f22fe'
  });
  const [clientAccessTree, setClientAccessTree] = useState({ services: [] });
  const [showClientPassword, setShowClientPassword] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  // Toast Trigger Helper
  const showToast = (title, message, type = 'success') => {
    const id = Date.now() + Math.random();
    const newToast = { id, title, message, type };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // ====================================================
  // SUPER ADMIN SETTINGS & APPEARANCE SYSTEM
  // ====================================================
  const [themeMode, setThemeMode] = useState('system'); // 'light' | 'dark' | 'system'
  const [systemIsDark, setSystemIsDark] = useState(false);
  const [accentColor, setAccentColor] = useState('#7f22fe'); // School Management primary violet
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState('appearance'); // 'appearance' | 'general' | 'account'

  // General Platform Settings State
  const [platformSettings, setPlatformSettings] = useState({
    platformName: 'AZZUNIQE CRM & ERP',
    brandBadge: 'AZ',
    tagline: 'Super Admin',
    supportEmail: 'support@azzuniqe.com',
    supportPhone: '+91 98765 43210',
    defaultTheme: 'system',
  });
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Super Admin Account & Security State
  const [profileNameInput, setProfileNameInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const ACCENT_PRESETS = [
    { name: 'School Violet', hex: '#7f22fe', desc: 'Reference Brand Palette' },
    { name: 'Modern Indigo', hex: '#6366f1', desc: 'Executive Crisp' },
    { name: 'Emerald', hex: '#10b981', desc: 'Growth & Success' },
    { name: 'Amber Gold', hex: '#f59e0b', desc: 'Warm Attention' },
    { name: 'Rose', hex: '#f43f5e', desc: 'Vibrant Accent' },
    { name: 'Sky Blue', hex: '#0284c7', desc: 'Classic Tech' },
  ];

  // Resolve active theme based on user preference and system scheme
  const resolvedTheme = themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  // Sync profile name input when currentUser loads
  useEffect(() => {
    if (currentUser?.name && !profileNameInput) {
      setProfileNameInput(currentUser.name);
    }
  }, [currentUser?.name]);

  // Load preferences from localStorage on mount & listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedTheme = localStorage.getItem('azzuniqe_super_theme') || 'system';
      const savedAccent = localStorage.getItem('azzuniqe_super_accent') || '#7f22fe';
      setThemeMode(savedTheme);
      setAccentColor(savedAccent);

      const savedGeneral = localStorage.getItem('azzuniqe_platform_settings');
      if (savedGeneral) {
        try {
          const parsed = JSON.parse(savedGeneral);
          setPlatformSettings(prev => ({ ...prev, ...parsed }));
        } catch {}
      }

      // Check system color scheme preference
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemIsDark(mql.matches);

      const handleMediaChange = (e) => {
        setSystemIsDark(e.matches);
      };

      if (mql.addEventListener) {
        mql.addEventListener('change', handleMediaChange);
      } else if (mql.addListener) {
        mql.addListener(handleMediaChange);
      }

      return () => {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', handleMediaChange);
        } else if (mql.removeListener) {
          mql.removeListener(handleMediaChange);
        }
      };
    } catch {}
  }, []);

  // Synchronize document-level theme attribute
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Synchronize document-level accent color
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.style.setProperty('--primary', accentColor);
    document.documentElement.style.setProperty('--primary-hover', accentColor === '#7f22fe' ? '#6b12df' : accentColor);
    document.documentElement.style.setProperty('--primary-glow', `${accentColor}40`);
  }, [accentColor]);

  const handleThemeChange = (mode) => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('azzuniqe_super_theme', mode);
      const isSysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const targetTheme = mode === 'system' ? (isSysDark ? 'dark' : 'light') : mode;
      document.documentElement.setAttribute('data-theme', targetTheme);
    }
    showToast('Theme Updated 🎨', `Appearance set to ${mode.charAt(0).toUpperCase() + mode.slice(1)} theme mode.`, 'success');
  };

  const handleAccentChange = (hex) => {
    setAccentColor(hex);
    if (typeof window !== 'undefined') {
      localStorage.setItem('azzuniqe_super_accent', hex);
      document.documentElement.style.setProperty('--primary', hex);
      document.documentElement.style.setProperty('--primary-hover', hex === '#7f22fe' ? '#6b12df' : hex);
      document.documentElement.style.setProperty('--primary-glow', `${hex}40`);
    }
    showToast('Accent Color Updated ✨', `Primary theme accent updated to ${hex}.`, 'success');
  };

  const handleResetTheme = () => {
    setThemeMode('system');
    setAccentColor('#7f22fe');
    if (typeof window !== 'undefined') {
      localStorage.setItem('azzuniqe_super_theme', 'system');
      localStorage.setItem('azzuniqe_super_accent', '#7f22fe');
      const isSysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isSysDark ? 'dark' : 'light');
      document.documentElement.style.setProperty('--primary', '#7f22fe');
      document.documentElement.style.setProperty('--primary-hover', '#6b12df');
      document.documentElement.style.setProperty('--primary-glow', 'rgba(127, 34, 254, 0.25)');
    }
    showToast('Preferences Reset 🔄', 'Appearance restored to default School Management Violet theme.', 'info');
  };

  const handleSavePlatformSettings = (e) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('azzuniqe_platform_settings', JSON.stringify(platformSettings));
      }
      setIsSavingGeneral(false);
      showToast('Settings Saved ⚙️', 'Global platform preferences updated successfully.', 'success');
    }, 300);
  };

  const handleSaveProfileName = async (e) => {
    e.preventDefault();
    if (!profileNameInput || profileNameInput.trim().length < 2) {
      showToast('Validation Error', 'Profile name must be at least 2 characters.', 'danger');
      return;
    }
    setIsSavingProfile(true);
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('azzuniqe_super_token') || sessionStorage.getItem('azzuniqe_super_token') : null;
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;

      const res = await fetch(`${API_BASE}/auth/super-admin/profile`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ name: profileNameInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(prev => ({ ...prev, name: data.data.name }));
        globalSuperAdminUser = { ...(globalSuperAdminUser || {}), name: data.data.name };
        showToast('Profile Updated 🛡️', 'Super Admin identity name updated successfully.', 'success');
      } else {
        showToast('Error', data.message || 'Failed to update profile.', 'danger');
      }
    } catch (err) {
      showToast('Connection Error', err.message, 'danger');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword) {
      showToast('Validation Error', 'Please enter your current password.', 'danger');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      showToast('Weak Password', 'New password must be at least 8 characters long.', 'danger');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showToast('Weak Password', 'New password must contain at least one uppercase letter (A-Z).', 'danger');
      return;
    }
    if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)) {
      showToast('Weak Password', 'New password must contain at least one number or special character.', 'danger');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Validation Error', 'New password and confirmation password do not match.', 'danger');
      return;
    }

    setIsSavingPassword(true);
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('azzuniqe_super_token') || sessionStorage.getItem('azzuniqe_super_token') : null;
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;

      const res = await fetch(`${API_BASE}/auth/super-admin/password`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        showToast('Password Updated 🔐', 'Your Super Admin credentials have been securely updated.', 'success');
      } else {
        showToast('Update Failed', data.message || 'Failed to update password.', 'danger');
      }
    } catch (err) {
      showToast('Connection Error', err.message, 'danger');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Load authenticated Super Admin profile from session / storage or profile API
  const loadUserProfile = async () => {
    if (globalSuperAdminLoaded && globalSuperAdminUser) {
      setCurrentUser(globalSuperAdminUser);
      setIsProfileLoading(false);
      return;
    }

    let resolvedUser = globalSuperAdminUser;

    const storedToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('azzuniqe_super_token') || sessionStorage.getItem('azzuniqe_super_token')
        : null;

    // Check storage first for instant response
    if (!resolvedUser && typeof window !== 'undefined') {
      const storageKeys = ['auth_user', 'azzuniqe_auth_user', 'super_admin_user'];
      for (const key of storageKeys) {
        try {
          const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const candidate = parsed?.user || parsed?.data || parsed;
            if (candidate && (candidate.role === 'SUPER_ADMIN' || candidate.role === 'Super Admin')) {
              resolvedUser = {
                name: candidate.name || 'Platform Super Admin',
                email: candidate.email || 'admin@azzuniqe.com',
                role: 'Super Admin',
              };
              break;
            }
          }
        } catch {}
      }
    }

    if (resolvedUser) {
      globalSuperAdminUser = resolvedUser;
      globalSuperAdminLoaded = true;
      setCurrentUser(resolvedUser);
      setIsProfileLoading(false);
    } else {
      setIsProfileLoading(true);
    }

    // Verify session in background silently
    if (storedToken) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${storedToken}` },
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const json = await res.json().catch(() => null);
          const candidate = json?.data?.user || json?.data || json?.user || json;
          if (candidate && (candidate.role === 'SUPER_ADMIN' || candidate.role === 'Super Admin')) {
            const freshUser = {
              name: candidate.name || 'Platform Super Admin',
              email: candidate.email || 'admin@azzuniqe.com',
              role: 'Super Admin',
            };
            globalSuperAdminUser = freshUser;
            globalSuperAdminLoaded = true;
            setCurrentUser(freshUser);
            setIsProfileLoading(false);
            return;
          }
        }
      } catch {
        // Network check failed
      }
    }

    if (!resolvedUser) {
      setIsProfileLoading(false);
      if (typeof window !== 'undefined') {
        const clientToken = localStorage.getItem('azzuniqe_client_token');
        if (clientToken && (pathname === '/dashboard' || pathname === '/')) {
          return;
        }
        const target = pathname && pathname !== '/' && pathname !== '/dashboard' ? pathname : '/super-admin';
        router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      }
    }
  };

  // Load initial data (cached to prevent 2-3s route re-render glitches)
  const fetchData = async (force = false) => {
    if (!force && globalSuperAdminDataCache && (Date.now() - lastSuperAdminDataFetchTime < 60000)) {
      return;
    }

    try {
      const [healthRes, dbRes, statsRes, servicesRes, clientsRes, logsRes, catalogRes] = await Promise.all([
        fetch(`${API_BASE}/health`).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/db-status`).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/dashboard/stats`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/services`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/clients`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/audit-logs`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/access-catalog`).then(r => r.json()).catch(() => null),
      ]);

      setApiStatus(healthRes.ok ? 'online' : 'offline');
      if (dbRes.ok) {
        const dbJson = await dbRes.json().catch(() => ({ connected: false }));
        setDbStatus(dbJson.connected ? 'connected' : 'resilient');
      } else {
        setDbStatus('resilient');
      }

      const newStats = statsRes?.data || stats;
      const newServices = servicesRes?.data || services;
      const newClients = clientsRes?.data || clients;
      const newLogs = logsRes?.data || auditLogs;
      const newCatalog = catalogRes?.data || accessCatalog;

      globalSuperAdminDataCache = {
        stats: newStats,
        services: newServices,
        clients: newClients,
        auditLogs: newLogs,
        accessCatalog: newCatalog,
      };
      lastSuperAdminDataFetchTime = Date.now();

      if (statsRes && statsRes.data) setStats(statsRes.data);
      if (servicesRes && servicesRes.data) setServices(servicesRes.data);
      if (clientsRes && clientsRes.data) setClients(clientsRes.data);
      if (logsRes && logsRes.data) setAuditLogs(logsRes.data);
      if (catalogRes && catalogRes.data) setAccessCatalog(catalogRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchData();
    loadUserProfile();

    // Dynamically react if auth session is populated in storage
    const handleStorageChange = () => {
      loadUserProfile();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  // Fetch full details for a single service
  const handleOpenServiceDetail = async (serviceId, shouldPushRoute = true) => {
    try {
      const res = await fetch(`${API_BASE}/services/${serviceId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedService(json.data);
        setActiveTab('service-detail');
        if (shouldPushRoute && router) {
          const targetSlug = json.data.code ? json.data.code.replace(/_/g, '-') : json.data.id;
          const targetUrl = `/super-admin/services/${targetSlug}`;
          if (pathname !== targetUrl) {
            router.push(targetUrl);
          }
        }
      }
    } catch (err) {
      console.error('Error loading service details:', err);
    }
  };

  // Synchronize route with activeTab when URL changes or on initialServiceId
  useEffect(() => {
    if (initialServiceId) {
      handleOpenServiceDetail(initialServiceId, false);
      return;
    }
    if (pathname) {
      const targetTab = resolveTabFromPath(pathname);
      setActiveTab(targetTab);
      if (pathname.startsWith('/super-admin/services/')) {
        const idOrSlug = pathname.replace('/super-admin/services/', '').split('/')[0];
        if (idOrSlug && idOrSlug !== 'departments') {
          handleOpenServiceDetail(idOrSlug, false);
        }
      }
    }
  }, [pathname, initialServiceId]);

  // Toggle Service status with Toast & Optimistic UI Update
  const handleToggleServiceStatus = async (id, serviceName, currentStatus, e) => {
    e?.stopPropagation();

    // 1. Instant Optimistic UI Flip (zero lag)
    const previousServices = services;
    const targetService = services.find(s => s.id === id);
    const newStatusOptimistic = targetService?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    setServices(prev => prev.map(s => s.id === id ? { ...s, status: newStatusOptimistic } : s));
    if (selectedService && selectedService.id === id) {
      setSelectedService(prev => prev ? { ...prev, status: newStatusOptimistic } : null);
    }

    try {
      const res = await fetch(`${API_BASE}/services/${id}/status`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) {
        const newStatus = json.data.status;
        setServices(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        if (selectedService && selectedService.id === id) {
          setSelectedService(prev => prev ? { ...prev, status: newStatus } : null);
        }
        if (newStatus === 'ACTIVE') {
          showToast('Service Activated! 🟢', `"${serviceName}" is now ACTIVE and available to clients.`, 'success');
        } else {
          showToast('Service Inactivated! 🔴', `"${serviceName}" is now INACTIVE. Its modules are temporarily disabled.`, 'danger');
        }
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('cached_company_data');
            localStorage.setItem('azzuniqe_catalog_updated', String(Date.now()));
          } catch {}
        }
        fetchData(true);
        if (selectedService && selectedService.id === id) {
          handleOpenServiceDetail(id, false);
        }
      } else {
        setServices(previousServices);
        showToast('Action Failed', json.message || 'Status toggle failed', 'danger');
      }
    } catch (err) {
      setServices(previousServices);
      showToast('Action Failed', err.message, 'danger');
    }
  };

  // Create Service
  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddServiceModal(false);
        showToast('Service Created! 🎉', `"${serviceForm.name}" has been added to the Global Catalogue.`, 'success');
        if (json.data) {
          setServices(prev => [...prev, json.data]);
        }
        setServiceForm({ name: '', code: '', description: '', order_no: 8 });
        fetchData(true);
      } else {
        showToast('Service not created', json.message || 'Unable to create service.', 'danger');
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  const handleOpenAddServiceModal = () => {
    setServiceForm({
      name: '',
      code: '',
      description: '',
      order_no: Math.max(8, services.length + 1),
    });
    setShowAddServiceModal(true);
  };

  // Create Module under Service
  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!selectedService) return;
    try {
      const res = await fetch(`${API_BASE}/services/${selectedService.id}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModuleModal(false);
        showToast('Main Module Added! 📁', `"${moduleForm.name}" added to ${selectedService.name}.`, 'success');
        setModuleForm({ name: '', code: '', description: '', icon: 'layers', order_no: 1 });
        handleOpenServiceDetail(selectedService.id, false);
        fetchData(true);
      } else {
        showToast('Module not created', json.message || 'Unable to create module.', 'danger');
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  // Create Sub-Module under Module
  const handleCreateSubModule = async (e) => {
    e.preventDefault();
    if (!activeModuleForSub) return;
    try {
      const res = await fetch(`${API_BASE}/modules/${activeModuleForSub.id}/sub-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subModuleForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddSubModuleModal(false);
        showToast('Sub-Module Created! ⚡', `Screen "${subModuleForm.name}" added to ${activeModuleForSub.name}.`, 'success');
        setSubModuleForm({ name: '', code: '', order_no: 1 });
        if (selectedService) handleOpenServiceDetail(selectedService.id, false);
        fetchData(true);
      } else {
        showToast('Sub-module not created', json.message || 'Unable to create sub-module.', 'danger');
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete || isDeletingService) return;

    setIsDeletingService(true);
    try {
      const storedToken = localStorage.getItem('azzuniqe_super_token') || sessionStorage.getItem('azzuniqe_super_token');
      const headers = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
      const res = await fetch(`${API_BASE}/services/${serviceToDelete.id}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        showToast('Service not deleted', json.message || 'Unable to delete service.', 'danger');
        return;
      }

      setServices((previous) => previous.filter((service) => service.id !== serviceToDelete.id));
      if (selectedService?.id === serviceToDelete.id) {
        setSelectedService(null);
        setActiveTab('services');
        router.push('/super-admin/services');
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cached_company_data');
        localStorage.setItem('azzuniqe_catalog_updated', String(Date.now()));
      }
      showToast('Service Deleted', `"${serviceToDelete.name}" and its modules have been permanently deleted.`, 'success');
      setServiceToDelete(null);
      fetchData(true);
    } catch (err) {
      showToast('Service not deleted', err.message, 'danger');
    } finally {
      setIsDeletingService(false);
    }
  };

  // Toggle Module status
  const handleToggleModuleStatus = async (moduleId, moduleName) => {
    // Optimistic toggle for instant UI responsiveness
    if (selectedService && selectedService.modules) {
      setSelectedService(prev => {
        if (!prev || !prev.modules) return prev;
        return {
          ...prev,
          modules: prev.modules.map(m => m.id === moduleId ? { ...m, status: m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : m)
        };
      });
    }

    try {
      const res = await fetch(`${API_BASE}/modules/${moduleId}/status`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) {
        const isAct = json.data.status === 'ACTIVE';
        if (selectedService && selectedService.modules) {
          setSelectedService(prev => {
            if (!prev || !prev.modules) return prev;
            return {
              ...prev,
              modules: prev.modules.map(m => m.id === moduleId ? { ...m, status: json.data.status } : m)
            };
          });
        }
        showToast(
          isAct ? 'Module Activated! 🟢' : 'Module Inactivated! 🔴',
          `"${moduleName}" is now ${json.data.status}.`,
          isAct ? 'success' : 'danger'
        );
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('cached_company_data');
            localStorage.setItem('azzuniqe_catalog_updated', String(Date.now()));
          } catch {}
        }
        fetchData(true);
        if (selectedService) handleOpenServiceDetail(selectedService.id, false);
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  // Toggle Sub-Module status
  const handleToggleSubModuleStatus = async (subModuleId, subName) => {
    // Optimistic toggle for instant UI responsiveness
    if (selectedService && selectedService.modules) {
      setSelectedService(prev => {
        if (!prev || !prev.modules) return prev;
        return {
          ...prev,
          modules: prev.modules.map(m => ({
            ...m,
            subModules: (m.subModules || []).map(sm => sm.id === subModuleId ? { ...sm, status: sm.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : sm)
          }))
        };
      });
    }

    try {
      const res = await fetch(`${API_BASE}/sub-modules/${subModuleId}/status`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) {
        const isAct = json.data.status === 'ACTIVE';
        if (selectedService && selectedService.modules) {
          setSelectedService(prev => {
            if (!prev || !prev.modules) return prev;
            return {
              ...prev,
              modules: prev.modules.map(m => ({
                ...m,
                subModules: (m.subModules || []).map(sm => sm.id === subModuleId ? { ...sm, status: json.data.status } : sm)
              }))
            };
          });
        }
        showToast(
          isAct ? 'Sub-Module Active! 🟢' : 'Sub-Module Inactive! 🔴',
          `Feature screen "${subName}" is now ${json.data.status}.`,
          isAct ? 'success' : 'danger'
        );
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('cached_company_data');
            localStorage.setItem('azzuniqe_catalog_updated', String(Date.now()));
          } catch {}
        }
        fetchData(true);
        if (selectedService) handleOpenServiceDetail(selectedService.id, false);
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  // Client / Admin Management
  const handleOpenNewClientModal = () => {
    setEditingClient(null);
    setClientModalMode('create');
    setClientForm({
      name: '',
      email: '',
      mobile: '',
      organization_name: '',
      password: '',
      status: 'ACTIVE',
      theme_color: '#7f22fe'
    });
    setClientAccessTree({ services: [] });
    setShowClientPassword(false);
    setShowClientModal(true);
  };

  // Open dedicated PERMISSIONS-ONLY view (Section 2 only)
  const handleOpenPermissionsModal = (client) => {
    setEditingClient(client);
    setClientModalMode('permissions');
    setClientForm({
      name: client.name,
      email: client.email,
      mobile: client.mobile || '',
      organization_name: client.organization_name,
      password: '',
      status: client.status,
      theme_color: client.theme_color || client.themeColor || '#7f22fe'
    });
    setClientAccessTree(client.access || { services: [] });
    setShowClientPassword(false);
    setShowClientModal(true);
  };

  // Open dedicated DETAILS view (Section 1 only)
  const handleOpenEditClientModal = (client) => {
    setEditingClient(client);
    setClientModalMode('details');
    setClientForm({
      name: client.name,
      email: client.email,
      mobile: client.mobile || '',
      organization_name: client.organization_name,
      password: '',
      status: client.status,
      theme_color: client.theme_color || client.themeColor || '#7f22fe'
    });
    setClientAccessTree(client.access || { services: [] });
    setShowClientPassword(false);
    setShowClientModal(true);
  };

  const handleToggleClientStatus = async (id, orgName) => {
    // 1. Instant Optimistic toggle for clients
    const prevClients = clients;
    const targetClient = clients.find(c => c.id === id);
    const newStatusOptimistic = targetClient?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: newStatusOptimistic } : c));

    try {
      const res = await fetch(`${API_BASE}/clients/${id}/status`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) {
        const isAct = json.data.status === 'ACTIVE';
        setClients(prev => prev.map(c => c.id === id ? { ...c, status: json.data.status } : c));
        showToast(
          isAct ? 'Client Panel Activated! 🟢' : 'Client Panel Deactivated! 🔴',
          `Panel for "${orgName}" is now ${json.data.status}.`,
          isAct ? 'success' : 'danger'
        );
        fetchData(true);
      } else {
        setClients(prevClients);
        showToast('Error', json.message || 'Status update failed.', 'danger');
      }
    } catch (err) {
      setClients(prevClients);
      showToast('Error', err.message, 'danger');
    }
  };

  const handleRequestDeleteClient = (client) => {
    setClientToDelete(client);
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return;
    const { id, organization_name } = clientToDelete;
    setClientToDelete(null);
    // Instant optimistic removal from UI
    setClients(prev => prev.filter(c => c.id !== id));
    try {
      await fetch(`${API_BASE}/clients/${id}`, { method: 'DELETE' });
      showToast('Client Deleted 🗑️', `Panel for "${organization_name}" has been removed.`, 'danger');
      fetchData(true);
    } catch (err) {
      showToast('Error', err.message, 'danger');
      fetchData(true);
    }
  };

  // Permission Tree Handler (PDF Section 5 & 5.1 & 5.2)
  const isServiceSelected = (serviceId) => {
    return clientAccessTree.services.some(s => String(s.service_id) === String(serviceId));
  };

  const isFullService = (serviceId) => {
    const s = clientAccessTree.services.find(item => String(item.service_id) === String(serviceId));
    return s ? Boolean(s.full_service) : false;
  };

  const handleToggleServiceAccess = (serviceId) => {
    const sId = String(serviceId);
    let updated = [...clientAccessTree.services];
    const index = updated.findIndex(s => String(s.service_id) === sId);

    if (index > -1) {
      updated.splice(index, 1);
    } else {
      updated.push({
        service_id: sId,
        full_service: true,
        modules: []
      });
    }
    setClientAccessTree({ services: updated });
  };

  const handleToggleFullServiceCheckbox = (serviceId) => {
    const sId = String(serviceId);
    let updated = [...clientAccessTree.services];
    const index = updated.findIndex(s => String(s.service_id) === sId);

    if (index > -1) {
      const currentFull = updated[index].full_service;
      updated[index] = {
        ...updated[index],
        full_service: !currentFull,
        modules: !currentFull ? [] : (updated[index].modules || [])
      };
    } else {
      updated.push({
        service_id: sId,
        full_service: true,
        modules: []
      });
    }
    setClientAccessTree({ services: updated });
  };

  const getModuleAccessMode = (serviceId, moduleId) => {
    const s = clientAccessTree.services.find(item => String(item.service_id) === String(serviceId));
    if (!s) return 'NONE';
    if (s.full_service) return 'FULL';
    const m = (s.modules || []).find(mod => String(mod.module_id) === String(moduleId));
    return m ? m.access_mode : 'NONE';
  };

  const handleSetModuleAccessMode = (serviceId, moduleId, mode) => {
    const sId = String(serviceId);
    const mId = String(moduleId);
    let updated = [...clientAccessTree.services];
    let s = updated.find(item => String(item.service_id) === sId);

    if (!s) {
      s = { service_id: sId, full_service: false, modules: [] };
      updated.push(s);
    } else {
      s.full_service = false;
    }

    if (!s.modules) s.modules = [];
    const mIndex = s.modules.findIndex(mod => String(mod.module_id) === mId);

    if (mode === 'NONE') {
      if (mIndex > -1) s.modules.splice(mIndex, 1);
    } else if (mode === 'FULL') {
      if (mIndex > -1) {
        s.modules[mIndex] = { module_id: mId, access_mode: 'FULL' };
      } else {
        s.modules.push({ module_id: mId, access_mode: 'FULL' });
      }
    } else if (mode === 'CUSTOM') {
      if (mIndex > -1) {
        s.modules[mIndex] = { module_id: mId, access_mode: 'CUSTOM', sub_module_ids: s.modules[mIndex].sub_module_ids || [] };
      } else {
        s.modules.push({ module_id: mId, access_mode: 'CUSTOM', sub_module_ids: [] });
      }
    }

    setClientAccessTree({ services: updated });
  };

  const isSubModuleSelected = (serviceId, moduleId, subModuleId) => {
    const s = clientAccessTree.services.find(item => String(item.service_id) === String(serviceId));
    if (!s) return false;
    if (s.full_service) return true;
    const m = (s.modules || []).find(mod => String(mod.module_id) === String(moduleId));
    if (!m) return false;
    if (m.access_mode === 'FULL') return true;
    return (m.sub_module_ids || []).includes(String(subModuleId));
  };

  const handleToggleSubModuleCheckbox = (serviceId, moduleId, subModuleId) => {
    const sId = String(serviceId);
    const mId = String(moduleId);
    const smId = String(subModuleId);

    let updated = [...clientAccessTree.services];
    let s = updated.find(item => String(item.service_id) === sId);
    if (!s) {
      s = { service_id: sId, full_service: false, modules: [] };
      updated.push(s);
    }
    s.full_service = false;

    if (!s.modules) s.modules = [];
    let m = s.modules.find(mod => String(mod.module_id) === mId);
    if (!m) {
      m = { module_id: mId, access_mode: 'CUSTOM', sub_module_ids: [smId] };
      s.modules.push(m);
    } else {
      m.access_mode = 'CUSTOM';
      if (!m.sub_module_ids) m.sub_module_ids = [];
      const subIdx = m.sub_module_ids.indexOf(smId);
      if (subIdx > -1) {
        m.sub_module_ids.splice(subIdx, 1);
      } else {
        m.sub_module_ids.push(smId);
      }
    }

    setClientAccessTree({ services: updated });
  };

  const handleSelectAllSubModules = (serviceId, moduleId, allSubIds) => {
    const sId = String(serviceId);
    const mId = String(moduleId);
    let updated = [...clientAccessTree.services];
    let s = updated.find(item => String(item.service_id) === sId);
    if (!s) {
      s = { service_id: sId, full_service: false, modules: [] };
      updated.push(s);
    }
    s.full_service = false;

    if (!s.modules) s.modules = [];
    let m = s.modules.find(mod => String(mod.module_id) === mId);
    if (!m) {
      m = { module_id: mId, access_mode: 'CUSTOM', sub_module_ids: allSubIds.map(String) };
      s.modules.push(m);
    } else {
      m.access_mode = 'CUSTOM';
      m.sub_module_ids = allSubIds.map(String);
    }

    setClientAccessTree({ services: updated });
  };

  // Submit Client Save with Toast & Comprehensive Validations
  const handleSaveClient = async (e) => {
    e.preventDefault();

    // 1. If in dedicated PERMISSIONS mode, update permissions directly without credential validations
    if (clientModalMode === 'permissions' && editingClient) {
      try {
        const res = await fetch(`${API_BASE}/clients/${editingClient.id}/access`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access: clientAccessTree })
        });

        const json = await res.json();
        if (res.ok && json.success) {
          setShowClientModal(false);
          // Instant optimistic permissions update in memory
          if (json.data) {
            setClients(prev => prev.map(c => c.id === editingClient.id ? json.data : c));
          } else {
            setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, access: clientAccessTree } : c));
          }
          showToast(
            'Permissions Updated! 🔐',
            `Dynamic panel permissions saved for "${editingClient.organization_name}".`,
            'success'
          );
          fetchData(true);
        } else {
          showToast('Update Failed', json.message || 'Failed to update permissions.', 'danger');
        }
      } catch (err) {
        showToast('Error', err.message, 'danger');
      }
      return;
    }

    // 2. Organization & Admin Name & Email validation (for Create & Details modes)
    if (!clientForm.organization_name.trim()) {
      showToast('Validation Error', 'Company / Organization name is required.', 'danger');
      return;
    }
    if (!clientForm.name.trim()) {
      showToast('Validation Error', 'Admin full name is required.', 'danger');
      return;
    }
    if (!clientForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientForm.email.trim())) {
      showToast('Validation Error', 'A valid email address is required.', 'danger');
      return;
    }

    // 2. Mobile Validation (Exactly 10 digits starting with 6, 7, 8, 9)
    if (clientForm.mobile && clientForm.mobile.trim()) {
      const cleanMob = clientForm.mobile.trim().replace(/\D/g, '');
      if (cleanMob.length !== 10) {
        showToast('Invalid Mobile Number', 'Mobile number must be exactly 10 digits.', 'danger');
        return;
      }
      if (!/^[6-9]/.test(cleanMob)) {
        showToast('Invalid Mobile Number', 'Mobile number must start with 6, 7, 8, or 9 (numbers starting with 5 or below are not accepted).', 'danger');
        return;
      }
    }

    // 3. Password Validation (At least 8 chars, 1 uppercase, 1 special character)
    const pwd = clientForm.password;
    if (!editingClient) {
      if (!pwd || pwd.length < 8) {
        showToast('Password Too Short', 'Initial password must be at least 8 characters long.', 'danger');
        return;
      }
      if (!/[A-Z]/.test(pwd)) {
        showToast('Weak Password', 'Password must contain at least one uppercase letter (A-Z).', 'danger');
        return;
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd)) {
        showToast('Weak Password', 'Password must contain at least one special character (!@#$%^&* etc.).', 'danger');
        return;
      }
    } else if (pwd && pwd.trim()) {
      if (pwd.length < 8) {
        showToast('Password Too Short', 'New password must be at least 8 characters long.', 'danger');
        return;
      }
      if (!/[A-Z]/.test(pwd)) {
        showToast('Weak Password', 'New password must contain at least one uppercase letter (A-Z).', 'danger');
        return;
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd)) {
        showToast('Weak Password', 'New password must contain at least one special character (!@#$%^&* etc.).', 'danger');
        return;
      }
    }

    try {
      const payload = {
        ...clientForm,
        mobile: clientForm.mobile ? clientForm.mobile.trim().replace(/\D/g, '') : null,
        access: clientAccessTree
      };

      let res;
      if (editingClient) {
        res = await fetch(`${API_BASE}/clients/${editingClient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (res.ok && json.success) {
        setShowClientModal(false);
        if (json.data) {
          if (editingClient) {
            setClients(prev => prev.map(c => c.id === editingClient.id ? json.data : c));
          } else {
            setClients(prev => [json.data, ...prev]);
          }
        }
        showToast(
          editingClient ? 'Permissions Updated! 🔐' : 'Client Panel Provisioned! 🚀',
          `Successfully saved dynamic panel permissions for "${clientForm.organization_name}".`,
          'success'
        );
        fetchData(true);
      } else {
        showToast('Validation Error', json.message || 'Failed to save company panel.', 'danger');
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  // Switch directly into real Client Panel workspace
  const handleSwitchToClientPanel = async (client) => {
    try {
      showToast('Switching Workspace...', `Authenticating real session for "${client.organization_name}"...`, 'info');
      const res = await fetch(`${API_BASE}/clients/${client.id}/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const { token, user } = json.data;
        // 1. Back up Super Admin token so we can easily return anytime
        const currentSuperToken = localStorage.getItem('azzuniqe_super_token') || sessionStorage.getItem('azzuniqe_super_token');
        if (currentSuperToken) {
          localStorage.setItem('azzuniqe_super_token_backup', currentSuperToken);
          localStorage.removeItem('azzuniqe_super_token');
          sessionStorage.removeItem('azzuniqe_super_token');
        }
        // 2. Set active client credentials
        localStorage.setItem('azzuniqe_client_token', token);
        localStorage.setItem('company_user', JSON.stringify(user));
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('active_company_id', String(user.companyId || client.id));
        localStorage.setItem('is_super_admin_impersonating', 'true');
        localStorage.setItem('impersonated_client_name', client.organization_name);

        const compData = {
          id: String(user.companyId || client.id),
          name: client.organization_name || user.name,
          organizationName: client.organization_name || user.organizationName,
          email: client.email || user.email,
          themeColor: client.theme_color || client.themeColor || user.themeColor || '#7f22fe',
          theme_color: client.theme_color || client.themeColor || user.themeColor || '#7f22fe',
          access: client.access || user.access || { services: [] },
          status: client.status || 'ACTIVE',
        };
        localStorage.setItem('cached_company_data', JSON.stringify(compData));

        showToast('Switched Successfully! 🚀', `Opening "${client.organization_name}" workspace...`, 'success');

        // Redirect directly to the real client dashboard!
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 350);
      } else {
        showToast('Switch Failed', json.message || 'Could not switch to client panel.', 'danger');
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  // Filter clients by search with defensive null-checks
  const filteredClients = (clients || []).filter(c => {
    if (!c) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;
    const org = String(c.organization_name || c.organizationName || '').toLowerCase();
    const name = String(c.name || '').toLowerCase();
    const email = String(c.email || '').toLowerCase();
    return org.includes(q) || name.includes(q) || email.includes(q);
  });

  // Helper for service card color class
  const getServiceColorClass = (code = '') => {
    const c = String(code).toLowerCase();
    if (c.includes('crm') || c.includes('sales')) return styles.stripCRM;
    if (c.includes('purchase') || c.includes('vendor')) return styles.stripPurchase;
    if (c.includes('inventory') || c.includes('warehouse') || c.includes('stock')) return styles.stripInventory;
    if (c.includes('manufacturing') || c.includes('production')) return styles.stripManufacturing;
    if (c.includes('dispatch') || c.includes('returns')) return styles.stripDispatch;
    if (c.includes('account') || c.includes('finance') || c.includes('bank')) return styles.stripFinance;
    if (c.includes('permission') || c.includes('control') || c.includes('system')) return styles.stripPermission;
    return styles.stripDefault;
  };

  if (!isMounted || isProfileLoading || !currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Verifying Super Admin session...
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.appLayout}
      data-theme={resolvedTheme}
      style={{
        '--primary': accentColor,
        '--primary-hover': accentColor === '#7f22fe' ? '#6b12df' : accentColor,
        '--primary-glow': `${accentColor}33`,
      }}
    >
      {/* ==================== TOAST CONTAINER ==================== */}
      <div className={styles.toastContainer}>
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${styles.toast} ${
              t.type === 'success' ? styles.toastSuccess : t.type === 'danger' ? styles.toastDanger : styles.toastInfo
            }`}
          >
            <span className={styles.toastIcon}>
              {t.type === 'success' ? '✅' : t.type === 'danger' ? '⛔' : 'ℹ️'}
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{t.title}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '2px' }}>{t.message}</div>
            </div>
            <button className={styles.toastClose} onClick={() => removeToast(t.id)}>&times;</button>
          </div>
        ))}
      </div>

      {/* ==================== SIDEBAR ==================== */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <div className={styles.brandLogo}>{platformSettings.brandBadge || 'AZ'}</div>
          <div className={styles.brandInfo}>
            <h2>{platformSettings.platformName || 'AZZUNIQE'}</h2>
            <span>{platformSettings.tagline || 'Super Admin'}</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSectionTitle}>Navigation</div>
          
          <Link
            href="/super-admin/dashboard"
            className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}><IconDashboard size={18} /></span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/super-admin/services"
            className={`${styles.navItem} ${activeTab === 'services' || activeTab === 'service-detail' ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}><IconGrid size={18} /></span>
            <span>Services Catalog</span>
            <span className={styles.navBadge}>{services.length}</span>
          </Link>

          <Link
            href="/super-admin/clients"
            className={`${styles.navItem} ${activeTab === 'clients' ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}><IconUsers size={18} /></span>
            <span>Admins / Clients</span>
            <span className={styles.navBadge}>{clients.length}</span>
          </Link>

          <div className={styles.navSectionTitle}>System &amp; Security</div>

          <Link
            href="/super-admin/audit-logs"
            className={`${styles.navItem} ${activeTab === 'audit-logs' ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}><IconClipboardList size={18} /></span>
            <span>Audit Logs</span>
          </Link>

          <Link
            href="/super-admin/settings"
            className={`${styles.navItem} ${activeTab === 'settings' ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}><IconSettings size={18} /></span>
            <span>Settings</span>
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>
              {isProfileLoading ? '..' : profileInitials}
            </div>
            <div>
              <div className={styles.userName}>
                {isProfileLoading ? 'Loading...' : (currentUser.name || 'Super Admin')}
              </div>
              <div className={styles.userRole}>Platform Super Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT WRAPPER ==================== */}
      <div className={styles.mainContent}>
        {/* Top Header */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon} aria-hidden="true">
                <IconSearch size={16} />
              </span>
              <input
                type="text"
                placeholder="Search services, companies, admins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search services, companies, and admins"
              />
            </div>
          </div>

          <div className={styles.topbarRight} ref={profileRef}>
            <button
              type="button"
              className={styles.profileTrigger}
              onClick={() => setShowProfileMenu(prev => !prev)}
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
              aria-label="Super Admin user profile"
            >
              <div className={styles.profileAvatar} aria-hidden="true">
                {isProfileLoading ? '..' : profileInitials}
              </div>
              <div className={styles.profileMeta}>
                <span className={styles.profileName}>
                  {isProfileLoading ? 'Loading...' : (currentUser.name || 'Super Admin')}
                </span>
                <span className={styles.profileRole}>Super Admin</span>
              </div>
              <IconChevronDown size={14} className={styles.profileChevron} />
            </button>

            {showProfileMenu && (
              <div className={styles.profileDropdown} role="menu">
                <div className={styles.dropdownHeader}>
                  <div className={styles.dropdownTitle}>
                    {isProfileLoading ? 'Loading...' : (currentUser.name || 'Super Admin')}
                  </div>
                  <div className={styles.dropdownEmail}>
                    {currentUser.email ? currentUser.email : 'Email unavailable'}
                  </div>
                  <div className={styles.dropdownRoleBadge}>Super Admin</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setShowProfileMenu(false);
                    router.push('/super-admin/settings');
                  }}
                >
                  <IconSettings size={15} />
                  <span>Profile &amp; Settings</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setShowProfileMenu(false);
                    router.push('/super-admin/audit-logs');
                  }}
                >
                  <IconClipboardList size={15} />
                  <span>System Audit Trail</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={handleLogoutClick}
                >
                  <IconLogout size={15} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className={styles.contentArea}>
          {/* ==================================================== */}
          {/* TAB 1: DASHBOARD                                    */}
          {/* ==================================================== */}
          {activeTab === 'dashboard' && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>Platform Statistics</h3>
                  <p>Real-time overview of Services, Modules, and provisioned Client Panels</p>
                </div>
                <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', flexShrink: 0 }}>
                  <button type="button" className={styles.btnPrimary} onClick={handleOpenNewClientModal} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <IconPlus size={15} /> Add New Admin / Client
                  </button>
                  <button type="button" className={`${styles.btnSecondary} ${styles.btnPurple}`} onClick={handleOpenAddServiceModal} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <IconPlus size={15} /> Add Service
                  </button>
                </div>
              </div>

              {/* Colorful KPI Cards */}
              <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
                  <div className={`${styles.kpiIcon} ${styles.blueIcon}`}><IconGrid size={22} /></div>
                  <div className={styles.kpiData}>
                    <h4>{stats.totalServices}</h4>
                    <span>Active Services</span>
                  </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                  <div className={`${styles.kpiIcon} ${styles.purpleIcon}`}><IconLayers size={22} /></div>
                  <div className={styles.kpiData}>
                    <h4>{stats.totalModules}</h4>
                    <span>Main Modules</span>
                  </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiEmerald}`}>
                  <div className={`${styles.kpiIcon} ${styles.emeraldIcon}`}><IconScreen size={22} /></div>
                  <div className={styles.kpiData}>
                    <h4>{stats.totalSubModules}</h4>
                    <span>Sub-Modules (Screens)</span>
                  </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
                  <div className={`${styles.kpiIcon} ${styles.amberIcon}`}><IconUsers size={22} /></div>
                  <div className={styles.kpiData}>
                    <h4>{stats.totalClients}</h4>
                    <span>Admin/Client Panels</span>
                  </div>
                </div>
              </div>

              {/* Recent Clients Table */}
              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <span className={styles.tableTitle}>Provisioned Companies / Admins</span>
                  <button type="button" className={styles.btnSecondary} onClick={() => router.push('/super-admin/clients')} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Manage All ({clients.length}) &rarr;
                  </button>
                </div>
                {clients.length > 0 ? (
                  <div className={styles.tableScrollContainer}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th className={styles.colCompany}>Company / Organization</th>
                          <th className={styles.colAdmin}>Admin Name</th>
                          <th className={styles.colEmail}>Email</th>
                          <th className={styles.colPermissions}>Permission Status</th>
                          <th className={styles.colStatus}>Live State</th>
                          <th className={styles.colActions}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.slice(0, 10).map(c => {
                          const isAct = c.status === 'ACTIVE';
                          return (
                            <tr key={c.id}>
                              <td className={styles.colCompany} title={c.organization_name}>
                                <strong className={styles.companyNameText}>{c.organization_name}</strong>
                              </td>
                              <td className={styles.colAdmin} title={c.name}>
                                <span className={styles.adminNameText}>{c.name}</span>
                              </td>
                              <td className={styles.colEmail} title={c.email}>
                                <span className={styles.emailText}>{c.email}</span>
                              </td>
                              <td className={styles.colPermissions}>
                                <div
                                  className={styles.permBadgesWrapper}
                                  onWheel={(e) => {
                                    if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                                      e.currentTarget.scrollLeft += e.deltaY;
                                    }
                                  }}
                                >
                                  {(() => {
                                    const activePermitted = (c.access?.services || []).filter(s => {
                                      const sObj = services.find(srv => String(srv.id) === String(s.service_id));
                                      const isGlobalActive = sObj ? sObj.status === 'ACTIVE' : (s.status ? s.status === 'ACTIVE' : true);
                                      const isAllowed = s.isAllowed !== false && (s.status ? s.status === 'ACTIVE' : true);
                                      const hasModules = s.full_service || (s.modules && s.modules.length > 0);
                                      return isGlobalActive && isAllowed && hasModules;
                                    });

                                    if (activePermitted.length === 0) {
                                      return (
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                          No active permitted services
                                        </span>
                                      );
                                    }

                                    return activePermitted.map(s => {
                                      const sObj = services.find(srv => String(srv.id) === String(s.service_id));
                                      const sName = sObj ? sObj.name : (s.name || `Service #${s.service_id}`);
                                      const badgeTitle = `${sName}: ${s.full_service ? 'FULL' : `${(s.modules || []).length} Modules`}`;
                                      return (
                                        <span
                                          key={s.service_id}
                                          className={`${styles.permTag} ${s.full_service ? styles.permTagFull : styles.permTagCustom}`}
                                          title={badgeTitle}
                                        >
                                          {badgeTitle}
                                        </span>
                                      );
                                    });
                                  })()}
                                </div>
                              </td>
                              <td className={styles.colStatus}>
                                <div
                                  className={styles.toggleWrapper}
                                  onClick={() => handleToggleClientStatus(c.id, c.organization_name)}
                                  title={`Click to ${isAct ? 'Deactivate' : 'Activate'} ${c.organization_name}`}
                                >
                                  <div className={`${styles.toggleSwitch} ${isAct ? styles.toggleSwitchActive : ''}`}>
                                    <div className={styles.toggleCircle}></div>
                                  </div>
                                  <span className={`${styles.toggleLabel} ${isAct ? styles.labelActive : styles.labelInactive}`}>
                                    {c.status}
                                  </span>
                                </div>
                              </td>
                              <td className={styles.colActions}>
                                <div className={styles.actionsWrapper}>
                                  <button
                                    className={`${styles.btnSecondary} ${styles.btnSm}`}
                                    onClick={() => handleSwitchToClientPanel(c)}
                                    style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                                    title={`Switch directly into real client workspace for ${c.organization_name}`}
                                  >
                                    🚀 Switch to Panel
                                  </button>
                                  <button
                                    className={`${styles.btnSecondary} ${styles.btnSm}`}
                                    onClick={() => handleOpenPermissionsModal(c)}
                                    style={{ background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    title="Manage dynamic company permissions only"
                                  >
                                    <IconShield size={14} /> Permissions
                                  </button>
                                  <button
                                    className={`${styles.btnSecondary} ${styles.btnSm}`}
                                    onClick={() => handleOpenEditClientModal(c)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    title="Edit Company Details & Credentials"
                                  >
                                    <IconPencil size={14} /> Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.emptyStateContainerSmall}>
                    <div className={styles.emptyStateIconWrapper} style={{ width: '56px', height: '56px', marginBottom: '0.75rem', borderRadius: '14px' }}>
                      <IconBuilding size={26} />
                    </div>
                    <h5 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0' }}>No Companies Registered Yet</h5>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>Super Admin can provision new tenant companies and assign granular service access.</p>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={handleOpenNewClientModal}
                      style={{ whiteSpace: 'nowrap', fontSize: '0.825rem', padding: '0.55rem 1.15rem' }}
                    >
                      <IconPlus size={15} /> Add First Company
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Audit Activity */}
              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <span className={styles.tableTitle}>Recent Platform Audit Activity</span>
                  <button type="button" className={styles.btnSecondary} onClick={() => router.push('/super-admin/audit-logs')} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    View All Audit Logs &rarr;
                  </button>
                </div>
                <div className={styles.tableScrollContainer}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th className={styles.colAuditAction}>Action</th>
                        <th className={styles.colAuditEntity}>Entity</th>
                        <th className={styles.colAuditTarget}>Target</th>
                        <th className={styles.colAuditDetails}>Details</th>
                        <th className={styles.colAuditTime}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 10).map(log => (
                        <tr key={log.id}>
                          <td className={styles.colAuditAction}>
                            <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '4px', background: '#eff6ff', color: '#1e40af' }}>
                              {log.action}
                            </span>
                          </td>
                          <td className={styles.colAuditEntity}>{log.entity_type}</td>
                          <td className={styles.colAuditTarget} title={log.entity_name}>
                            <strong>{log.entity_name}</strong>
                          </td>
                          <td className={styles.colAuditDetails} title={log.details}>
                            {log.details}
                          </td>
                          <td className={styles.colAuditTime} title={new Date(log.created_at).toLocaleString()}>
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: SERVICES CATALOG (All Services on One Page)   */}
          {/* ==================================================== */}
          {activeTab === 'services' && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>Global Services Catalogue</h3>
                  <p>All active and inactive services visible on one page. Toggle active state or click to manage modules.</p>
                </div>
                <button type="button" className={styles.btnPrimary} onClick={handleOpenAddServiceModal} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <IconPlus size={15} /> Add New Service
                </button>
              </div>

              <div className={styles.servicesGrid}>
                {services.map(s => {
                  const isAct = s.status === 'ACTIVE';
                  const colorClass = getServiceColorClass(s.code);

                  return (
                    <div key={s.id} className={`${styles.serviceCard} ${colorClass}`}>
                      <div className={styles.serviceCardTop}>
                        <span className={styles.serviceCode}>{s.code}</span>
                        <div
                          className={styles.toggleWrapper}
                          onClick={(e) => handleToggleServiceStatus(s.id, s.name, s.status, e)}
                          title="Click to toggle Active / Inactive"
                        >
                          <div className={`${styles.toggleSwitch} ${isAct ? styles.toggleSwitchActive : ''}`}>
                            <div className={styles.toggleCircle}></div>
                          </div>
                          <span className={`${styles.toggleLabel} ${isAct ? styles.labelActive : styles.labelInactive}`}>
                            {s.status}
                          </span>
                        </div>
                      </div>

                      <h4 className={styles.serviceName}>{s.name}</h4>
                      <p className={styles.serviceDesc}>{s.description || 'Global service container.'}</p>

                      <div className={styles.serviceMetrics}>
                        <div className={styles.metricItem}>
                          <span className={styles.metricVal}>{s.module_count}</span>
                          <span className={styles.metricLabel}>Main Modules</span>
                        </div>
                        <div className={styles.metricItem}>
                          <span className={styles.metricVal}>{s.sub_module_count}</span>
                          <span className={styles.metricLabel}>Sub-Modules</span>
                        </div>
                        <div className={styles.metricItem}>
                          <span className={styles.metricVal}>#{s.order_no}</span>
                          <span className={styles.metricLabel}>Order</span>
                        </div>
                      </div>

                      <div className={styles.serviceActions} style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => handleOpenServiceDetail(s.code ? s.code.replace(/_/g, '-') : s.id, true)}
                          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          Manage Modules &rarr;
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={(e) => handleToggleServiceStatus(s.id, s.name, s.status, e)}
                          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {isAct ? 'Deactivate 🔴' : 'Activate 🟢'}
                        </button>
                        {!SEEDED_SERVICE_CODES.has(s.code) && (
                          <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={() => setServiceToDelete(s)}
                            title={`Delete custom service ${s.name}`}
                          >
                            <IconTrash size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: SINGLE SERVICE DETAIL (Section 3.1 of PDF)   */}
          {/* ==================================================== */}
          {activeTab === 'service-detail' && selectedService && (
            <div>
              <div className={styles.detailHeader}>
                <Link
                  href="/super-admin/services"
                  className={styles.detailBack}
                  onClick={() => {
                    setSelectedService(null);
                    setActiveTab('services');
                  }}
                >
                  &larr; Back to Services Catalog
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.4rem' }}>
                      <h3 className={styles.detailTitle}>{selectedService.name}</h3>
                      <span className={styles.serviceCode}>{selectedService.code}</span>
                      
                      <div
                        className={styles.toggleWrapper}
                        onClick={(e) => handleToggleServiceStatus(selectedService.id, selectedService.name, selectedService.status, e)}
                      >
                        <div className={`${styles.toggleSwitch} ${selectedService.status === 'ACTIVE' ? styles.toggleSwitchActive : ''}`}>
                          <div className={styles.toggleCircle}></div>
                        </div>
                        <span className={`${styles.toggleLabel} ${selectedService.status === 'ACTIVE' ? styles.labelActive : styles.labelInactive}`}>
                          {selectedService.status}
                        </span>
                      </div>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{selectedService.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                    <button type="button" className={styles.btnPrimary} onClick={() => setShowAddModuleModal(true)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <IconPlus size={15} /> Add Main Module
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.sectionHeader}>
                <div>
                  <h4>Main Modules &amp; Sub-Modules Hierarchy</h4>
                  <p>Main Module is the heading/container. Feature content screens live in Sub-Modules.</p>
                </div>
              </div>

              <div className={styles.moduleList}>
                {selectedService.modules && selectedService.modules.length > 0 ? (
                  selectedService.modules.map(mod => {
                    const isModAct = mod.status === 'ACTIVE';

                    return (
                      <div key={mod.id} className={styles.moduleAccordion}>
                        <div className={styles.moduleHeaderBar}>
                          <div className={styles.moduleInfo}>
                            <div className={styles.moduleIconBox}>M</div>
                            <div className={styles.moduleTitleText}>
                              <h4>{mod.name} <span className={styles.serviceCode}>{mod.code}</span></h4>
                              <span>{mod.description || 'Module container'} &bull; Display Order: {mod.order_no}</span>
                            </div>
                          </div>

                          <div className={styles.moduleHeaderActions}>
                            <div
                              className={styles.toggleWrapper}
                              onClick={() => handleToggleModuleStatus(mod.id, mod.name)}
                              title="Toggle Module Status"
                              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                            >
                              <div className={`${styles.toggleSwitch} ${isModAct ? styles.toggleSwitchActive : ''}`}>
                                <div className={styles.toggleCircle}></div>
                              </div>
                              <span className={`${styles.toggleLabel} ${isModAct ? styles.labelActive : styles.labelInactive}`}>
                                {mod.status}
                              </span>
                            </div>

                            <button
                              type="button"
                              className={`${styles.btnSecondary} ${styles.btnSm}`}
                              onClick={() => {
                                setActiveModuleForSub(mod);
                                setShowAddSubModuleModal(true);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                minWidth: 'max-content',
                              }}
                            >
                              <IconPlus size={14} /> Add Sub-Module
                            </button>
                          </div>
                        </div>

                        {/* Sub-Modules area */}
                        <div className={styles.subModulesContainer}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                              Sub-Modules / Screens ({mod.sub_modules?.length || 0})
                            </span>
                          </div>

                          {mod.sub_modules && mod.sub_modules.length > 0 ? (
                            <div className={styles.subModulesGrid}>
                              {mod.sub_modules.map(sub => {
                                const isSubAct = sub.status === 'ACTIVE';

                                return (
                                  <div key={sub.id} className={styles.subModuleChip}>
                                    <div className={styles.subModuleName}>{sub.name}</div>
                                    <div
                                      className={styles.toggleWrapper}
                                      onClick={() => handleToggleSubModuleStatus(sub.id, sub.name)}
                                      title="Toggle Sub-Module Status"
                                    >
                                      <div className={`${styles.toggleSwitch} ${isSubAct ? styles.toggleSwitchActive : ''}`} style={{ width: '38px', height: '22px' }}>
                                        <div className={styles.toggleCircle} style={{ width: '16px', height: '16px', top: '3px', left: '3px', transform: isSubAct ? 'translateX(16px)' : 'none' }}></div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                              No sub-modules added yet. Click &quot;+ Add Sub-Module&quot; to define feature screens.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ background: '#fff', padding: '3rem', textAlign: 'center', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', marginBottom: '1rem' }}>No Main Modules created under this service yet.</p>
                    <button type="button" className={styles.btnPrimary} onClick={() => setShowAddModuleModal(true)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <IconPlus size={15} /> Create First Main Module
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: ADMIN / CLIENT / COMPANY MANAGEMENT           */}
          {/* ==================================================== */}
          {activeTab === 'clients' && (
            <div>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderTitleGroup}>
                  <h3>Company &amp; Client Management</h3>
                  <p>Provision and manage tenant companies, assign granular access to the 7 core services and modules, and configure client admin login credentials.</p>
                </div>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleOpenNewClientModal}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <IconPlus size={16} /> Add New Company / Client
                </button>
              </div>

              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <span className={styles.tableTitle}>Registered Companies &amp; Clients ({filteredClients.length})</span>
                  {clients.length > 0 && (
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      {clients.filter(c => c.status === 'ACTIVE').length} Active &bull; {clients.filter(c => c.status !== 'ACTIVE').length} Inactive
                    </span>
                  )}
                </div>

                {filteredClients.length > 0 ? (
                  <div className={styles.tableScrollContainer}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th className={styles.colCompany}>Company / Organization</th>
                          <th className={styles.colAdmin}>Admin Name</th>
                          <th className={styles.colEmail}>Contact Info</th>
                          <th className={styles.colPermissions}>Permitted Services</th>
                          <th className={styles.colStatus}>Active Status</th>
                          <th className={styles.colActions}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map(c => {
                          const isAct = c.status === 'ACTIVE';

                          return (
                            <tr key={c.id}>
                              <td className={styles.colCompany} title={c.organization_name}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    title={`Assigned Theme Color: ${c.theme_color || c.themeColor || '#7f22fe'}`}
                                    style={{
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      backgroundColor: c.theme_color || c.themeColor || '#7f22fe',
                                      border: '2px solid rgba(255,255,255,0.9)',
                                      boxShadow: `0 0 0 1.5px ${c.theme_color || c.themeColor || '#7f22fe'}66`,
                                      flexShrink: 0
                                    }}
                                  />
                                  <strong className={styles.companyNameText}>{c.organization_name}</strong>
                                </div>
                              </td>
                              <td className={styles.colAdmin} title={c.name}>
                                <span className={styles.adminNameText}>{c.name}</span>
                              </td>
                              <td className={styles.colEmail} title={`${c.email} | ${c.mobile || 'No mobile'}`}>
                                <span className={styles.emailText}>{c.email}</span>
                                {c.mobile && <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>{c.mobile}</div>}
                              </td>
                              <td className={styles.colPermissions}>
                                <div
                                  className={styles.permBadgesWrapper}
                                  onWheel={(e) => {
                                    if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                                      e.currentTarget.scrollLeft += e.deltaY;
                                    }
                                  }}
                                >
                                  {(() => {
                                    const activePermitted = (c.access?.services || []).filter(s => {
                                      const sObj = services.find(srv => String(srv.id) === String(s.service_id));
                                      const isGlobalActive = sObj ? sObj.status === 'ACTIVE' : (s.status ? s.status === 'ACTIVE' : true);
                                      const isAllowed = s.isAllowed !== false && (s.status ? s.status === 'ACTIVE' : true);
                                      const hasModules = s.full_service || (s.modules && s.modules.length > 0);
                                      return isGlobalActive && isAllowed && hasModules;
                                    });

                                    if (activePermitted.length === 0) {
                                      return (
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                          No active permitted services
                                        </span>
                                      );
                                    }

                                    return activePermitted.map(s => {
                                      const sObj = services.find(srv => String(srv.id) === String(s.service_id));
                                      const sName = sObj ? sObj.name : (s.name || `Service #${s.service_id}`);
                                      const badgeTitle = `${sName}: ${s.full_service ? 'FULL' : `${(s.modules || []).length} Modules`}`;
                                      return (
                                        <span
                                          key={s.service_id}
                                          className={`${styles.permTag} ${s.full_service ? styles.permTagFull : styles.permTagCustom}`}
                                          title={badgeTitle}
                                        >
                                          {badgeTitle}
                                        </span>
                                      );
                                    });
                                  })()}
                                </div>
                              </td>
                              <td className={styles.colStatus}>
                                <div
                                  className={styles.toggleWrapper}
                                  onClick={() => handleToggleClientStatus(c.id, c.organization_name)}
                                  title={`Toggle Active / Inactive for ${c.organization_name}`}
                                >
                                  <div className={`${styles.toggleSwitch} ${isAct ? styles.toggleSwitchActive : ''}`}>
                                    <div className={styles.toggleCircle}></div>
                                  </div>
                                  <span className={`${styles.toggleLabel} ${isAct ? styles.labelActive : styles.labelInactive}`}>
                                    {c.status}
                                  </span>
                                </div>
                              </td>
                              <td className={styles.colActions}>
                                <div className={styles.actionsWrapper}>
                                  <button
                                    className={`${styles.btnSecondary} ${styles.btnSm}`}
                                    onClick={() => handleSwitchToClientPanel(c)}
                                    style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                                    title={`Switch directly into real client workspace for ${c.organization_name}`}
                                  >
                                    🚀 Switch to Panel
                                  </button>
                                  <button
                                    className={`${styles.btnSecondary} ${styles.btnSm}`}
                                    onClick={() => handleOpenPermissionsModal(c)}
                                    style={{ background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    title="Manage dynamic company permissions only"
                                  >
                                    <IconShield size={14} /> Permissions
                                  </button>
                                  <button
                                    className={`${styles.btnSecondary} ${styles.btnSm}`}
                                    onClick={() => handleOpenEditClientModal(c)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    title="Edit Company Details & Credentials"
                                  >
                                    <IconPencil size={14} /> Edit
                                  </button>
                                  <button
                                    className={styles.btnDanger}
                                    onClick={() => handleRequestDeleteClient(c)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    title="Deactivate and Remove Client Panel"
                                  >
                                    <IconTrash size={14} /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : clients.length === 0 ? (
                  <div className={styles.emptyStateContainer}>
                    <div className={styles.emptyStateIconWrapper}>
                      <IconBuilding size={34} />
                    </div>
                    <h4 className={styles.emptyStateTitle}>No Companies or Clients Registered</h4>
                    <p className={styles.emptyStateDesc}>
                      You haven&apos;t provisioned any tenant companies yet. Click the button below to create your first company, configure service access permissions, and generate admin login credentials.
                    </p>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={handleOpenNewClientModal}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <IconPlus size={16} /> Create First Company / Client
                    </button>

                    <div className={styles.emptyStateFeatures}>
                      <div className={styles.emptyFeatureItem}>
                        <span className={styles.emptyFeatureDot}></span>
                        <span><strong>7 Core Services</strong> — Granular module permissions</span>
                      </div>
                      <div className={styles.emptyFeatureItem}>
                        <span className={styles.emptyFeatureDot}></span>
                        <span><strong>Multi-Tenant Isolation</strong> — Secure per-company data</span>
                      </div>
                      <div className={styles.emptyFeatureItem}>
                        <span className={styles.emptyFeatureDot}></span>
                        <span><strong>Live Preview</strong> — Instant workspace inspection</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyStateContainer}>
                    <div className={styles.emptyStateIconWrapper}>
                      <IconSearch size={30} />
                    </div>
                    <h4 className={styles.emptyStateTitle}>No Matching Companies Found</h4>
                    <p className={styles.emptyStateDesc}>
                      No company or admin records matched &ldquo;<strong>{searchQuery}</strong>&rdquo;. Try searching with a different name, email, or organization.
                    </p>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search Filter
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 5: AUDIT LOGS                                   */}
          {/* ==================================================== */}
          {activeTab === 'audit-logs' && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>System Audit Trail</h3>
                  <p>Comprehensive tracking of service changes, module updates, client creations, and permission modifications.</p>
                </div>
              </div>

              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <span className={styles.tableTitle}>Audit Records ({auditLogs.length})</span>
                </div>
                <div className={styles.tableScrollContainer}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '150px' }}>Time</th>
                        <th style={{ minWidth: '130px' }}>Actor</th>
                        <th style={{ minWidth: '110px' }}>Action</th>
                        <th style={{ minWidth: '130px' }}>Entity Type</th>
                        <th style={{ minWidth: '180px' }}>Target</th>
                        <th style={{ minWidth: '280px' }}>Details</th>
                        <th style={{ minWidth: '110px' }}>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: '#64748b' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>{log.actor}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '4px', background: '#eff6ff', color: '#1e40af' }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{log.entity_type}</td>
                          <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.entity_name}>
                            <strong>{log.entity_name}</strong>
                          </td>
                          <td style={{ maxWidth: '440px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>
                            {log.details}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{log.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 5: SETTINGS                                     */}
          {/* ==================================================== */}
          {activeTab === 'settings' && (
            <div className={styles.settingsContainer}>
              {/* Settings Page Header */}
              <div className={styles.sectionHeader} style={{ marginBottom: '1.25rem' }}>
                <div className={styles.sectionHeaderTitleGroup}>
                  <h3>Super Admin Settings</h3>
                  <p>
                    Manage visual theme appearance, platform preferences, and administrator credentials
                  </p>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className={styles.settingsSubNav}>
                <button
                  type="button"
                  className={`${styles.settingsSubNavItem} ${activeSettingsSubTab === 'appearance' ? styles.settingsSubNavItemActive : ''}`}
                  onClick={() => setActiveSettingsSubTab('appearance')}
                >
                  <IconPalette size={16} />
                  <span>Appearance &amp; Theme</span>
                </button>
                <button
                  type="button"
                  className={`${styles.settingsSubNavItem} ${activeSettingsSubTab === 'general' ? styles.settingsSubNavItemActive : ''}`}
                  onClick={() => setActiveSettingsSubTab('general')}
                >
                  <IconSliders size={16} />
                  <span>General Settings</span>
                </button>
                <button
                  type="button"
                  className={`${styles.settingsSubNavItem} ${activeSettingsSubTab === 'account' ? styles.settingsSubNavItemActive : ''}`}
                  onClick={() => setActiveSettingsSubTab('account')}
                >
                  <IconShield size={16} />
                  <span>Account &amp; Security</span>
                </button>
              </div>

              {/* ==================================================== */}
              {/* SUBTAB 1: APPEARANCE & THEME                         */}
              {/* ==================================================== */}
              {activeSettingsSubTab === 'appearance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Card 1: Theme Mode Selection */}
                  <div className={styles.settingsCard}>
                    <div className={styles.settingsCardHeader}>
                      <div>
                        <h4>
                          <IconPalette size={18} />
                          <span>Interface Theme Mode</span>
                        </h4>
                        <p>
                          Select your preferred display theme. System mode dynamically adapts to your OS or browser preference.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={handleResetTheme}
                        title="Restore School Management Violet default theme"
                        style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
                      >
                        <IconRotateCcw size={14} />
                        <span>Reset to Default</span>
                      </button>
                    </div>

                    <div className={styles.themeGrid}>
                      {/* Light Theme Card */}
                      <div
                        className={`${styles.themeCard} ${themeMode === 'light' ? styles.themeCardActive : ''}`}
                        onClick={() => handleThemeChange('light')}
                        role="button"
                        tabIndex={0}
                      >
                        {themeMode === 'light' && (
                          <span className={styles.themeCardBadge}>Active Now</span>
                        )}
                        <div className={`${styles.themeCardPreview} ${styles.previewLight}`}>
                          <div className={styles.previewLightSidebar}>
                            <div className={styles.previewLightSidebarItemActive} style={{ background: accentColor }} />
                            <div className={styles.previewLightSidebarItem} />
                            <div className={styles.previewLightSidebarItem} />
                          </div>
                          <div className={styles.previewLightMain}>
                            <div className={styles.previewLightHeader} />
                            <div className={styles.previewLightCard}>
                              <div style={{ width: '40%', height: '5px', background: '#e2e8f0', borderRadius: '2px' }} />
                              <div style={{ width: '80%', height: '4px', background: '#f1f5f9', borderRadius: '2px' }} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.themeCardInfo}>
                          <div className={styles.themeCardTitle}>
                            <IconSun size={18} style={{ color: '#f59e0b' }} />
                            <span>Light Theme</span>
                          </div>
                          <p className={styles.themeCardDesc}>
                            Clean white surfaces, crisp zinc borders, and high daylight readability.
                          </p>
                        </div>
                      </div>

                      {/* Dark Theme Card */}
                      <div
                        className={`${styles.themeCard} ${themeMode === 'dark' ? styles.themeCardActive : ''}`}
                        onClick={() => handleThemeChange('dark')}
                        role="button"
                        tabIndex={0}
                      >
                        {themeMode === 'dark' && (
                          <span className={styles.themeCardBadge}>Active Now</span>
                        )}
                        <div className={`${styles.themeCardPreview} ${styles.previewDark}`}>
                          <div className={styles.previewDarkSidebar}>
                            <div className={styles.previewDarkSidebarItemActive} style={{ background: accentColor }} />
                            <div className={styles.previewDarkSidebarItem} />
                            <div className={styles.previewDarkSidebarItem} />
                          </div>
                          <div className={styles.previewDarkMain}>
                            <div className={styles.previewDarkHeader} />
                            <div className={styles.previewDarkCard}>
                              <div style={{ width: '40%', height: '5px', background: '#26283b', borderRadius: '2px' }} />
                              <div style={{ width: '80%', height: '4px', background: '#1e202e', borderRadius: '2px' }} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.themeCardInfo}>
                          <div className={styles.themeCardTitle}>
                            <IconMoon size={18} style={{ color: '#a78bfa' }} />
                            <span>Dark Theme</span>
                          </div>
                          <p className={styles.themeCardDesc}>
                            Deep slate surfaces and low-glare panels engineered for nighttime workflows.
                          </p>
                        </div>
                      </div>

                      {/* System Theme Card */}
                      <div
                        className={`${styles.themeCard} ${themeMode === 'system' ? styles.themeCardActive : ''}`}
                        onClick={() => handleThemeChange('system')}
                        role="button"
                        tabIndex={0}
                      >
                        {themeMode === 'system' && (
                          <span className={styles.themeCardBadge}>
                            Active ({systemIsDark ? 'Dark' : 'Light'})
                          </span>
                        )}
                        <div className={`${styles.themeCardPreview}`} style={{ background: systemIsDark ? '#0c0d14' : '#f8fafc' }}>
                          <div style={{ width: '50%', height: '100%', background: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ height: '6px', width: '60%', background: accentColor, borderRadius: '3px' }} />
                            <div style={{ height: '5px', width: '90%', background: '#e2e8f0', borderRadius: '2px', marginTop: '4px' }} />
                          </div>
                          <div style={{ width: '50%', height: '100%', background: '#12131c', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ height: '6px', width: '60%', background: accentColor, borderRadius: '3px' }} />
                            <div style={{ height: '5px', width: '90%', background: '#26283b', borderRadius: '2px', marginTop: '4px' }} />
                          </div>
                        </div>
                        <div className={styles.themeCardInfo}>
                          <div className={styles.themeCardTitle}>
                            <IconScreen size={18} style={{ color: '#38bdf8' }} />
                            <span>System Theme</span>
                          </div>
                          <p className={styles.themeCardDesc}>
                            Automatically follows your operating system preference (currently {systemIsDark ? 'Dark' : 'Light'}).
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Accent Color Palette */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <h5 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Primary Brand Accent Color</h5>
                          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                            Applied across primary action buttons, active navigation markers, and selected states.
                          </p>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', color: accentColor, padding: '0.2rem 0.6rem', background: `${accentColor}18`, borderRadius: '6px' }}>
                          {accentColor}
                        </span>
                      </div>

                      <div className={styles.accentGrid}>
                        {ACCENT_PRESETS.map((preset) => {
                          const isAct = accentColor.toLowerCase() === preset.hex.toLowerCase();
                          return (
                            <div
                              key={preset.hex}
                              className={`${styles.accentSwatch} ${isAct ? styles.accentSwatchActive : ''}`}
                              style={{ backgroundColor: preset.hex }}
                              onClick={() => handleAccentChange(preset.hex)}
                              title={`${preset.name} (${preset.hex}) - ${preset.desc}`}
                              role="button"
                              tabIndex={0}
                            >
                              {isAct && <span className={styles.accentCheck}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Live Preview Card */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                      <h5 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                        Live Super Admin Preview
                      </h5>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                        Real-time visualization of your active theme mode ({resolvedTheme.toUpperCase()}) and accent palette ({accentColor}).
                      </p>

                      <div
                        className={styles.livePreviewBox}
                        style={{
                          background: resolvedTheme === 'dark' ? '#0c0d14' : '#f8fafc',
                          borderColor: resolvedTheme === 'dark' ? '#1e202e' : '#e2e8f0',
                        }}
                      >
                        <div
                          className={styles.livePreviewTopbar}
                          style={{
                            background: resolvedTheme === 'dark' ? '#12131c' : '#ffffff',
                            borderBottomColor: resolvedTheme === 'dark' ? '#1e202e' : '#e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                background: accentColor,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                              }}
                            >
                              {platformSettings.brandBadge || 'AZ'}
                            </div>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                              {platformSettings.platformName || 'AZZUNIQE'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '9999px',
                                background: `${accentColor}20`,
                                color: accentColor,
                              }}
                            >
                              {resolvedTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                            </span>
                            <div
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '7px',
                                background: accentColor,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                              }}
                            >
                              {profileInitials}
                            </div>
                          </div>
                        </div>

                        <div className={styles.livePreviewContent}>
                          <div className={styles.livePreviewSidebar}>
                            <div className={`${styles.livePreviewNavItem} ${styles.livePreviewNavItemActive}`} style={{ background: accentColor }}>
                              Dashboard
                            </div>
                            <div className={styles.livePreviewNavItem}>Services Catalog</div>
                            <div className={styles.livePreviewNavItem}>Admins / Clients</div>
                            <div className={styles.livePreviewNavItem}>Audit Logs</div>
                            <div className={styles.livePreviewNavItem}>Settings</div>
                          </div>

                          <div className={styles.livePreviewMain}>
                            <div
                              className={styles.livePreviewCardWidget}
                              style={{
                                background: resolvedTheme === 'dark' ? '#12131c' : '#ffffff',
                                borderColor: resolvedTheme === 'dark' ? '#1e202e' : '#e2e8f0',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '0.78rem', color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                    Active Platform Services
                                  </div>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem', color: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                    {stats.totalServices || services.length || 4} Services Live
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '6px',
                                    background: '#ecfdf5',
                                    color: '#065f46',
                                  }}
                                >
                                  +100% Operational
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                className={styles.btnPrimary}
                                style={{ background: accentColor, padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                              >
                                Sample Primary Button
                              </button>
                              <span style={{ fontSize: '0.78rem', color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                Theme applies consistently across all 5 navigation sections.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* SUBTAB 2: GENERAL SETTINGS                           */}
              {/* ==================================================== */}
              {activeSettingsSubTab === 'general' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className={styles.settingsCard}>
                    <div className={styles.settingsCardHeader}>
                      <div>
                        <h4>
                          <IconSliders size={18} />
                          <span>Platform Profile &amp; Branding</span>
                        </h4>
                        <p>
                          Configure global platform branding, contact channels, and default system behavior.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSavePlatformSettings}>
                      <div className={styles.formRow2}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Platform Display Name</label>
                          <input
                            className={styles.formInput}
                            value={platformSettings.platformName}
                            onChange={(e) => setPlatformSettings({ ...platformSettings, platformName: e.target.value })}
                            placeholder="e.g. AZZUNIQE CRM & ERP"
                            required
                          />
                          <p className={styles.formHelper}>Displayed in the sidebar, browser title, and platform headers.</p>
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Brand Badge / Logo Text</label>
                          <input
                            className={styles.formInput}
                            value={platformSettings.brandBadge}
                            maxLength={4}
                            onChange={(e) => setPlatformSettings({ ...platformSettings, brandBadge: e.target.value.toUpperCase() })}
                            placeholder="e.g. AZ"
                            required
                          />
                          <p className={styles.formHelper}>Short 2–4 character emblem for the sidebar logo box.</p>
                        </div>
                      </div>

                      <div className={styles.formRow2}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Sidebar Role Subtitle</label>
                          <input
                            className={styles.formInput}
                            value={platformSettings.tagline}
                            onChange={(e) => setPlatformSettings({ ...platformSettings, tagline: e.target.value })}
                            placeholder="e.g. Super Admin"
                          />
                          <p className={styles.formHelper}>Subtitle displayed directly beneath the platform name in the sidebar.</p>
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Default Appearance</label>
                          <select
                            className={styles.formInput}
                            value={platformSettings.defaultTheme || 'system'}
                            onChange={(e) => setPlatformSettings({ ...platformSettings, defaultTheme: e.target.value })}
                          >
                            <option value="system">System Preference (Adaptive)</option>
                            <option value="light">Always Light Mode</option>
                            <option value="dark">Always Dark Mode</option>
                          </select>
                          <p className={styles.formHelper}>Initial appearance baseline for newly initialized browser sessions.</p>
                        </div>
                      </div>

                      <div className={styles.formRow2}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Support Contact Email</label>
                          <input
                            type="email"
                            className={styles.formInput}
                            value={platformSettings.supportEmail}
                            onChange={(e) => setPlatformSettings({ ...platformSettings, supportEmail: e.target.value })}
                            placeholder="e.g. support@azzuniQE.com"
                          />
                          <p className={styles.formHelper}>Official support contact presented in system logs and platform alerts.</p>
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Support Contact Phone</label>
                          <input
                            type="tel"
                            className={styles.formInput}
                            value={platformSettings.supportPhone}
                            onChange={(e) => setPlatformSettings({ ...platformSettings, supportPhone: e.target.value })}
                            placeholder="e.g. +91 98765 43210"
                          />
                          <p className={styles.formHelper}>Direct technical assistance contact phone number.</p>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                        <button
                          type="submit"
                          className={styles.btnPrimary}
                          disabled={isSavingGeneral}
                        >
                          {isSavingGeneral ? 'Saving Settings...' : 'Save General Settings'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* SUBTAB 3: ACCOUNT & SECURITY                         */}
              {/* ==================================================== */}
              {activeSettingsSubTab === 'account' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Card 1: Super Admin Identity & Profile Name */}
                  <div className={styles.settingsCard}>
                    <div className={styles.settingsCardHeader}>
                      <div>
                        <h4>
                          <IconUser size={18} />
                          <span>Super Admin Identity &amp; Profile</span>
                        </h4>
                        <p>
                          Manage your administrator profile details. Master Admin and Super Admin represent the unified platform owner role.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfileName}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: accentColor,
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '1.35rem',
                            boxShadow: `0 4px 14px ${accentColor}40`,
                          }}
                        >
                          {profileInitials}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{currentUser.name || 'Platform Super Admin'}</h4>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '0.15rem 0.55rem',
                                borderRadius: '9999px',
                                background: `${accentColor}18`,
                                color: accentColor,
                                border: `1px solid ${accentColor}30`,
                              }}
                            >
                              SUPER ADMIN
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '0.15rem 0.55rem',
                                borderRadius: '9999px',
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0',
                              }}
                            >
                              ACTIVE
                            </span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                            {currentUser.email || 'admin@azzuniqe.com'}
                          </p>
                        </div>
                      </div>

                      <div className={styles.formRow2}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Super Admin Full Name</label>
                          <input
                            className={styles.formInput}
                            value={profileNameInput}
                            onChange={(e) => setProfileNameInput(e.target.value)}
                            placeholder="Super Admin Name"
                            required
                          />
                          <p className={styles.formHelper}>Your display name shown across audit trails and administrator activity logs.</p>
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Registered Platform Email</label>
                          <input
                            className={styles.formInput}
                            value={currentUser.email || 'admin@azzuniqe.com'}
                            readOnly
                            style={{ opacity: 0.8, cursor: 'not-allowed' }}
                          />
                          <p className={styles.formHelper}>Unique account identifier tied to encrypted session credentials.</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="submit"
                          className={styles.btnPrimary}
                          disabled={isSavingProfile}
                        >
                          {isSavingProfile ? 'Saving Profile...' : 'Save Profile Name'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Card 2: Password Update */}
                  <div className={styles.settingsCard}>
                    <div className={styles.settingsCardHeader}>
                      <div>
                        <h4>
                          <IconLock size={18} />
                          <span>Change Super Admin Password</span>
                        </h4>
                        <p>
                          Update your platform master credentials. Requires entering your current password for security verification.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleUpdatePassword}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Current Password *</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showCurrentPass ? 'text' : 'password'}
                            className={styles.formInput}
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            placeholder="Enter your current password"
                            required
                            style={{ paddingRight: '2.5rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            {showCurrentPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className={styles.formRow2}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>New Password *</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showNewPass ? 'text' : 'password'}
                              className={styles.formInput}
                              value={passwordForm.newPassword}
                              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                              placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                              required
                              style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPass(!showNewPass)}
                              style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              {showNewPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Confirm New Password *</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showConfirmPass ? 'text' : 'password'}
                              className={styles.formInput}
                              value={passwordForm.confirmPassword}
                              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                              placeholder="Re-type new password"
                              required
                              style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPass(!showConfirmPass)}
                              style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              {showConfirmPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '0.25rem', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Password Strength Requirements:</div>
                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.74rem' }}>
                          <span style={{ color: passwordForm.newPassword.length >= 8 ? '#166534' : '#64748b' }}>
                            {passwordForm.newPassword.length >= 8 ? '✓' : '•'} At least 8 characters
                          </span>
                          <span style={{ color: /[A-Z]/.test(passwordForm.newPassword) ? '#166534' : '#64748b' }}>
                            {/[A-Z]/.test(passwordForm.newPassword) ? '✓' : '•'} 1 Uppercase letter
                          </span>
                          <span style={{ color: /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(passwordForm.newPassword) ? '#166534' : '#64748b' }}>
                            {/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(passwordForm.newPassword) ? '✓' : '•'} 1 Number or symbol
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="submit"
                          className={styles.btnPrimary}
                          disabled={isSavingPassword}
                        >
                          {isSavingPassword ? 'Updating Password...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Card 3: Session & Access Security Controls */}
                  <div className={styles.settingsCard}>
                    <div className={styles.settingsCardHeader}>
                      <div>
                        <h4>
                          <IconShield size={18} />
                          <span>Active Session &amp; Platform Security</span>
                        </h4>
                        <p>
                          Overview of active cryptographic session tokens and platform ownership safeguards.
                        </p>
                      </div>
                    </div>

                    <div className={styles.securityBadgeGrid}>
                      <div className={styles.securityBadgeCard}>
                        <div className={styles.securityBadgeIcon}>🔐</div>
                        <div>
                          <div className={styles.securityBadgeTitle}>Session Integrity</div>
                          <div className={styles.securityBadgeSubtitle}>HTTP-only Cookie &amp; Bearer Token Active</div>
                        </div>
                      </div>

                      <div className={styles.securityBadgeCard}>
                        <div className={styles.securityBadgeIcon}>👑</div>
                        <div>
                          <div className={styles.securityBadgeTitle}>Role Permissions</div>
                          <div className={styles.securityBadgeSubtitle}>Full Master Super Admin Privilege</div>
                        </div>
                      </div>

                      <div className={styles.securityBadgeCard}>
                        <div className={styles.securityBadgeIcon}>🗄️</div>
                        <div>
                          <div className={styles.securityBadgeTitle}>Database Connection</div>
                          <div className={styles.securityBadgeSubtitle}>Prisma MySQL Connection Active</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Terminate Super Admin Session</div>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Invalidates all local tokens and safely logs out this administrator account.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogoutClick}
                        className={styles.dropdownItemDanger}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#dc2626',
                          borderRadius: '10px',
                          padding: '0.6rem 1.25rem',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                        }}
                      >
                        <IconLogout size={16} />
                        <span>Logout Session</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ==================================================== */}
      {/* MODAL: ADD SERVICE                                   */}
      {/* ==================================================== */}
      {showAddServiceModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Create New Global Service</h3>
              <button className={styles.closeBtn} onClick={() => setShowAddServiceModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateService}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Service Name *</label>
                  <input
                    className={styles.formInput}
                    placeholder="e.g. CRM & Sales, Human Resources"
                    required
                    value={serviceForm.name}
                    onChange={(e) => updateCatalogName(serviceForm, setServiceForm, e.target.value)}
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Service Code</label>
                    <input
                      className={styles.formInput}
                      placeholder="Auto-generated from service name"
                      value={serviceForm.code}
                      onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Display Order</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className={styles.formInput}
                      value={serviceForm.order_no}
                      onChange={(e) => setServiceForm({ ...serviceForm, order_no: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description</label>
                  <textarea
                    className={styles.formTextarea}
                    rows={3}
                    placeholder="Service purpose and scope..."
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowAddServiceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD MAIN MODULE                               */}
      {/* ==================================================== */}
      {showAddModuleModal && selectedService && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Add Main Module under &quot;{selectedService.name}&quot;</h3>
              <button className={styles.closeBtn} onClick={() => setShowAddModuleModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateModule}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Module Name *</label>
                  <input
                    className={styles.formInput}
                    placeholder="e.g. CRM, Product, Sales"
                    required
                    value={moduleForm.name}
                    onChange={(e) => updateCatalogName(moduleForm, setModuleForm, e.target.value)}
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Module Code</label>
                    <input
                      className={styles.formInput}
                      placeholder="Auto-generated from module name"
                      value={moduleForm.code}
                      onChange={(e) => setModuleForm({ ...moduleForm, code: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Display Order</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className={styles.formInput}
                      value={moduleForm.order_no}
                      onChange={(e) => setModuleForm({ ...moduleForm, order_no: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description</label>
                  <textarea
                    className={styles.formTextarea}
                    rows={2}
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowAddModuleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD SUB-MODULE                                */}
      {/* ==================================================== */}
      {showAddSubModuleModal && activeModuleForSub && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Add Sub-Module (Screen) under &quot;{activeModuleForSub.name}&quot;</h3>
              <button className={styles.closeBtn} onClick={() => setShowAddSubModuleModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateSubModule}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Sub-Module / Screen Name *</label>
                  <input
                    className={styles.formInput}
                    placeholder="e.g. Lead, Customer, Quotation"
                    required
                    value={subModuleForm.name}
                    onChange={(e) => updateCatalogName(subModuleForm, setSubModuleForm, e.target.value)}
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Sub-Module Code</label>
                    <input
                      className={styles.formInput}
                      placeholder="Auto-generated from sub-module name"
                      value={subModuleForm.code}
                      onChange={(e) => setSubModuleForm({ ...subModuleForm, code: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Display Order</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className={styles.formInput}
                      value={subModuleForm.order_no}
                      onChange={(e) => setSubModuleForm({ ...subModuleForm, order_no: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowAddSubModuleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Save Sub-Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CREATE / EDIT ADMIN & PERMISSION ASSIGNMENT   */}
      {/* ==================================================== */}
      {showClientModal && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalContent} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <div>
                <h3>
                  {clientModalMode === 'permissions'
                    ? `🛡️ Manage Permissions: ${editingClient?.organization_name || clientForm.organization_name}`
                    : clientModalMode === 'details'
                    ? `✏️ Edit Company Details: ${editingClient?.organization_name || clientForm.organization_name}`
                    : 'Create New Admin / Client Panel'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {clientModalMode === 'permissions'
                    ? `Configure permitted Core Services, Modules, and Sub-Modules for "${editingClient?.organization_name || clientForm.organization_name}"`
                    : clientModalMode === 'details'
                    ? 'Update company profile, admin contact, and login credentials'
                    : 'Assign company details and configure granular Service → Module → Sub-Module permissions'}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowClientModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveClient}>
              <div className={styles.modalBody}>
                {/* Mode Switcher Tabs for existing client */}
                {editingClient && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setClientModalMode('permissions')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.83rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: clientModalMode === 'permissions' ? '#7f22fe' : '#f1f5f9',
                        color: clientModalMode === 'permissions' ? '#ffffff' : '#475569',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <IconShield size={14} /> Permissions Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientModalMode('details')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.83rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: clientModalMode === 'details' ? '#7f22fe' : '#f1f5f9',
                        color: clientModalMode === 'details' ? '#ffffff' : '#475569',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <IconPencil size={14} /> Company &amp; Admin Details
                    </button>
                  </div>
                )}

                {/* Company Context Badge when in Permissions mode */}
                {clientModalMode === 'permissions' && editingClient && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: '#f5f0ff',
                        color: '#7f22fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.05rem'
                      }}>
                        {editingClient.organization_name?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                          {editingClient.organization_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Admin: <strong>{editingClient.name}</strong> • <span>{editingClient.email}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        background: editingClient.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                        color: editingClient.status === 'ACTIVE' ? '#15803d' : '#b91c1c'
                      }}>
                        {editingClient.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => setClientModalMode('details')}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#475569',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <IconPencil size={12} /> Edit Details
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. Basic Details (rendered when mode is 'create' or 'details') */}
                {(clientModalMode === 'create' || clientModalMode === 'details') && (
                  <>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.85rem' }}>1. Company &amp; Admin Details</h4>
                    <div className={styles.formGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Company / Organization Name *</label>
                        <input
                          className={styles.formInput}
                          placeholder="e.g. Apex Industries Pvt Ltd"
                          required
                          value={clientForm.organization_name}
                          onChange={(e) => setClientForm({ ...clientForm, organization_name: e.target.value })}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Admin Full Name *</label>
                        <input
                          className={styles.formInput}
                          placeholder="e.g. Ramesh Kumar"
                          required
                          value={clientForm.name}
                          onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className={styles.formGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Admin Login Email *</label>
                        <input
                          type="email"
                          className={styles.formInput}
                          placeholder="admin@company.com"
                          required
                          value={clientForm.email}
                          onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className={styles.formLabel}>Mobile Number</label>
                          <span style={{ fontSize: '0.72rem', color: clientForm.mobile?.length === 10 ? '#10b981' : '#64748b', fontWeight: 600 }}>
                            {clientForm.mobile?.length || 0} / 10 digits
                          </span>
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          className={styles.formInput}
                          placeholder="e.g. 9876543210 (10 digits)"
                          value={clientForm.mobile}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setClientForm({ ...clientForm, mobile: val });
                          }}
                        />
                        {clientForm.mobile && clientForm.mobile.length > 0 && !/^[6-9]/.test(clientForm.mobile) && (
                          <div style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 600 }}>
                            ⚠️ Must start with 6, 7, 8, or 9 (starts with 5 or below rejected)
                          </div>
                        )}
                        {clientForm.mobile && clientForm.mobile.length > 0 && clientForm.mobile.length < 10 && /^[6-9]/.test(clientForm.mobile) && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.25rem' }}>
                            Enter remaining {10 - clientForm.mobile.length} digits
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.formGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          {editingClient ? 'New Password (leave blank to keep current)' : 'Initial Password *'}
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showClientPassword ? 'text' : 'password'}
                            className={styles.formInput}
                            placeholder="e.g. CompanyAdmin@2026!"
                            required={!editingClient}
                            value={clientForm.password}
                            onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                            style={{ paddingRight: '4.75rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowClientPassword(!showClientPassword)}
                            style={{
                              position: 'absolute',
                              right: '0.65rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.45rem',
                              borderRadius: '6px',
                              userSelect: 'none',
                            }}
                            title={showClientPassword ? 'Hide password' : 'Show password'}
                            aria-label={showClientPassword ? 'Hide password' : 'Show password'}
                          >
                            {showClientPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                            <span>{showClientPassword ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        {/* Live Password Rules Indicator */}
                        <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.22rem', fontSize: '0.73rem', background: '#f8fafc', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ color: (clientForm.password || '').length >= 8 ? '#16a34a' : '#64748b', fontWeight: (clientForm.password || '').length >= 8 ? 700 : 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{(clientForm.password || '').length >= 8 ? '✅' : '○'}</span> At least 8 characters
                          </span>
                          <span style={{ color: /[A-Z]/.test(clientForm.password || '') ? '#16a34a' : '#64748b', fontWeight: /[A-Z]/.test(clientForm.password || '') ? 700 : 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{/[A-Z]/.test(clientForm.password || '') ? '✅' : '○'}</span> At least 1 uppercase letter (A-Z)
                          </span>
                          <span style={{ color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(clientForm.password || '') ? '#16a34a' : '#64748b', fontWeight: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(clientForm.password || '') ? 700 : 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(clientForm.password || '') ? '✅' : '○'}</span> At least 1 special character (!@#$%^&* etc.)
                          </span>
                        </div>
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Account Status</label>
                        <select
                          className={styles.formSelect}
                          value={clientForm.status}
                          onChange={(e) => setClientForm({ ...clientForm, status: e.target.value })}
                        >
                          <option value="ACTIVE">ACTIVE (🟢 Enabled)</option>
                          <option value="INACTIVE">INACTIVE (🔴 Disabled)</option>
                        </select>
                      </div>
                    </div>

                    {/* Section 1.1: Assigned Theme Color / Primary Brand Accent */}
                    <div style={{ marginTop: '1.25rem', padding: '1.15rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>🎨</span>
                          <div>
                            <label className={styles.formLabel} style={{ marginBottom: 0, fontWeight: 700 }}>
                              Theme Color / Primary Color
                            </label>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Assign the primary accent color applied across this client&apos;s workspace and navigation.
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Selected:</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#ffffff', padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: clientForm.theme_color || '#7f22fe' }} />
                            <span>{clientForm.theme_color || '#7f22fe'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Swatches Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.65rem', marginTop: '0.75rem' }}>
                        {ACCENT_PRESETS.map(preset => {
                          const isSelected = (clientForm.theme_color || '#7f22fe').toLowerCase() === preset.hex.toLowerCase();
                          return (
                            <button
                              key={preset.hex}
                              type="button"
                              onClick={() => setClientForm({ ...clientForm, theme_color: preset.hex })}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                padding: '0.55rem 0.75rem',
                                borderRadius: '8px',
                                border: isSelected ? `2px solid ${preset.hex}` : '1px solid #cbd5e1',
                                background: '#ffffff',
                                boxShadow: isSelected ? `0 2px 8px ${preset.hex}33` : 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  backgroundColor: preset.hex,
                                  boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${preset.hex}66`,
                                  flexShrink: 0
                                }}
                              />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: isSelected ? 800 : 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {preset.name}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{preset.hex}</div>
                              </div>
                              {isSelected && <span style={{ color: preset.hex, fontWeight: 900, fontSize: '0.85rem' }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Live Mini Preview Box */}
                      <div style={{ marginTop: '0.9rem', padding: '0.85rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Live Accent Preview:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ background: clientForm.theme_color || '#7f22fe', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                              Primary Button
                            </span>
                            <span style={{ border: `1px solid ${clientForm.theme_color || '#7f22fe'}`, color: clientForm.theme_color || '#7f22fe', background: `${clientForm.theme_color || '#7f22fe'}14`, fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                              Active Tab
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#0f172a', fontWeight: 600 }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: clientForm.theme_color || '#7f22fe', boxShadow: `0 0 6px ${clientForm.theme_color || '#7f22fe'}` }} />
                              Selected Nav Item
                            </span>
                          </div>
                        </div>

                        {/* Custom Hex Color Picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Custom Hex:</span>
                          <input
                            type="color"
                            value={clientForm.theme_color || '#7f22fe'}
                            onChange={(e) => setClientForm({ ...clientForm, theme_color: e.target.value })}
                            style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                            title="Pick custom color"
                          />
                          <input
                            type="text"
                            value={clientForm.theme_color || '#7f22fe'}
                            onChange={(e) => setClientForm({ ...clientForm, theme_color: e.target.value })}
                            placeholder="#7f22fe"
                            maxLength={7}
                            style={{ width: '80px', padding: '0.25rem 0.45rem', fontSize: '0.75rem', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. Permission Tree (rendered when mode is 'create' or 'permissions') */}
                {(clientModalMode === 'create' || clientModalMode === 'permissions') && (
                  <>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, marginTop: clientModalMode === 'permissions' ? 0 : '1.5rem', marginBottom: '0.5rem' }}>
                      {clientModalMode === 'permissions' ? 'Permission Assignment (Hierarchy Tree)' : '2. Permission Assignment (Hierarchy Tree)'}
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                      Select <strong>Full Service</strong> for all modules, or choose <strong>CUSTOM</strong> to select specific feature sub-modules.
                    </p>

                <div className={styles.permTreeContainer}>
                  {accessCatalog.map(serv => {
                    const servSelected = isServiceSelected(serv.id);
                    const fullServ = isFullService(serv.id);

                    return (
                      <div key={serv.id} className={styles.permServiceCard}>
                        {/* Service Header Row */}
                        <div className={styles.permServiceHeader}>
                          <label className={styles.permCheckboxLabel}>
                            <input
                              type="checkbox"
                              checked={servSelected}
                              onChange={() => handleToggleServiceAccess(serv.id)}
                            />
                            <span>{serv.name}</span>
                          </label>

                          {servSelected && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#7f22fe', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={fullServ}
                                onChange={() => handleToggleFullServiceCheckbox(serv.id)}
                              />
                              Full Service (All Modules)
                            </label>
                          )}
                        </div>

                        {/* Modules Hierarchy */}
                        {servSelected && !fullServ && (
                          <div className={styles.permModulesList}>
                            {serv.modules.map(mod => {
                              const mode = getModuleAccessMode(serv.id, mod.id);
                              const subModuleIds = (mod.sub_modules || []).map(s => s.id);

                              return (
                                <div key={mod.id} className={styles.permModuleItem}>
                                  <div className={styles.permModuleHeader}>
                                    <span className={styles.permModuleTitle}>📁 {mod.name}</span>

                                    <div className={styles.permModeButtons}>
                                      <button
                                        type="button"
                                        className={`${styles.modeBtn} ${mode === 'NONE' ? styles.modeBtnActive : ''}`}
                                        onClick={() => handleSetModuleAccessMode(serv.id, mod.id, 'NONE')}
                                      >
                                        NONE
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.modeBtn} ${mode === 'FULL' ? styles.modeBtnActive : ''}`}
                                        onClick={() => handleSetModuleAccessMode(serv.id, mod.id, 'FULL')}
                                      >
                                        FULL MODULE
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.modeBtn} ${mode === 'CUSTOM' ? styles.modeBtnActive : ''}`}
                                        onClick={() => handleSetModuleAccessMode(serv.id, mod.id, 'CUSTOM')}
                                      >
                                        CUSTOM
                                      </button>
                                    </div>
                                  </div>

                                  {/* Sub-Modules selection when CUSTOM */}
                                  {mode === 'CUSTOM' && (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.65rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Select Allowed Screens:</span>
                                        <span
                                          className={styles.selectAllBtn}
                                          onClick={() => handleSelectAllSubModules(serv.id, mod.id, subModuleIds)}
                                        >
                                          Select All ({subModuleIds.length})
                                        </span>
                                      </div>

                                      <div className={styles.permSubModulesList}>
                                        {mod.sub_modules.map(sub => {
                                          const subChecked = isSubModuleSelected(serv.id, mod.id, sub.id);
                                          return (
                                            <label key={sub.id} className={styles.permSubItem}>
                                              <input
                                                type="checkbox"
                                                checked={subChecked}
                                                onChange={() => handleToggleSubModuleCheckbox(serv.id, mod.id, sub.id)}
                                              />
                                              <span>{sub.name}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                  </>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowClientModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  {clientModalMode === 'permissions'
                    ? 'Save Permissions'
                    : clientModalMode === 'details'
                    ? 'Save Details'
                    : 'Provision Client Panel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ==================================================== */}
      {/* MODAL: CENTERED SCREEN DELETE CONFIRMATION POPUP    */}
      {/* ==================================================== */}
      {clientToDelete && (
        <div className={styles.modalBackdrop} onClick={() => setClientToDelete(null)}>
          <div
            className={styles.confirmModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmDeleteTitle"
          >
            <div className={styles.confirmIconWrap} aria-hidden="true">
              <IconTrash size={30} />
            </div>
            <h3 id="confirmDeleteTitle" className={styles.confirmTitle}>
              Delete Admin / Client Panel?
            </h3>
            <p className={styles.confirmText}>
              Are you sure you want to permanently delete the panel for{' '}
              <strong className={styles.confirmTargetName}>&quot;{clientToDelete.organization_name}&quot;</strong>?
              <br />
              This will deactivate all permitted access and remove the client panel.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmBtnCancel}
                onClick={() => setClientToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtnDelete}
                onClick={handleConfirmDeleteClient}
              >
                <IconTrash size={15} /> Yes, Delete Panel
              </button>
            </div>
          </div>
        </div>
      )}
      {serviceToDelete && (
        <div
          className={styles.modalBackdrop}
          onClick={() => {
            if (!isDeletingService) setServiceToDelete(null);
          }}
        >
          <div
            className={styles.confirmModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmDeleteServiceTitle"
          >
            <div className={styles.confirmIconWrap} aria-hidden="true">
              <IconTrash size={30} />
            </div>
            <h3 id="confirmDeleteServiceTitle" className={styles.confirmTitle}>
              Delete Custom Service?
            </h3>
            <p className={styles.confirmText}>
              Permanently delete{' '}
              <strong className={styles.confirmTargetName}>&quot;{serviceToDelete.name}&quot;</strong>?
              This also removes its modules, screens, client access assignments, and related departments.
              The 7 seeded core services cannot be deleted.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmBtnCancel}
                onClick={() => setServiceToDelete(null)}
                disabled={isDeletingService}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtnDelete}
                onClick={handleDeleteService}
                disabled={isDeletingService}
              >
                <IconTrash size={15} /> {isDeletingService ? 'Deleting...' : 'Yes, Delete Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
