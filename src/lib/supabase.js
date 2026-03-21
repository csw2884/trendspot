import { createClient } from '@supabase/supabase-js';

// 싱글톤 패턴 - 인스턴스 중복 생성 방지
let supabaseInstance = null;

const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      'https://pwfhnhunvohyjeqkumqr.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhuaHVudm9oeWplcWt1bXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzIzODUsImV4cCI6MjA4OTE0ODM4NX0.wqpsLV5GxR1w8xMQobFY-AquG-ioDoaaNDmhydup0AE'
    );
  }
  return supabaseInstance;
};

export const supabase = getSupabase();