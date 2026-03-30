export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const SERVICE_KEY = process.env.WEATHER_API_KEY;
    if (!SERVICE_KEY) {
      return res.status(200).json({ icon: '🌤️', text: '날씨 준비 중', effect: null });
    }

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const baseDate = kst.toISOString().slice(0, 10).replace(/-/g, '');
    const hours = kst.getHours();
    const baseTime =
      hours < 2 ? '2300' : hours < 5 ? '0200' : hours < 8 ? '0500' :
      hours < 11 ? '0800' : hours < 14 ? '1100' : hours < 17 ? '1400' :
      hours < 20 ? '1700' : hours < 23 ? '2000' : '2300';

    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst?serviceKey=${SERVICE_KEY}&numOfRows=60&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=60&ny=127`;

    const response = await fetch(url);
    const data = await response.json();
    const items = data?.response?.body?.items?.item || [];

    const pty = items.find(i => i.category === 'PTY')?.fcstValue;
    const t1h = items.find(i => i.category === 'T1H')?.fcstValue;

    let weather = { icon: '☀️', text: '맑음', effect: null };
    if (pty === '1') weather = { icon: '🌧️', text: '비', effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (pty === '2') weather = { icon: '🌨️', text: '비/눈', effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (pty === '3') weather = { icon: '❄️', text: '눈', effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (t1h && parseInt(t1h) >= 28) weather = { icon: '🌡️', text: `${t1h}°C 더움`, effect: '실내 쇼핑 증가 가능성↑' };
    else if (t1h && parseInt(t1h) <= 0) weather = { icon: '🥶', text: `${t1h}°C 추움`, effect: '외출 감소 → 재고 여유 가능성↑' };
    else if (t1h) weather = { icon: '🌤️', text: `${t1h}°C`, effect: null };

    res.status(200).json(weather);
  } catch (err) {
    res.status(200).json({ icon: '🌤️', text: '날씨 정보 없음', effect: null });
  }
}