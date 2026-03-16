import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pwfhnhunvohyjeqkumqr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhuaHVudm9oeWplcWt1bXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzIzODUsImV4cCI6MjA4OTE0ODM4NX0.wqpsLV5GxR1w8xMQobFY-AquG-ioDoaaNDmhydup0AE'
);

function Auth({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleKakaoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <h1 className="logo">📍 TrendSpot</h1>
          <p className="auth-subtitle">실시간 트렌드 재고 공유 플랫폼</p>
        </div>

        <p className="auth-desc">로그인하고 재고를 제보해보세요!</p>

        {error && <div className="auth-error">{error}</div>}

        <button
          className="kakao-login-btn"
          onClick={handleKakaoLogin}
          disabled={loading}
        >
          <img src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_medium.png" alt="kakao" width="24" />
          카카오로 로그인
        </button>

        <button
          className="google-login-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <img src="https://www.google.com/favicon.ico" alt="google" width="20" />
          구글로 로그인
        </button>

        <p className="auth-notice">로그인 없이도 재고 확인은 가능해요 😊</p>
      </div>
    </div>
  );
}

export default Auth;