export default async function handler(req, res) {
  const { dataset, key } = req.query;
  
  if (!dataset || !key) {
    return res.status(400).json({ error: 'dataset, key 파라미터 필요' });
  }

  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/${dataset}/1/100/`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}