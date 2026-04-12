import { useState, useEffect } from 'react';
import { 
  Camera, List, BarChart3, Settings, Home, 
  Trash2, Edit3, Check, X, Loader2, CreditCard, Wallet, Banknote, Search, ChevronRight
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './App.css';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#5856D6'];
const JPY_TO_TWD = 0.21;

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 狀態管理：辨識中、確認中、編輯中
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  const [isConfirming, setIsConfirming] = useState(false);

  const WORKER_URL = 'https://receipt-parser.jason093010.workers.dev';
  const SUPABASE_REST = 'https://你的專案ID.supabase.co/rest/v1/transactions'; // ⚠️ 請換成你的專案 URL

  // 🔄 初始化：從資料庫抓取
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${SUPABASE_REST}?order=receipt_date.desc`, {
        headers: { 'apikey': '你的KEY', 'Authorization': 'Bearer 你的KEY' }
      });
      const data = await res.json();
      setHistory(data);
    } catch (e) { console.error("讀取失敗", e); }
    finally { setIsLoading(false); }
  };

  // 📸 掃描辨識
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

  // 💾 儲存/更新到 Supabase
  const saveToDB = async (item) => {
    try {
      const res = await fetch(SUPABASE_REST, {
        method: 'POST',
        headers: { 
          'apikey': '你的KEY', 
          'Authorization': 'Bearer 你的KEY',
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        fetchData();
        setIsConfirming(false);
        setEditingItem(null);
      }
    } catch (e) { alert("儲存失敗"); }
  };

  // --- 視圖元件 ---

  const HomeView = () => (
    <div className="view">
      <header className="view-header">
        <span className="subtitle">查看所有旅行消費</span>
        <h1>旅行總支出</h1>
      </header>
      
      <div className="main-card">
        <div className="total-amount">
          <span className="symbol">¥</span>
          <span className="num">{history.reduce((s,i) => s + Number(i.amount_jpy), 0).toLocaleString()}</span>
        </div>
        <div className="sub-total">≈ NT$ {Math.round(history.reduce((s,i) => s + Number(i.amount_jpy), 0) * JPY_TO_TWD).toLocaleString()} · {history.length} 筆</div>
      </div>

      <div className="section-title">
        <h3>今日花費</h3>
      </div>
      
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
    <div className="view">
      <header className="view-header"><h1>所有紀錄</h1></header>
      {history.map((item, i) => (
        <div key={i} className="item-card shadow" onClick={() => { setEditingItem(item); setIsConfirming(true); }}>
           <div className="item-info">
              <div className="name">{item.shop_name}</div>
              <div className="meta">{item.receipt_date} · {item.payment_method}</div>
            </div>
            <div className="item-price">
              <div className="jpy bold">¥{item.amount_jpy}</div>
              <Edit3 size={14} color="#ccc" />
            </div>
        </div>
      ))}
    </div>
  );

  // --- 覆蓋層：辨識中動畫 ---
  if (isProcessing) {
    return (
      <div className="processing-overlay">
        <div className="scan-window">
          <div className="scan-line"></div>
        </div>
        <h2>AI 正在辨識收據...</h2>
        <p>請稍候，這可能需要幾秒鐘</p>
      </div>
    );
  }

  // --- 覆蓋層：確認/編輯畫面 (1:1 復刻) ---
  if (isConfirming && editingItem) {
    return (
      <div className="edit-overlay">
        <nav className="edit-nav">
          <button onClick={() => setIsConfirming(false)}><X size={24} /></button>
          <h2>確認收據內容</h2>
          <button onClick={() => saveToDB(editingItem)} className="save-btn">確認儲存</button>
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

          <div className="edit-group items-list card">
            <div className="list-header"><h3>購買明細</h3><span>+ 新增品項</span></div>
            {editingItem.items?.map((item, idx) => (
              <div key={idx} className="edit-item-row">
                <div className="item-names">
                  <input className="primary" value={item.translated_name} onChange={e => {
                    const newItems = [...editingItem.items];
                    newItems[idx].translated_name = e.target.value;
                    setEditingItem({...editingItem, items: newItems});
                  }} />
                  <div className="secondary">{item.original_name}</div>
                </div>
                <div className="item-val">
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
      {activeTab === 'home' && <HomeView />}
      {activeTab === 'records' && <RecordsView />}
      
      <nav className="tab-bar">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}><Home /><span>首頁</span></button>
        <button className={activeTab === 'records' ? 'active' : ''} onClick={() => setActiveTab('records')}><List /><span>紀錄</span></button>
        <label className="scan-fab">
          <Camera size={28} color="#fff" />
          <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
        </label>
        <button onClick={() => setActiveTab('stats')}><BarChart3 /><span>統計</span></button>
        <button onClick={() => setActiveTab('settings')}><Settings /><span>設定</span></button>
      </nav>
    </div>
  );
}

export default App;