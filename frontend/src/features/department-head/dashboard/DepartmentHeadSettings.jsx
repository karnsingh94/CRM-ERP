'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import styles from '@/components/modules/SettingsModule.module.css';

const ACCENT_PRESETS = ['#7f22fe', '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0284c7'];

export default function DepartmentHeadSettings({
  activeCompany,
  currentUser,
  modules = [],
  subModuleCount = 0,
  serviceName,
  themeMode,
  resolvedTheme,
  accentColor,
  notificationPreferences,
  onThemeChange,
  onAccentChange,
  onNotificationsChange,
}) {
  const roleLabel = currentUser?.role === 'TEAM_LEADER' ? 'Team Leader' : 'Department Head';
  const [activeTab, setActiveTab] = useState('appearance');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const savePassword = async (event) => {
    event.preventDefault();
    setStatus(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatus({ type: 'error', message: 'Enter the same new password in both fields.' });
      return;
    }
    if (
      passwordForm.newPassword.length < 8
      || !/[A-Z]/.test(passwordForm.newPassword)
      || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(passwordForm.newPassword)
    ) {
      setStatus({
        type: 'error',
        message: 'Use at least 8 characters, including an uppercase letter and a special character.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.put('/auth/user/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatus({ type: 'success', message: response.message || 'Password updated successfully.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to update password.' });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'account', label: 'Account & Security' },
    { id: 'department', label: 'Company Profile' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className={styles.settingsPage} data-theme={resolvedTheme}>
      <header className={styles.pageHeader}>
        <div>
          <h2>Settings</h2>
          <p>Manage your workspace appearance, {roleLabel} account, access details, and notifications.</p>
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
            <p>Choose how your {roleLabel} workspace looks on this device.</p>
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
            <p className={styles.helpText}>
              Theme and accent preferences are saved for your {roleLabel} account in this browser. Company-wide branding remains unchanged.
            </p>
          </div>
        </section>
      )}

      {activeTab === 'account' && (
        <div className={styles.stack}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>{roleLabel} Profile</h3>
              <p>Your account identity is managed by the Company Admin.</p>
            </div>
            <div className={styles.form}>
              <label className={styles.field}>
                <span className={styles.label}>Full name</span>
                <input value={currentUser?.name || ''} readOnly />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Login email</span>
                <input value={currentUser?.email || activeCompany?.email || ''} readOnly />
                <span className={styles.helpText}>Contact your Company Admin to change your name or login email.</span>
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Password &amp; Security</h3>
              <p>Verify your current password before setting a new one.</p>
            </div>
            <form className={styles.form} onSubmit={savePassword}>
              <label className={styles.field}>
                <span className={styles.label}>Current password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                />
              </label>
              <div className={styles.twoColumns}>
                <label className={styles.field}>
                  <span className={styles.label}>New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                  />
                </label>
              </div>
              <span className={styles.helpText}>Use at least 8 characters, including an uppercase letter and a special character.</span>
              <button className={styles.primaryButton} type="submit" disabled={isSaving}>
                {isSaving ? 'Updating…' : 'Change Password'}
              </button>
              {status && (
                <p
                  role="status"
                  style={{
                    margin: 0,
                    color: status.type === 'success' ? '#059669' : '#dc2626',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {status.message}
                </p>
              )}
            </form>
          </section>
        </div>
      )}

      {activeTab === 'department' && (
        <div className={styles.stack}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Company &amp; Department Details</h3>
              <p>Your assigned company, department, role, and access summary.</p>
            </div>
            <div className={styles.form}>
              <label className={styles.field}>
                <span className={styles.label}>Company / organization</span>
                <input value={activeCompany?.organizationName || activeCompany?.name || ''} readOnly />
              </label>
              <div className={styles.twoColumns}>
                <label className={styles.field}>
                  <span className={styles.label}>Assigned department</span>
                  <input value={serviceName} readOnly />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Workspace role</span>
                  <input value={currentUser?.roleTitle || roleLabel} readOnly />
                </label>
              </div>
              <div className={styles.twoColumns}>
                <label className={styles.field}>
                  <span className={styles.label}>Accessible modules</span>
                  <input value={modules.length} readOnly />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Accessible screens</span>
                  <input value={subModuleCount} readOnly />
                </label>
              </div>
            </div>
          </section>
          <section className={styles.infoCard}>
            <strong>Department access is managed by your Company Admin</strong>
            <span>Contact your Company Admin if you need a different department, module, screen, or permission assigned.</span>
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
              <input
                type="checkbox"
                checked={notificationPreferences.success}
                onChange={(event) => onNotificationsChange({ ...notificationPreferences, success: event.target.checked })}
              />
            </label>
            <label className={styles.preference}>
              <span>
                <strong>Informational notices</strong>
                <small>Show non-critical tips and status information.</small>
              </span>
              <input
                type="checkbox"
                checked={notificationPreferences.info}
                onChange={(event) => onNotificationsChange({ ...notificationPreferences, info: event.target.checked })}
              />
            </label>
            <div className={styles.securityNote}>
              Important errors and warning messages always remain enabled so critical feedback is not missed.
            </div>
          </div>
          <p className={styles.helpText}>These display preferences are saved for this account in this browser.</p>
        </section>
      )}
    </div>
  );
}
