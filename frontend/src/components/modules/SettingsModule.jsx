'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import styles from './SettingsModule.module.css';

const ACCENT_PRESETS = ['#7f22fe', '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0284c7'];

export default function SettingsModule({
  activeCompany,
  currentUser,
  permittedServices = [],
  themeMode,
  resolvedTheme,
  accentColor,
  notificationPreferences,
  onThemeChange,
  onAccentChange,
  onNotificationsChange,
  onProfileUpdated,
  onCompanyUpdated,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState('appearance');
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [companyForm, setCompanyForm] = useState({
    organizationName: activeCompany?.organizationName || '',
    mobile: activeCompany?.mobile || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState('');

  useEffect(() => {
    setProfileName(currentUser?.name || '');
  }, [currentUser?.name]);

  useEffect(() => {
    setCompanyForm({
      organizationName: activeCompany?.organizationName || '',
      mobile: activeCompany?.mobile || '',
    });
  }, [activeCompany?.organizationName, activeCompany?.mobile]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving('profile');
    try {
      const response = await api.put('/auth/company-admin/profile', { name: profileName.trim() });
      onProfileUpdated?.(response.data);
      showToast('Profile updated', 'Your admin profile name has been saved.', 'success');
    } catch (error) {
      showToast('Could not update profile', error.message, 'danger');
    } finally {
      setSaving('');
    }
  };

  const saveCompany = async (event) => {
    event.preventDefault();
    setSaving('company');
    try {
      const response = await api.put('/auth/company-admin/company', {
        organizationName: companyForm.organizationName.trim(),
        mobile: companyForm.mobile.trim(),
      });
      onCompanyUpdated?.(response.data);
      showToast('Company profile updated', 'Company name and contact number have been saved.', 'success');
    } catch (error) {
      showToast('Could not update company profile', error.message, 'danger');
    } finally {
      setSaving('');
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Passwords do not match', 'Enter the same new password in both fields.', 'danger');
      return;
    }

    setSaving('password');
    try {
      const response = await api.put('/auth/company-admin/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password updated', response.message || 'Your password has been changed.', 'success');
    } catch (error) {
      showToast('Could not update password', error.message, 'danger');
    } finally {
      setSaving('');
    }
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'account', label: 'Account & Security' },
    { id: 'company', label: 'Company Profile' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className={styles.settingsPage} data-theme={resolvedTheme}>
      <header className={styles.pageHeader}>
        <div>
          <h2>Settings</h2>
          <p>Manage your workspace appearance, admin account, company details, and notifications.</p>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'appearance' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Appearance &amp; Branding</h3>
            <p>Choose how your company workspace looks on this device.</p>
          </div>
          <div className={styles.fieldGroup}>
            <span className={styles.label}>Theme mode</span>
            <div className={styles.choiceGrid}>
              {['light', 'dark', 'system'].map((mode) => (
                <button
                  type="button"
                  key={mode}
                  className={`${styles.choice} ${themeMode === mode ? styles.selectedChoice : ''}`}
                  onClick={() => onThemeChange(mode)}
                >
                  <span className={styles.choiceTitle}>{mode[0].toUpperCase() + mode.slice(1)}</span>
                  <span className={styles.muted}>
                    {mode === 'system' ? 'Follow device preference' : `${mode[0].toUpperCase() + mode.slice(1)} workspace`}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <span className={styles.label}>Accent color</span>
            <div className={styles.colorChoices}>
              {ACCENT_PRESETS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`${styles.colorChoice} ${accentColor.toLowerCase() === color ? styles.selectedColor : ''}`}
                  onClick={() => onAccentChange(color)}
                  style={{ '--swatch-color': color }}
                  aria-label={`Use accent color ${color}`}
                  title={color}
                />
              ))}
              <label className={styles.customColor}>
                Custom
                <input
                  type="color"
                  value={accentColor}
                  onChange={(event) => onAccentChange(event.target.value)}
                  aria-label="Choose custom accent color"
                />
              </label>
            </div>
            <p className={styles.helpText}>Accent preference is saved for your admin account on this browser. Company-wide branding remains unchanged.</p>
          </div>
        </section>
      )}

      {activeTab === 'account' && (
        <div className={styles.stack}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Admin Profile</h3>
              <p>Update the name displayed in your company workspace.</p>
            </div>
            <form className={styles.form} onSubmit={saveProfile}>
              <label className={styles.field}>
                <span className={styles.label}>Full name</span>
                <input required minLength={2} maxLength={150} value={profileName} onChange={(event) => setProfileName(event.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Login email</span>
                <input value={currentUser?.email || activeCompany?.email || ''} readOnly />
                <span className={styles.helpText}>Contact your platform administrator to change the login email.</span>
              </label>
              <button className={styles.primaryButton} type="submit" disabled={saving === 'profile'}>
                {saving === 'profile' ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Password &amp; Security</h3>
              <p>Verify your current password before setting a new one.</p>
            </div>
            <form className={styles.form} onSubmit={savePassword}>
              <label className={styles.field}>
                <span className={styles.label}>Current password</span>
                <input type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
              </label>
              <div className={styles.twoColumns}>
                <label className={styles.field}>
                  <span className={styles.label}>New password</span>
                  <input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Confirm new password</span>
                  <input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
                </label>
              </div>
              <span className={styles.helpText}>Use at least 8 characters, including an uppercase letter and a special character.</span>
              <button className={styles.primaryButton} type="submit" disabled={saving === 'password'}>
                {saving === 'password' ? 'Updating…' : 'Change Password'}
              </button>
            </form>
          </section>
        </div>
      )}

      {activeTab === 'company' && (
        <div className={styles.stack}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Company Details</h3>
              <p>Edit your organization name and main contact number.</p>
            </div>
            <form className={styles.form} onSubmit={saveCompany}>
              <label className={styles.field}>
                <span className={styles.label}>Company / organization name</span>
                <input required minLength={2} maxLength={180} value={companyForm.organizationName} onChange={(event) => setCompanyForm({ ...companyForm, organizationName: event.target.value })} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Contact mobile</span>
                <input type="tel" inputMode="numeric" maxLength={10} value={companyForm.mobile} onChange={(event) => setCompanyForm({ ...companyForm, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile number" />
                <span className={styles.helpText}>Leave blank if no contact number is available.</span>
              </label>
              <div className={styles.readonlyInfo}>
                <span className={styles.label}>Login email</span>
                <span>{activeCompany?.email || currentUser?.email || 'Not provided'}</span>
              </div>
              <button className={styles.primaryButton} type="submit" disabled={saving === 'company'}>
                {saving === 'company' ? 'Saving…' : 'Save Company Details'}
              </button>
            </form>
          </section>
          <section className={styles.infoCard}>
            <strong>Workspace access is managed by Super Admin</strong>
            <span>{permittedServices.length} enterprise services are currently assigned to this company. Contact your platform administrator to change access.</span>
          </section>
        </div>
      )}

      {activeTab === 'notifications' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Notification Preferences</h3>
            <p>Choose which routine messages appear while you work.</p>
          </div>
          <div className={styles.preferenceList}>
            <label className={styles.preference}>
              <span>
                <strong>Success confirmations</strong>
                <small>Show a message after saving or completing an action.</small>
              </span>
              <input type="checkbox" checked={notificationPreferences.success} onChange={(event) => onNotificationsChange({ ...notificationPreferences, success: event.target.checked })} />
            </label>
            <label className={styles.preference}>
              <span>
                <strong>Informational notices</strong>
                <small>Show non-critical tips and status information.</small>
              </span>
              <input type="checkbox" checked={notificationPreferences.info} onChange={(event) => onNotificationsChange({ ...notificationPreferences, info: event.target.checked })} />
            </label>
            <div className={styles.securityNote}>Important errors and warning messages always remain enabled so critical feedback is not missed.</div>
          </div>
          <p className={styles.helpText}>These display preferences are saved in this browser. Email and mobile notification delivery is not configured for this workspace.</p>
        </section>
      )}
    </div>
  );
}
