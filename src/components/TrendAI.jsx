import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// 품절 예측 알고리즘
// 판매속도(V) = 경과시간 / 총판매량
// 품절까지 남은시간 = V * 현재재고량
function calcSoldOutPrediction(itemName, stocks) {
  const itemStocks = stocks
    .filter(s => s.item_name?.toLowerCase().includes(itemName.toLowerCase()))
    .sort((a, b) => new Date(a.reported_at) - new Date(b.reported_at));

  const storeGroups = {};
  itemStocks.forEach(s => {
    if (!storeGroups[s.store_id]) storeGroups[s.store_id] = [];
    storeGroups[s.store_id].push(s);
  });

  let predictions = [];

  Object.values(storeGroups).forEach(reports => {
    const withStock = reports.filter(r => r.status !== '품절' && r.quantity > 0);
    if (withStock.length < 2) return;

    for (let i = 1; i < withStock.length; i++) {
      const prev = withStock[i - 1];
      const curr = withStock[i];
      const timeDiffHours = (new Date(curr.reported_at) - new Date(prev.reported_at)) / (1000 * 60 * 60);
      const qtyDiff = (prev.quantity || 0) - (curr.quantity || 0);
      if (timeDiffHours <= 0 || qtyDiff <= 0) continue;

      // V = 경과시간 / 총판매량
      const V = timeDiffHours / qtyDiff;
      const currentQty = curr.quantity || 0;
      // 품절까지 남은 시간 = V * 현재재고량
      const hoursLeft = V * currentQty;

      if (hoursLeft > 0 && hoursLeft < 72) {
        predictions.push(hoursLeft);
      }
    }
  });

  if (predictions.length === 0) return null;
  const avgHours = predictions.reduce((a, b) => a + b, 0) / predictions.length;

  if (avgHours < 1) return '🔴 곧 품절 예상';
  if (avgHours < 3) return `🔴 약 ${Math.round(avgHours)}시간 후 품절 예상`;
  if (avgHours < 12) return `🟠 약 ${Math.round(avgHours)}시간 후 품절 예상`;
  if (avgHours < 24) return `🟡 오늘 중 품절 가능`;
  return `🟢 약 ${Math.round(avgHours / 24)}일 후 품절 예상`;
}

// 규칙 기반 트렌드 분석
function analyzeTrends(trends, stocks) {
  const now = Date.now();

  const analyze = (trend) => {
    const itemStocks = stocks.filter(s =>
      s.item_name?.toLowerCase().includes(trend.name.toLowerCase())
    );
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

    const reasons = [];
    if (soldOutRate >= 70) reasons.push(`품절률 ${soldOutRate}%로 매우 높음`);
    else if (soldOutRate >= 40) reasons.push(`품절률 ${soldOutRate}%로 높은 편`);
    if (isHot) reasons.push('1시간 내 제보 급증');
    if (isRising) reasons.push('6시간 내 트렌드 상승 중');
    if (trend.storeCount >= 3) reasons.push(`${trend.storeCount}개 매장에서 판매 중`);
    if (recent24h.length >= 5) reasons.push(`오늘 ${recent24h.length}건 제보`);

    // ✅ 알고리즘 기반 품절 예측
    const algorithmPrediction = calcSoldOutPrediction(trend.name, stocks);

    let prediction = algorithmPrediction || '🟢 당분간 재고 여유';
    if (!algorithmPrediction) {
      if (soldOutRate >= 80 || isHot) prediction = '🔴 곧 품절 예상';
      else if (soldOutRate >= 50 || isRising) prediction = '🟡 오늘 중 품절 가능';
      else if (soldOutRate >= 30) prediction = '🟠 내일 품절 가능성';
    }

    const hotness = Math.min(100, Math.round(
      soldOutRate * 0.5 + (isHot ? 20 : 0) + (isRising ? 15 : 0) +
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
  const topItem = rankings[0];
  const summary = topItem ? `${topItem.name} 1위 · 품절률 ${topItem.soldOutRate}%` : '트렌드 분석 중';
  const hotItems = rankings.filter(r => r.isHot || r.soldOutRate >= 80);
  const alert = hotItems.length > 0 ? `${hotItems.map(h => h.name).join(', ')} 품절 임박!` : null;
  const totalReports = rankings.reduce((sum, r) => sum + r.reportCount, 0);
  const avgSoldOut = rankings.length > 0
    ? Math.round(rankings.reduce((sum, r) => sum + r.soldOutRate, 0) / rankings.length) : 0;
  const report = `오늘 총 ${totalReports}건 재고 제보 · 평균 품절률 ${avgSoldOut}% · ${topItem?.name || ''}이 가장 뜨거운 아이템`;

  return { rankings, summary, alert, report };
}

function TrendAI({ trends, stocks, user }) {
  const [analysis, setAnalysis] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailText, setDetailText] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const DAILY_LIMIT = 3;

  useEffect(() => {
    if (trends.length > 0) {
      setAnalysis(analyzeTrends(trends, stocks));
    }
  }, [trends, stocks]);

  // ✅ 오늘 AI 상세분석 사용 횟수 확인
  useEffect(() => {
    if (user) loadTodayCount();
  }, [user]);

  const loadTodayCount = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('activity_logs').select('*')
      .eq('user_id', user.id).eq('action', 'ai_detail_analysis')
      .gte('created_at', today.toISOString());
    setTodayCount(data?.length || 0);
  };

  // ✅ Gemini API 기반 AI 상세분석 (하루 3회)
  const handleDetailAnalysis = async () => {
    if (!user) { alert('로그인 후 이용할 수 있어요!'); return; }
    if (todayCount >= DAILY_LIMIT) {
      alert(`오늘 AI 상세분석 ${DAILY_LIMIT}회를 모두 사용했어요.\n내일 다시 이용할 수 있어요! 😊`);
      return;
    }

    setDetailLoading(true);
    setShowDetail(true);

    try {
      const contextData = analysis?.rankings.map(r => ({
        순위: r.rank, 아이템: r.name, 품절률: `${r.soldOutRate}%`,
        예측: r.prediction, 핫니스: r.hotness, 제보수: r.reportCount
      }));

      const prompt = `당신은 트렌드 굿즈 재고 분석 전문가입니다.
아래는 실시간 재고 데이터입니다:
${JSON.stringify(contextData, null, 2)}

위 데이터를 바탕으로:
1. 현재 가장 핫한 아이템 TOP3 분석
2. 각 아이템의 품절 위험도와 이유
3. 소비자에게 구매 타이밍 추천
4. 소상공인에게 재고 준비 조언

한국어로 친근하고 간결하게 분석해주세요. 이모지 활용해주세요.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
          })
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '분석 결과를 가져오지 못했어요.';
      setDetailText(text);

      // 사용 기록 저장
      await supabase.from('activity_logs').insert({
        user_id: user.id, action: 'ai_detail_analysis',
        target_id: null
      });
      setTodayCount(prev => prev + 1);

    } catch (e) {
      console.error(e);
      setDetailText('AI 분석 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (!analysis) return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      color: 'rgba(255,255,255,0.5)', padding: '10px 16px', fontSize: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>
      🤖 AI 트렌드 분석 준비 중...
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      color: 'white', padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          <span style={{ fontSize: '16px' }}>🤖</span>
          <span style={{ fontSize: '13px', fontWeight: '700' }}>AI 트렌드 분석</span>
          <span style={{
            fontSize: '11px', fontWeight: '600',
            background: 'rgba(46,213,115,0.2)', color: '#2ED573',
            padding: '2px 8px', borderRadius: '20px',
            border: '1px solid rgba(46,213,115,0.3)'
          }}>
            {analysis.summary}
          </span>
          {analysis.alert && (
            <span style={{
              fontSize: '11px',
              background: 'rgba(255,71,87,0.2)', color: '#FF4757',
              padding: '2px 8px', borderRadius: '20px',
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
            whiteSpace: 'nowrap', flexShrink: 0
          }}
        >
          {expanded ? '접기 ▲' : '자세히 ▼'}
        </button>
      </div>

      {/* 확장 패널 */}
      {expanded && (
        <div style={{ marginTop: '12px' }}>
          {/* 순위 목록 */}
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
                    {/* ✅ 알고리즘 기반 품절 예측 표시 */}
                    <span style={{
                      fontSize: '10px', padding: '1px 6px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px', color: 'rgba(255,255,255,0.85)'
                    }}>{item.prediction}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                    {item.reason}
                  </div>
                </div>
                <div style={{ width: '50px', flexShrink: 0 }}>
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
            background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
            padding: '10px 12px', fontSize: '12px',
            color: 'rgba(255,255,255,0.8)',
            borderLeft: '3px solid #2ED573', marginBottom: '10px'
          }}>
            📊 {analysis.report}
          </div>

          {/* ✅ Gemini AI 상세분석 버튼 */}
          <button
            onClick={handleDetailAnalysis}
            disabled={detailLoading || todayCount >= DAILY_LIMIT}
            style={{
              width: '100%', padding: '10px',
              background: todayCount >= DAILY_LIMIT
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, #1E90FF, #0066CC)',
              color: todayCount >= DAILY_LIMIT ? 'rgba(255,255,255,0.3)' : 'white',
              border: 'none', borderRadius: '10px',
              fontSize: '13px', fontWeight: '700',
              cursor: todayCount >= DAILY_LIMIT ? 'default' : 'pointer',
              transition: 'opacity 0.2s'
            }}
          >
            {detailLoading ? '🤖 Gemini 분석 중...' :
              todayCount >= DAILY_LIMIT
                ? `✨ AI 상세분석 (오늘 ${DAILY_LIMIT}회 소진)`
                : `✨ Gemini AI 상세분석 (오늘 ${DAILY_LIMIT - todayCount}회 남음)`}
          </button>

          {/* ✅ Gemini 분석 결과 */}
          {showDetail && (
            <div style={{
              marginTop: '10px',
              background: 'rgba(30,144,255,0.1)',
              border: '1px solid rgba(30,144,255,0.3)',
              borderRadius: '10px', padding: '12px',
              fontSize: '12px', lineHeight: '1.7',
              color: 'rgba(255,255,255,0.9)',
              maxHeight: '300px', overflowY: 'auto'
            }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  🤖 Gemini AI가 분석 중이에요...
                </div>
              ) : (
                detailText.split('\n').map((line, i) => (
                  <span key={i}>{line}<br /></span>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrendAI;
