'use client';

import { useState } from 'react';
import { api } from '../../lib/api';

export default function StaffPasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    if (form.newPassword !== form.confirmPassword) {
      setMessage('The new password and confirmation do not match.');
      return;
    }
    if (
      form.newPassword.length < 8 ||
      !/[A-Z]/.test(form.newPassword) ||
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(form.newPassword)
    ) {
      setMessage('Use at least 8 characters, including an uppercase letter and a special character.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.put('/auth/user/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setMessage(response.message || 'Password updated successfully.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setMessage(error.message || 'Unable to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    color: '#0f172a',
    background: '#fff',
  };

  return (
    <section style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
      <h2 style={{ margin: '0 0 0.35rem', color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>Change Password</h2>
      <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.82rem' }}>Your initial password was provided by your Company Admin.</p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <label style={{ color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>
          Current password
          <input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} style={inputStyle} />
        </label>
        <label style={{ color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>
          New password
          <input type="password" autoComplete="new-password" required value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} style={inputStyle} />
        </label>
        <label style={{ color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>
          Confirm new password
          <input type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} style={inputStyle} />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button type="submit" disabled={isSubmitting} style={{ padding: '0.65rem 1rem', border: 0, borderRadius: '8px', background: '#7f22fe', color: '#fff', fontWeight: 700, cursor: isSubmitting ? 'wait' : 'pointer' }}>
            {isSubmitting ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </form>
      {message && <p role="status" style={{ margin: '0.75rem 0 0', color: message.includes('success') ? '#047857' : '#b91c1c', fontSize: '0.82rem' }}>{message}</p>}
    </section>
  );
}
