import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function OnlineCounter() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const channel = supabase.channel('online_users', {
      config: { presence: { key: Math.random().toString(36).slice(2) } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: '11px',
      color: '#2ED573',
      fontWeight: '600',
      background: 'rgba(46,213,115,0.1)',
      border: '1px solid rgba(46,213,115,0.3)',
      borderRadius: '20px',
      padding: '3px 10px',
    }}>
      <span style={{
        width: '6px', height: '6px',
        background: '#2ED573',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'pulse 1.5s infinite',
      }} />
      {count}명 접속 중
    </div>
  );
}

export default OnlineCounter;