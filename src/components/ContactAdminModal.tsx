import React, { useState } from 'react';

interface Props {
  hardwareId: string;
  onClose: () => void;
}

export const ContactAdminModal: React.FC<Props> = ({ hardwareId, onClose }) => {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const response = await fetch('/api/support/device-unbind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardwareId, contactEmail: email, reason })
      });

      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        backgroundColor: '#1e1e2f', color: '#fff', padding: '24px',
        borderRadius: '8px', width: '420px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}>
        <h3 style={{ marginTop: 0 }}>Thiết bị đã bị liên kết</h3>
        <p style={{ fontSize: '14px', color: '#aaa' }}>
          Máy tính này đang liên kết với một tài khoản khác. Nếu mất tài khoản cũ, vui lòng gửi yêu cầu để Admin hỗ trợ gỡ liên kết.
        </p>

        {status === 'success' ? (
          <div>
            <p style={{ color: '#4caf50' }}>Yêu cầu đã được gửi thành công! Admin sẽ xử lý sớm nhất.</p>
            <button onClick={onClose} style={{ width: '100%', padding: '10px', background: '#3f51b5', color: '#fff', border: 'none', borderRadius: '4px' }}>Đóng</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px' }}>Hardware ID:</label>
              <input type="text" value={hardwareId} disabled style={{ width: '100%', padding: '8px', background: '#2a2a3d', border: '1px solid #444', color: '#888', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Email liên hệ:</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px', background: '#2a2a3d', border: '1px solid #444', color: '#fff', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px' }}>Lý do:</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} style={{ width: '100%', padding: '8px', background: '#2a2a3d', border: '1px solid #444', color: '#fff', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy</button>
              <button type="submit" disabled={status === 'loading'} style={{ padding: '8px 16px', background: '#e91e63', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {status === 'loading' ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
