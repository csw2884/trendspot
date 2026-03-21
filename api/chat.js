import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, system, user_id } = req.body;

  try {
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: system }]
          },
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 받지 못했어요.';

    try {
      await supabase.from('activity_logs').insert({
        user_id: user_id || null,
        action: 'ai_chat',
        target_id: null,
        ip_address: req.headers['x-forwarded-for'] || null,
      });
    } catch (logError) {
      console.error('로그 저장 실패:', logError);
    }

    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (error) {
    console.error('Gemini API 오류:', error);
    res.status(500).json({ error: error.message });
  }
}