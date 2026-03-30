export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const API_KEY = '46575a435764616e3639496a4d7377';
    
    // ✅ Vercel은 http(8088 포트) 요청이 가능하므로 서울시 공식 주소 사용!
    const seoulUrl = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/citydata/1/5/POI009`;
    
    const response = await fetch(seoulUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const raw = await response.json();
    const weatherData = raw?.CITYDATA?.WEATHER_STTS?.[0];
    
    // 데이터 구조가 다를 경우를 대비한 디버깅
    if (!weatherData) {
      return res.status(200).json({ 
        icon: '⚠️', 
        text: 'API 응답 오류', 
        effect: '데이터 구조 확인 필요' 
      });
    }

    const precptType = weatherData.PRECPT_TYPE; // 0:없음 1:비 2:비/눈 3:눈
    const temp = weatherData.TEMP;
    const pm25 = weatherData.PM25_INDEX; // 좋음/보통/나쁨/매우나쁨
    
    let weather = { icon: '☀️', text: `${temp}°C`, effect: null };
    
    if (precptType === '1') weather = { icon: '🌧️', text: `비 ${temp}°C`, effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (precptType === '2') weather = { icon: '🌨️', text: `비/눈 ${temp}°C`, effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (precptType === '3') weather = { icon: '❄️', text: `눈 ${temp}°C`, effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (temp && parseInt(temp) >= 28) weather = { icon: '🌡️', text: `${temp}°C 더움`, effect: '실내 쇼핑 증가 가능성↑' };
    else if (temp && parseInt(temp) <= 0) weather = { icon: '🥶', text: `${temp}°C 추움`, effect: '외출 감소 → 재고 여유 가능성↑' };

    if (pm25 === '나쁨' || pm25 === '매우나쁨') {
      weather.effect = (weather.effect ? weather.effect + ' · ' : '') + `미세먼지 ${pm25}`;
    }
    
    res.status(200).json(weather);
  } catch (err) {
    // 에러 원인을 화면에 띄워서 확인
    res.status(200).json({ icon: '❌', text: '통신 실패', effect: err.message });
  }
}