'use client';

import Modal from './Modal';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this operation?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="480px">
      <div style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
        {message}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontWeight: 600,
            fontSize: '0.88rem',
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          style={{
            padding: '0.65rem 1.35rem',
            borderRadius: '8px',
            border: 'none',
            background: isDanger ? '#ef4444' : '#7f22fe',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.88rem',
            boxShadow: isDanger
              ? '0 4px 10px -1px rgba(239, 68, 68, 0.25)'
              : '0 4px 12px -1px rgba(127, 34, 254, 0.3)',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
