'use client';

import { useState } from 'react';
import styles from '../DispatchModule.module.css';
import Modal from '../../ui/Modal';
import EmptyState from '../../ui/EmptyState';

export default function DispatchTrackingTab({
  dispatchOrders = [],
  loading = false,
  onFetchTrackingHistory,
  onAddTrackingEvent,
  onRecordPOD,
  onRecordFailedDelivery,
  onRefresh,
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(dispatchOrders[0]?.id || null);
  const [trackingData, setTrackingData] = useState(null);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [isFailModalOpen, setIsFailModalOpen] = useState(false);

  // Form states
  const [eventForm, setEventForm] = useState({
    status: 'IN_TRANSIT',
    location: '',
    carrierStatus: '',
    remarks: '',
  });

  const [podForm, setPodForm] = useState({
    receiverName: '',
    podAttachmentUrl: '',
    notes: '',
  });

  const [failForm, setFailForm] = useState({
    failureReason: 'Consignee unavailable',
    location: '',
    remarks: '',
    attemptNumber: 1,
  });

  const selectedOrder = dispatchOrders.find((d) => d.id === selectedOrderId) || dispatchOrders[0];

  const handleSelectOrder = async (orderId) => {
    setSelectedOrderId(orderId);
    try {
      setFetchingHistory(true);
      const data = await onFetchTrackingHistory(orderId);
      setTrackingData(data);
    } catch (err) {
      alert(err.message || 'Failed to fetch tracking history');
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      setActionLoading(true);
      await onAddTrackingEvent(selectedOrder.id, eventForm);
      setIsUpdateModalOpen(false);
      await handleSelectOrder(selectedOrder.id);
    } catch (err) {
      alert(err.message || 'Failed to update tracking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPOD = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      setActionLoading(true);
      await onRecordPOD(selectedOrder.id, podForm);
      setIsPodModalOpen(false);
      await handleSelectOrder(selectedOrder.id);
      alert('Proof of Delivery (POD) confirmed successfully!');
    } catch (err) {
      alert(err.message || 'Failed to record POD');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordFailed = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      setActionLoading(true);
      await onRecordFailedDelivery(selectedOrder.id, failForm);
      setIsFailModalOpen(false);
      await handleSelectOrder(selectedOrder.id);
    } catch (err) {
      alert(err.message || 'Failed to record delivery failure');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Shipment Tracking &amp; Proof of Delivery (POD)</h3>
          <p>Real-time transit updates, carrier checkpoints, failed attempt logging, and POD verification</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {dispatchOrders.length === 0 ? (
        <EmptyState
          icon="🚚"
          title="No Active Shipments"
          description="Create and dispatch orders to monitor carrier transit events and verify POD."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Orders Sidebar */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.82rem' }}>
              Dispatches ({dispatchOrders.length})
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {dispatchOrders.map((d) => (
                <div
                  key={d.id}
                  onClick={() => handleSelectOrder(d.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: (selectedOrder?.id === d.id) ? '#f0f9ff' : 'transparent',
                    borderLeft: (selectedOrder?.id === d.id) ? '3px solid #0284c7' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{d.dispatchNo}</strong>
                    <span
                      className={`${styles.badge} ${
                        d.status === 'DELIVERED'
                          ? styles.badgeGreen
                          : d.status === 'FAILED'
                          ? styles.badgeRed
                          : styles.badgeBlue
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px' }}>
                    {d.customerName}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking Details View */}
          {selectedOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', padding: '1rem' }}>
                <div className={styles.sectionHeader} style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Tracking: {selectedOrder.dispatchNo}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Transporter: <strong>{selectedOrder.carrierName || 'Self Transport'}</strong> &bull;
                      Vehicle: <strong>{selectedOrder.vehicleNo || 'N/A'}</strong> &bull;
                      Current Status: <span className={`${styles.badge} ${selectedOrder.status === 'DELIVERED' ? styles.badgeGreen : styles.badgeBlue}`}>{selectedOrder.status}</span>
                    </span>
                  </div>

                  <div className={styles.quickActions}>
                    {selectedOrder.status !== 'DELIVERED' && (
                      <>
                        <button className={styles.secondary} onClick={() => setIsUpdateModalOpen(true)}>
                          + Milestone Update
                        </button>
                        <button className={styles.secondary} onClick={() => setIsFailModalOpen(true)} style={{ color: '#b91c1c' }}>
                          ⚠️ Log Delay / Failure
                        </button>
                        <button className={styles.primary} onClick={() => setIsPodModalOpen(true)}>
                          ✓ Confirm POD
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* POD Section if delivered */}
                {selectedOrder.status === 'DELIVERED' && (
                  <div style={{ padding: '0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: '#166534', fontSize: '0.85rem' }}>Proof of Delivery (POD) Confirmed</strong>
                        <div style={{ fontSize: '0.74rem', color: '#15803d', marginTop: '2px' }}>
                          Delivered on: {selectedOrder.deliveredAt ? new Date(selectedOrder.deliveredAt).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      {selectedOrder.podAttachmentUrl && (
                        <a
                          href={selectedOrder.podAttachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.secondary}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                        >
                          📎 View POD Attachment
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <h5 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0 0 0.75rem', color: '#0f172a' }}>
                  Shipment Milestone Timeline
                </h5>

                {fetchingHistory ? (
                  <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.8rem' }}>Loading tracking timeline...</div>
                ) : trackingData?.timeline && trackingData.timeline.length > 0 ? (
                  <div className={styles.timeline}>
                    {trackingData.timeline.map((evt) => (
                      <div key={evt.id} className={styles.timelineItem}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`${styles.badge} ${evt.status === 'DELIVERED' ? styles.badgeGreen : styles.badgeBlue}`}>
                            {evt.status}
                          </span>
                          <strong style={{ color: '#0f172a' }}>{evt.location || 'In Transit'}</strong>
                          <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                            {new Date(evt.eventDate).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.75rem' }}>
                          {evt.remarks || evt.carrierStatus || 'Checkpoint cleared.'}
                        </div>
                        <small style={{ color: '#94a3b8' }}>Recorded by: {evt.recordedBy}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                    No tracking milestones recorded yet. Click &quot;+ Milestone Update&quot; to log current location.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* UPDATE TRACKING MODAL */}
      <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title={`Update Status: ${selectedOrder?.dispatchNo}`} maxWidth="500px">
        <form onSubmit={handleAddEvent} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Shipment Status</label>
            <select
              value={eventForm.status}
              onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
            >
              <option value="DISPATCHED">DISPATCHED (Left Origin)</option>
              <option value="IN_TRANSIT">IN_TRANSIT (On Route)</option>
              <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY (Arriving)</option>
              <option value="DELIVERED">DELIVERED (Final Arrival)</option>
              <option value="FAILED">FAILED (Attempt Unsuccessful)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Current Location / Hub</label>
            <input
              type="text"
              required
              placeholder="e.g. Jaipur Central Hub, Ahmedabad Toll"
              value={eventForm.location}
              onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Carrier Status</label>
            <input
              type="text"
              placeholder="e.g. Transporter Manifest Scan"
              value={eventForm.carrierStatus}
              onChange={(e) => setEventForm({ ...eventForm, carrierStatus: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Remarks / Notes</label>
            <textarea
              rows={2}
              placeholder="Transit observations, expected arrival time..."
              value={eventForm.remarks}
              onChange={(e) => setEventForm({ ...eventForm, remarks: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsUpdateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={actionLoading}>
              {actionLoading ? 'Updating...' : 'Log Milestone'}
            </button>
          </div>
        </form>
      </Modal>

      {/* RECORD POD MODAL */}
      <Modal isOpen={isPodModalOpen} onClose={() => setIsPodModalOpen(false)} title="Confirm Proof of Delivery (POD)" maxWidth="520px">
        <form onSubmit={handleRecordPOD} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Receiver Name *</label>
            <input
              type="text"
              required
              placeholder="Consignee or store manager name"
              value={podForm.receiverName}
              onChange={(e) => setPodForm({ ...podForm, receiverName: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Signed POD Attachment URL</label>
            <input
              type="url"
              placeholder="https://.../signed_pod.pdf"
              value={podForm.podAttachmentUrl}
              onChange={(e) => setPodForm({ ...podForm, podAttachmentUrl: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Delivery Remarks</label>
            <textarea
              rows={2}
              placeholder="Seal verified, cartons counted, delivered intact..."
              value={podForm.notes}
              onChange={(e) => setPodForm({ ...podForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsPodModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={actionLoading}>
              {actionLoading ? 'Saving POD...' : 'Confirm POD Delivery'}
            </button>
          </div>
        </form>
      </Modal>

      {/* RECORD FAILED DELIVERY MODAL */}
      <Modal isOpen={isFailModalOpen} onClose={() => setIsFailModalOpen(false)} title="Log Delivery Failure / Delay" maxWidth="520px">
        <form onSubmit={handleRecordFailed} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Failure Reason *</label>
            <select
              value={failForm.failureReason}
              onChange={(e) => setFailForm({ ...failForm, failureReason: e.target.value })}
            >
              <option value="Consignee warehouse closed">Consignee warehouse closed</option>
              <option value="Vehicle breakdown in transit">Vehicle breakdown in transit</option>
              <option value="Severe weather / road blockage">Severe weather / road blockage</option>
              <option value="Delivery refused by consignee">Delivery refused by consignee</option>
              <option value="Incorrect address / uncontactable">Incorrect address / uncontactable</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Current Location</label>
            <input
              type="text"
              placeholder="e.g. Near Mumbai Octroi Post"
              value={failForm.location}
              onChange={(e) => setFailForm({ ...failForm, location: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Attempt Number</label>
            <input
              type="number"
              min="1"
              max="5"
              value={failForm.attemptNumber}
              onChange={(e) => setFailForm({ ...failForm, attemptNumber: Number(e.target.value) })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Actionable Remarks</label>
            <textarea
              rows={2}
              placeholder="Re-delivery scheduled for tomorrow morning..."
              value={failForm.remarks}
              onChange={(e) => setFailForm({ ...failForm, remarks: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsFailModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} style={{ background: '#b91c1c' }} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Record Failure'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

