import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function Admin({ user, isAdmin }) {
  const [pendingStores, setPendingStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) loadPendingStores();
  }, [isAdmin]);

  const loadPendingStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingStores(data || []);
    setLoading(false);
  };

  const handleApprove = async (id) => {
    await supabase.from('stores').update({ status: 'approved' }).eq('id', id);
    setPendingStores(prev => prev.filter(s => s.id !== id));
    alert('승인됐어요! ✅');
  };

  const handleReject = async (id) => {
    await supabase.from('stores').update({ status: 'rejected' }).eq('id', id);
    setPendingStores(prev => prev.filter(s => s.id !== id));
    alert('거절됐어요! ❌');
  };

  if (!isAdmin) {
    return <div style={{padding: '20px', textAlign: 'center'}}>관리자만 접근 가능해요.</div>;
  }

  return (
    <div className="admin-panel">
      <h2>🔧 관리자 페이지</h2>
      <h3>승인 대기 가게 ({pendingStores.length}개)</h3>
      {loading ? <p>로딩 중...</p> : pendingStores.length === 0 ? (
        <p>대기 중인 가게가 없어요!</p>
      ) : (
        pendingStores.map(store => (
          <div key={store.id} className="admin-store-card">
<div className="admin-store-info">
  {store.image_url && (
    <img
      src={store.image_url}
      alt={store.name}
      style={{
        width: '100%',
        maxHeight: '160px',
        objectFit: 'cover',
        borderRadius: '8px',
        marginBottom: '8px'
      }}
    />
  )}
  <h4>{store.name}</h4>
  <p>{store.address}</p>
  <p>카테고리: {store.category}</p>
  <p>등록자: {store.owner_email}</p>
</div>
            <div className="admin-store-actions">
              <button className="btn-approve" onClick={() => handleApprove(store.id)}>✅ 승인</button>
              <button className="btn-reject" onClick={() => handleReject(store.id)}>❌ 거절</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default Admin;