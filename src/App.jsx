import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import { addCongestionToAllStores, formatCongestionInfo } from './utils/seoulCityData';
import Auth from './components/Auth';
import AIAssistant from './components/AIAssistant';
import Admin from './components/Admin';
import { supabase } from './lib/supabase';

const KAKAO_MAP_KEY = '15dec95eb60278894a9e834e679af110';
const ADMIN_EMAIL = 'dany4274@naver.com';

const CATEGORIES = {
  popmart: { name: '팝마트', color: '#FF6B6B', emoji: '🧸' },
  buttertteok: { name: '버터떡', color: '#4ECDC4', emoji: '🧈' },
  twochoco: { name: '두쫀쿠', color: '#45B7D1', emoji: '🍫' },
  fashion: { name: '한정판 패션', color: '#96CEB4', emoji: '👕' },
  popup: { name: '팝업스토어', color: '#FECA57', emoji: '🏪' }
};

const STOCK_STATUS = {
  여유: { color: '#28a745', name: '여유' },
  소량: { color: '#ffc107', name: '소량' },
  품절: { color: '#dc3545', name: '품절' }
};

function App() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [spotPoints, setSpotPoints] = useState(0);
  const [map, setMap] = useState(null);
  const [stores, setStores] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showAddStoreForm, setShowAddStoreForm] = useState(false);
  const [reportData, setReportData] = useState({ itemName: '', status: '여유', quantity: '' });
  const [storeData, setStoreData] = useState({ name: '', category: 'popmart', address: '' });
  const [addressLoading, setAddressLoading] = useState(false);
  const [loadingCongestion, setLoadingCongestion] = useState(false);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  const [kakaoLoaded, setKakaoLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
    if (kakaoLoaded && !mapRef.current) {
      initializeMap();
    }
  }, [kakaoLoaded]);

  // 카테고리 변경시 줌 유지하면서 마커만 교체
  useEffect(() => {
    if (!mapRef.current || !kakaoLoaded) return;
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (activeCategory) {
      const filteredStores = stores.filter(store =>
        store.category === activeCategory && store.status === 'approved'
      );
      filteredStores.forEach(store => createMarker(mapRef.current, store));
    }
  }, [activeCategory, stores, stocks]);

  useEffect(() => {
    const stocksSubscription = supabase
      .channel('stocks_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, () => loadStoresAndStocks())
      .subscribe();
    return () => { stocksSubscription.unsubscribe(); };
  }, []);

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const updateNearbyStores = (loc, storeList) => {
    const list = storeList || stores;
    const withDistance = list
      .map(store => ({ ...store, distance: calculateDistance(loc.lat, loc.lng, store.lat, store.lng) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
    setNearbyStores(withDistance);
  };

  const loadStoresAndStocks = async () => {
    try {
      setLoadingCongestion(true);
      const { data: storesData, error: storesError } = await supabase.from('stores').select('*');
      if (storesError) throw storesError;
      const { data: stocksData, error: stocksError } = await supabase
        .from('stocks').select('*').order('reported_at', { ascending: false });
      if (stocksError) throw stocksError;

      const seoulStores = storesData.filter(store =>
        store.address?.includes('서울') ||
        (store.lat >= 37.4 && store.lat <= 37.7 && store.lng >= 126.8 && store.lng <= 127.2)
      );
      let storesWithCongestion = storesData;
      if (seoulStores.length > 0) {
        try {
          const updatedSeoulStores = await addCongestionToAllStores(seoulStores);
          storesWithCongestion = storesData.map(store => {
            const updatedStore = updatedSeoulStores.find(s => s.id === store.id);
            return updatedStore || store;
          });
        } catch (error) { console.error('혼잡도 로드 실패:', error); }
      }
      setStores(storesWithCongestion);
      setStocks(stocksData);
      setUserLocation(prev => {
        if (prev) updateNearbyStores(prev, storesWithCongestion);
        return prev;
      });
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoadingCongestion(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(loc);
          updateNearbyStores(loc);
        },
        () => {
          const defaultLoc = { lat: 37.5665, lng: 126.9780 };
          setUserLocation(defaultLoc);
          updateNearbyStores(defaultLoc);
        }
      );
    } else {
      const defaultLoc = { lat: 37.5665, lng: 126.9780 };
      setUserLocation(defaultLoc);
      updateNearbyStores(defaultLoc);
    }
  };

  const moveToMyLocation = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.setCenter(new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng));
      mapRef.current.setLevel(3);
    }
  };

  const initializeMap = () => {
    if (!mapContainerRef.current) return;
    if (!window.kakao?.maps) return;
    const center = userLocation
      ? new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
      : new window.kakao.maps.LatLng(37.5665, 126.9780);
    const mapInstance = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 3 });
    setMap(mapInstance);
    mapRef.current = mapInstance;
    if (userLocation) {
      const myMarkerImage = new window.kakao.maps.MarkerImage(
        `data:image/svg+xml;utf8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="#4285F4" stroke="#fff" stroke-width="3"/>
            <circle cx="12" cy="12" r="4" fill="#fff"/>
          </svg>
        `)}`,
        new window.kakao.maps.Size(24, 24),
        { offset: new window.kakao.maps.Point(12, 12) }
      );
      new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        image: myMarkerImage,
        map: mapInstance
      });
    }
  };

  const createMarker = (mapInstance, store) => {
    const position = new window.kakao.maps.LatLng(store.lat, store.lng);
    const latestStock = stocks
      .filter(stock => stock.store_id === store.id)
      .sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at))[0];
    const status = latestStock?.status || '품절';
    const statusColor = STOCK_STATUS[status]?.color || '#dc3545';
    const emoji = CATEGORIES[store.category]?.emoji || '📍';
    let opacity = 1;
    if (latestStock) {
      const hoursAgo = (Date.now() - new Date(latestStock.reported_at)) / (1000 * 60 * 60);
      if (hoursAgo > 24) opacity = 0.3;
      else if (hoursAgo > 12) opacity = 0.5;
      else if (hoursAgo > 6) opacity = 0.7;
      else if (hoursAgo > 2) opacity = 0.85;
    }
    const markerImageSrc = `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" opacity="${opacity}">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 16 16 24 16 24s16-8 16-24C32 7.2 24.8 0 16 0z" fill="${statusColor}" stroke="#fff" stroke-width="2"/>
        <circle cx="16" cy="16" r="8" fill="#fff"/>
        <text x="16" y="20" text-anchor="middle" font-size="12" font-weight="bold" fill="${statusColor}">${emoji}</text>
      </svg>
    `)}`;
    const markerImage = new window.kakao.maps.MarkerImage(
      markerImageSrc, new window.kakao.maps.Size(32, 40),
      { offset: new window.kakao.maps.Point(16, 40) }
    );
    const marker = new window.kakao.maps.Marker({ position, image: markerImage });
    marker.setMap(mapInstance);
    markersRef.current.push(marker);
    window.kakao.maps.event.addListener(marker, 'click', () => {
      setSelectedStore(store);
      showInfoWindow(mapInstance, marker, store, latestStock);
    });
  };

  const showInfoWindow = (mapInstance, marker, store, latestStock) => {
    if (infoWindowRef.current) infoWindowRef.current.close();
    const congestionInfo = store.congestion ? formatCongestionInfo(store.congestion) : null;
    const distanceText = store.distance
      ? store.distance < 1 ? `${Math.round(store.distance * 1000)}m` : `${store.distance.toFixed(1)}km`
      : null;
    const infoContent = `
      <div class="info-window">
        <div class="info-header">
          <h3>${store.name}</h3>
          <span class="category-badge">${CATEGORIES[store.category]?.name}</span>
          ${distanceText ? `<span class="distance-badge">📍 ${distanceText}</span>` : ''}
        </div>
        ${congestionInfo ? `
          <div class="congestion-info">
            <div class="congestion-badge" style="background-color: ${congestionInfo.color}">${congestionInfo.icon} ${congestionInfo.level}</div>
            <div class="congestion-details">
              <div class="population">추정 인구: ${congestionInfo.population}</div>
              <div class="location-info">${congestionInfo.locationName} 기준 (${congestionInfo.distance})</div>
            </div>
          </div>` : ''}
        <div class="stock-info">
          ${latestStock ? `
            <div class="stock-item">
              <span class="item-name">${latestStock.item_name}</span>
              <span class="stock-status ${latestStock.status}" style="background-color: ${STOCK_STATUS[latestStock.status]?.color}">${latestStock.status}</span>
            </div>
            <div class="stock-quantity">수량: ${latestStock.quantity}개</div>
            <div class="update-time">${new Date(latestStock.reported_at).toLocaleDateString('ko-KR')} ${new Date(latestStock.reported_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}</div>
          ` : `<div class="no-stock">재고 정보 없음</div>`}
        </div>
        <div class="info-actions">
          <button class="btn btn-report" onclick="window.showReportForm('${store.id}')">재고 제보하기</button>
        </div>
      </div>
    `;
    const infoWindow = new window.kakao.maps.InfoWindow({ content: infoContent, removable: true });
    infoWindow.open(mapInstance, marker);
    infoWindowRef.current = infoWindow;
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); setShowSearchResults(false); return; }
    const results = stores.filter(store =>
      store.name?.toLowerCase().includes(query.toLowerCase()) ||
      store.address?.toLowerCase().includes(query.toLowerCase()) ||
      stocks.filter(s => s.store_id === store.id).some(s => s.item_name?.toLowerCase().includes(query.toLowerCase()))
    );
    setSearchResults(results);
    setShowSearchResults(true);
  };

  const handleSearchSelect = (store) => {
    setShowSearchResults(false);
    setSearchQuery(store.name);
    if (mapRef.current) {
      mapRef.current.setCenter(new window.kakao.maps.LatLng(store.lat, store.lng));
      mapRef.current.setLevel(3);
      const latestStock = stocks.filter(s => s.store_id === store.id).sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at))[0];
      createMarker(mapRef.current, store);
      showInfoWindow(mapRef.current, null, store, latestStock);
    }
  };

  // 주소 → 좌표 변환
  const searchAddressToCoords = (address) => {
    return new Promise((resolve, reject) => {
      if (!window.kakao?.maps?.services) { reject('카카오맵 서비스 로드 안됨'); return; }
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
        } else {
          reject('주소를 찾을 수 없어요.');
        }
      });
    });
  };

  useEffect(() => {
    window.showReportForm = (storeId) => {
      if (!user) { setShowAuthModal(true); if (infoWindowRef.current) infoWindowRef.current.close(); return; }
      setSelectedStore(stores.find(store => store.id === storeId));
      setShowReportForm(true);
      if (infoWindowRef.current) infoWindowRef.current.close();
    };
  }, [stores, user]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    if (!selectedStore || !reportData.itemName.trim()) { alert('아이템명을 입력해주세요.'); return; }
    try {
      const { error } = await supabase.from('stocks').insert({
        store_id: selectedStore.id,
        item_name: reportData.itemName.trim(),
        status: reportData.status,
        quantity: parseInt(reportData.quantity) || 0,
        reported_by: user?.id || 'anonymous',
        reported_at: new Date().toISOString()
      });
      if (error) throw error;
      alert('재고 제보 완료! +10 스팟 포인트 ⭐');
      setSpotPoints(prev => prev + 10);
      setShowReportForm(false);
      setReportData({ itemName: '', status: '여유', quantity: '' });
    } catch (error) { alert('재고 제보에 실패했습니다.'); }
  };

  const handleAddStore = async (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    setAddressLoading(true);
    try {
      const coords = await searchAddressToCoords(storeData.address);
      const { error } = await supabase.from('stores').insert({
        name: storeData.name.trim(),
        category: storeData.category,
        address: storeData.address.trim(),
        lat: coords.lat,
        lng: coords.lng,
        status: 'pending',
        owner_id: user.id,
        owner_email: user.email
      });
      if (error) throw error;
      alert('가게 등록 신청이 완료됐어요! 관리자 승인 후 표시됩니다 😊');
      setShowAddStoreForm(false);
      setStoreData({ name: '', category: 'popmart', address: '' });
    } catch (error) {
      alert(typeof error === 'string' ? error : '가게 등록에 실패했습니다.');
    } finally {
      setAddressLoading(false);
    }
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
            <button className="logout-btn" onClick={() => setShowAdminPage(false)}>← 돌아가기</button>
          </div>
        </header>
        <Admin user={user} />
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

      <header className="header">
        <div className="header-content">
          <h1 className="logo">📍 TrendSpot</h1>
          <div className="header-right">
            {user ? (
              <>
                <span className="user-nickname">
                  {user?.user_metadata?.nickname || user?.user_metadata?.name || user?.email?.split('@')[0]}
                  {spotPoints > 0 && <span className="spot-points">⭐ {spotPoints}P</span>}
                </span>
                {user.email === ADMIN_EMAIL && (
                  <button className="admin-btn" onClick={() => setShowAdminPage(true)}>🔧</button>
                )}
                <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
              </>
            ) : (
              <button className="login-btn" onClick={() => setShowAuthModal(true)}>로그인</button>
            )}
          </div>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 가게명, 주소, 아이템 검색..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
          />
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(store => {
                const latestStock = stocks.filter(s => s.store_id === store.id).sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at))[0];
                return (
                  <div key={store.id} className="search-result-item" onClick={() => handleSearchSelect(store)}>
                    <span className="search-emoji">{CATEGORIES[store.category]?.emoji}</span>
                    <div>
                      <div className="search-name">{store.name}</div>
                      <div className="search-address">{store.address}</div>
                      {latestStock && <div className="search-stock">{latestStock.item_name} · {latestStock.status}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="header-subtitle">
          실시간 트렌드 재고 공유 플랫폼
          {loadingCongestion && <span className="loading-indicator">업데이트 중...</span>}
        </div>
      </header>

      <nav className="category-tabs">
        {Object.entries(CATEGORIES).map(([key, category]) => (
          <button
            key={key}
            className={`tab ${activeCategory === key ? 'active' : ''}`}
            onClick={() => setActiveCategory(activeCategory === key ? null : key)}
            style={{
              backgroundColor: activeCategory === key ? category.color : 'transparent',
              color: activeCategory === key ? 'white' : category.color
            }}
          >
            {category.emoji} {category.name}
          </button>
        ))}
        <button className="tab add-store-tab"
          onClick={() => user ? setShowAddStoreForm(true) : setShowAuthModal(true)}>
          ➕ 가게 등록
        </button>
      </nav>

      {!activeCategory && (
        <div className="category-hint">카테고리를 선택하면 매장이 표시돼요 👆</div>
      )}

      <main className="map-container">
        <div ref={mapContainerRef} className="kakao-map" />
        <div className="legend">
          <div className="legend-title">재고 상태</div>
          {Object.entries(STOCK_STATUS).map(([status, config]) => (
            <div key={status} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: config.color }} />
              <span>{config.name}</span>
            </div>
          ))}
        </div>
        <button className="my-location-btn" onClick={moveToMyLocation}>📍</button>
      </main>

      <div className={`nearby-panel ${showNearbyPanel ? 'open' : ''}`}>
        <div className="nearby-panel-header" onClick={() => setShowNearbyPanel(!showNearbyPanel)}>
          <span>📍 내 주변 매장</span>
          <span className="nearby-count">{nearbyStores.length}개</span>
          <div style={{ flex: 1 }} />
          <span className="panel-arrow">{showNearbyPanel ? '▼' : '▲'}</span>
        </div>
        {showNearbyPanel && (
          <div className="nearby-list">
            {nearbyStores.length === 0 ? (
              <div className="no-nearby">위치 정보를 불러오는 중...</div>
            ) : (
              nearbyStores.map((store, index) => {
                const latestStock = stocks.filter(s => s.store_id === store.id).sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at))[0];
                const status = latestStock?.status || '정보없음';
                const statusColor = STOCK_STATUS[status]?.color || '#999';
                return (
                  <div key={store.id} className="nearby-item" onClick={() => {
                    if (mapRef.current) {
                      mapRef.current.setCenter(new window.kakao.maps.LatLng(store.lat, store.lng));
                      mapRef.current.setLevel(3);
                    }
                    setShowNearbyPanel(false);
                  }}>
                    <span className="nearby-rank">#{index + 1}</span>
                    <span className="nearby-emoji">{CATEGORIES[store.category]?.emoji}</span>
                    <div className="nearby-info">
                      <div className="nearby-name">{store.name}</div>
                      <div className="nearby-meta">
                        {store.distance < 1 ? `${Math.round(store.distance * 1000)}m` : `${store.distance.toFixed(1)}km`}
                        {latestStock && ` · ${latestStock.item_name}`}
                      </div>
                    </div>
                    <span className="nearby-status" style={{ backgroundColor: statusColor }}>{status}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

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
              <div className="store-info">
                <h4>{selectedStore.name}</h4>
                <p>{selectedStore.address}</p>
                <span className="category-badge">{CATEGORIES[selectedStore.category]?.name}</span>
              </div>
              <form onSubmit={handleSubmitReport} className="report-form">
                <div className="form-group">
                  <label>아이템명 *</label>
                  <input type="text" value={reportData.itemName}
                    onChange={e => setReportData(prev => ({ ...prev, itemName: e.target.value }))}
                    placeholder="예: 라부부 크리미 캐릭터" required />
                </div>
                <div className="form-group">
                  <label>재고 상태 *</label>
                  <select value={reportData.status}
                    onChange={e => setReportData(prev => ({ ...prev, status: e.target.value }))}>
                    <option value="여유">🟢 여유</option>
                    <option value="소량">🟡 소량</option>
                    <option value="품절">🔴 품절</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>수량 (선택)</label>
                  <input type="number" min="0" value={reportData.quantity}
                    onChange={e => setReportData(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="예: 5" />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-cancel" onClick={() => setShowReportForm(false)}>취소</button>
                  <button type="submit" className="btn btn-primary">제보하기</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 가게 등록 폼 */}
      {showAddStoreForm && (
        <div className="modal-overlay" onClick={() => setShowAddStoreForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🏪 가게 등록 신청</h3>
              <button className="close-btn" onClick={() => setShowAddStoreForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize: '13px', color: '#888', marginBottom: '12px'}}>
                관리자 승인 후 지도에 표시됩니다 😊
              </p>
              <form onSubmit={handleAddStore} className="report-form">
                <div className="form-group">
                  <label>가게명 *</label>
                  <input type="text" value={storeData.name}
                    onChange={e => setStoreData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 내 팝마트 가게" required />
                </div>
                <div className="form-group">
                  <label>카테고리 *</label>
                  <select value={storeData.category}
                    onChange={e => setStoreData(prev => ({ ...prev, category: e.target.value }))}>
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.emoji} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>주소 *</label>
                  <input type="text" value={storeData.address}
                    onChange={e => setStoreData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="예: 서울시 강남구 강남대로 123" required />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-cancel" onClick={() => setShowAddStoreForm(false)}>취소</button>
                  <button type="submit" className="btn btn-primary" disabled={addressLoading}>
                    {addressLoading ? '주소 변환 중...' : '등록 신청하기'}
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