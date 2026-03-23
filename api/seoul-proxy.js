export default async function handler(req, res) {
  const { locationCode } = req.query;
  if (!locationCode) return res.status(400).json({ error: 'locationCode 필요' });

  try {
    const API_KEY = '46575a435764616e3639496a4d7377';
    const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/citydata_ppltn/1/5/${locationCode}`;
    const response = await fetch(url);
    const raw = await response.json();

    const list = raw?.["SeoulRtd.citydata_ppltn"];
    if (!list || list.length === 0) throw new Error('데이터 없음');

    const item = list[0];
    res.status(200).json({
      areaName: item.AREA_NM,
      congestionLevel: item.AREA_CONGEST_LVL,
      congestionMessage: item.AREA_CONGEST_MSG,
      populationMin: parseInt(item.AREA_PPLTN_MIN) || 0,
      populationMax: parseInt(item.AREA_PPLTN_MAX) || 0,
      updateTime: item.PPLTN_TIME,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}