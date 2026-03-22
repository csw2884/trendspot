export default async function handler(req, res) {
  const { locationCode } = req.query;

  if (!locationCode) {
    return res.status(400).json({ error: 'locationCode 파라미터 필요' });
  }

  const API_KEY = 'FWZCWdan69IjMsw';

  try {
    // ✅ 올바른 엔드포인트: citydata
    const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/citydata/1/5/${locationCode}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: `서울시 API 오류: ${response.status}`, detail: text });
    }

    const raw = await response.json();

    // ✅ 올바른 응답 파싱 구조
    const citydata = raw?.SeoulRtd?.CITYDATA;
    if (!citydata) {
      return res.status(404).json({ error: '데이터 없음', raw });
    }

    const ppltn = citydata.LIVE_PPLTN_STTS?.[0];

    res.status(200).json({
      areaName: citydata.AREA_NM,
      congestionLevel: ppltn?.AREA_CONGEST_LVL || '보통',
      congestionMessage: ppltn?.AREA_CONGEST_MSG || '',
      populationMin: parseInt(ppltn?.AREA_PPLTN_MIN) || 0,
      populationMax: parseInt(ppltn?.AREA_PPLTN_MAX) || 0,
      updateTime: ppltn?.PPLTN_TIME || '',
    });

  } catch (err) {
    console.error('서울시 API 실패:', err.message);
    res.status(500).json({ error: err.message });
  }
}