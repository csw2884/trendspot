// 서울시 실시간 도시데이터 API 유틸리티
// TrendSpot - 유동인구 혼잡도 표시 기능

const SEOUL_API_KEY = '46575a435764616e3639496a4d7377';
const SEOUL_API_BASE_URL = 'http://openAPI.seoul.go.kr:8088';

// 서울시 주요 120장소 목록 (매장 위치와 매칭용)
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
  { name: '중구청·신당', code: 'POI025', lat: 37.5607, lng: 127.0178 },
  { name: '용산역 일대', code: 'POI026', lat: 37.5299, lng: 126.9649 },
  { name: '시청·서울역', code: 'POI027', lat: 37.5663, lng: 126.9779 },
  { name: '가로수길', code: 'POI028', lat: 37.5207, lng: 127.0230 },
  { name: '성수·뚝섬', code: 'POI029', lat: 37.5448, lng: 127.0557 },
  { name: '방배·사당', code: 'POI030', lat: 37.4762, lng: 126.9814 },
  { name: '을지로·동대문', code: 'POI031', lat: 37.5714, lng: 127.0094 },
  { name: '연남·망원', code: 'POI032', lat: 37.5655, lng: 126.9138 },
  { name: '성북·안암', code: 'POI033', lat: 37.5890, lng: 127.0295 }
];

// 혼잡도 레벨별 설정
const CONGESTION_CONFIG = {
  '붐빔': { 
    color: '#FF4757', 
    icon: '🔴', 
    description: '매우 혼잡함',
    level: 4 
  },
  '약간 붐빔': { 
    color: '#FF7675', 
    icon: '🟠', 
    description: '다소 혼잡함',
    level: 3 
  },
  '보통': { 
    color: '#FDCB6E', 
    icon: '🟡', 
    description: '적당함',
    level: 2 
  },
  '여유': { 
    color: '#00B894', 
    icon: '🟢', 
    description: '여유로움',
    level: 1 
  }
};

// API 호출 캐시 (10분)
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10분

// 두 좌표 간의 거리 계산 (Haversine Formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 지구 반지름(km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km 단위
}

// 매장 위치에서 가장 가까운 서울시 실시간 도시데이터 장소 찾기
export function findNearestSeoulLocation(storeLat, storeLng) {
  let nearestLocation = null;
  let minDistance = Infinity;

  SEOUL_LOCATIONS.forEach(location => {
    const distance = calculateDistance(storeLat, storeLng, location.lat, location.lng);
    if (distance < minDistance && distance <= 2.0) { // 2km 이내만
      minDistance = distance;
      nearestLocation = location;
    }
  });

  return nearestLocation ? { ...nearestLocation, distance: minDistance } : null;
}

// 서울시 실시간 인구데이터 API 호출 (임시 테스트 모드)
export async function fetchCongestionData(locationName) {
  try {
    // 임시로 테스트 데이터 반환 (API 프록시 문제로 인한 우회)
    const testData = {
      areaName: locationName,
      congestionLevel: "보통",
      congestionMessage: "적당한 혼잡도입니다.",
      populationMin: 10000,
      populationMax: 15000,
      maleRate: 50.0,
      femaleRate: 50.0,
      updateTime: new Date().toISOString(),
      forecast: [],
      config: CONGESTION_CONFIG['보통']
    };
    
    return testData;
    
  } catch (error) {
    console.error('혼잡도 데이터 조회 실패:', error);
    return null;
  }
}

// 매장 정보에 혼잡도 데이터 추가
export async function addCongestionToStore(store) {
  try {
    const nearestLocation = findNearestSeoulLocation(store.lat, store.lng);
    
    if (!nearestLocation) {
      return { ...store, congestion: null };
    }

    const congestionData = await fetchCongestionData(nearestLocation.name);
    
    return {
      ...store,
      congestion: congestionData ? {
        ...congestionData,
        nearestLocation,
        distance: nearestLocation.distance
      } : null
    };

  } catch (error) {
    console.error('매장 혼잡도 데이터 추가 실패:', error);
    return { ...store, congestion: null };
  }
}

// 모든 매장에 혼잡도 데이터 일괄 추가
export async function addCongestionToAllStores(stores) {
  try {
    const storesWithCongestion = await Promise.all(
      stores.map(store => addCongestionToStore(store))
    );
    
    return storesWithCongestion;
  } catch (error) {
    console.error('전체 매장 혼잡도 데이터 추가 실패:', error);
    return stores; // 실패 시 원본 데이터 반환
  }
}

// 혼잡도 정보 포맷팅 유틸리티
export function formatCongestionInfo(congestion) {
  if (!congestion) return null;

  const populationRange = `${congestion.populationMin?.toLocaleString()} ~ ${congestion.populationMax?.toLocaleString()}명`;
  
  return {
    level: congestion.congestionLevel,
    icon: congestion.config.icon,
    color: congestion.config.color,
    description: congestion.config.description,
    population: populationRange,
    message: congestion.congestionMessage,
    updateTime: congestion.updateTime,
    locationName: congestion.nearestLocation?.name,
    distance: congestion.distance ? `${congestion.distance.toFixed(1)}km` : null
  };
}