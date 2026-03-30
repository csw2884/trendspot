import StatsDashboard from './components/StatsDashboard';
import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import Onboarding from './components/Onboarding';
import UserProfile from './components/UserProfile';

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
  const [reportData, setReportData] = useState({ itemName: '', status: '여유', quantity: '', showOtherItems: false });
  const [storeData, setStoreData] = useState({ name: '', category: 'popmart', address: '', lat: null, lng: null });
  const [customStoreName, setCustomStoreName] = useState('');
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
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('trendspot_onboarded'));
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('trendspot_dark') === 'true');
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [storeSearchResults, setStoreSearchResults] = useState([]);
  const [selectedKakaoPlace, setSelectedKakaoPlace] = useState(null);
  const [storeSearchLoading, setStoreSearchLoading] = useState(false);
  // ✅ 모바일 제보: GPS 로딩 상태
  const [locationLoading, setLocationLoading] = useState(false);

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
    script.onload = () => { window.kakao.maps.load(() => setKakaoLoaded(true)); };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (kakaoLoaded && !mapRef.current) setTimeout(() => initializeMap(), 300);
  }, [kakaoLoaded]);

  // ✅ 관리자 페이지에서 돌아올 때 지도 재초기화
  useEffect(() => {
    if (!showAdminPage && kakaoLoaded) {
      setTimeout(() => {
        if (!mapRef.current && mapContainerRef.current) {
          initializeMap();
        }
      }, 400);
    }
  }, [showAdminPage]);

  useEffect(() => {
    if (!mapRef.current) return;
    updateMarkers();
  }, [selectedTrend, stores, stocks]);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('trendspot_dark', darkMode);
  }, [darkMode]);

  useEffect(() => { calculateTrends(); }, [stocks]);

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
      .sort((a, b) => b.score - a.score).slice(0, 5);
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
    } catch (e) { console.error('데이터 로드 실패:', e); }
    finally { setLoadingCongestion(false); }
  };

  const checkAdmin = async (email) => {
    const { data } = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
    setIsAdmin(!!data);
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: 37.5665, lng: 126.9780 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation({ lat: 37.5665, lng: 126.9780 }),
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // ✅ 모바일 제보: GPS를 강제로 새로 가져오는 함수
  const getFreshLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(userLocation || { lat: 37.5665, lng: 126.9780 });
        return;
      }
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setLocationLoading(false);
          resolve(loc);
        },
        () => {
          setLocationLoading(false);
          resolve(userLocation || { lat: 37.5665, lng: 126.9780 });
        },
        { timeout: 8000, maximumAge: 30000, enableHighAccuracy: true }
      );
    });
  };

  const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
      new window.kakao.maps.Size(24, 24), { offset: new window.kakao.maps.Point(12, 12) }
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
      new window.kakao.maps.Size(48, 56), { offset: new window.kakao.maps.Point(24, 56) }
    );
    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(store.lat, store.lng),
      image: markerImage, map: mapInstance
    });
    markersRef.current.push(marker);
    window.kakao.maps.event.addListener(marker, 'click', () => {
      setSelectedStore(store); setShowStoreDetail(true);
    });
  };

  const handleSelectTrend = (trendName) => {
    setSelectedTrend(prev => prev === trendName ? null : trendName);
  };

  // ✅ 검색: 아이템은 재고있는 가게 수 표시
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); setShowSearchResults(false); return; }
    const storeResults = stores.filter(store =>
      store.name?.toLowerCase().includes(query.toLowerCase()) ||
      store.address?.toLowerCase().includes(query.toLowerCase())
    ).map(store => ({ type: 'store', data: store }));

    const itemMap = {};
    stocks.forEach(stock => {
      if (!stock.item_name?.toLowerCase().includes(query.toLowerCase())) return;
      const key = stock.item_name;
      if (!itemMap[key]) itemMap[key] = { item_name: key, storeIds: new Set(), hasStock: 0 };
      itemMap[key].storeIds.add(stock.store_id);
      if (stock.status !== '품절') itemMap[key].hasStock++;
    });
    const itemResults = Object.values(itemMap).map(item => ({
      type: 'item', data: { item_name: item.item_name },
      storeCount: item.storeIds.size, hasStock: item.hasStock
    }));

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

  const searchKakaoPlaces = (query) => {
    setStoreSearchQuery(query);
    setSelectedKakaoPlace(null);
    setCustomStoreName('');
    if (!query.trim()) { setStoreSearchResults([]); return; }
    if (!window.kakao?.maps?.services) return;
    setStoreSearchLoading(true);
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(query, (result, status) => {
      setStoreSearchLoading(false);
      if (status === window.kakao.maps.services.Status.OK) setStoreSearchResults(result.slice(0, 8));
      else setStoreSearchResults([]);
    });
  };

  // ✅ 위치만 가져오고 이름은 직접 입력
  const handleSelectKakaoPlace = (place) => {
    setSelectedKakaoPlace(place);
    setStoreSearchQuery(place.road_address_name || place.address_name);
    setStoreSearchResults([]);
    setCustomStoreName('');
    setStoreData(prev => ({
      ...prev,
      name: '',
      address: place.road_address_name || place.address_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x)
    }));
  };

  const uploadImage = async (file) => {
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
    if (!selectedKakaoPlace) { alert('위치를 검색해서 선택해주세요!'); return; }
    if (!customStoreName.trim()) { alert('가게 이름을 입력해주세요!'); return; }
    setAddressLoading(true);
    try {
      let imageUrl = null;
      if (storeImage) {
        try { imageUrl = await uploadImage(storeImage); }
        catch (imgError) { console.error('이미지 업로드 실패:', imgError); }
      }
      const { error } = await supabase.from('stores').insert({
        name: customStoreName.trim(),
        category: storeData.category,
        address: storeData.address.trim(),
        lat: storeData.lat, lng: storeData.lng,
        status: 'pending', owner_id: user.id,
        owner_email: user.email, image_url: imageUrl
      });
      if (error) throw error;
      alert('가게 등록 신청 완료! 관리자 승인 후 표시됩니다 😊');
      setShowAddStoreForm(false);
      setStoreData({ name: '', category: 'popmart', address: '', lat: null, lng: null });
      setStoreSearchQuery(''); setSelectedKakaoPlace(null);
      setStoreImage(null); setCustomStoreName('');
    } catch (error) {
      alert('가게 등록에 실패했습니다: ' + error.message);
    } finally { setAddressLoading(false); }
  };

  const addPoints = async (userId, points) => {
    const { data } = await supabase.from('user_points').select('*').eq('user_id', userId).single();
    if (data) {
      await supabase.from('user_points').update({
        points: data.points + points, total_points: data.total_points + points,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
      setSpotPoints(data.points + points);
    } else {
      await supabase.from('user_points').insert({
        user_id: userId, points, total_points: points, updated_at: new Date().toISOString()
      });
      setSpotPoints(points);
    }
  };

  // ✅ 모바일 제보: GPS를 제보 시점에 새로 가져와서 정확도 향상
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!user) { setShowAuthModal(true); return; }
    if (!selectedStore || !reportData.itemName.trim()) { alert('아이템을 선택해주세요.'); return; }

    // GPS 새로 가져오기 (모바일 정확도 향상)
    const freshLocation = await getFreshLocation();

    const distance = getDistance(freshLocation.lat, freshLocation.lng, selectedStore.lat, selectedStore.lng);
    if (distance > 100) {
      alert(`📍 가게에서 ${Math.round(distance)}m 떨어져 있어요.\n직접 방문 후 100m 이내에서만 제보할 수 있어요!`);
      return;
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: todayLogs } = await supabase.from('activity_logs').select('*')
      .eq('user_id', user.id).eq('action', 'stock_report').gte('created_at', today.toISOString());
    const userPoints = await supabase.from('user_points').select('points').eq('user_id', user.id).single();
    const pts = userPoints?.data?.points || 0;
    const dailyLimit = pts >= 300 ? 10 : pts >= 100 ? 5 : 3;
    if (todayLogs && todayLogs.length >= dailyLimit) {
      alert(`오늘 제보 횟수(${dailyLimit}회)를 모두 사용했어요.\n등급을 올리면 더 많이 제보할 수 있어요! 😊`);
      return;
    }

    try {
      await supabase.from('stocks').insert({
        store_id: selectedStore.id, item_name: reportData.itemName.trim(),
        status: reportData.status, quantity: parseInt(reportData.quantity) || 0,
        reported_by: user.id, reported_at: new Date().toISOString()
      });
      await supabase.from('activity_logs').insert({
        user_id: user.id, action: 'stock_report', target_id: selectedStore.id
      });
      await addPoints(user.id, 10);
      const remaining = dailyLimit - (todayLogs?.length || 0) - 1;
      alert(`재고 제보 완료! +10 스팟 포인트 ⭐\n오늘 남은 제보 횟수: ${remaining}회`);
      setShowReportForm(false);
      setReportData({ itemName: '', status: '여유', quantity: '', showOtherItems: false });
      loadStoresAndStocks();
    } catch (e) { console.error(e); alert('제보 실패했습니다.'); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setSpotPoints(0);
  };

  // ✅ 관리자 뒤로가기: 지도 ref 초기화 후 재렌더링
  const handleBackFromAdmin = () => {
    mapRef.current = null;
    markersRef.current = [];
    setShowAdminPage(false);
  };

  if (showAdminPage) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-content">
            <h1 className="logo">🏷️ 있템</h1>
            <button className="btn btn-ghost btn-pill" onClick={handleBackFromAdmin}>← 돌아가기</button>
          </div>
        </header>
        <Admin user={user} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div className="app">
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}

      {/* ✅ 모바일 모달 CSS 수정 */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
          }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px' }}>
            <Auth onLogin={(u) => { setUser(u); setShowAuthModal(false); }} />
          </div>
        </div>
      )}

      {showStoreDetail && selectedStore && (
        <StoreDetail store={selectedStore} stocks={stocks}
          onClose={() => setShowStoreDetail(false)}
          onReport={(store) => {
            if (!user) { setShowStoreDetail(false); setShowAuthModal(true); return; }
            setSelectedStore(store); setShowStoreDetail(false); setShowReportForm(true);
          }}
          selectedTrend={selectedTrend} user={user} />
      )}
      {showOwnerDashboard && user && <OwnerDashboard user={user} onClose={() => setShowOwnerDashboard(false)} />}
      {showUserProfile && user && <UserProfile user={user} onClose={() => setShowUserProfile(false)} />}
      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}

      <header className="header">
        <div className="header-content">
          <h1 className="logo">🏷️ 있템</h1>
          <div className="header-right">
            {user ? (
              <>
                <span className="user-nickname" onClick={() => setShowUserProfile(true)} style={{ cursor: 'pointer' }}>
                  {user?.user_metadata?.nickname || user?.email?.split('@')[0]}
                  {spotPoints > 0 && <span className="point-badge">⚡ {spotPoints}P</span>}
                </span>
                {isAdmin && <button className="btn btn-icon admin-btn" onClick={() => setShowAdminPage(true)}>🔧</button>}
                <button className="btn btn-icon owner-btn" onClick={() => setShowOwnerDashboard(true)}>🏪</button>
                <button className="btn btn-secondary btn-pill" style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => setShowAddStoreForm(true)}>+ 가게 등록</button>
                <button className="btn btn-ghost btn-pill" onClick={() => setShowPricing(true)}>💎 요금제</button>
                <button className="btn btn-ghost btn-pill" onClick={() => setDarkMode(d => !d)}>{darkMode ? '☀️' : '🌙'}</button>
                <button className="btn btn-ghost btn-pill" onClick={handleLogout}>로그아웃</button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary btn-pill" style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => setShowAuthModal(true)}>+ 가게 등록</button>
                <button className="btn btn-primary btn-pill" onClick={() => setShowAuthModal(true)}>로그인</button>
              </>
            )}
          </div>
        </div>

        <div className="search-container">
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--ts-text-muted)' }}>
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input type="text" placeholder="가게명, 메뉴, 아이템 검색..."
              value={searchQuery} onChange={e => handleSearch(e.target.value)} />
            {loadingCongestion && <div className="spinner spinner-sm" />}
          </div>
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result, i) => (
                <div key={i} className="search-result-item" onClick={() => handleSearchSelect(result)}>
                  <span className="search-emoji">{result.type === 'store' ? '🏪' : '📦'}</span>
                  <div>
                    <div className="search-name">
                      {result.type === 'store' ? result.data.name : result.data.item_name}
                    </div>
                    {/* ✅ 아이템: 재고 있는 가게 수 표시 */}
                    <div className="search-address">
                      {result.type === 'store' ? result.data.address : `재고 있는 매장 ${result.hasStock}곳`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="header-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>🔥 있어? 있템! 실시간 트렌드 재고 공유 플랫폼</span>
          <OnlineCounter />
        </div>
      </header>

      <TrendAI trends={trends} stocks={stocks} user={user} />
      <StatsDashboard stores={stores} stocks={stocks} trends={trends} />

      <div className="trend-bar">
        <span className="trend-bar-title">🔥 TOP</span>
        {trends.length === 0 ? (
          [1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton skeleton-trend-chip" />)
        ) : (
          trends.map((item, index) => (
            <button key={item.name}
              className={`trend-chip ${selectedTrend === item.name ? 'active' : ''}`}
              onClick={() => handleSelectTrend(item.name)}>
              <span className="rank-num">{index + 1}</span>
              <span>{item.name}</span>
            </button>
          ))
        )}
      </div>

      {selectedTrend && (
        <div className="trend-filter-bar">
          <span>🔍 <strong>{selectedTrend}</strong> 재고 있는 매장</span>
          <button className="btn btn-ghost btn-pill" style={{ fontSize: '12px', padding: '4px 12px' }}
            onClick={() => setSelectedTrend(null)}>✕ 초기화</button>
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
        <div className="modal-overlay" onClick={() => setShowReportForm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3>📝 재고 제보</h3>
              <button className="close-btn" onClick={() => setShowReportForm(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <div className="store-info-box">
                <h4>{selectedStore.name}</h4>
                <p>{selectedStore.address}</p>
              </div>
              <div style={{ padding: '8px 12px', marginBottom: '12px', background: '#FFF9E6', borderRadius: '8px', fontSize: '12px', color: '#856404' }}>
                📍 가게 100m 이내에서만 제보 가능 · 하루 3회 제한
                {locationLoading && <span style={{ marginLeft: '8px', color: '#1E90FF' }}>📡 위치 확인 중...</span>}
              </div>
              <form onSubmit={handleSubmitReport} className="report-form">
                <div className="form-group">
                  <label className="input-label">아이템명 *</label>
                  {(() => {
                    const storeItems = [...new Set(stocks.filter(s => s.store_id === selectedStore?.id).map(s => s.item_name))];
                    const selectedItems = selectedTrend ? storeItems.filter(name => name.toLowerCase().includes(selectedTrend.toLowerCase())) : storeItems;
                    const otherItems = storeItems.filter(name => !selectedItems.includes(name));
                    return (
                      <>
                        {selectedItems.length > 0 && (
                          <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {selectedItems.map(name => (
                              <button key={name} type="button"
                                onClick={() => setReportData(prev => ({ ...prev, itemName: name }))}
                                style={{ fontSize: '12px', padding: '4px 10px', background: reportData.itemName === name ? 'var(--ts-primary)' : '#f0f0f0', color: reportData.itemName === name ? 'white' : '#555', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>
                                {name}
                              </button>
                            ))}
                            {otherItems.length > 0 && (
                              <button type="button"
                                onClick={() => setReportData(prev => ({ ...prev, showOtherItems: !prev.showOtherItems }))}
                                style={{ fontSize: '12px', padding: '4px 10px', background: 'none', color: '#999', border: '1px dashed #ddd', borderRadius: '20px', cursor: 'pointer' }}>
                                + 다른 재고 {otherItems.length}개 보기
                              </button>
                            )}
                          </div>
                        )}
                        {reportData.showOtherItems && (
                          <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {otherItems.map(name => (
                              <button key={name} type="button"
                                onClick={() => setReportData(prev => ({ ...prev, itemName: name }))}
                                style={{ fontSize: '12px', padding: '4px 10px', background: reportData.itemName === name ? 'var(--ts-primary)' : '#f5f5f5', color: reportData.itemName === name ? 'white' : '#888', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedStore?.owner_id === user?.id ? (
                          <input className="input" type="text" value={reportData.itemName}
                            onChange={e => setReportData(prev => ({ ...prev, itemName: e.target.value }))}
                            placeholder="새 아이템 직접 입력 (사장님 전용)" required />
                        ) : (
                          <>
                            {reportData.itemName ? (
                              <div style={{ padding: '8px 12px', background: '#f8f8f8', borderRadius: '8px', fontSize: '13px', color: '#333' }}>
                                ✅ 선택됨: <strong>{reportData.itemName}</strong>
                                <button type="button" onClick={() => setReportData(prev => ({ ...prev, itemName: '' }))}
                                  style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>✕</button>
                              </div>
                            ) : (
                              <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>위 목록에서 아이템을 선택해주세요</p>
                            )}
                            <input type="hidden" value={reportData.itemName} required />
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="form-group">
                  <label className="input-label">재고 상태 *</label>
                  <select className="input" value={reportData.status} onChange={e => setReportData(prev => ({ ...prev, status: e.target.value }))}>
                    <option value="여유">🟢 여유</option>
                    <option value="소량">🟡 소량</option>
                    <option value="품절">🔴 품절</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-label">수량 (선택)</label>
                  <input className="input" type="number" min="0" value={reportData.quantity}
                    onChange={e => setReportData(prev => ({ ...prev, quantity: e.target.value }))} placeholder="예: 5" />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowReportForm(false)}>취소</button>
                  <button type="submit" className="btn btn-primary" disabled={locationLoading}>
                    {locationLoading ? '위치 확인 중...' : <><span>제보하기</span> <span className="badge badge-accent" style={{ marginLeft: '4px' }}>+10P</span></>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 가게 등록 폼 */}
      {showAddStoreForm && (
        <div className="modal-overlay" onClick={() => setShowAddStoreForm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>🏪 가게 등록 신청</h3>
              <button className="close-btn" onClick={() => setShowAddStoreForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--ts-text-secondary)', marginBottom: '16px' }}>관리자 승인 후 지도에 표시됩니다 😊</p>
              <form onSubmit={handleAddStore} className="report-form">
                {/* ✅ 위치 검색 먼저 */}
                <div className="form-group">
                  <label className="input-label">위치 검색 *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type="text" value={storeSearchQuery}
                      onChange={e => searchKakaoPlaces(e.target.value)}
                      placeholder="주소나 건물명으로 검색 (예: 홍대 와우산로)" />
                    {storeSearchLoading && (
                      <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                        <div className="spinner spinner-sm" />
                      </div>
                    )}
                    {storeSearchResults.length > 0 && (
                      <div className="search-results" style={{ position: 'absolute', top: '100%', zIndex: 100 }}>
                        {storeSearchResults.map((place, i) => (
                          <div key={i} className="search-result-item" onClick={() => handleSelectKakaoPlace(place)}>
                            <span className="search-emoji">📍</span>
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
                    <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(46,213,115,0.08)', border: '1px solid rgba(46,213,115,0.3)', borderRadius: 'var(--ts-radius-md)', fontSize: '13px' }}>
                      📍 <strong>{selectedKakaoPlace.road_address_name || selectedKakaoPlace.address_name}</strong>
                    </div>
                  )}
                </div>
                {/* ✅ 가게 이름 직접 입력 */}
                <div className="form-group">
                  <label className="input-label">가게 이름 *</label>
                  <input className="input" type="text" value={customStoreName}
                    onChange={e => setCustomStoreName(e.target.value)}
                    placeholder="예: 홍대 팝마트" required />
                </div>
                <div className="form-group">
                  <label className="input-label">가게 사진 (선택)</label>
                  <input type="file" accept="image/*" onChange={e => setStoreImage(e.target.files[0])} />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddStoreForm(false)}>취소</button>
                  <button type="submit" className="btn btn-primary" disabled={addressLoading || !selectedKakaoPlace || !customStoreName.trim()}>
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
