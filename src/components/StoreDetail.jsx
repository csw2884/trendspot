import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STOCK_STATUS = {
  여유: { color: '#2ED573' },
  소량: { color: '#FFA502' },
  품절: { color: '#FF4757' }
};

function StoreDetail({ store, stocks, onClose, onReport, user, selectedTrend }) {
  const [votes, setVotes] = useState({});
  const [userVotes, setUserVotes] = useState(new Set());
  const [showAllReports, setShowAllReports] = useState({});
  const [showOtherItems, setShowOtherItems] = useState(false);

  useEffect(() => { loadVotes(); }, []);

  const loadVotes = async () => {
    const storeStockIds = stocks.filter(s => s.store_id === store.id).map(s => s.id);
    if (storeStockIds.length === 0) return;
    const { data } = await supabase.from('stock_votes').select('*').in('stock_id', storeStockIds);
    const voteMap = {};
    const myVotes = new Set();
    (data || []).forEach(v => {
      voteMap[v.stock_id] = (voteMap[v.stock_id] || 0) + 1;
      if (v.user_id === user?.id) myVotes.add(v.stock_id);
    });
    setVotes(voteMap);
    setUserVotes(myVotes);
  };

  const handleVote = async (stockId) => {
    if (!user) return;
    if (userVotes.has(stockId)) return;
    await supabase.from('stock_votes').insert({ stock_id: stockId, user_id: user.id });
    setVotes(prev => ({ ...prev, [stockId]: (prev[stockId] || 0) + 1 }));
    setUserVotes(prev => new Set([...prev, stockId]));
    // 포인트 적립
    const { data } = await supabase.from('user_points').select('*').eq('user_id', user.id).single();
    if (data) {
      await supabase.from('user_points').update({
        points: data.points + 2,
        total_points: data.total_points + 2,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id);
    } else {
      await supabase.from('user_points').insert({ user_id: user.id, points: 2, total_points: 2 });
    }
  };

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000 / 60;
    if (diff < 60) return `${Math.round(diff)}분 전`;
    if (diff < 1440) return `${Math.round(diff / 60)}시간 전`;
    return `${Math.round(diff / 1440)}일 전`;
  };

  const storeStocks = stocks.filter(s => s.store_id === store.id)
    .sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));

  // 아이템별 그룹핑
  const groupedByItem = {};
  storeStocks.forEach(stock => {
    if (!groupedByItem[stock.item_name]) groupedByItem[stock.item_name] = [];
    groupedByItem[stock.item_name].push(stock);
  });

  // 선택된 트렌드 아이템 vs 다른 아이템 분리
  const trendItems = {};
  const otherItems = {};
  Object.entries(groupedByItem).forEach(([name, reports]) => {
    if (selectedTrend && name.toLowerCase().includes(selectedTrend.toLowerCase())) {
      trendItems[name] = reports;
    } else {
      otherItems[name] = reports;
    }
  });

  // 표시할 아이템 (트렌드 없으면 전체)
  const displayItems = selectedTrend
    ? (showOtherItems ? groupedByItem : (Object.keys(trendItems).length > 0 ? trendItems : groupedByItem))
    : groupedByItem;

  // 불일치 감지
  const getConflict = (reports) => {
    if (reports.length < 2) return null;
    const ownerReport = reports.find(r => r.reported_by === store.owner_id);
    const userReports = reports.filter(r => r.reported_by !== store.owner_id);
    if (!ownerReport || userReports.length === 0) return null;
    if (ownerReport.status !== userReports[0].status) {
      return { ownerStatus: ownerReport.status, userStatus: userReports[0].status, count: userReports.length };
    }
    return null;
  };

  const renderItem = (itemName, reports) => {
    const latest = reports[0];
    const conflict = getConflict(reports);
    const showing = showAllReports[itemName];

    return (
      <div key={itemName} style={{
        marginBottom: '12px',
        border: conflict ? '1px solid #FF4757' : '1px solid #eee',
        borderRadius: '12px', overflow: 'hidden', background: 'white'
      }}>
        {/* 메인 재고 정보 */}
        <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {latest.image_url && (
            <img src={latest.image_url} alt={itemName}
              style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', fontSize: '14px' }}>{itemName}</div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
              최근 제보 {timeAgo(latest.reported_at)} · 총 {reports.length}건
            </div>
            {conflict && (
              <div style={{
                marginTop: '6px', padding: '4px 8px',
                background: '#FFF3F3', border: '1px solid #FF4757',
                borderRadius: '6px', fontSize: '11px', color: '#FF4757'
              }}>
                ⚠️ 사장님: {conflict.ownerStatus} → 방문자 {conflict.count}명: {conflict.userStatus}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              padding: '4px 10px', borderRadius: '20px',
              fontSize: '12px', fontWeight: '700', color: 'white',
              background: STOCK_STATUS[latest.status]?.color || '#999'
            }}>
              {latest.status}
            </span>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              {latest.quantity}개
            </div>
          </div>
        </div>

        {/* 제보 목록 */}
        <div style={{ borderTop: '1px solid #f5f5f5', padding: '8px 12px', background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: '#999' }}>📋 제보 내역</span>
            {reports.length > 1 && (
              <button
                onClick={() => setShowAllReports(prev => ({ ...prev, [itemName]: !prev[itemName] }))}
                style={{ fontSize: '11px', color: '#457B9D', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showing ? '접기 ▲' : `전체보기 (${reports.length}건) ▼`}
              </button>
            )}
          </div>

          {(showing ? reports : reports.slice(0, 2)).map(report => (
            <div key={report.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 0', borderBottom: '1px solid #f0f0f0'
            }}>
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '10px',
                color: 'white', background: STOCK_STATUS[report.status]?.color || '#999',
                whiteSpace: 'nowrap'
              }}>
                {report.status}
              </span>
              {/* 수량 표시 */}
              <span style={{ fontSize: '11px', color: '#888', minWidth: '35px' }}>
                {report.quantity > 0 ? `${report.quantity}개` : '-'}
              </span>
              <span style={{ fontSize: '11px', color: '#666', flex: 1 }}>
                {report.reported_by === store.owner_id ? '👨‍💼 사장님' : '👤 방문자'}
              </span>
              <span style={{ fontSize: '10px', color: '#999' }}>
                {timeAgo(report.reported_at)}
              </span>
              <button
                onClick={() => handleVote(report.id)}
                disabled={!user || userVotes.has(report.id)}
                style={{
                  fontSize: '11px', padding: '2px 8px',
                  background: userVotes.has(report.id) ? '#2ED573' : '#f0f0f0',
                  color: userVotes.has(report.id) ? 'white' : '#666',
                  border: 'none', borderRadius: '10px',
                  cursor: user && !userVotes.has(report.id) ? 'pointer' : 'default',
                  whiteSpace: 'nowrap'
                }}
              >
                👍 {votes[report.id] || 0}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const otherItemCount = Object.keys(otherItems).length;

  return (
    <div className="store-detail-overlay" onClick={onClose}>
      <div className="store-detail" onClick={e => e.stopPropagation()}>
        <button className="store-detail-close" onClick={onClose}>✕</button>

        <div className="store-detail-header">
          {store.image_url && (
            <img src={store.image_url} alt={store.name} className="store-detail-img" />
          )}
          <h2>{store.name}</h2>
          <p className="store-detail-address">📍 {store.address}</p>
        </div>

        <div className="store-detail-body">
          {Object.keys(groupedByItem).length === 0 ? (
            <div className="no-menu">아직 등록된 재고가 없어요</div>
          ) : (
            <>
              <h3 className="menu-section-title">📦 재고 현황</h3>

              {/* 메인 아이템들 */}
              {Object.entries(displayItems).map(([name, reports]) => renderItem(name, reports))}

              {/* 다른 재고 보기 버튼 */}
              {selectedTrend && otherItemCount > 0 && !showOtherItems && (
                <button
                  onClick={() => setShowOtherItems(true)}
                  style={{
                    width: '100%', padding: '10px',
                    background: '#f8f8f8', border: '1px dashed #ddd',
                    borderRadius: '10px', fontSize: '13px', color: '#666',
                    cursor: 'pointer', marginBottom: '12px'
                  }}
                >
                  📦 다른 재고 {otherItemCount}개 보기
                </button>
              )}
              {showOtherItems && otherItemCount > 0 && (
                <button
                  onClick={() => setShowOtherItems(false)}
                  style={{
                    width: '100%', padding: '6px',
                    background: 'none', border: 'none',
                    fontSize: '12px', color: '#999',
                    cursor: 'pointer', marginBottom: '8px'
                  }}
                >
                  접기 ▲
                </button>
              )}
            </>
          )}

          <button className="btn-report-store" onClick={() => onReport(store)}>
            📝 직접 확인하고 제보하기 (+10P)
          </button>
        </div>
      </div>
    </div>
  );
}

export default StoreDetail;
