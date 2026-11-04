'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function BiometricTab({ companyId, toast, userRole }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);

  const [deviceForm, setDeviceForm] = useState({
    deviceName: '',
    deviceSerial: '',
    deviceModel: 'eSSL K90 Pro',
    ipAddress: '',
    port: 4370,
    location: 'Main Reception',
  });

  const [simForm, setSimForm] = useState({
    deviceSerial: '',
    biometricUserId: '',
    punchType: 'CHECK_IN',
  });

  const loadDevices = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/biometric/devices`);
      if (res?.success) {
        setDevices(res.data || []);
        if (res.data?.length > 0 && !simForm.deviceSerial) {
          setSimForm((f) => ({ ...f, deviceSerial: res.data[0].deviceSerial }));
        }
      }
    } catch (err) {
      toast(err.message || 'Failed to load biometric devices', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, simForm.deviceSerial, toast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    if (!deviceForm.deviceName || !deviceForm.deviceSerial) {
      toast('Device name and serial number are required', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/biometric/devices`, deviceForm);
      if (res?.success) {
        toast('Biometric device registered successfully');
        setShowRegisterModal(false);
        setDeviceForm({
          deviceName: '',
          deviceSerial: '',
          deviceModel: 'eSSL K90 Pro',
          ipAddress: '',
          port: 4370,
          location: 'Main Reception',
        });
        loadDevices();
      }
    } catch (err) {
      toast(err.message || 'Failed to register device', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessBuffer = async () => {
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/biometric/process`);
      if (res?.success) {
        toast(`Processed ${res.data.processedCount || 0} raw punch logs into Daily Attendance`);
      }
    } catch (err) {
      toast(err.message || 'Failed to process buffer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePunch = async (e) => {
    e.preventDefault();
    if (!simForm.deviceSerial || !simForm.biometricUserId) {
      toast('Device and User ID are required', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/biometric/ingest`, {
        deviceSerial: simForm.deviceSerial,
        punches: [
          {
            biometricUserId: simForm.biometricUserId,
            punchTime: new Date().toISOString(),
            punchType: simForm.punchType,
            verificationMode: 'FINGERPRINT',
          },
        ],
      });
      if (res?.success) {
        toast(`Ingested ${res.data.ingestedCount} punch(es) (${res.data.duplicateCount} duplicate)`);
        setShowSimModal(false);
      }
    } catch (err) {
      toast(err.message || 'Punch ingestion failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper: check if device pinged within 10 minutes
  const isDeviceLive = (device) => {
    if (!device.lastPingAt) return false;
    const diffMin = (new Date().getTime() - new Date(device.lastPingAt).getTime()) / (1000 * 60);
    return diffMin < 10;
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Biometric Hardware Integration & Punch Buffer</h2>
          <p>On-premise bridge agent webhook, device heartbeats and raw punch ingestion</p>
        </div>
        {userRole !== 'EMPLOYEE' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowSimModal(true)}>
              Simulate Punch
            </button>
            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleProcessBuffer} disabled={loading}>
              ⚡ Process Raw Buffer
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowRegisterModal(true)}>
              + Register Device
            </button>
          </div>
        )}
      </div>

      <div className={styles.disclaimerBox} style={{ marginTop: '1rem' }}>
        🔒 <strong>Architecture Note:</strong> Devices behind private enterprise LAN firewalls communicate via an authenticated on-premise HTTP push agent. Devices show <strong>ONLINE</strong> only when confirmed by an active heartbeat within 10 minutes.
      </div>

      <div className={styles.tableContainer} style={{ marginTop: '1rem' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Device Name</th>
              <th>Serial Number</th>
              <th>Model</th>
              <th>IP Address : Port</th>
              <th>Location</th>
              <th>Live Heartbeat</th>
              <th>Last Ingested Sync</th>
              <th>Device Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No biometric devices registered. Register your first biometric time-clock.
                </td>
              </tr>
            ) : (
              devices.map((d) => {
                const live = isDeviceLive(d);
                return (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 'bold' }}>{d.deviceName}</td>
                    <td>{d.deviceSerial}</td>
                    <td>{d.deviceModel || '—'}</td>
                    <td>{d.ipAddress ? `${d.ipAddress}:${d.port}` : 'DHCP'}</td>
                    <td>{d.location || '—'}</td>
                    <td>{d.lastPingAt ? new Date(d.lastPingAt).toLocaleTimeString() : 'Never'}</td>
                    <td>{d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : 'No sync yet'}</td>
                    <td>
                      <span className={`${styles.badge} ${live ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {live ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Register Device Modal */}
      {showRegisterModal && (
        <Modal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)} title="Register Biometric Device">
          <form onSubmit={handleRegisterDevice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Device Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Factory Main Gate Scanner"
                value={deviceForm.deviceName}
                onChange={(e) => setDeviceForm({ ...deviceForm, deviceName: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Device Serial Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. ESS-2026-X1"
                value={deviceForm.deviceSerial}
                onChange={(e) => setDeviceForm({ ...deviceForm, deviceSerial: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Model</label>
                <input
                  type="text"
                  value={deviceForm.deviceModel}
                  onChange={(e) => setDeviceForm({ ...deviceForm, deviceModel: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Location</label>
                <input
                  type="text"
                  placeholder="e.g. Reception, Gate 2"
                  value={deviceForm.location}
                  onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>LAN IP Address</label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={deviceForm.ipAddress}
                  onChange={(e) => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Port</label>
                <input
                  type="number"
                  value={deviceForm.port}
                  onChange={(e) => setDeviceForm({ ...deviceForm, port: Number(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowRegisterModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                {loading ? 'Registering...' : 'Register Device'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Simulate Punch Modal */}
      {showSimModal && (
        <Modal isOpen={showSimModal} onClose={() => setShowSimModal(false)} title="Test Hardware Punch Push">
          <form onSubmit={handleSimulatePunch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Device</label>
              <select
                value={simForm.deviceSerial}
                onChange={(e) => setSimForm({ ...simForm, deviceSerial: e.target.value })}
                required
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.deviceSerial}>
                    {d.deviceName} ({d.deviceSerial})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Biometric User ID / Employee Code</label>
              <input
                type="text"
                required
                placeholder="e.g. EMP-202603-0001"
                value={simForm.biometricUserId}
                onChange={(e) => setSimForm({ ...simForm, biometricUserId: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Punch Type</label>
              <select
                value={simForm.punchType}
                onChange={(e) => setSimForm({ ...simForm, punchType: e.target.value })}
              >
                <option value="CHECK_IN">CHECK_IN</option>
                <option value="CHECK_OUT">CHECK_OUT</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowSimModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnSuccess}`} disabled={loading}>
                Push Ingestion
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

