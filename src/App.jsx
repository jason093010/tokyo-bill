import { useState, useEffect } from 'react';
import { 
  Camera, List, BarChart3, Settings, Home, 
  Trash2, Edit3, Check, X, Loader2, Banknote, ChevronRight
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './App.css';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#5856D6'];
const JPY_TO_TWD = 0.21;

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
    finally { setIsLoading(false); }
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
          setEditingItem({ ...result.data, payment_method: '現金' });
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
          'apikey': ANON_KEY, 
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        fetchData();
        setIsConfirming(false);
        setEditingItem(null);
        setActiveTab('records'); // 儲存後跳轉到紀錄頁
      }
    } catch (e) { alert("儲存失敗"); }
  };

  // --- 視圖元件 ---
  const HomeView = () => (
    <div className="view fade-in">
      <header className="view-header"><h1>總覽</h1></header>
      <div className="main-card">
        <div className="sub-title">旅行總支出</div>
        <div className="total-amount">
          <span className="symbol">¥</span>
          <span className="num">{history.reduce((s,i) => s + Number(i.amount_jpy), 0).toLocaleString()}</span>
        </div>
        <div className="sub-total">≈ NT$ {Math.round(history.reduce((s,i) => s + Number(i.amount_jpy), 0) * JPY_TO_TWD).toLocaleString()} · {history.length} 筆</div>
      </div>
      <div className="section-title"><h3>最新消費</h3></div>
      <div className="quick-list">
        {history.slice(0, 3).map((item, i) => (
          <div key={i} className="item-card" onClick={() => { setEditingItem(item); setIsConfirming(true); }}>
            <div className="item-icon"><Banknote size={20} color="#007AFF" /></div>
            <div className="item-info">
              <div className="name">{item.shop_name}</div>
              <div className="meta">{item.category} · {item.payment_method}</div>
            </div>
            <div className="item-price">
              <div className="jpy">¥{item.amount_jpy}</div>
              <div className="twd">NT${Math.round(item.amount_jpy * JPY_TO_TWD)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const RecordsView = () => (
    <div className="view fade-in">
      <header className="view-header"><h1>所有紀錄</h1></header>
      <div className="list-container">
        {history.map((item, i) => (
          <div key={i} className="item-card shadow" onClick={() => { setEditingItem(item); setIsConfirming(true); }}>
             <div className="item-info">
                <div className="name">{item.shop_name}</div>
                <div className="meta">{item.receipt_date} · {item.payment_method}</div>
              </div>
              <div className="item-price">
                <div className="jpy bold">¥{item.amount_jpy}</div>
                <Edit3 size={14} color="var(--text-secondary)" style={{marginTop:'4px'}} />
              </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ✅ 新增：統計視圖
  const StatsView = () => {
    const catData = Object.values(history.reduce((acc, curr) => {
      const cat = curr.category || '其他';
      acc[cat] = acc[cat] || { name: cat, value: 0 };
      acc[cat].value += Number(curr.amount_jpy);
      return acc;
    }, {}));

    return (
      <div className="view fade-in">
        <header className="view-header"><h1>統計</h1></header>
        <div className="card">
          <h3>分類支出佔比</h3>
          <div style={{ height: '250px', marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {catData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  // ✅ 新增：設定視圖
  const SettingsView = () => (
    <div className="view fade-in">
      <header className="view-header"><h1>設定</h1></header>
      <div className="menu-group">
        <div className="menu-item">
          <span>日幣匯率 (JPY to TWD)</span>
          <span className="value">0.21</span>
        </div>
        <div className="menu-item">
          <span>分帳人數</span>
          <span className="value">10 人</span>
        </div>
        <div className="menu-item">
          <span>資料庫連線</span>
          <span className="value" style={{color: '#34C759'}}>已連線</span>
        </div>
      </div>
    </div>
  );

  // --- 覆蓋層 ---
  if (isProcessing) {
    return (
      <div className="processing-overlay">
        <div className="scan-window"><div className="scan-line"></div></div>
        <h2>AI 正在辨識...</h2>
        <p>擷取收據明細中，請稍候</p>
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
          <div className="edit-group card">
            <label>店家名稱</label>
            <input value={editingItem.shop_name} onChange={e => setEditingItem({...editingItem, shop_name: e.target.value})} />
            
            <div className="grid-2">
              <div><label>日期</label><input type="date" value={editingItem.receipt_date} onChange={e => setEditingItem({...editingItem, receipt_date: e.target.value})} /></div>
              <div><label>支付方式</label>
                <select value={editingItem.payment_method} onChange={e => setEditingItem({...editingItem, payment_method: e.target.value})}>
                  <option>現金</option><option>信用卡</option><option>PayPay</option><option>Suica</option>
                </select>
              </div>
            </div>
          </div>

          <div className="edit-group card">
            <div className="list-header"><h3>購買明細</h3></div>
            {editingItem.items?.map((item, idx) => (
              <div key={idx} className="edit-item-row">
                <div className="item-names">
                  <input className="primary-input" value={item.translated_name} onChange={e => {
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