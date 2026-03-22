// api/seoul.js - Vercel 서버사이드 프록시 (CORS 우회)
export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { locationCode } = req.query;
  if (!locationCode) {
    return res.status(400).json({ error: 'locationCode required' });
  }

  const API_KEY = '46575a435764616e3639496a4d7377';
  const url = `http://openAPI.seoul.go.kr:8088/${API_KEY}/json/citydata_ppltn/1/5/${encodeURIComponent(locationCode)}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const ppltn = data?.SeoulRtd?.row?.[0];

    if (!ppltn) {
      return res.status(404).json({ error: 'No data' });
    }

    return res.status(200).json({
      areaName: ppltn.AREA_NM,
      congestionLevel: ppltn.AREA_CONGEST_LVL,
      congestionMessage: ppltn.AREA_CONGEST_MSG,
      populationMin: parseInt(ppltn.AREA_PPLTN_MIN) || 0,
      populationMax: parseInt(ppltn.AREA_PPLTN_MAX) || 0,
      updateTime: ppltn.PPLTN_TIME,
    });
  } catch (error) {
    console.error('Seoul API error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}