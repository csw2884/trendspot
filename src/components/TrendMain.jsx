import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const TREND_EMOJIS = ['🔥', '⚡', '💫', '✨', '🌟', '💥', '🎯', '🚀', '👑', '💎'];

function TrendMain({ onSelectTrend, stocks, stores, isAdmin }) {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateTrends();
  }, [stocks, stores]);

  const calculateTrends = () => {
    if (!stocks || !stores) return;

    const now = Date.now();
    const scoreMap = {};

    stocks.forEach(stock => {
      const itemKey = stock.item_name?.trim().toLowerCase();
      if (!itemKey) return;

      const hoursAgo = (now - new Date(stock.reported_at)) / (1000 * 60 * 60);
      if (hoursAgo > 168) return; // 1주일 이상 된 건 제외

      if (!scoreMap[itemKey]) {
        scoreMap[itemKey] = {
          name: stock.item_name,
          score: 0,
          reportCount: 0,
          soldOutCount: 0,
          lowStockCount: 0,
          storeCount: new Set()
        };
      }

      const recencyBonus = hoursAgo < 6 ? 3 : hoursAgo < 24 ? 2 : 1;

      scoreMap[itemKey].reportCount += 1;
      scoreMap[itemKey].storeCount.add(stock.store_id);

      if (stock.status === '품절') {
        scoreMap[itemKey].soldOutCount += 1;
        scoreMap[itemKey].score += 5 * recencyBonus; // 품절 = 인기 신호
      } else if (stock.status === '소량') {
        scoreMap[itemKey].lowStockCount += 1;
        scoreMap[itemKey].score += 3 * recencyBonus;
      } else {
        scoreMap[itemKey].score += 1 * recencyBonus;
      }

      scoreMap[itemKey].score += (stock.search_count || 0) * 0.5;
      scoreMap[itemKey].score += (stock.view_count || 0) * 0.1;
    });

    const sorted = Object.values(scoreMap)
      .map(item => ({ ...item, storeCount: item.storeCount.size }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    setTrends(sorted);
    setLoading(false);
  };

  const getTrendLabel = (item, index) => {
    if (item.soldOutCount > item.reportCount * 0.6) return '🔥 품절대란';
    if (item.lowStockCount > item.reportCount * 0.5) return '⚡ 품귀현상';
    if (item.storeCount >= 5) return '💫 전국 확산';
    if (index === 0) return '👑 1위';
    return '📈 급상승';
  };

  if (loading) return (
    <div className="trend-loading">
      <div className="trend-spinner" />
      <p>트렌드 분석 중...</p>
    </div>
  );

  return (
    <div className="trend-main">
      <div className="trend-header">
        <h2>🔥 실시간 트렌드</h2>
        <span className="trend-updated">AI 분석 기준</span>
      </div>

      {trends.length === 0 ? (
        <div className="trend-empty">
          <p>아직 트렌드 데이터가 없어요</p>
          <p style={{fontSize: '13px', color: '#999'}}>재고 제보가 쌓이면 자동으로 분석돼요!</p>
        </div>
      ) : (
        <div className="trend-list">
          {trends.map((item, index) => (
            <div
              key={item.name}
              className="trend-item"
              onClick={() => onSelectTrend(item.name)}
            >
              <div className="trend-rank">
                {index < 3 ? ['🥇','🥈','🥉'][index] : `${index + 1}`}
              </div>
              <div className="trend-info">
                <div className="trend-name">{item.name}</div>
                <div className="trend-meta">
                  <span className="trend-label">{getTrendLabel(item, index)}</span>
                  <span className="trend-stores">📍 {item.storeCount}개 매장</span>
{isAdmin && item.soldOutCount > 0 && (
  <span className="trend-soldout">품절 {item.soldOutCount}회</span>
)}
                </div>
              </div>
              <div className="trend-score">
                <div className="trend-bar" style={{ width: `${Math.min(100, (item.score / (trends[0]?.score || 1)) * 100)}%` }} />
              </div>
              <span className="trend-arrow">→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrendMain;