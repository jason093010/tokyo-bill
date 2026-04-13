import { useState, useEffect } from 'react';
import { 
  Camera, List, BarChart3, Settings, Home, 
  X, Banknote, Target, CalendarDays, MapPin, Edit3, Users, Trash2
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './App.css';

const CAT_COLORS = ['#007AFF', '#FF9500', '#FF2D55', '#34C759', '#AF52DE', '#FF3B30', '#8E8E93'];
const PAY_COLORS = ['#34C759', '#007AFF', '#FF2D55', '#5AC8FA'];

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [history, setHistory] = useState([]);
  
  // ⚙️ 核心設定 
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tripSettings');
    return saved ? JSON.parse(saved) : {
      tripName: '東京之旅',
      startDate: '2026-04-16',
      endDate: '2026-04-21',
      rate: 0.21,
      budget: 200000,
      split: 10,
      schedule: "東京 4/16-4/21" 
    };
  });

  const [recordView, setRecordView] = useState('date'); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  const [isConfirming, setIsConfirming] = useState(false);

  const WORKER_URL = 'https://receipt-parser.jason093010.workers.dev';
  const SUPABASE_REST = 'https://ghgqnwqedfevtklaglok.supabase.co/rest/v1/transactions'; 
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoZ3Fud3FlZGZldnRrbGFnbG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDE4MjAsImV4cCI6MjA5MTU3NzgyMH0.ErjvsqQboBjJgasCBjQhiwxkGpRyrvaMLBuOb2bmpHc';

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${SUPABASE_REST}?order=receipt_date.desc`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      });
      const data = await res.json();
      setHistory(data);
    } catch (e) { console.error("讀取失敗", e); }
  };

  const determineRegion = (dateStr) => {
    const lines = settings.schedule.split('\n');
    for (let line of lines) {
      const parts = line.split(' ');
      if (parts.length >= 2) return parts[0]; 
    }
    return '東京';
  };

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const response = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: reader.result.split(',')[1], payer_avatar: 'Jason' }),
        });
        const result = await response.json();
        if (result.success) {
          const autoRegion = determineRegion(result.data.receipt_date);
          setEditingItem({ 
            ...result.data, 
            location: autoRegion,
            tax_type: result.data.tax_type || '内税',
            payer_avatar: 'Jason'
          });
          setIsConfirming(true);
        }
      } catch (err) { alert("辨識失敗"); }
      finally { setIsProcessing(false); }
    };
  };

  const saveToDB = async (item) => {
    try {
      const res = await fetch(SUPABASE_REST, {
        method: 'POST',
        headers: { 
          'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        fetchData();
        setIsConfirming(false);
        setEditingItem(null);
        setActiveTab('records'); 
      }
    } catch (e) { alert("儲存失敗"); }
  };

  // 🗑️ 新增：刪除單筆資料功能
  const deleteRecord = async (id) => {
    if (!window.confirm('確定要刪除這筆紀錄嗎？')) return;
    try {
      const res = await fetch(`${SUPABASE_REST}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      });
      if (res.ok) {
        fetchData(); // 刪除成功後重新讀取畫面
      } else {
        alert('刪除失敗，請檢查網路連線。');
      }
    } catch (e) { alert('刪除時發生錯誤'); }
  };

  const saveSettings = () => {
    localStorage.setItem('tripSettings', JSON.stringify(settings));
    alert('設定已更新');
  };

  // 🧮 運算邏輯
  const totalJPY = history.reduce((s,i) => s + Number(i.amount_jpy), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayJPY = history.filter(h => h.receipt_date === todayStr).reduce((s,i) => s + Number(i.amount_jpy), 0);
  const budgetPercent = Math.min(Math.round((totalJPY / settings.budget) * 100), 100);
  
  const getTripStatus = () => {
    const start = new Date(settings.startDate);
    const end = new Date(settings.endDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    const totalDays = Math.round((end - start) / 86400000) + 1;
    if (today < start) return `還有 ${Math.ceil((start - today) / 86400000)} 天出發`;
    if (today > end) return `旅程已結束`;
    return `Day ${Math.floor((today - start) / 86400000) + 1} / ${totalDays} 天`;
  };

  // --- 視圖元件 ---
  const HomeView = () => (
    <div className="view fade-in">
      <h1 className="page-title">{settings.tripName}</h1>
      
      <div className="grid-2-home">
        <div className="card dash-card">
          <div className="dash-head"><Banknote size={16} color="#FF9500"/> 今日支出</div>
          <div className="dash-val">¥{todayJPY.toLocaleString()}</div>
          <div className="dash-sub">≈ NT${Math.round(todayJPY * settings.rate).toLocaleString()}</div>
        </div>
        <div className="card dash-card">
          <div className="dash-head"><BarChart3 size={16} color="#007AFF"/> 旅程累計</div>
          <div className="dash-val">¥{totalJPY.toLocaleString()}</div>
          <div className="dash-sub">均分: NT${Math.round((totalJPY * settings.rate) / settings.split).toLocaleString()}</div>
        </div>
        <div className="card dash-card">
          <div className="dash-head"><Target size={16} color="#34C759"/> 預算進度</div>
          <div className="dash-val">{budgetPercent}%</div>
          <div className="progress-bg"><div className="progress-fill" style={{width: `${budgetPercent}%`}}></div></div>
        </div>
        <div className="card dash-card">
          <div className="dash-head"><CalendarDays size={16} color="#FF2D55"/> 旅程狀態</div>
          <div className="dash-val" style={{fontSize: '1.1rem', marginTop: '6px'}}>{getTripStatus()}</div>
        </div>
      </div>

      <h3 className="section-title">今日花費</h3>
      <div className="list-container">
        {history.filter(h => h.receipt_date === todayStr).map((item, i) => (
          <div key={i} className="item-card" onClick={() => { setEditingItem(item); setIsConfirming(true); }}>
            <div className="item-icon-box" style={{background: 'var(--blue-light)', color: 'var(--blue)'}}>
              {item.payer_avatar?.substring(0,1) || '我'}
            </div>
            <div className="item-info">
              <div className="name">{item.shop_name}</div>
              <div className="meta"><span className="tag">{item.category}</span> {item.payment_method} · {item.location}</div>
            </div>
            <div className="item-price">
              <div className="jpy">¥{item.amount_jpy}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <Edit3 size={15} color="var(--text-secondary)" />
                <Trash2 size={15} color="#FF3B30" onClick={(e) => { e.stopPropagation(); deleteRecord(item.id); }} />
              </div>
            </div>
          </div>
        ))}
        {history.filter(h => h.receipt_date === todayStr).length === 0 && <div className="empty-state">今日尚無消費</div>}
      </div>
    </div>
  );

  const RecordsView = () => {
    const grouped = history.reduce((acc, curr) => {
      const key = recordView === 'date' ? curr.receipt_date : (curr.category || '其他');
      acc[key] = acc[key] || [];
      acc[key].push(curr);
      return acc;
    }, {});

    return (
      <div className="view fade-in">
        <div className="card total-banner">
          <div className="sub">旅程總支出</div>
          <div className="val">¥{totalJPY.toLocaleString()}</div>
          <div className="meta">≈ NT${Math.round(totalJPY * settings.rate).toLocaleString()} · {history.length} 筆</div>
        </div>

        <div className="segmented-control">
          <button className={recordView === 'date' ? 'active' : ''} onClick={() => setRecordView('date')}>按日期</button>
          <button className={recordView === 'category' ? 'active' : ''} onClick={() => setRecordView('category')}>按類別</button>
        </div>

        {Object.entries(grouped).sort((a,b) => recordView === 'date' ? b[0].localeCompare(a[0]) : 0).map(([key, items]) => (
          <div key={key} className="date-group">
            <div className="date-header">
              <span className="d-date">{key}</span>
              <span className="d-total">小計 ¥{items.reduce((s,i)=>s+Number(i.amount_jpy),0).toLocaleString()}</span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="item-card shadow" onClick={() => { setEditingItem(item); setIsConfirming(true); }}>
                <div className="item-icon-box" style={{background: 'var(--blue-light)', color: 'var(--blue)'}}>
                  {item.payer_avatar?.substring(0,1) || '我'}
                </div>
                <div className="item-info">
                  <div className="name">{item.shop_name}</div>
                  <div className="meta"><span className="tag">{item.category}</span> {item.payment_method} · {item.tax_type}</div>
                </div>
                <div className="item-price">
                  <div className="jpy">¥{item.amount_jpy}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    <Edit3 size={15} color="var(--text-secondary)" />
                    {/* 🗑️ 點擊垃圾桶時會攔截事件 (stopPropagation)，避免打開編輯視窗 */}
                    <Trash2 size={15} color="#FF3B30" onClick={(e) => { e.stopPropagation(); deleteRecord(item.id); }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const StatsView = () => {
    const processData = (field) => Object.values(history.reduce((acc, curr) => {
      const val = curr[field] || '其他';
      acc[val] = acc[val] || { name: val, value: 0 };
      acc[val].value += Number(curr.amount_jpy);
      return acc;
    }, {})).sort((a,b) => b.value - a.value);

    const catData = processData('category');
    const payData = processData('payment_method');
    const top10 = [...history].sort((a,b) => b.amount_jpy - a.amount_jpy).slice(0, 10);

    const StatBlock = ({ title, data, colors }) => (
      <div className="card stat-card">
        <div className="stat-head">{title} <span className="stat-filter">全部</span></div>
        <div className="stat-body">
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                {data.map((e, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-wrapper">
            {data.map((d, i) => (
              <div key={i} className="leg-item">
                <div className="leg-left">
                  <span className="dot" style={{background: colors[i % colors.length]}}></span>
                  <span className="leg-name">{d.name}</span>
                </div>
                <div className="leg-right">
                  <span className="leg-pct">{Math.round((d.value/(totalJPY||1))*100)}%</span>
                  <span className="leg-val">¥{(d.value/1000).toFixed(1)}k</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    return (
      <div className="view fade-in">
        <h1 className="page-title">統計分析</h1>
        <StatBlock title="分類支出" data={catData} colors={CAT_COLORS} />
        <StatBlock title="支付方式" data={payData} colors={PAY_COLORS} />
        <div className="card">
          <div className="stat-head" style={{marginBottom:'10px'}}>花費金額前十名</div>
          {top10.map((item, i) => (
            <div key={i} className="top-item-row">
              <span className="rank">{i+1}</span>
              <div className="top-info">
                <div className="name">{item.shop_name}</div>
                <div className="meta">{item.receipt_date} · {item.category}</div>
              </div>
              <span className="val">¥{item.amount_jpy.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SettingsView = () => (
    <div className="view fade-in">
      <h1 className="page-title">設定</h1>
      <div className="menu-group">
        <div className="menu-item">
          <span>旅程名稱</span>
          <input className="settings-input" style={{textAlign:'right', width:'150px'}} value={settings.tripName} onChange={e => setSettings({...settings, tripName: e.target.value})} />
        </div>
        <div className="menu-item">
          <span>出發日期</span>
          <input type="date" className="settings-input" value={settings.startDate} onChange={e => setSettings({...settings, startDate: e.target.value})} />
        </div>
        <div className="menu-item">
          <span>結束日期</span>
          <input type="date" className="settings-input" value={settings.endDate} onChange={e => setSettings({...settings, endDate: e.target.value})} />
        </div>
      </div>

      <div className="menu-group" style={{marginTop:'20px'}}>
        <div className="menu-item">
          <span>匯率 (JPY to TWD)</span>
          <input type="number" step="0.001" className="settings-input" value={settings.rate} onChange={e => setSettings({...settings, rate: Number(e.target.value)})} />
        </div>
        <div className="menu-item">
          <span>預算 (JPY)</span>
          <input type="number" className="settings-input" value={settings.budget} onChange={e => setSettings({...settings, budget: Number(e.target.value)})} />
        </div>
        <div className="menu-item">
          <span>分帳人數</span>
          <div className="input-with-icon" style={{width:'80px', paddingRight:'10px'}}>
            <Users size={16} color="var(--text-secondary)" />
            <input type="number" style={{width:'100%', border:'none', background:'transparent', textAlign:'right', outline:'none', color:'var(--text-primary)'}} value={settings.split} onChange={e => setSettings({...settings, split: Number(e.target.value)})} />
          </div>
        </div>
      </div>

      <div className="menu-group" style={{marginTop:'20px'}}>
        <div className="menu-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
          <span style={{marginBottom:'10px'}}>行程地區 (自動判斷用)</span>
          <textarea className="settings-input" style={{width:'100%', height:'80px', textAlign:'left', padding:'10px', background:'var(--bg-color)', borderRadius:'8px'}} 
            value={settings.schedule} onChange={e => setSettings({...settings, schedule: e.target.value})} placeholder="例如:&#10;東京 4/16-4/21"
          />
        </div>
      </div>
      <button className="save-settings-btn" onClick={saveSettings}>儲存設定</button>
    </div>
  );

  if (isProcessing) {
    return (
      <div className="processing-overlay">
        <div className="scan-window"><div className="scan-line"></div></div>
        <h2 style={{color: '#fff', letterSpacing: '1px'}}>AI 正在辨識...</h2>
        <p style={{color: 'rgba(255,255,255,0.7)', fontSize:'0.9rem'}}>擷取收據明細、稅制與折扣</p>
      </div>
    );
  }

  if (isConfirming && editingItem) {
    return (
      <div className="edit-overlay fade-in">
        <nav className="edit-nav blur-header">
          <button className="icon-btn" onClick={() => setIsConfirming(false)}><X size={24} /></button>
          <h2>確認內容</h2>
          <button onClick={() => saveToDB(editingItem)} className="save-btn">儲存</button>
        </nav>
        
        <div className="edit-content">
          <div className="card">
            <div className="edit-group">
              <label>店家名稱</label>
              <input value={editingItem.shop_name} onChange={e => setEditingItem({...editingItem, shop_name: e.target.value})} />
            </div>
            <div className="grid-2">
              <div className="edit-group"><label>日期</label><input type="date" value={editingItem.receipt_date} onChange={e => setEditingItem({...editingItem, receipt_date: e.target.value})} /></div>
              <div className="edit-group"><label>分類</label>
                <select value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})}>
                  <option>餐飲</option><option>購物</option><option>交通</option><option>住宿</option><option>門票</option><option>藥品</option><option>其他</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="edit-group"><label>地區</label>
                <div className="input-with-icon">
                  <MapPin size={16} color="var(--text-secondary)" />
                  <input value={editingItem.location} onChange={e => setEditingItem({...editingItem, location: e.target.value})} />
                </div>
              </div>
              <div className="edit-group"><label>付款方式</label>
                <select value={editingItem.payment_method} onChange={e => setEditingItem({...editingItem, payment_method: e.target.value})}>
                  <option>現金</option><option>信用卡</option><option>PayPay</option><option>Suica</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="edit-group"><label>記帳人 (分帳用)</label>
                <div className="input-with-icon">
                  <Users size={16} color="var(--text-secondary)" />
                  <input value={editingItem.payer_avatar} onChange={e => setEditingItem({...editingItem, payer_avatar: e.target.value})} placeholder="例如：Jason" />
                </div>
              </div>
              <div className="edit-group"><label>稅制</label>
                <select value={editingItem.tax_type} onChange={e => setEditingItem({...editingItem, tax_type: e.target.value})}>
                  <option>内税</option><option>外税</option><option>免税</option>
                </select>
              </div>
            </div>
            <div className="edit-group" style={{marginTop:'10px'}}><label>總額 (JPY)</label>
              <input type="number" style={{fontSize:'1.8rem', fontWeight:'800', color:'var(--blue)'}} value={editingItem.amount_jpy} onChange={e => setEditingItem({...editingItem, amount_jpy: Number(e.target.value)})} />
            </div>
          </div>

          <div className="card">
            <div className="list-header"><h3>購買明細</h3><span className="add-btn" onClick={() => setEditingItem({...editingItem, items: [...(editingItem.items||[]), {translated_name:'', price:0}]})}>+ 新增品項</span></div>
            {editingItem.items && editingItem.items.map((item, idx) => (
              <div key={idx} className="edit-item-row">
                <div className="item-names">
                  <input className="primary-input" placeholder="中文品名" value={item.translated_name} onChange={e => {
                    const newItems = [...editingItem.items];
                    newItems[idx].translated_name = e.target.value;
                    setEditingItem({...editingItem, items: newItems});
                  }} />
                  <div className="secondary-text">{item.original_name}</div>
                </div>
                <div className="item-val">
                  <span className="currency-symbol">¥</span>
                  <input type="number" value={item.price} onChange={e => {
                    const newItems = [...editingItem.items];
                    newItems[idx].price = Number(e.target.value);
                    setEditingItem({...editingItem, items: newItems});
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <main className="main-content">
        {activeTab === 'home' && <HomeView />}
        {activeTab === 'records' && <RecordsView />}
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
      
      <nav className="tab-bar blur-nav">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}><Home size={22} /><span>首頁</span></button>
        <button className={activeTab === 'records' ? 'active' : ''} onClick={() => setActiveTab('records')}><List size={22} /><span>紀錄</span></button>
        <div className="fab-container">
          <label className="scan-fab shadow-lg">
            <Camera size={26} color="#fff" />
            <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
          </label>
        </div>
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}><BarChart3 size={22} /><span>統計</span></button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}><Settings size={22} /><span>設定</span></button>
      </nav>
    </div>
  );
}

export default App;