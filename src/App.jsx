import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

const STATUS_COLOR = { '여유': '#1D9E75', '소량': '#EF9F27', '품절': '#E24B4A' }
const STATUS_BG = { '여유': '#E1F5EE', '소량': '#FEF3DC', '품절': '#FDECEC' }

const CATEGORIES = [
  { label: '🐣 팝마트', value: 'popmart' },
  { label: '🍞 버터떡', value: 'buttertteok' },
  { label: '🍫 두쫀쿠', value: 'twochoco' },
  { label: '👟 한정판 패션', value: 'fashion' },
  { label: '🎪 팝업스토어', value: 'popup' },
]

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function App() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('popmart')
  const [mapReady, setMapReady] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportStatus, setReportStatus] = useState('여유')
  const [reportQty, setReportQty] = useState('')
  const [reportItem, setReportItem] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [gpsChecking, setGpsChecking] = useState(false)

  useEffect(() => {
    let tries = 0
    const interval = setInterval(() => {
      tries++
      if (window.kakao && window.kakao.maps) {
        clearInterval(interval)
        const map = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(37.5665, 126.9780),
          level: 7
        })
        mapInstance.current = map
        setMapReady(true)
      }
      if (tries > 20) clearInterval(interval)
    }, 300)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (mapReady) fetchStores()
  }, [category, mapReady])

  useEffect(() => {
    if (!mapReady) return
    const channel = supabase
      .channel('stocks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, () => {
        fetchStores()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [mapReady, category])

  async function fetchStores() {
    const { data } = await supabase
      .from('stores')
      .select('*, stocks(*)')
      .eq('category', category)
    if (data) renderMarkers(data)
  }

  function clearMarkers() {
    markersRef.current.forEach(o => o.setMap(null))
    markersRef.current = []
  }

  function renderMarkers(data) {
    if (!mapInstance.current) return
    clearMarkers()
    data.forEach(store => {
      const latest = store.stocks?.[store.stocks.length - 1]
      const status = latest?.status || '품절'
      const color = STATUS_COLOR[status]

      const wrapper = document.createElement('div')
      wrapper.style.cssText = 'position:relative;cursor:pointer;'

      const pin = document.createElement('div')
      pin.style.cssText = `
        background:${color};width:40px;height:40px;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.25);
        transition:transform 0.15s;
      `

      const label = document.createElement('div')
      label.style.cssText = `
        position:absolute;top:-28px;left:50%;transform:translateX(-50%);
        background:#222;color:#fff;font-size:11px;font-weight:600;
        padding:3px 7px;border-radius:10px;white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.2);
      `
      label.textContent = store.name.replace('팝마트 ', '').replace('버터떡 ', '').replace('두쫀쿠 ', '')

      wrapper.appendChild(label)
      wrapper.appendChild(pin)
      wrapper.addEventListener('click', () => {
        setSelected({ store, status, latest })
        setReporting(false)
      })

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(store.lat, store.lng),
        content: wrapper,
        yAnchor: 1
      })
      overlay.setMap(mapInstance.current)
      markersRef.current.push(overlay)
    })
  }

  async function handleReportClick() {
    setGpsChecking(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = getDistance(
          pos.coords.latitude, pos.coords.longitude,
          selected.store.lat, selected.store.lng
        )
        setGpsChecking(false)
        if (dist <= 100) {
          setReporting(true)
          setReportStatus('여유')
          setReportQty('')
          setReportItem('')
        } else {
          showToast(`📍 매장에서 ${Math.round(dist)}m 떨어져 있어요`)
        }
      },
      () => {
        setGpsChecking(false)
        showToast('⚠️ GPS 확인 불가 — 개발 모드')
        setReporting(true)
        setReportStatus('여유')
        setReportQty('')
        setReportItem('')
      }
    )
  }

  async function submitReport() {
    if (!selected) return
    setSubmitting(true)
    const { error } = await supabase.from('stocks').insert({
      store_id: selected.store.id,
      item_name: reportItem || '기타',
      status: reportStatus,
      quantity: parseInt(reportQty) || 0,
      reported_by: '익명',
    })
    setSubmitting(false)
    if (!error) {
      showToast('✅ 제보 완료!')
      setReporting(false)
      setSelected(null)
      setReportItem('')
      setReportQty('')
    } else {
      showToast('❌ 제보 실패. 다시 시도해주세요.')
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* 헤더 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 28, background: '#1D9E75', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📍</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#1A1A1A', letterSpacing: '-0.3px' }}>TrendSpot</span>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => { setCategory(c.value); setSelected(null) }} style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: category === c.value ? '#1D9E75' : '#f5f5f5',
              color: category === c.value ? '#fff' : '#666',
              whiteSpace: 'nowrap', transition: 'all 0.15s'
            }}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* 지도 */}
      <div ref={mapRef} style={{ flex: 1 }} />

      {/* 로딩 */}
      {!mapReady && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#999', fontSize: 14 }}>
          지도 로딩 중...
        </div>
      )}

      {/* 범례 */}
      <div style={{ position: 'fixed', bottom: 24, left: 16, background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontSize: 12, zIndex: 10 }}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            <span style={{ color: '#444', fontWeight: 500 }}>{s}</span>
          </div>
        ))}
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,30,0.9)', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 13, zIndex: 100, maxWidth: '85%', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
          {toast}
        </div>
      )}

      {/* 매장 팝업 */}
      {selected && !reporting && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', boxShadow: '0 -4px 30px rgba(0,0,0,0.12)', zIndex: 20 }}>
          <div style={{ width: 36, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#1A1A1A', marginBottom: 4 }}>{selected.store.name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{selected.store.address}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: STATUS_BG[selected.status], borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>재고 상태</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: STATUS_COLOR[selected.status] }}>{selected.status}</div>
            </div>
            <div style={{ flex: 1, background: '#f8f8f8', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>수량</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#333' }}>{selected.latest?.quantity ?? '-'}개</div>
            </div>
            <div style={{ flex: 1, background: '#f8f8f8', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>아이템</div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#333', marginTop: 4 }}>{selected.latest?.item_name ?? '-'}</div>
            </div>
          </div>
          <button onClick={handleReportClick} disabled={gpsChecking} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: gpsChecking ? '#ccc' : 'linear-gradient(135deg, #1D9E75, #157A5A)',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: gpsChecking ? 'default' : 'pointer',
            boxShadow: gpsChecking ? 'none' : '0 4px 15px rgba(29,158,117,0.4)'
          }}>
            {gpsChecking ? '📍 위치 확인 중...' : '📍 재고 제보하기'}
          </button>
        </div>
      )}

      {/* 제보 폼 */}
      {selected && reporting && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', boxShadow: '0 -4px 30px rgba(0,0,0,0.12)', zIndex: 20 }}>
          <div style={{ width: 36, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1A1A1A' }}>재고 제보</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{selected.store.name}</div>
            </div>
            <button onClick={() => setReporting(false)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>아이템명</div>
            <input type="text" value={reportItem} onChange={e => setReportItem(e.target.value)}
              placeholder="예: 라부부 몰리, 스키니피그..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #eee', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>재고 상태</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['여유', '소량', '품절'].map(s => (
                <button key={s} onClick={() => setReportStatus(s)} style={{
                  flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  border: `2px solid ${reportStatus === s ? STATUS_COLOR[s] : '#eee'}`,
                  background: reportStatus === s ? STATUS_BG[s] : '#fafafa',
                  color: reportStatus === s ? STATUS_COLOR[s] : '#bbb',
                  transition: 'all 0.15s'
                }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>수량 <span style={{ fontWeight: 400, color: '#aaa' }}>(모르면 비워두세요)</span></div>
            <input type="number" value={reportQty} onChange={e => setReportQty(e.target.value)}
              placeholder="예: 5"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #eee', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fafafa' }} />
          </div>

          <button onClick={submitReport} disabled={submitting} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: submitting ? '#ccc' : 'linear-gradient(135deg, #1D9E75, #157A5A)',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
            boxShadow: submitting ? 'none' : '0 4px 15px rgba(29,158,117,0.4)'
          }}>
            {submitting ? '제보 중...' : '✅ 제보 완료'}
          </button>
        </div>
      )}
    </div>
  )
}