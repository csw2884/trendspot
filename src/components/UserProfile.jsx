import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const GRADES = {
  bronze: { label: '브론즈', emoji: '🥉', color: '#CD7F32', minPoints: 0, dailyReports: 3, aiUnlimited: false },
  silver: { label: '실버', emoji: '🥈', color: '#A8A8A8', minPoints: 100, dailyReports: 5, aiUnlimited: false },
  gold: { label: '골드', emoji: '🥇', color: '#FFD700', minPoints: 300, dailyReports: 10, aiUnlimited: true },
};

const GRADE_BENEFITS = {
  bronze: ['하루 제보 3회', 'AI 트렌드 분석', '품절 알림'],
  silver: ['하루 제보 5회 ⬆️', 'AI 트렌드 분석', '품절 알림', '실버 뱃지'],
  gold: ['하루 제보 10회 ⬆️', 'AI 상세분석 무제한 ⬆️', '품절 알림', '골드 뱃지', '우선 알림'],
};

const GRADE_ROADMAP = [
  { key: 'bronze', ...GRADES.bronze, benefits: '하루 제보 3회 · AI 분석 · 품절 알림' },
  { key: 'silver', ...GRADES.silver, benefits: '하루 제보 5회 · 실버 뱃지' },
  { key: 'gold', ...GRADES.gold, benefits: '하루 제보 10회 · AI 무제한 · 골드 뱃지 · 우선 알림' },
];

function getGrade(points) {
  if (points >= 300) return { key: 'gold', ...GRADES.gold };
  if (points >= 100) return { key: 'silver', ...GRADES.silver };
  return { key: 'bronze', ...GRADES.bronze };
}

function getNextGrade(points) {
  if (points >= 300) return null;
  if (points >= 100) return { ...GRADES.gold, key: 'gold', needed: 300 - points };
  return { ...GRADES.silver, key: 'silver', needed: 100 - points };
}

function UserProfile({ user, onClose }) {
  const [points, setPoints] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [todayReports, setTodayReports] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUserData(); }, []);

  const loadUserData = async () => {
    const { data: pointData } = await supabase
      .from('user_points').select('*').eq('user_id', user.id).single();

    const { data: logs } = await supabase
      .from('activity_logs').select('*')
      .eq('user_id', user.id).eq('action', 'stock_report');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayLogs } = await supabase
      .from('activity_logs').select('*')
      .eq('user_id', user.id).eq('action', 'stock_report')
      .gte('created_at', today.toISOString());

    setPoints(pointData?.points || 0);
    setReportCount(logs?.length || 0);
    setTodayReports(todayLogs?.length || 0);
    setLoading(false);
  };

  const grade = getGrade(points);
  const nextGrade = getNextGrade(points);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '20px',
        padding: '28px', maxWidth: '360px', width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>내 프로필</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#999' }}>✕</button>
        </div>

        {loading ? <p style={{ textAlign: 'center', color: '#999' }}>로딩 중...</p> : (
          <>
            {/* 유저 정보 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              marginBottom: '16px', padding: '16px',
              background: `linear-gradient(135deg, ${grade.color}15, white)`,
              borderRadius: '14px', border: `1px solid ${grade.color}33`,
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: `linear-gradient(135deg, ${grade.color}, ${grade.color}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', flexShrink: 0,
              }}>
                {grade.emoji}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#1a1a1a' }}>
                  {user?.user_metadata?.nickname || user?.email?.split('@')[0]}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: grade.color, marginTop: '2px' }}>
                  {grade.label} 등급
                </div>
              </div>
            </div>

            {/* 스탯 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[
                { label: '스팟 포인트', value: `${points}P`, emoji: '⚡', color: '#FFA502' },
                { label: '총 제보', value: `${reportCount}회`, emoji: '📝', color: '#2ED573' },
                { label: '오늘 제보', value: `${todayReports}/${grade.dailyReports}회`, emoji: '📍', color: '#1E90FF' },
              ].map(stat => (
                <div key={stat.label} style={{
                  flex: 1, padding: '10px 6px', textAlign: 'center',
                  background: `${stat.color}10`, borderRadius: '12px',
                  border: `1px solid ${stat.color}22`,
                }}>
                  <div style={{ fontSize: '18px' }}>{stat.emoji}</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '10px', color: '#999' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* 현재 등급 혜택 */}
            <div style={{
              padding: '14px', marginBottom: '16px',
              background: `${grade.color}10`,
              borderRadius: '12px',
              border: `1px solid ${grade.color}33`,
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: grade.color, marginBottom: '8px' }}>
                {grade.emoji} {grade.label} 등급 혜택
              </div>
              {GRADE_BENEFITS[grade.key].map(benefit => (
                <div key={benefit} style={{
                  fontSize: '12px', color: '#555',
                  padding: '3px 0', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ color: grade.color }}>✓</span> {benefit}
                </div>
              ))}
            </div>

            {/* 다음 등급까지 */}
            {nextGrade ? (
              <div style={{
                padding: '14px', background: '#f8f8f8',
                borderRadius: '12px', marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>다음 등급까지</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: nextGrade.color }}>
                    {nextGrade.emoji} {nextGrade.label} ({nextGrade.needed}P 필요)
                  </span>
                </div>
                <div style={{ height: '6px', background: '#e0e0e0', borderRadius: '3px' }}>
                  <div style={{
                    height: '100%', borderRadius: '3px',
                    width: `${Math.min(points / (points + nextGrade.needed) * 100, 100)}%`,
                    background: `linear-gradient(90deg, ${grade.color}, ${nextGrade.color})`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
                  {nextGrade.label} 달성 시 →
                  {nextGrade.key === 'silver' ? ' 하루 제보 5회, 실버 뱃지' : ' 하루 제보 10회, AI 무제한, 골드 뱃지'}
                </div>
              </div>
            ) : (
              <div style={{
                padding: '14px', background: '#FFF9E6',
                borderRadius: '12px', marginBottom: '16px',
                textAlign: 'center', fontSize: '13px', color: '#B8860B'
              }}>
                🏆 최고 등급 달성! 골드 멤버입니다
              </div>
            )}

            {/* 전체 등급 로드맵 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#333', marginBottom: '10px' }}>
                🗺️ 전체 등급 로드맵
              </div>
              {GRADE_ROADMAP.map(g => (
                <div key={g.key} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', marginBottom: '6px',
                  borderRadius: '10px',
                  background: grade.key === g.key ? `${g.color}15` : '#f8f8f8',
                  border: grade.key === g.key ? `1px solid ${g.color}44` : '1px solid #eee',
                  opacity: points < g.minPoints ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: '20px' }}>{g.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: g.color }}>
                      {g.label} {grade.key === g.key && '← 현재'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{g.benefits}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', whiteSpace: 'nowrap' }}>
                    {g.minPoints}P~
                  </div>
                </div>
              ))}
            </div>

            {/* 포인트 안내 */}
            <div style={{ fontSize: '11px', color: '#999', lineHeight: 1.8, textAlign: 'center' }}>
              💡 재고 제보 +10P · 투표 +2P<br />
              100P = 실버 · 300P = 골드
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default UserProfile;
