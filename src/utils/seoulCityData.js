export async function fetchCongestionData(locationCode) {
  const cacheKey = locationCode;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // ✅ 프록시 없이 직접 호출
    const API_KEY = 'FWZCWdan69IjMsw';
    const res = await fetch(
      `http://openapi.seoul.go.kr:8088/${API_KEY}/json/citydata/1/5/${locationCode}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) throw new Error(`서울시 API 응답 오류: ${res.status}`);

    const raw = await res.json();
    const citydata = raw?.SeoulRtd?.CITYDATA;
    if (!citydata) throw new Error('데이터 없음');

    const ppltn = citydata.LIVE_PPLTN_STTS?.[0];

    const result = {
      areaName: citydata.AREA_NM,
      congestionLevel: ppltn?.AREA_CONGEST_LVL || '보통',
      congestionMessage: ppltn?.AREA_CONGEST_MSG || '',
      populationMin: parseInt(ppltn?.AREA_PPLTN_MIN) || 0,
      populationMax: parseInt(ppltn?.AREA_PPLTN_MAX) || 0,
      updateTime: ppltn?.PPLTN_TIME || '',
      config: CONGESTION_CONFIG[ppltn?.AREA_CONGEST_LVL] || CONGESTION_CONFIG['보통'],
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;

  } catch (error) {
    console.warn('서울시 API 호출 실패:', error.message);
    return null;
  }
}