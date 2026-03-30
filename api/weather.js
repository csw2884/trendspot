export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const API_KEY = '46575a435764616e3639496a4d7377';
    // 홍대 지역 코드로 서울 날씨 대표값 가져오기
    const seoulUrl = `https://openapi.seoul.go.kr:443/${API_KEY}/json/citydata_ppltn/1/1/POI009`;
    const response = await fetch(seoulUrl);
    const raw = await response.json();

    const item = raw?.["SeoulRtd.citydata_ppltn"]?.[0];
    if (!item) return res.status(200).json({ icon: '🌤️', text: '날씨 정보 없음', effect: null });

    const precptType = item.PRECPT_TYPE; // 0:없음 1:비 2:비/눈 3:눈
    const temp = item.TEMP;
    const pm25 = item.PM25_INDEX; // 좋음/보통/나쁨/매우나쁨

    let weather = { icon: '☀️', text: `${temp}°C`, effect: null };
    if (precptType === '1') weather = { icon: '🌧️', text: `비 ${temp}°C`, effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (precptType === '2') weather = { icon: '🌨️', text: `비/눈 ${temp}°C`, effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (precptType === '3') weather = { icon: '❄️', text: `눈 ${temp}°C`, effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (temp && parseInt(temp) >= 28) weather = { icon: '🌡️', text: `${temp}°C 더움`, effect: '실내 쇼핑 증가 가능성↑' };
    else if (temp && parseInt(temp) <= 0) weather = { icon: '🥶', text: `${temp}°C 추움`, effect: '외출 감소 → 재고 여유 가능성↑' };

    // 미세먼지 나쁨이면 추가
    if (pm25 === '나쁨' || pm25 === '매우나쁨') {
      weather.effect = (weather.effect ? weather.effect + ' · ' : '') + `미세먼지 ${pm25}`;
    }

    res.status(200).json(weather);
  } catch (err) {
    res.status(200).json({ icon: '🌤️', text: '날씨 정보 없음', effect: null });
  }
}