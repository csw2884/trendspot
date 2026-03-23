// 서울시 실시간 도시데이터 API 유틸리티
// Supabase Edge Function 프록시를 통해 CORS 우회

const SEOUL_LOCATIONS = [
  { name: '광화문·덕수궁', code: 'POI009', lat: 37.5662, lng: 126.9779 },
  { name: '종로·청계', code: 'POI010', lat: 37.5689, lng: 126.9849 },
  { name: '명동', code: 'POI011', lat: 37.5636, lng: 126.9825 },
  { name: '이태원·한남', code: 'POI012', lat: 37.5349, lng: 126.9955 },
  { name: '강남역 일대', code: 'POI013', lat: 37.4979, lng: 127.0276 },
  { name: '서초·교대', code: 'POI014', lat: 37.4943, lng: 127.0122 },
  { name: '압구정·청담', code: 'POI015', lat: 37.5273, lng: 127.0416 },
  { name: '잠실·송파', code: 'POI016', lat: 37.5145, lng: 127.1050 },
  { name: '홍대·합정', code: 'POI017', lat: 37.5558, lng: 126.9237 },
  { name: '건대·성수', code: 'POI018', lat: 37.5405, lng: 127.0715 },
  { name: '여의도·국회의사당', code: 'POI019', lat: 37.5265, lng: 126.9240 },
  { name: '성신여대·돈암', code: 'POI020', lat: 37.5926, lng: 127.0176 },
  { name: '신촌·이대', code: 'POI021', lat: 37.5556, lng: 126.9364 },
  { name: '혜화·대학로', code: 'POI022', lat: 37.5816, lng: 127.0025 },
  { name: '신사·논현', code: 'POI023', lat: 37.5163, lng: 127.0290 },
  { name: '왕십리·성동구청', code: 'POI024', lat: 37.5616, lng: 127.0376 },
  { name: '용산역 일대', code: 'POI026', lat: 37.5299, lng: 126.9649 },
  { name: '시청·서울역', code: 'POI027', lat: 37.5663, lng: 126.9779 },
  { name: '가로수길', code: 'POI028', lat: 37.5207, lng: 127.0230 },
  { name: '성수·뚝섬', code: 'POI029', lat: 37.5448, lng: 127.0557 },
  { name: '을지로·동대문', code: 'POI031', lat: 37.5714, lng: 127.0094 },
  { name: '연남·망원', code: 'POI032', lat: 37.5655, lng: 126.9138 },
];

const CONGESTION_CONFIG = {
  '붐빔':      { color: '#FF4757', icon: '🔴', description: '매우 혼잡', level: 4 },
  '약간 붐빔': { color: '#FF7675', icon: '🟠', description: '다소 혼잡', level: 3 },
  '보통':      { color: '#FDCB6E', icon: '🟡', description: '적당함',    level: 2 },
  '여유':      { color: '#00B894', icon: '🟢', description: '여유로움',  level: 1 },
};

// 캐시 (10분)
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestSeoulLocation(storeLat, storeLng) {
  let nearest = null;
  let minDist = Infinity;
  SEOUL_LOCATIONS.forEach(loc => {
    const d = calculateDistance(storeLat, storeLng, loc.lat, loc.lng);
    if (d < minDist && d <= 2.0) { minDist = d; nearest = loc; }
  });
  return nearest ? { ...nearest, distance: minDist } : null;
}

// ✅ Supabase Edge Function 프록시 통해 호출
export async function fetchCongestionData(locationCode) {
  const cacheKey = locationCode;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `https://pwfhnhunvohyjeqkumqr.supabase.co/functions/v1/seoul-proxy?locationCode=${locationCode}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!res.ok) throw new Error(`서울시 API 응답 오류: ${res.status}`);

    const data = await res.json();
    if (!data.areaName) throw new Error('데이터 없음');

    const congestionLevel = data.congestionLevel || '보통';

    const result = {
      areaName: data.areaName,
      congestionLevel,
      congestionMessage: data.congestionMessage || '',
      populationMin: data.populationMin || 0,
      populationMax: data.populationMax || 0,
      updateTime: data.updateTime || '',
      config: CONGESTION_CONFIG[congestionLevel] || CONGESTION_CONFIG['보통'],
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;

  } catch (error) {
    console.warn('서울시 API 호출 실패, 기본값 사용:', error.message);
    return null;
  }
}

export async function addCongestionToStore(store) {
  try {
    const nearest = findNearestSeoulLocation(store.lat, store.lng);
    if (!nearest) return { ...store, congestion: null };

    const data = await fetchCongestionData(nearest.code);
    return {
      ...store,
      congestion: data ? { ...data, nearestLocation: nearest, distance: nearest.distance } : null
    };
  } catch (e) {
    return { ...store, congestion: null };
  }
}

// ✅ 수정: 3개씩 나눠서 요청 (동시 폭탄 방지)
export async function addCongestionToAllStores(stores) {
  try {
    const results = [];
    const chunkSize = 3;
    for (let i = 0; i < stores.length; i += chunkSize) {
      const chunk = stores.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(s => addCongestionToStore(s)));
      results.push(...chunkResults);
    }
    return results;
  } catch (e) {
    return stores;
  }
}

export function formatCongestionInfo(congestion) {
  if (!congestion) return null;
  return {
    level: congestion.congestionLevel,
    icon: congestion.config?.icon,
    color: congestion.config?.color,
    description: congestion.config?.description,
    population: `${congestion.populationMin?.toLocaleString()} ~ ${congestion.populationMax?.toLocaleString()}명`,
    message: congestion.congestionMessage,
    updateTime: congestion.updateTime,
    locationName: congestion.nearestLocation?.name,
    distance: congestion.distance ? `${congestion.distance.toFixed(1)}km` : null
  };
}