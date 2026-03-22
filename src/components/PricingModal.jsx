import React from 'react';

function PricingModal({ onClose }) {
  const plans = [
    {
      name: '일반 유저',
      price: '무료',
      color: '#2ED573',
      emoji: '👤',
      features: [
        '실시간 재고 지도 조회',
        '트렌드 TOP5 확인',
        'AI 트렌드 분석',
        '재고 제보 (+10P)',
        '품절 알림',
        '광고 포함',
      ],
      cta: '현재 이용 중',
      disabled: true,
    },
    {
      name: '스팟 멤버십',
      price: '₩990',
      period: '/월',
      color: '#FFA502',
      emoji: '⭐',
      badge: 'POPULAR',
      features: [
        '일반 유저 모든 기능',
        '광고 없는 환경',
        'AI 상세분석 무제한',
        '우선 품절 알림',
        '포인트 500P로 교환 가능',
      ],
      cta: '준비 중',
      disabled: true,
    },
    {
      name: '사장님 플랜',
      price: '₩12,900',
      period: '/월',
      color: '#FF4757',
      emoji: '🏪',
      features: [
        '내 가게 재고 직접 관리',
        '방문자 통계',
        '지도 상단 노출',
        '월간 트렌드 리포트',
        '포인트 1,500P로 교환 가능',
      ],
      cta: '준비 중',
      disabled: true,
    },
    {
      name: '기업 API',
      price: '별도 문의',
      color: '#1E90FF',
      emoji: '🏢',
      features: [
        '트렌드 데이터 API 제공',
        '맞춤형 대시보드',
        '브랜드 트렌드 모니터링',
        '월간 인사이트 리포트',
        '전담 매니저 지원',
      ],
      cta: '문의하기',
      disabled: false,
    },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '20px',
        padding: '24px', maxWidth: '900px', width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <button onClick={onClose} style={{
            float: 'right', background: 'none', border: 'none',
            fontSize: '20px', cursor: 'pointer', color: '#999'
          }}>✕</button>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>💎</div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 8px' }}>있템 요금제</h2>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
            트렌드를 먼저 아는 사람이 기회를 잡습니다
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{
              border: `2px solid ${plan.color}33`,
              borderRadius: '16px', padding: '16px',
              position: 'relative',
              background: `linear-gradient(135deg, ${plan.color}08, white)`,
            }}>
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: '-10px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: plan.color, color: 'white',
                  fontSize: '10px', fontWeight: '800',
                  padding: '3px 10px', borderRadius: '20px',
                }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '28px' }}>{plan.emoji}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#333', marginTop: '4px' }}>
                  {plan.name}
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span style={{ fontSize: '22px', fontWeight: '800', color: plan.color }}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span style={{ fontSize: '12px', color: '#999' }}>{plan.period}</span>
                  )}
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '12px' }}>
                {plan.features.map((f) => (
                  <li key={f} style={{
                    padding: '4px 0', color: '#555',
                    display: 'flex', alignItems: 'flex-start', gap: '6px'
                  }}>
                    <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button style={{
                width: '100%', padding: '10px',
                background: plan.disabled ? '#f0f0f0' : plan.color,
                color: plan.disabled ? '#999' : 'white',
                border: 'none', borderRadius: '10px',
                fontSize: '13px', fontWeight: '700',
                cursor: plan.disabled ? 'default' : 'pointer',
              }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#999' }}>
          💡 현재 베타 서비스 운영 중 · 포인트 500P로 스팟 멤버십 1개월 교환 가능 (준비 중)
        </div>
      </div>
    </div>
  );
}

export default PricingModal;
