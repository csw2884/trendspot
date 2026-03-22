import React, { useState, useRef, useEffect } from 'react';

function AIAssistant({ stores, stocks, user, userLocation }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 트렌드 재고 AI 어시스턴트예요 😊 궁금한 것을 물어보세요!\n\n예시:\n- "강남에서 라부부 어디서 살 수 있어?"\n- "요즘 뭐가 유행해?"\n- "품절 안된 팝마트 알려줘"' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    const storeData = stores.map(store => {
      const latestStock = stocks
        .filter(s => s.store_id === store.id)
        .sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at))[0];
      const hoursAgo = latestStock
        ? Math.round((Date.now() - new Date(latestStock.reported_at)) / (1000 * 60 * 60))
        : null;
      return {
        name: store.name,
        category: store.category,
        address: store.address,
        stock: latestStock ? {
          item: latestStock.item_name,
          status: latestStock.status,
          quantity: latestStock.quantity,
          hoursAgo
        } : null
      };
    });
    return {
      stores: storeData,
      summary: {
        total: stores.length,
        available: stocks.filter(s => s.status === '여유').length,
        low: stocks.filter(s => s.status === '소량').length,
        soldOut: stocks.filter(s => s.status === '품절').length,
        topItems: [...new Set(stocks.map(s => s.item_name))].slice(0, 10)
      }
    };
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const currentInput = input;
    const userMsg = { role: 'user', content: currentInput };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const context = buildContext();
      const systemPrompt = `당신은 있템의 AI 어시스턴트입니다. 트렌드 매장의 실시간 재고 정보를 알려주는 역할을 합니다.

현재 매장 데이터:
${JSON.stringify(context, null, 2)}

규칙:
1. 항상 한국어로 답변
2. 재고 정보를 바탕으로 정확하게 답변
3. 품절된 곳보다 재고 있는 곳을 먼저 추천
4. 정보가 몇 시간 전 데이터인지 언급
5. 친근하고 간결하게 답변
6. 트렌드 분석 시 품절 빈도가 높은 아이템을 인기 아이템으로 판단`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...messages.filter((_, i) => i > 0).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: currentInput }
          ]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || data.error || '응답을 받지 못했어요.';
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      console.error('AI 응답 실패:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '죄송해요, 일시적인 오류가 발생했어요. 다시 시도해주세요!'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ✅ AI 버튼 - 파란색으로 변경 (제보하기 빨간색과 구분) */}
      <button
        className="ai-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1E90FF, #0066CC)',
          color: 'white',
          fontSize: '22px',
          border: 'none',
          boxShadow: '0 4px 16px rgba(30,144,255,0.45)',
          cursor: 'pointer',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(30,144,255,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(30,144,255,0.45)'; }}
      >
        🤖
      </button>

      {isOpen && (
        <div className="ai-panel" style={{
          position: 'fixed',
          bottom: '86px',
          right: '24px',
          width: '320px',
          maxHeight: '480px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #eee',
        }}>
          <div className="ai-header" style={{
            padding: '14px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1E90FF, #0066CC)',
            color: 'white',
          }}>
            <span style={{ fontWeight: '700', fontSize: '14px' }}>🤖 AI 어시스턴트</span>
            <button onClick={() => setIsOpen(false)} style={{
              background: 'none', border: 'none', color: 'white',
              fontSize: '18px', cursor: 'pointer', lineHeight: 1
            }}>✕</button>
          </div>

          <div className="ai-messages" style={{
            flex: 1, overflowY: 'auto', padding: '12px',
            display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? 'linear-gradient(135deg, #1E90FF, #0066CC)' : '#f5f5f5',
                color: msg.role === 'user' ? 'white' : '#333',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                maxWidth: '85%',
                fontSize: '13px',
                lineHeight: 1.5,
              }}>
                {typeof msg.content === 'string'
                  ? msg.content.split('\n').map((line, j) => <span key={j}>{line}<br /></span>)
                  : msg.content}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start', background: '#f5f5f5',
                padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                fontSize: '13px', color: '#999'
              }}>
                답변 생성 중...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-area" style={{
            padding: '10px 12px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            gap: '8px',
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="질문을 입력하세요..."
              disabled={loading}
              style={{
                flex: 1, padding: '8px 12px',
                border: '1.5px solid #e0e0e0', borderRadius: '20px',
                fontSize: '13px', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              style={{
                padding: '8px 14px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #1E90FF, #0066CC)',
                color: 'white', border: 'none',
                borderRadius: '20px', fontSize: '13px',
                fontWeight: '600', cursor: loading ? 'default' : 'pointer',
              }}
            >
              전송
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default AIAssistant;
