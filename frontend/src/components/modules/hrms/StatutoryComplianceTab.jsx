'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function StatutoryComplianceTab({ companyId, toast, userRole }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Calculator preview state
  const [calcForm, setCalcForm] = useState({
    basicWage: 25000,
    grossWage: 45000,
    state: 'RAJASTHAN',
  });
  const [calcResult, setCalcResult] = useState(null);

  const [ruleForm, setRuleForm] = useState({
    ruleType: 'EPF',
    effectiveFrom: new Date().toISOString().split('T')[0],
    notes: 'Configured statutory rate parameter',
    configJson: JSON.stringify(
      {
        employeeRatePct: 12.0,
        employerRatePct: 12.0,
        wageCeiling: 15000.0,
        enforceCeiling: true,
      },
      null,
      2
    ),
  });

  const loadRules = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/statutory/rules`);
      if (res?.success) {
        setRules(res.data || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load statutory rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  const runPreview = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.post(`/companies/${companyId}/hrms/statutory/preview`, calcForm);
      if (res?.success) {
        setCalcResult(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [companyId, calcForm]);

  useEffect(() => {
    loadRules();
    runPreview();
  }, [loadRules, runPreview]);

  const handleSaveRule = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(ruleForm.configJson);
      } catch {
        toast('Invalid JSON format in rule configuration', 'error');
        setLoading(false);
        return;
      }

      const res = await api.post(`/companies/${companyId}/hrms/statutory/rules`, {
        ruleType: ruleForm.ruleType,
        effectiveFrom: ruleForm.effectiveFrom,
        notes: ruleForm.notes,
        configJson: parsedConfig,
      });

      if (res?.success) {
        toast(`${ruleForm.ruleType} statutory rule saved`);
        setShowConfigModal(false);
        loadRules();
        runPreview();
      }
    } catch (err) {
      toast(err.message || 'Failed to save rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Statutory Compliance (EPF, ESIC, PT & TDS)</h2>
          <p>Configurable statutory rates, effective-dated parameters and state-specific taxation rules</p>
        </div>
        {userRole !== 'EMPLOYEE' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowConfigModal(true)}>
            + Configure Statutory Rule
          </button>
        )}
      </div>

      <div className={styles.disclaimerBox} style={{ marginTop: '1rem' }}>
        ⚖️ <strong>Legal & Chartered Accountant Verification Notice:</strong> All statutory rates (EPF, ESIC, State PT slabs, TDS) are parameter-driven. Default benchmarks must be vetted and calibrated by your company CA/Auditor for state-specific jurisdictional compliance (e.g. Rajasthan, Maharashtra, Karnataka) before production filing.
      </div>

      {/* Deduction Preview Calculator */}
      <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 800 }}>⚡ Live Statutory Deduction Sandbox Preview</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label>Monthly Basic Wage (₹)</label>
            <input
              type="number"
              value={calcForm.basicWage}
              onChange={(e) => setCalcForm({ ...calcForm, basicWage: Number(e.target.value) })}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Monthly Gross Wage (₹)</label>
            <input
              type="number"
              value={calcForm.grossWage}
              onChange={(e) => setCalcForm({ ...calcForm, grossWage: Number(e.target.value) })}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Jurisdiction / State</label>
            <select
              value={calcForm.state}
              onChange={(e) => setCalcForm({ ...calcForm, state: e.target.value })}
            >
              <option value="RAJASTHAN">RAJASTHAN (No PT Levy)</option>
              <option value="MAHARASHTRA">MAHARASHTRA (Slab PT)</option>
              <option value="KARNATAKA">KARNATAKA</option>
              <option value="GUJARAT">GUJARAT</option>
              <option value="DELHI">DELHI (No PT Levy)</option>
            </select>
          </div>
        </div>

        {calcResult && (
          <div className={styles.statGrid} style={{ marginTop: '1rem' }}>
            <div className={styles.statCard}>
              <div className={styles.metricTitle}>Employee EPF (12%)</div>
              <div className={styles.metricValue}>₹{calcResult.epf?.employeePf || 0}</div>
              <div className={styles.metricSub}>Employer PF: ₹{calcResult.epf?.employerPf || 0}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.metricTitle}>Employee ESIC (0.75%)</div>
              <div className={styles.metricValue}>₹{calcResult.esic?.employeeEsic || 0}</div>
              <div className={styles.metricSub}>Employer ESIC: ₹{calcResult.esic?.employerEsic || 0}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.metricTitle}>Professional Tax (PT)</div>
              <div className={styles.metricValue}>₹{calcResult.pt?.ptAmount || 0}</div>
              <div className={styles.metricSub}>State: {calcResult.pt?.state || calcForm.state}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.metricTitle}>Est. Monthly TDS</div>
              <div className={styles.metricValue}>₹{calcResult.tds?.tdsAmount || 0}</div>
              <div className={styles.metricSub}>Annualized slab based</div>
            </div>
          </div>
        )}
      </div>

      {/* Rules Table */}
      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1.5rem 0 0.5rem' }}>Active Statutory Rule Configurations</h3>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rule Type</th>
              <th>Effective From</th>
              <th>Effective To</th>
              <th>Status</th>
              <th>Notes / Remarks</th>
              <th>Config Payload</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  No customized statutory rules configured. Using standard system benchmarks.
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 'bold' }}>{r.ruleType}</td>
                  <td>{new Date(r.effectiveFrom).toLocaleDateString()}</td>
                  <td>{r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : 'Indefinite'}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>{r.status}</span>
                  </td>
                  <td>{r.notes || '—'}</td>
                  <td>
                    <pre style={{ margin: 0, fontSize: '0.72rem', background: '#f8fafc', padding: '0.4rem', borderRadius: '4px', maxWidth: '300px', overflowX: 'auto' }}>
                      {typeof r.configJson === 'string' ? r.configJson : JSON.stringify(r.configJson, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Configure Rule Modal */}
      {showConfigModal && (
        <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Configure Statutory Parameter">
          <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Rule Type *</label>
                <select
                  value={ruleForm.ruleType}
                  onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value })}
                >
                  <option value="EPF">EPF (Employee Provident Fund)</option>
                  <option value="ESIC">ESIC (Employee State Insurance)</option>
                  <option value="PROFESSIONAL_TAX">Professional Tax (PT)</option>
                  <option value="TDS">TDS (Tax Deducted at Source)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Effective Date *</label>
                <input
                  type="date"
                  required
                  value={ruleForm.effectiveFrom}
                  onChange={(e) => setRuleForm({ ...ruleForm, effectiveFrom: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Configuration JSON *</label>
              <textarea
                rows={8}
                required
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                value={ruleForm.configJson}
                onChange={(e) => setRuleForm({ ...ruleForm, configJson: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Auditor Notes</label>
              <input
                type="text"
                value={ruleForm.notes}
                onChange={(e) => setRuleForm({ ...ruleForm, notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowConfigModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                Save Statutory Rule
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

