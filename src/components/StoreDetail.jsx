import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STOCK_STATUS = {
  여유: { color: '#28a745' },
  소량: { color: '#ffc107' },
  품절: { color: '#dc3545' }
};

function StoreDetail({ store, stocks, onClose, onReport, user }) {
  const [votes, setVotes] = useState({});
  const [userVotes, setUserVotes] = useState(new Set());

  useEffect(() => {
    loadVotes();
  }, []);

  const loadVotes = async () => {
    const storeStockIds = stocks.filter(s => s.store_id === store.id).map(s => s.id);
    if (storeStockIds.length === 0) return;

    const { data } = await supabase
      .from('stock_votes')
      .select('*')
      .in('stock_id', storeStockIds);

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
    await addPoints(user.id, 2);
  };

  const addPoints = async (userId, points) => {
    const { data } = await supabase.from('user_points').select('*').eq('user_id', userId).single();
    if (data) {
      await supabase.from('user_points').update({
        points: data.points + points,
        total_points: data.total_points + points,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
    } else {
      await supabase.from('user_points').insert({
        user_id: userId, points, total_points: points
      });
    }
  };

  const storeStocks = stocks.filter(s => s.store_id === store.id)
    .sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));

  const latestByItem = {};
  storeStocks.forEach(stock => {
    if (!latestByItem[stock.item_name]) latestByItem[stock.item_name] = stock;
  });
  const menuList = Object.values(latestByItem);

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000 / 60;
    if (diff < 60) return `${Math.round(diff)}분 전`;
    if (diff < 1440) return `${Math.round(diff/60)}시간 전`;
    return `${Math.round(diff/1440)}일 전`;
  };

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
          {menuList.length === 0 ? (
            <div className="no-menu">아직 등록된 재고가 없어요</div>
          ) : (
            <>
              <h3 className="menu-section-title">📦 재고 현황</h3>
              <div className="menu-list">
                {menuList.map(stock => (
                  <div key={stock.id} className="menu-item">
                    {stock.image_url && (
                      <img src={stock.image_url} alt={stock.item_name} className="menu-img" />
                    )}
                    <div className="menu-info">
                      <div className="menu-name">{stock.item_name}</div>
                      <div className="menu-time">{timeAgo(stock.reported_at)}</div>
                      <button
                        className={`vote-btn ${userVotes.has(stock.id) ? 'voted' : ''}`}
                        onClick={() => handleVote(stock.id)}
                        disabled={!user || userVotes.has(stock.id)}
                      >
                        👍 도움돼요 {votes[stock.id] || 0}
                      </button>
                    </div>
                    <div className="menu-right">
                      <span className="menu-qty">{stock.quantity}개</span>
                      <span className="menu-status" style={{ backgroundColor: STOCK_STATUS[stock.status]?.color }}>
                        {stock.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="btn-report-store" onClick={() => onReport(store)}>
            📝 재고 제보하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default StoreDetail;