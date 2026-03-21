import StatsDashboard from './components/StatsDashboard';
import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import { addCongestionToAllStores } from './utils/seoulCityData';
import Auth from './components/Auth';
import AIAssistant from './components/AIAssistant';
import Admin from './components/Admin';
import StoreDetail from './components/StoreDetail';
import { supabase } from './lib/supabase';
import OwnerDashboard from './components/OwnerDashboard';
import TrendAI from './components/TrendAI';
import PricingModal from './components/PricingModal';
import OnlineCounter from './components/OnlineCounter';

const KAKAO_MAP_KEY = '15dec95eb60278894a9e834e679af110';

const STOCK_STATUS = {
  여유: { color: '#2ED573', name: '여유' },
  소량: { color: '#FFA502', name: '소량' },
  품절: { color: '#FF4757', name: '품절' }
};

function App() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [spotPoints, setSpotPoints] = useState(0);
  const [stores, setStores] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showAddStoreForm, setShowAddStoreForm] = useState(false);
  const [reportData, setReportData] = useState({ itemName: '', status: '여유', quantity: '' });
  const [storeData, setStoreData] = useState({ name: '', category: 'popmart', address: '', lat: null, lng: null });
  const [addressLoading, setAddressLoading] = useState(false);
  const [loadingCongestion, setLoadingCongestion] = useState(false);
  const [kakaoLoaded, setKakaoLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showStoreDetail, setShowStoreDetail] = useState(false);
  const [storeImage, setStoreImage] = useState(null);
  const [trends, setTrends] = useState([]);
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  // 가게 등록 - 카카오 장소 검색
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [storeSearchResults, setStoreSearchResults] = useState([]);
  const [selectedKakaoPlace, setSelectedKakaoPlace] = useState(null);
  const [storeSearchLoading, setStoreSearchLoading] = useState(false);

  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const mapRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUser(session.user); checkAdmin(session.user.email); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.email);
      else setIsAdmin(false);
    });
    loadStoresAndStocks();
    getUserLocation();
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (window.kakao?.maps) { setKakaoLoaded(true); return; }
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false&libraries=services`;
    script.onload = () => { window.kakao.maps.load(() => { setKakaoLoaded(true); }); };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (kakaoLoaded && !mapRef.current) setTimeout(() => initializeMap(), 300);
  }, [kakaoLoaded]);

  useEffect(() => {
    if (!mapRef.current) return;
    updateMarkers();
  }, [selectedTrend, stores, stocks]);

  useEffect(() => {
    if (stocks.length > 0) calculateTrends();
  }, [stocks]);

  useEffect(() => {
    const sub = supabase.channel('stocks_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, () => loadStoresAndStocks())
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  const calculateTrends = () => {
    const now = Date.now();
    const scoreMap = {};
    stocks.forEach(stock => {
      const itemKey = stock.item_name?.trim().toLowerCase();
      if (!itemKey) return;
      const hoursAgo = (now - new Date(stock.reported_at)) / (1000 * 60 * 60);
      if (hoursAgo > 168) return;
      if (!scoreMap[itemKey]) {
        scoreMap[itemKey] = { name: stock.item_name, score: 0, soldOutCount: 0, storeCount: new Set() };
      }
      const recencyBonus = hoursAgo < 6 ? 3 : hoursAgo < 24 ? 2 : 1;
      scoreMap[itemKey].storeCount.add(stock.store_id);
      if (stock.status === '품절') { scoreMap[itemKey].soldOutCount += 1; scoreMap[itemKey].score += 5 * recencyBonus; }
      else if (stock.status === '소량') { scoreMap[itemKey].score += 3 * recencyBonus; }
      else { scoreMap[itemKey].score += 1 * recencyBonus; }
    });
    const sorted = Object.values(scoreMap)
      .map(item => ({ ...item, storeCount: item.storeCount.size }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setTrends(sorted);
  };

  const loadStoresAndStocks = async () => {
    try {
      setLoadingCongestion(true);
      const { data: storesData } = await supabase.from('stores').select('*').eq('status', 'approved');
      const { data: stocksData } = await supabase.from('stocks').select('*').order('reported_at', { ascending: false });
      let storesWithCongestion = storesData || [];
      const seoulStores = storesWithCongestion.filter(s =>
        s.address?.includes('서울') || (s.lat >= 37.4 && s.lat <= 37.7)
      );
      if (seoulStores.length > 0) {
        try {
          const updated = await addCongestionToAllStores(seoulStores);
          storesWithCongestion = storesWithCongestion.map(s => updated.find(u => u.id === s.id) || s);
        } catch (e) { console.error(e); }
      }
      setStores(storesWithCongestion);
      setStocks(stocksData || []);
    } catch (e) {
      console.error('데이터 로드 실패:', e);
    } finally {
      setLoadingCongestion(false);
    }
  };

  const checkAdmin = async (email) => {
    const { data } = await supabase.from('admins').select('*').eq('email', email).single();
    setIsAdmin(!!data);
  };

  const getUserLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation({ lat: 37.5665, lng: 126.9780 })
    );
  };

  const initializeMap = () => {
    if (!mapContainerRef.current || !window.kakao?.maps) return;
    const center = new window.kakao.maps.LatLng(37.5665, 126.9780);
    const mapInstance = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 5 });
    mapRef.current = mapInstance;
    if (userLocation) addMyLocationMarker(mapInstance);
  };

  const addMyLocationMarker = (mapInstance) => {
    const myImg = new window.kakao.maps.MarkerImage(
      `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#4285F4" stroke="#fff" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="#fff"/></svg>`)}`,
      new window.kakao.maps.Size(24, 24),
      { offset: new window.kakao.maps.Point(12, 12) }
    );
    new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
      image: myImg, map: mapInstance
    });
  };

  const updateMarkers = () => {
    const m = mapRef.current;
    if (!m) return;
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (!selectedTrend) return;
    const relevantStoreIds = new Set(
      stocks.filter(s => s.item_name?.toLowerCase().includes(selectedTrend.toLowerCase())).map(s => s.store_id)
    );
    stores.filter(s => relevantStoreIds.has(s.id)).forEach(store => createMarker(m, store));
  };

  const createMarker = (mapInstance, store) => {
    const trendStock = stocks
      .filter(s => s.store_id === store.id && s.item_name?.toLowerCase().includes(selectedTrend?.toLowerCase()))
      .sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at))[0];
    const status = trendStock?.status || '품절';
    const statusColor = STOCK_STATUS[status]?.color || '#FF4757';
    const qty = trendStock?.quantity ?? '?';
    const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
      <path d="M24 0C10.7 0 0 10.7 0 24c0 24 24 32 24 32s24-8 24-32C48 10.7 37.3 0 24 0z" fill="${statusColor}" stroke="#fff" stroke-width="2"/>
      <circle cx="24" cy="22" r="14" fill="#fff"/>
      <text x="24" y="19" text-anchor="middle" font-size="9" fill="#666" font-weight="bold">수량</text>
      <text x="24" y="31" text-anchor="middle" font-size="12" fill="${statusColor}" font-weight="bold">${qty}개</text>
    </svg>`;
    const markerImage = new window.kakao.maps.MarkerImage(
      `data:image/svg+xml;utf8,${encodeURIComponent(markerSvg)}`,
      new window.kakao.maps.Size(48, 56),
      { offset: new window.kakao.maps.Point(24, 56) }
    );
    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(store.lat, store.lng),
      image: markerImage, map: mapInstance
    });
    markersRef.current.push(marker);
    window.kakao.maps.event.addListener(marker, 'click', () => {
      setSelectedStore(store);
      setShowStoreDetail(true);
    });
  };

  const handleSelectTrend = (trendName) => {
    setSelectedTrend(prev => prev === trendName ? null : trendName);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); setShowSearchResults(false); return; }
    const storeResults = stores.filter(store =>
      store.name?.toLowerCase().includes(query.toLowerCase()) ||
      store.address?.toLowerCase().includes(query.toLowerCase())
    ).map(store => ({ type: 'store', data: store }));
    const itemResults = [];
    const seenItems = new Set();
    stocks.forEach(stock => {
      if (stock.item_name?.toLowerCase().includes(query.toLowerCase()) && !seenItems.has(stock.item_name)) {
        seenItems.add(stock.item_name);
        const store = stores.find(s => s.id === stock.store_id);
        if (store) itemResults.push({ type: 'item', data: stock, store });
      }
    });
    setSearchResults([...storeResults, ...itemResults].slice(0, 15));
    setShowSearchResults(true);
  };

  const handleSearchSelect = (result) => {
    setShowSearchResults(false);
    setSearchQuery('');
    if (result.type === 'store') {
      setSelectedStore(result.data);
      setShowStoreDetail(true);
      if (mapRef.current) {
        mapRef.current.setCenter(new window.kakao.maps.LatLng(result.data.lat, result.data.lng));
        mapRef.current.setLevel(3);
      }
    } else {
      handleSelectTrend(result.data.item_name);
    }
  };

  // 카카오맵 장소 검색
  const searchKakaoPlaces = (query) => {
    setStoreSearchQuery(query);
    setSelectedKakaoPlace(null);
    if (!query.trim()) { setStoreSearchResults([]); return; }
    if (!window.kakao?.maps?.services) return;
    setStoreSearchLoading(true);
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(query, (result, status) => {
      setStoreSearchLoading(false);
      if (status === window.kakao.maps.services.Status.OK) {
        setStoreSearchResults(result.slice(0, 8));
      } else {
        setStoreSearchResults([]);
      }
    });
  };

  const handleSelectKakaoPlace = (place) => {
    setSelectedKakaoPlace(place);
    setStoreSearchQuery(place.place_name);
    setStoreSearchResults([]);
    setStoreData(prev => ({
      ...prev,
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x)
    }));
  };

const uploadImage = async (file, path) => {
  // 파일명 영문/숫자만 남기기
  const ext = file.name.split('.').pop();
  const safePath = `stores/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('store-images').upload(safePath, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('store-images').getPublicUrl(safePath);
  return publicUrl;
};

const handleAddStore = async (e) => {
  e.preventDefault();
  if (!user) { setShowAuthModal(true); return; }
  if (!selectedKakaoPlace) { alert('가게를 검색해서 선택해주세요!'); return; }
  setAddressLoading(true);
  try {
    let imageUrl = null;
    if (storeImage) {
      try {
        imageUrl = await uploadImage(storeImage);
      } catch (imgError) {
        console.error('이미지 업로드 실패:', imgError);
        // 이미지 실패해도 가게 등록은 계속 진행
      }
    }
    const { error } = await supabase.from('stores').insert({
      name: storeData.name.trim(),
      category: storeData.category,
      address: storeData.address.trim(),
      lat: storeData.lat,
      lng: storeData.lng,
      status: 'pending',
      owner_id: user.id,
      owner_email: user.email,
      image_url: imageUrl
    });
    if (error) throw error;
    alert('가게 등록 신청 완료! 관리자 승인 후 표시됩니다 😊');
    setShowAddStoreForm(false);
    setStoreData({ name: '', category: 'popmart', address: '', lat: null, lng: null });
    setStoreSearchQuery('');
    setSelectedKakaoPlace(null);
    setStoreImage(null);
  } catch (error) {
    alert('가게 등록에 실패했습니다: ' + error.message);
    console.error(error);
  } finally {
    setAddressLoading(false);
  }
};

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    if (!selectedStore || !reportData.itemName.trim()) { alert('아이템명을 입력해주세요.'); return; }
    try {
      await supabase.from('stocks').insert({
        store_id: selectedStore.id,
        item_name: reportData.itemName.trim(),
        status: reportData.status,
        quantity: parseInt(reportData.quantity) || 0,
        reported_by: user.id,
        reported_at: new Date().toISOString()
      });
      await supabase.from('activity_logs').insert({
        user_id: user.id, action: 'stock_report', target_id: selectedStore.id
      });
      alert('재고 제보 완료! +10 스팟 포인트 ⭐');
      setSpotPoints(prev => prev + 10);
      setShowReportForm(false);
      setReportData({ itemName: '', status: '여유', quantity: '' });
      loadStoresAndStocks();
    } catch (e) { alert('제보 실패했습니다.'); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSpotPoints(0);
  };

  if (showAdminPage) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-content">
            <h1 className="logo">📍 TrendSpot</h1>
            <button className="btn btn-ghost btn-pill" onClick={() => setShowAdminPage(false)}>← 돌아가기</button>
          </div>
        </header>
        <Admin user={user} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div className="app">
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div onClick={e => e.stopPropagation()}>
            <Auth onLogin={(u) => { setUser(u); setShowAuthModal(false); }} />
          </div>
        </div>
      )}

      {showStoreDetail && selectedStore && (
        <StoreDetail
          store={selectedStore}
          stocks={stocks}
          onClose={() => setShowStoreDetail(false)}
          onReport={(store) => { setSelectedStore(store); setShowStoreDetail(false); setShowReportForm(true); }}
          user={user}
        />
      )}

{showPricing && (
  <PricingModal onClose={() => setShowPricing(false)} />
)}

      <header className="header">
        <div className="header-content">
          <h1 className="logo">📍 TrendSpot</h1>
          <div className="header-right">
            {user ? (
              <>
                <span className="user-nickname">
                  {user?.user_metadata?.nickname || user?.email?.split('@')[0]}
                  {spotPoints > 0 && <span className="point-badge">⚡ {spotPoints}P</span>}
                </span>
                {isAdmin && <button className="btn btn-icon admin-btn" onClick={() => setShowAdminPage(true)}>🔧</button>}
                <button className="btn btn-icon owner-btn" onClick={() => setShowOwnerDashboard(true)}>🏪</button>
                <button
  className="btn btn-secondary btn-pill"
  style={{fontSize: '12px', padding: '6px 12px'}}
  onClick={() => setShowAddStoreForm(true)}
>
  + 가게 등록
</button> 
<button className="btn btn-ghost btn-pill" onClick={() => setShowPricing(true)}>💎 요금제</button>
                <button className="btn btn-ghost btn-pill" onClick={handleLogout}>로그아웃</button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-secondary btn-pill"
                  style={{fontSize: '12px', padding: '6px 12px'}}
                  onClick={() => setShowAuthModal(true)}
                >
                  + 가게 등록
                </button>
                <button className="btn btn-primary btn-pill" onClick={() => setShowAuthModal(true)}>로그인</button>
              </>
            )}
          </div>
        </div>

        <div className="search-container">
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink: 0, color: 'var(--ts-text-muted)'}}>
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="가게명, 메뉴, 아이템 검색..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
            />
            {loadingCongestion && <div className="spinner spinner-sm" />}
          </div>
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result, i) => (
                <div key={i} className="search-result-item" onClick={() => handleSearchSelect(result)}>
                  <span className="search-emoji">{result.type === 'store' ? '🏪' : '📦'}</span>
                  <div>
                    <div className="search-name">{result.type === 'store' ? result.data.name : result.data.item_name}</div>
                    <div className="search-address">{result.type === 'store' ? result.data.address : `${result.store?.name} · ${result.data.status}`}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
<div className="header-subtitle" style={{display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap'}}>
  <span>🔥 지금 어디서 살 수 있는지, AI가 실시간으로 알려드립니다</span>
  <OnlineCounter />
</div>
      </header>
          <TrendAI trends={trends} stocks={stocks} />
          <StatsDashboard stores={stores} stocks={stocks} trends={trends} />
      <div className="trend-bar">
        <span className="trend-bar-title">🔥 TOP</span>
        {trends.length === 0 ? (
          [1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-trend-chip" />)
        ) : (
          trends.map((item, index) => (
            <button
              key={item.name}
              className={`trend-chip ${selectedTrend === item.name ? 'active' : ''}`}
              onClick={() => handleSelectTrend(item.name)}
            >
              <span className="rank-num">{index + 1}</span>
              <span>{item.name}</span>
            </button>
          ))
        )}
      </div>

      {selectedTrend && (
        <div className="trend-filter-bar">
          <span>🔍 <strong>{selectedTrend}</strong> 재고 있는 매장</span>
          <button className="btn btn-ghost btn-pill" style={{fontSize: '12px', padding: '4px 12px'}} onClick={() => setSelectedTrend(null)}>✕ 초기화</button>
        </div>
      )}

      <main className="map-container">
        <div ref={mapContainerRef} className="kakao-map" />
        <div className="legend">
          <div className="legend-title">재고 상태</div>
          {Object.entries(STOCK_STATUS).map(([status, config]) => (
            <div key={status} className="legend-item">
              <div className="status-dot" style={{ backgroundColor: config.color }} />
              <span>{config.name}</span>
            </div>
          ))}
        </div>
        <button className="my-location-btn" onClick={() => {
          if (mapRef.current && userLocation) {
            mapRef.current.setCenter(new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng));
            mapRef.current.setLevel(3);
          }
        }}>📍</button>
      </main>

      <AIAssistant stores={stores} stocks={stocks} user={user} userLocation={userLocation} />

      {/* 재고 제보 폼 */}
      {showReportForm && selectedStore && (
        <div className="modal-overlay" onClick={() => setShowReportForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 재고 제보</h3>
              <button className="close-btn" onClick={() => setShowReportForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="store-info-box">
                <h4>{selectedStore.name}</h4>
                <p>{selectedStore.address}</p>
              </div>
              <form onSubmit={handleSubmitReport} className="report-form">
                <div className="form-group">
                  <label className="input-label">아이템명 *</label>
                  <input className="input" type="text" value={reportData.itemName}
                    onChange={e => setReportData(prev => ({ ...prev, itemName: e.target.value }))}
                    placeholder="예: 라부부 크리미 캐릭터" required />
                </div>
                <div className="form-group">
                  <label className="input-label">재고 상태 *</label>
                  <select className="input" value={reportData.status}
                    onChange={e => setReportData(prev => ({ ...prev, status: e.target.value }))}>
                    <option value="여유">🟢 여유</option>
                    <option value="소량">🟡 소량</option>
                    <option value="품절">🔴 품절</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-label">수량 (선택)</label>
                  <input className="input" type="number" min="0" value={reportData.quantity}
                    onChange={e => setReportData(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="예: 5" />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowReportForm(false)}>취소</button>
                  <button type="submit" className="btn btn-primary">
                    제보하기 <span className="badge badge-accent" style={{marginLeft: '4px'}}>+10P</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 가게 등록 폼 - 카카오맵 장소 검색 */}
      {showAddStoreForm && (
        <div className="modal-overlay" onClick={() => setShowAddStoreForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🏪 가게 등록 신청</h3>
              <button className="close-btn" onClick={() => setShowAddStoreForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize: '13px', color: 'var(--ts-text-secondary)', marginBottom: '16px'}}>
                관리자 승인 후 지도에 표시됩니다 😊
              </p>
              <form onSubmit={handleAddStore} className="report-form">

                {/* 카카오 장소 검색 */}
                <div className="form-group">
                  <label className="input-label">가게 검색 *</label>
                  <div style={{position: 'relative'}}>
                    <input
                      className="input"
                      type="text"
                      value={storeSearchQuery}
                      onChange={e => searchKakaoPlaces(e.target.value)}
                      placeholder="가게명으로 검색 (예: 홍대 팝마트)"
                    />
                    {storeSearchLoading && (
                      <div style={{position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)'}}>
                        <div className="spinner spinner-sm" />
                      </div>
                    )}
                    {storeSearchResults.length > 0 && (
                      <div className="search-results" style={{position: 'absolute', top: '100%', zIndex: 100}}>
                        {storeSearchResults.map((place, i) => (
                          <div key={i} className="search-result-item" onClick={() => handleSelectKakaoPlace(place)}>
                            <span className="search-emoji">🏪</span>
                            <div>
                              <div className="search-name">{place.place_name}</div>
                              <div className="search-address">{place.road_address_name || place.address_name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedKakaoPlace && (
                    <div style={{
                      marginTop: '8px', padding: '10px 12px',
                      background: 'rgba(46,213,115,0.08)',
                      border: '1px solid rgba(46,213,115,0.3)',
                      borderRadius: 'var(--ts-radius-md)',
                      fontSize: '13px'
                    }}>
                      ✅ <strong>{selectedKakaoPlace.place_name}</strong><br/>
                      <span style={{color: 'var(--ts-text-muted)', fontSize: '12px'}}>
                        {selectedKakaoPlace.road_address_name || selectedKakaoPlace.address_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* 카테고리 */}
                <div className="form-group">
                  <label className="input-label">카테고리 *</label>
                  <select className="input" value={storeData.category}
                    onChange={e => setStoreData(prev => ({ ...prev, category: e.target.value }))}>
                    <option value="popmart">🧸 팝마트</option>
                    <option value="buttertteok">🧈 버터떡</option>
                    <option value="twochoco">🍫 두쫀쿠</option>
                    <option value="fashion">👕 한정판 패션</option>
                    <option value="popup">🏪 팝업스토어</option>
                  </select>
                </div>

                {/* 가게 사진 */}
                <div className="form-group">
                  <label className="input-label">가게 사진 (선택)</label>
                  <input type="file" accept="image/*" onChange={e => setStoreImage(e.target.files[0])} />
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddStoreForm(false)}>취소</button>
                  <button type="submit" className="btn btn-primary" disabled={addressLoading || !selectedKakaoPlace}>
                    {addressLoading ? <><div className="spinner spinner-sm" /> 처리 중...</> : '등록 신청하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
