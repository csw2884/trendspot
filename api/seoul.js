export default async function handler(req, res) {
  const { locationCode } = req.query;

  if (!locationCode) {
    return res.status(400).json({ error: 'locationCode 파라미터 필요' });
  }

  const API_KEY = 'FWZEWdan69IjMsw';

  try {
    const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/citydata_ppltn/1/5/${locationCode}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`서울시 API 오류: ${response.status}`);
    }

    const raw = await response.json();
    const item = raw?.SeoulRtd?.row?.[0];

    if (!item) {
      return res.status(404).json({ error: '데이터 없음' });
    }

    res.status(200).json({
      areaName: item.AREA_NM,
      congestionLevel: item.AREA_CONGEST_LVL,
      congestionMessage: item.AREA_CONGEST_MSG,
      populationMin: parseInt(item.AREA_PPLTN_MIN),
      populationMax: parseInt(item.AREA_PPLTN_MAX),
      updateTime: item.PPLTN_TIME,
    });

  } catch (err) {
    console.error('서울시 API 실패:', err.message);
    res.status(500).json({ error: err.message });
  }
}