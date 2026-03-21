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
      const systemPrompt = `당신은 TrendSpot의 AI 어시스턴트입니다. 트렌드 매장의 실시간 재고 정보를 알려주는 역할을 합니다.

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
            ...messages.filter((_, i) => i > 0).map(m => ({
              role: m.role,
              content: m.content
            })),
            { role: 'user', content: currentInput }
          ]
        })
      });

        const data = await response.json();
    console.log('API 응답:', data); // 디버깅용
   const text = data.content?.[0]?.text 
  || data.candidates?.[0]?.content?.parts?.[0]?.text 
  || data.error 
  || '응답을 받지 못했어요.';
  
    setMessages(prev => [...prev, {
    role: 'assistant',
        content: text
            }]);

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
      <button className="ai-btn" onClick={() => setIsOpen(!isOpen)}>🤖</button>

      {isOpen && (
        <div className="ai-panel">
          <div className="ai-header">
            <span>🤖 AI 어시스턴트</span>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div className="ai-messages">
        {messages.map((msg, i) => (
             <div key={i} className={`ai-message ${msg.role}`}>
             {typeof msg.content === 'string' 
                 ? msg.content.split('\n').map((line, j) => (
          <span key={j}>{line}<br/></span>
        ))
             : msg.content
            }
             </div>
            ))}
            {loading && (
              <div className="ai-message assistant">
                <span className="ai-loading">답변 생성 중...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-area">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="질문을 입력하세요..."
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading}>전송</button>
          </div>
        </div>
      )}
    </>
  );
}

export default AIAssistant;