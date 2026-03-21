import React, { useState, useEffect } from 'react';

// 규칙 기반 트렌드 분석 엔진
function analyzeTrends(trends, stocks) {
  const now = Date.now();

  const analyze = (trend) => {
    const itemStocks = stocks.filter(s =>
      s.item_name?.toLowerCase().includes(trend.name.toLowerCase())
    );

    // 최근 24시간 데이터
    const recent24h = itemStocks.filter(s =>
      (now - new Date(s.reported_at)) / (1000 * 60 * 60) < 24
    );
    const recent6h = itemStocks.filter(s =>
      (now - new Date(s.reported_at)) / (1000 * 60 * 60) < 6
    );
    const recent1h = itemStocks.filter(s =>
      (now - new Date(s.reported_at)) / (1000 * 60 * 60) < 1
    );

    const soldOutCount = recent24h.filter(s => s.status === '품절').length;
    const soldOutRate = recent24h.length > 0
      ? Math.round(soldOutCount / recent24h.length * 100) : 0;
    const isRising = recent6h.length > recent24h.length * 0.4;
    const isHot = recent1h.length >= 2;

    // 이유 생성
    const reasons = [];
    if (soldOutRate >= 70) reasons.push(`품절률 ${soldOutRate}%로 매우 높음`);
    else if (soldOutRate >= 40) reasons.push(`품절률 ${soldOutRate}%로 높은 편`);
    if (isHot) reasons.push('1시간 내 제보 급증');
    if (isRising) reasons.push('6시간 내 트렌드 상승 중');
    if (trend.storeCount >= 3) reasons.push(`${trend.storeCount}개 매장에서 판매 중`);
    if (recent24h.length >= 5) reasons.push(`오늘 ${recent24h.length}건 제보`);

    // 품절 예측
    let prediction = '재고 여유';
    if (soldOutRate >= 80 || isHot) prediction = '🔴 곧 품절 예상';
    else if (soldOutRate >= 50 || isRising) prediction = '🟡 오늘 중 품절 가능';
    else if (soldOutRate >= 30) prediction = '🟠 내일 품절 가능성';
    else prediction = '🟢 당분간 재고 여유';

    // 핫니스 점수 (0-100)
    const hotness = Math.min(100, Math.round(
      soldOutRate * 0.5 +
      (isHot ? 20 : 0) +
      (isRising ? 15 : 0) +
      Math.min(trend.storeCount * 5, 15)
    ));

    return {
      name: trend.name,
      reason: reasons.length > 0 ? reasons[0] : '꾸준한 인기 유지 중',
      subReasons: reasons.slice(1),
      prediction,
      hotness,
      soldOutRate,
      reportCount: recent24h.length,
      isHot,
      isRising
    };
  };

  const rankings = trends.map((t, i) => ({ rank: i + 1, ...analyze(t) }));

  // 요약
  const topItem = rankings[0];
  const summary = topItem
    ? `${topItem.name} 1위 · 품절률 ${topItem.soldOutRate}%`
    : '트렌드 분석 중';

  // 알림
  const hotItems = rankings.filter(r => r.isHot || r.soldOutRate >= 80);
  const alert = hotItems.length > 0
    ? `${hotItems.map(h => h.name).join(', ')} 품절 임박!`
    : null;

  // 리포트
  const totalReports = rankings.reduce((sum, r) => sum + r.reportCount, 0);
  const avgSoldOut = Math.round(rankings.reduce((sum, r) => sum + r.soldOutRate, 0) / rankings.length);
  const report = `오늘 총 ${totalReports}건 재고 제보 · 평균 품절률 ${avgSoldOut}% · `
    + `${topItem?.name || ''}이 가장 뜨거운 아이템`;

  return { rankings, summary, alert, report };
}

function TrendAI({ trends, stocks }) {
  const [analysis, setAnalysis] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (trends.length > 0) {
      const result = analyzeTrends(trends, stocks);
      setAnalysis(result);
    }
  }, [trends, stocks]);

  if (!analysis) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      color: 'white',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '16px' }}>🤖</span>
          <span style={{ fontSize: '13px', fontWeight: '700' }}>AI 트렌드 분석</span>
          <span style={{
            fontSize: '11px', fontWeight: '600',
            background: 'rgba(46,213,115,0.2)',
            color: '#2ED573',
            padding: '2px 8px',
            borderRadius: '20px',
            border: '1px solid rgba(46,213,115,0.3)'
          }}>
            {analysis.summary}
          </span>
          {analysis.alert && (
            <span style={{
              fontSize: '11px',
              background: 'rgba(255,71,87,0.2)',
              color: '#FF4757',
              padding: '2px 8px',
              borderRadius: '20px',
              border: '1px solid rgba(255,71,87,0.3)'
            }}>
              ⚠️ {analysis.alert}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            fontSize: '11px', padding: '3px 10px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '20px', color: 'white', cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          {expanded ? '접기 ▲' : '자세히 ▼'}
        </button>
      </div>

      {/* 확장 패널 */}
      {expanded && (
        <div style={{ marginTop: '12px' }}>
          {/* 순위 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {analysis.rankings.map((item) => (
              <div key={item.rank} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px', padding: '8px 12px'
              }}>
                <span style={{ fontSize: '18px', minWidth: '28px' }}>
                  {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `${item.rank}위`}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>{item.name}</span>
                    {item.isHot && (
                      <span style={{
                        fontSize: '10px', padding: '1px 6px',
                        background: 'rgba(255,71,87,0.2)',
                        border: '1px solid rgba(255,71,87,0.3)',
                        borderRadius: '10px', color: '#FF4757'
                      }}>🔥 급상승</span>
                    )}
                    <span style={{
                      fontSize: '10px', padding: '1px 6px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px', color: 'rgba(255,255,255,0.7)'
                    }}>{item.prediction}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                    {item.reason}
                  </div>
                </div>
                {/* 핫니스 바 */}
                <div style={{ width: '50px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginBottom: '2px' }}>
                    {item.hotness}°
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      width: `${item.hotness}%`,
                      background: item.hotness > 80 ? '#FF4757' : item.hotness > 60 ? '#FFA502' : '#2ED573',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 리포트 */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px', padding: '10px 12px',
            fontSize: '12px', color: 'rgba(255,255,255,0.8)',
            borderLeft: '3px solid #2ED573'
          }}>
            📊 {analysis.report}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrendAI;