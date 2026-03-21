import React, { useMemo, useState } from 'react';

function StatsDashboard({ stores, stocks, trends }) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const now = Date.now();
    const today = stocks.filter(s =>
      (now - new Date(s.reported_at)) / (1000 * 60 * 60) < 24
    );
    const soldOut = today.filter(s => s.status === '품절');
    const soldOutRate = today.length > 0
      ? Math.round(soldOut.length / today.length * 100) : 0;
    const activeStores = new Set(today.map(s => s.store_id)).size;

    return {
      totalStores: stores.length,
      todayReports: today.length,
      soldOutRate,
      activeStores,
    };
  }, [stores, stocks]);

  const cards = [
    { label: '등록 매장', value: stats.totalStores, unit: '개', emoji: '🏪', color: '#2ED573' },
    { label: '오늘 제보', value: stats.todayReports, unit: '건', emoji: '📝', color: '#FFA502' },
    { label: '품절률', value: stats.soldOutRate, unit: '%', emoji: '🔴', color: '#FF4757' },
    { label: '활성 매장', value: stats.activeStores, unit: '개', emoji: '⚡', color: '#1E90FF' },
  ];

  return (
    <>
      {/* 토글 버튼 - trend-bar 옆에 붙는 작은 버튼 */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--ts-bg-secondary, #f8f8f8)',
        borderBottom: open ? 'none' : '1px solid var(--ts-border, #eee)',
        padding: '4px 0',
      }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            fontSize: '11px',
            padding: '3px 14px',
            background: open ? '#333' : 'white',
            color: open ? 'white' : '#666',
            border: '1px solid #ddd',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          📊 실시간 통계 {open ? '▲' : '▼'}
        </button>
      </div>

      {/* 펼쳐지는 대시보드 */}
      {open && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 16px',
          background: 'var(--ts-bg-secondary, #f8f8f8)',
          borderBottom: '1px solid var(--ts-border, #eee)',
          overflowX: 'auto',
        }}>
          {cards.map((card) => (
            <div key={card.label} style={{
              flex: '1 0 auto',
              minWidth: '80px',
              background: 'white',
              borderRadius: '12px',
              padding: '10px 12px',
              textAlign: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: `1px solid ${card.color}22`,
            }}>
              <div style={{ fontSize: '18px', marginBottom: '2px' }}>{card.emoji}</div>
              <div style={{
                fontSize: '20px', fontWeight: '800',
                color: card.color, lineHeight: 1.1
              }}>
                {card.value}<span style={{ fontSize: '12px', fontWeight: '600' }}>{card.unit}</span>
              </div>
              <div style={{
                fontSize: '11px', color: '#999',
                marginTop: '2px', fontWeight: '500'
              }}>
                {card.label}
              </div>
            </div>
          ))}

          {trends.length > 0 && (
            <div style={{
              flex: '2 0 160px',
              background: 'white',
              borderRadius: '12px',
              padding: '10px 14px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: '1px solid #eee',
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#333', marginBottom: '6px' }}>
                🔥 실시간 TOP3
              </div>
              {trends.slice(0, 3).map((item, i) => {
                const maxScore = trends[0].score || 1;
                const pct = Math.round((item.score / maxScore) * 100);
                const colors = ['#FF4757', '#FFA502', '#2ED573'];
                return (
                  <div key={item.name} style={{ marginBottom: '5px' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '11px', marginBottom: '2px'
                    }}>
                      <span style={{ fontWeight: '600', color: '#333' }}>
                        {i + 1}. {item.name}
                      </span>
                      <span style={{ color: colors[i], fontWeight: '700' }}>{pct}°</span>
                    </div>
                    <div style={{
                      height: '4px', background: '#f0f0f0',
                      borderRadius: '2px', overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: colors[i], borderRadius: '2px',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default StatsDashboard;