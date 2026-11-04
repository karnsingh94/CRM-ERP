'use client';

import { useState } from 'react';
import styles from '../DispatchModule.module.css';
import Modal from '../../ui/Modal';
import EmptyState from '../../ui/EmptyState';

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function DispatchPackingTab({
  dispatchOrders = [],
  loading = false,
  onCreatePackage,
  onFetchPackingList,
  onRefresh,
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(dispatchOrders[0]?.id || null);
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [packingListData, setPackingListData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingList, setFetchingList] = useState(false);

  // New Package Form State
  const [pkgForm, setPkgForm] = useState({
    boxType: 'CARTON',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    weightGrossKg: '',
    weightNetKg: '',
    barcode: '',
    notes: '',
  });

  const selectedOrder = dispatchOrders.find((d) => d.id === selectedOrderId) || dispatchOrders[0];

  const handleOpenPackModal = () => {
    setPkgForm({
      boxType: 'CARTON',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
      weightGrossKg: '',
      weightNetKg: '',
      barcode: '',
      notes: '',
    });
    setIsPackModalOpen(true);
  };

  const handleCreatePackage = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      setSubmitting(true);
      await onCreatePackage(selectedOrder.id, {
        boxType: pkgForm.boxType,
        lengthCm: pkgForm.lengthCm ? Number(pkgForm.lengthCm) : null,
        widthCm: pkgForm.widthCm ? Number(pkgForm.widthCm) : null,
        heightCm: pkgForm.heightCm ? Number(pkgForm.heightCm) : null,
        weightGrossKg: Number(pkgForm.weightGrossKg) || 0,
        weightNetKg: Number(pkgForm.weightNetKg) || 0,
        barcode: pkgForm.barcode || null,
        notes: pkgForm.notes || null,
      });
      setIsPackModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to create package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPackingList = async () => {
    if (!selectedOrder) return;
    try {
      setFetchingList(true);
      const data = await onFetchPackingList(selectedOrder.id);
      setPackingListData(data);
      setIsListModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to fetch packing list');
    } finally {
      setFetchingList(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Packing &amp; Carton Management</h3>
          <p>Package creation, box dimensions, gross/net weights, barcodes, and printable packing lists</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {dispatchOrders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No Dispatch Orders Available"
          description="Create a dispatch order from the Dispatch Planning tab to manage cartons and packing lists."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Order Selector */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.82rem' }}>
              Select Dispatch Order ({dispatchOrders.length})
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {dispatchOrders.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedOrderId(d.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: selectedOrder?.id === d.id ? '#f0f9ff' : 'transparent',
                    borderLeft: selectedOrder?.id === d.id ? '3px solid #0284c7' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{d.dispatchNo}</strong>
                    <span className={`${styles.badge} ${styles.badgeBlue}`}>{d.packages?.length || 0} Boxes</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px' }}>
                    {d.customerName}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Order Packages View */}
          {selectedOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', padding: '1rem' }}>
                <div className={styles.sectionHeader} style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Packing Breakdown: {selectedOrder.dispatchNo}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Customer: {selectedOrder.customerName} &nbsp;|&nbsp;
                      Total Packages: <strong>{selectedOrder.totalPackages || selectedOrder.packages?.length || 0}</strong> &nbsp;|&nbsp;
                      Total Weight: <strong>{numberFmt(selectedOrder.totalGrossWeightKg)} KG</strong>
                    </span>
                  </div>

                  <div className={styles.quickActions}>
                    <button className={styles.secondary} onClick={handleViewPackingList} disabled={fetchingList}>
                      {fetchingList ? 'Loading...' : '📄 View Packing List'}
                    </button>
                    {!['DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(selectedOrder.status) && (
                      <button className={styles.primary} onClick={handleOpenPackModal}>
                        + Add Carton/Package
                      </button>
                    )}
                  </div>
                </div>

                {/* Packages Table */}
                {selectedOrder.packages && selectedOrder.packages.length > 0 ? (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Pkg #</th>
                        <th>Package Code</th>
                        <th>Box Type</th>
                        <th>Dimensions (L×W×H)</th>
                        <th>Gross Wt (KG)</th>
                        <th>Net Wt (KG)</th>
                        <th>Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.packages.map((pkg) => (
                        <tr key={pkg.id}>
                          <td><strong>#{pkg.packageNumber}</strong></td>
                          <td><code>{pkg.packageCode}</code></td>
                          <td><span className={`${styles.badge} ${styles.badgeGray}`}>{pkg.boxType}</span></td>
                          <td>{pkg.lengthCm || 0} × {pkg.widthCm || 0} × {pkg.heightCm || 0} cm</td>
                          <td><strong>{numberFmt(pkg.weightGrossKg)} KG</strong></td>
                          <td>{numberFmt(pkg.weightNetKg)} KG</td>
                          <td><small style={{ color: '#64748b' }}>{pkg.barcode || 'N/A'}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState
                    icon="📦"
                    title="No Packages Created Yet"
                    description="Click '+ Add Carton/Package' to create boxes with dimensions and weights."
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE PACKAGE MODAL */}
      <Modal isOpen={isPackModalOpen} onClose={() => !submitting && setIsPackModalOpen(false)} title={`Add Package for ${selectedOrder?.dispatchNo}`} maxWidth="600px">
        <form onSubmit={handleCreatePackage} className={styles.modalForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Box / Package Type</label>
              <select
                value={pkgForm.boxType}
                onChange={(e) => setPkgForm({ ...pkgForm, boxType: e.target.value })}
              >
                <option value="CARTON">Corrugated Carton</option>
                <option value="WOODEN_CRATE">Wooden Crate</option>
                <option value="PALLET">Wooden Pallet</option>
                <option value="DRUM">Steel/Fiber Drum</option>
                <option value="POUCH">Pouch / Bag</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Barcode / Tag</label>
              <input
                type="text"
                placeholder="Barcode or leave blank to auto-generate"
                value={pkgForm.barcode}
                onChange={(e) => setPkgForm({ ...pkgForm, barcode: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Gross Weight (KG) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 25.5"
                value={pkgForm.weightGrossKg}
                onChange={(e) => setPkgForm({ ...pkgForm, weightGrossKg: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Net Weight (KG) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 23.0"
                value={pkgForm.weightNetKg}
                onChange={(e) => setPkgForm({ ...pkgForm, weightNetKg: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Length (cm)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 60"
                value={pkgForm.lengthCm}
                onChange={(e) => setPkgForm({ ...pkgForm, lengthCm: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Width (cm)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 40"
                value={pkgForm.widthCm}
                onChange={(e) => setPkgForm({ ...pkgForm, widthCm: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Height (cm)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 40"
                value={pkgForm.heightCm}
                onChange={(e) => setPkgForm({ ...pkgForm, heightCm: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsPackModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Carton'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PRINTABLE PACKING LIST MODAL */}
      <Modal isOpen={isListModalOpen} onClose={() => setIsListModalOpen(false)} title="Printable Packing List" maxWidth="800px">
        {packingListData && (
          <div className={styles.docPreview}>
            <div className={styles.docHeader}>
              <div className={styles.docCompany}>
                <h4>SHREE NATH EXPORTS</h4>
                <p style={{ margin: '3px 0', color: '#64748b' }}>Export Packing Manifest &amp; Carton Breakdown</p>
              </div>
              <div className={styles.docMeta}>
                <p><strong>Dispatch #:</strong> {packingListData.dispatchNo}</p>
                <p><strong>Date:</strong> {new Date(packingListData.dispatchDate).toLocaleDateString()}</p>
                <p><strong>Sales Order #:</strong> {packingListData.salesOrderNo || 'N/A'}</p>
              </div>
            </div>

            <div className={styles.docSection}>
              <div>
                <strong>Consignee / Customer:</strong>
                <div>{packingListData.customerName}</div>
                <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{packingListData.shippingAddress || 'Standard Warehouse Delivery'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Transport Details:</strong>
                <div>Carrier: {packingListData.carrierName || 'Self Transport'}</div>
                <div>Vehicle: {packingListData.vehicleNo || 'N/A'}</div>
              </div>
            </div>

            <table className={styles.table} style={{ border: '1px solid #e2e8f0' }}>
              <thead>
                <tr>
                  <th>Pkg #</th>
                  <th>Carton Code</th>
                  <th>Box Type</th>
                  <th>Dimensions</th>
                  <th>Gross Wt</th>
                  <th>Net Wt</th>
                  <th>Barcode</th>
                </tr>
              </thead>
              <tbody>
                {packingListData.packages?.map((p) => (
                  <tr key={p.packageNumber}>
                    <td>#{p.packageNumber}</td>
                    <td><code>{p.packageCode}</code></td>
                    <td>{p.boxType}</td>
                    <td>{p.dimensions}</td>
                    <td><strong>{numberFmt(p.weightGrossKg)} KG</strong></td>
                    <td>{numberFmt(p.weightNetKg)} KG</td>
                    <td>{p.barcode}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
              <div><strong>Total Packages:</strong> {packingListData.totalPackages}</div>
              <div><strong>Total Gross Weight:</strong> {numberFmt(packingListData.totalGrossWeightKg)} KG</div>
              <div><strong>Total Net Weight:</strong> {numberFmt(packingListData.totalNetWeightKg)} KG</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
              <button className={styles.secondary} onClick={() => window.print()}>
                🖨️ Print Packing List
              </button>
              <button className={styles.primary} onClick={() => setIsListModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

