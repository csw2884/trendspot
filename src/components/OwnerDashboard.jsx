import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STOCK_STATUS = {
  여유: { color: '#2ED573' },
  소량: { color: '#FFA502' },
  품절: { color: '#FF4757' }
};

function OwnerDashboard({ user, onClose }) {
  const [myStores, setMyStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddStock, setShowAddStock] = useState(false);
  const [stockForm, setStockForm] = useState({ item_name: '', status: '여유', quantity: '' });
  const [stockImage, setStockImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // ✅ 수량 수정 상태
  const [editingQty, setEditingQty] = useState(null);
  const [editQtyValue, setEditQtyValue] = useState('');

  useEffect(() => {
    loadMyStores();
    const sub = supabase.channel('owner_stores_channel')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'stores',
        filter: `owner_id=eq.${user.id}`
      }, (payload) => {
        setMyStores(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
        setSelectedStore(prev => prev?.id === payload.new.id ? payload.new : prev);
      })
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedStore) loadStocks(selectedStore.id);
  }, [selectedStore]);

  const loadMyStores = async () => {
    const { data } = await supabase.from('stores').select('*')
      .eq('owner_id', user.id).order('created_at', { ascending: false });
    setMyStores(data || []);
    if (data?.length > 0) setSelectedStore(data[0]);
    setLoading(false);
  };

  const loadStocks = async (storeId) => {
    const { data } = await supabase.from('stocks').select('*')
      .eq('store_id', storeId).order('reported_at', { ascending: false });
    const latest = {};
    (data || []).forEach(s => { if (!latest[s.item_name]) latest[s.item_name] = s; });
    setStocks(Object.values(latest));
  };

  const uploadImage = async (file) => {
    const ext = file.name.split('.').pop();
    const path = `stocks/${Date.now()}.${ext}`;
    await supabase.storage.from('store-images').upload(path, file, { upsert: true });
    const { data: { publicUrl } } = supabase.storage.from('store-images').getPublicUrl(path);
    return publicUrl;
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!stockForm.item_name.trim()) return;
    setSubmitting(true);
    try {
      let imageUrl = null;
      if (stockImage) imageUrl = await uploadImage(stockImage);
      await supabase.from('stocks').insert({
        store_id: selectedStore.id,
        item_name: stockForm.item_name.trim(),
        status: stockForm.status,
        quantity: parseInt(stockForm.quantity) || 0,
        reported_by: user.id,
        reported_at: new Date().toISOString(),
        image_url: imageUrl
      });
      setShowAddStock(false);
      setStockForm({ item_name: '', status: '여유', quantity: '' });
      setStockImage(null);
      loadStocks(selectedStore.id);
      alert('재고가 등록됐어요! ✅');
    } catch (e) {
      alert('등록 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 상태 변경
  const handleUpdateStatus = async (stock, newStatus) => {
    await supabase.from('stocks').insert({
      store_id: stock.store_id,
      item_name: stock.item_name,
      status: newStatus,
      quantity: newStatus === '품절' ? 0 : stock.quantity,
      reported_by: user.id,
      reported_at: new Date().toISOString(),
      image_url: stock.image_url
    });
    loadStocks(selectedStore.id);
  };

  // ✅ 수량 수정
  const handleUpdateQty = async (stock) => {
    const newQty = parseInt(editQtyValue);
    if (isNaN(newQty) || newQty < 0) { alert('올바른 수량을 입력해주세요.'); return; }
    await supabase.from('stocks').insert({
      store_id: stock.store_id,
      item_name: stock.item_name,
      status: stock.status,
      quantity: newQty,
      reported_by: user.id,
      reported_at: new Date().toISOString(),
      image_url: stock.image_url
    });
    setEditingQty(null);
    setEditQtyValue('');
    loadStocks(selectedStore.id);
  };

  // ✅ 재고 삭제 (해당 아이템의 모든 기록 삭제)
  const handleDeleteStock = async (stock) => {
    if (!window.confirm(`"${stock.item_name}" 재고를 삭제할까요?`)) return;
    await supabase.from('stocks')
      .delete()
      .eq('store_id', stock.store_id)
      .eq('item_name', stock.item_name);
    loadStocks(selectedStore.id);
  };

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000 / 60;
    if (diff < 60) return `${Math.round(diff)}분 전`;
    if (diff < 1440) return `${Math.round(diff / 60)}시간 전`;
    return `${Math.round(diff / 1440)}일 전`;
  };

  if (loading) return (
    <div className="owner-overlay" onClick={onClose}>
      <div className="owner-dashboard" onClick={e => e.stopPropagation()}>
        <div className="dashboard-header">
          <h2>🏪 사장님 대시보드</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="dashboard-loading">로딩 중...</div>
      </div>
    </div>
  );

  return (
    <div className="owner-overlay" onClick={onClose}>
      <div className="owner-dashboard" onClick={e => e.stopPropagation()}>
        <div className="dashboard-header">
          <h2>🏪 사장님 대시보드</h2>
          <button className="dashboard-close" onClick={onClose}>✕</button>
        </div>

        {myStores.length === 0 ? (
          <div className="no-stores">
            <p>등록된 가게가 없어요</p>
            <p style={{ fontSize: '13px', color: '#999' }}>가게 등록 신청 후 승인을 기다려주세요</p>
          </div>
        ) : (
          <>
            {myStores.length > 0 && (
              <div className="store-selector">
                {myStores.map(store => (
                  <button key={store.id}
                    className={`store-select-btn ${selectedStore?.id === store.id ? 'active' : ''}`}
                    onClick={() => setSelectedStore(store)}>
                    {store.name}
                    {store.status === 'pending' && <span className="pending-badge">승인 대기</span>}
                    {store.status === 'approved' && <span style={{ fontSize: '10px', color: '#2ED573', marginLeft: '4px' }}>✅</span>}
                  </button>
                ))}
              </div>
            )}

            {selectedStore && (
              <>
                <div className="store-status-card">
                  <div className="store-status-info">
                    <h3>{selectedStore.name}</h3>
                    <p>{selectedStore.address}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`status-badge ${selectedStore.status}`}>
                      {selectedStore.status === 'approved' ? '✅ 승인됨' :
                        selectedStore.status === 'pending' ? '⏳ 대기중' : '❌ 거절됨'}
                    </span>
                    {selectedStore.status === 'pending' && (
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>관리자 승인 대기 중이에요</div>
                    )}
                  </div>
                </div>

                {selectedStore.status === 'approved' ? (
                  <>
                    <div className="stock-section-header">
                      <h3>📦 재고 현황 ({stocks.length}개)</h3>
                      <button className="btn-add-stock" onClick={() => setShowAddStock(true)}>+ 재고 추가</button>
                    </div>
                    {stocks.length === 0 ? (
                      <div className="no-stocks">
                        <p>등록된 재고가 없어요</p>
                        <button className="btn-add-stock-big" onClick={() => setShowAddStock(true)}>+ 첫 재고 등록하기</button>
                      </div>
                    ) : (
                      <div className="stock-list">
                        {stocks.map(stock => (
                          <div key={stock.id} className="stock-card">
                            {stock.image_url && (
                              <img src={stock.image_url} alt={stock.item_name} className="stock-card-img" />
                            )}
                            <div className="stock-card-info">
                              <div className="stock-card-name">{stock.item_name}</div>
                              <div className="stock-card-time">{timeAgo(stock.reported_at)}</div>

                              {/* ✅ 수량 수정 */}
                              {editingQty === stock.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <input
                                    type="number" min="0" value={editQtyValue}
                                    onChange={e => setEditQtyValue(e.target.value)}
                                    style={{ width: '70px', padding: '3px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px' }}
                                    autoFocus
                                  />
                                  <button onClick={() => handleUpdateQty(stock)}
                                    style={{ fontSize: '11px', padding: '3px 8px', background: '#2ED573', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                                    저장
                                  </button>
                                  <button onClick={() => { setEditingQty(null); setEditQtyValue(''); }}
                                    style={{ fontSize: '11px', padding: '3px 8px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <span className="stock-card-qty">수량: {stock.quantity}개</span>
                                  <button onClick={() => { setEditingQty(stock.id); setEditQtyValue(String(stock.quantity)); }}
                                    style={{ fontSize: '11px', padding: '2px 7px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                                    ✏️ 수정
                                  </button>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                              {/* 상태 버튼 */}
                              <div className="stock-card-actions">
                                {Object.keys(STOCK_STATUS).map(s => (
                                  <button key={s}
                                    className={`status-btn ${stock.status === s ? 'active' : ''}`}
                                    style={{
                                      borderColor: STOCK_STATUS[s].color,
                                      color: stock.status === s ? 'white' : STOCK_STATUS[s].color,
                                      backgroundColor: stock.status === s ? STOCK_STATUS[s].color : 'white'
                                    }}
                                    onClick={() => handleUpdateStatus(stock, s)}>
                                    {s}
                                  </button>
                                ))}
                              </div>

                              {/* ✅ 삭제 버튼 */}
                              <button onClick={() => handleDeleteStock(stock)}
                                style={{
                                  fontSize: '11px', padding: '3px 10px',
                                  background: 'none', color: '#FF4757',
                                  border: '1px solid #FF4757', borderRadius: '6px',
                                  cursor: 'pointer'
                                }}>
                                🗑️ 삭제
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : selectedStore.status === 'rejected' ? (
                  <div className="pending-message" style={{ color: '#FF4757' }}>
                    <p>❌ 가게 등록이 거절됐어요</p>
                    <p style={{ fontSize: '12px', color: '#999' }}>다시 등록 신청해주세요</p>
                  </div>
                ) : (
                  <div className="pending-message">
                    <p>⏳ 관리자 승인 후 재고를 관리할 수 있어요</p>
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>승인되면 자동으로 업데이트돼요 🔔</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 재고 추가 폼 */}
        {showAddStock && (
          <div className="modal-overlay" onClick={() => setShowAddStock(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📦 재고 추가</h3>
                <button className="close-btn" onClick={() => setShowAddStock(false)}>✕</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAddStock} className="report-form">
                  <div className="form-group">
                    <label>상품명 *</label>
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>🔥 현재 트렌드 아이템 선택</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {['라부부 크리미 시리즈', '버터떡 오리지널', '두쫀쿠 오리지널', '라부부 홀리데이 시리즈', '조던1 레트로 하이 OG'].map(name => (
                          <button key={name} type="button"
                            onClick={() => setStockForm(p => ({ ...p, item_name: name }))}
                            style={{
                              fontSize: '11px', padding: '4px 10px',
                              background: stockForm.item_name === name ? '#FF4757' : '#f0f0f0',
                              color: stockForm.item_name === name ? 'white' : '#555',
                              border: 'none', borderRadius: '20px', cursor: 'pointer'
                            }}>
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>또는 직접 입력</p>
                    <input type="text" value={stockForm.item_name}
                      onChange={e => setStockForm(p => ({ ...p, item_name: e.target.value }))}
                      placeholder="예: 버터떡 오리지널" required />
                  </div>
                  <div className="form-group">
                    <label>재고 상태 *</label>
                    <select value={stockForm.status} onChange={e => setStockForm(p => ({ ...p, status: e.target.value }))}>
                      <option value="여유">🟢 여유</option>
                      <option value="소량">🟡 소량</option>
                      <option value="품절">🔴 품절</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>수량</label>
                    <input type="number" min="0" value={stockForm.quantity}
                      onChange={e => setStockForm(p => ({ ...p, quantity: e.target.value }))}
                      placeholder="예: 10" />
                  </div>
                  <div className="form-group">
                    <label>상품 사진 (선택)</label>
                    <input type="file" accept="image/*" onChange={e => setStockImage(e.target.files[0])} />
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-cancel" onClick={() => setShowAddStock(false)}>취소</button>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? '등록 중...' : '등록하기'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OwnerDashboard;
