import React, { useState, useEffect } from 'react';

const STEPS = [
  {
    emoji: '📍',
    title: 'TrendSpot에 오신 걸 환영해요!',
    desc: '팝마트, 버터떡, 한정판 굿즈의\n실시간 재고를 한눈에 확인하세요',
    color: '#FF4757',
  },
  {
    emoji: '🔥',
    title: 'AI가 트렌드를 분석해요',
    desc: '실시간 재고 데이터를 기반으로\nAI가 품절 예측과 순위를 알려드려요',
    color: '#FFA502',
  },
  {
    emoji: '🗺️',
    title: '지도에서 바로 확인',
    desc: '트렌드 아이템을 클릭하면\n근처 매장 재고를 지도에서 볼 수 있어요',
    color: '#2ED573',
  },
  {
    emoji: '📝',
    title: '제보하고 포인트 받기',
    desc: '직접 재고를 제보하면\n스팟 포인트가 쌓여요!',
    color: '#1E90FF',
  },
];

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setStep(s => s + 1);
        setAnimating(false);
      }, 200);
    } else {
      localStorage.setItem('trendspot_onboarded', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('trendspot_onboarded', 'true');
    onComplete();
  };

  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '24px',
        padding: '40px 32px', maxWidth: '360px', width: '100%',
        textAlign: 'center',
        opacity: animating ? 0 : 1,
        transform: animating ? 'translateY(10px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
      }}>
        {/* 스텝 인디케이터 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '32px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: '4px',
              width: i === step ? '24px' : '8px',
              borderRadius: '2px',
              background: i <= step ? current.color : '#eee',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* 이모지 */}
        <div style={{
          fontSize: '64px', marginBottom: '20px',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
        }}>
          {current.emoji}
        </div>

        {/* 제목 */}
        <h2 style={{
          fontSize: '20px', fontWeight: '800',
          color: '#1a1a1a', margin: '0 0 12px',
          lineHeight: 1.3,
        }}>
          {current.title}
        </h2>

        {/* 설명 */}
        <p style={{
          fontSize: '15px', color: '#666',
          lineHeight: 1.6, margin: '0 0 36px',
          whiteSpace: 'pre-line',
        }}>
          {current.desc}
        </p>

        {/* 버튼 */}
        <button
          onClick={handleNext}
          style={{
            width: '100%', padding: '14px',
            background: current.color,
            color: 'white', border: 'none',
            borderRadius: '14px', fontSize: '16px',
            fontWeight: '700', cursor: 'pointer',
            marginBottom: '12px',
            boxShadow: `0 4px 16px ${current.color}44`,
            transition: 'transform 0.1s',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {step === STEPS.length - 1 ? '🚀 시작하기' : '다음 →'}
        </button>

        {step < STEPS.length - 1 && (
          <button onClick={handleSkip} style={{
            background: 'none', border: 'none',
            color: '#aaa', fontSize: '13px',
            cursor: 'pointer', padding: '4px',
          }}>
            건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}

export default Onboarding;