import { useState, useEffect, useRef } from 'react';
import { 
  Camera, List, BarChart3, Settings, Home, 
  X, Banknote, Target, CalendarDays, MapPin, Edit3, Users, Trash2, AlertCircle, Image as ImageIcon, Plus, PenSquare, Languages
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import './App.css';

// 🚀 新增翻譯分類的顏色
const CAT_COLORS = ['#007AFF', '#FF9500', '#FF2D55', '#34C759', '#AF52DE', '#FF3B30', '#8E8E93', '#5AC8FA', '#FFCC00', '#A2845E'];
const PAY_COLORS = ['#34C759', '#007AFF', '#FF2D55', '#5AC8FA'];

// 定義 Worker 處理類型
const TYPE_RECEIPT_PARSE = 'receipt';
const TYPE_TRANSLATE_JP = 'translate_jp';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [history, setHistory] = useState([]);
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tripSettings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      tripName: parsed.tripName || '日本中部北陸之旅',
      startDate: parsed.startDate || '2026-04-16',
      endDate: parsed.endDate || '2026-04-21',
      rate: parsed.rate || 0.207,
      budget: parsed.budget || 200000,
      split: parsed.split || 10,
      schedule: parsed.schedule || "東京 4/16-4/21" 
    };
  });

  const [recordView, setRecordView] = useState('date'); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  const [isConfirming, setIsConfirming] = useState(false);
  
  const [showActionSheet, setShowActionSheet] = useState(false);
  // 用來區分當前 Action Sheet 是為了「記帳」還是「翻譯」
  const [actionSheetContext, setActionSheetContext] = useState(TYPE_RECEIPT_PARSE);
  
  // 🚀 新增狀態：儲存原始上傳圖片的 Base64，用於翻譯畫面顯示
  const [originalImageBase64, setOriginalImageBase64] = useState(null);
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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
    const scheduleText = settings.schedule || "東京 4/16-4/21"; 
    const lines = scheduleText.split('\n');
    for (let line of lines) {
      const parts = line.split(' ');
      if (parts.length >= 2) return parts[0]; 
    }
    return '東京';
  };

  const compressImage = (file, maxWidth = 1024) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          resolve(compressedBase64);
        };
      };
    });
  };

  const handleFileSelect = async (e) => {
    setShowActionSheet(false);
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const compressedBase64 = await compressImage(file);
      
      // 🚀 新增：辨識前先儲存原始圖片的 Base64，用於翻譯畫面顯示
      setOriginalImageBase64(compressedBase64);
      
      if (actionSheetContext === TYPE_TRANSLATE_JP) {
        await handleTranslateJp(compressedBase64);
      } else {
        await handleReceiptParse(compressedBase64);
      }
      
    } catch (err) { 
      alert(`網路連線異常或辨識逾時，請確認網路狀態。\n錯誤代碼: ${err.message}`); 
    }
    finally { 
      setIsProcessing(false); 
      e.target.value = ''; 
    }
  };

  const handleReceiptParse = async (base64Data) => {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, payer_avatar: 'Jason', type: TYPE_RECEIPT_PARSE }),
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      if (result.data.shop_name === "辨識失敗" || !result.data.amount_jpy) {
        alert("⚠️ 收據影像太模糊或反光，AI 無法讀取內容。請換個角度重新拍攝！");
        return; 
      }

      const autoRegion = determineRegion(result.data.receipt_date);
      setEditingItem({ 
        ...result.data, 
        location: autoRegion,
        tax_type: result.data.tax_type || '内税',
        payer_avatar: 'Jason'
      });
      setIsConfirming(true);
    } else {
      alert(`記帳解析失敗: ${result.error || '未知的 AI 錯誤'}`);
    }
  };

  const handleTranslateJp = async (base64Data) => {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, type: TYPE_TRANSLATE_JP }),
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      setEditingItem({
        type: TYPE_TRANSLATE_JP,
        ...result.data,
        dedupe_id: `${Date.now()}_translate`
      });
      setIsConfirming(true);
    } else {
      alert(`翻譯失敗: ${result.error || '未知的 AI 錯誤'}`);
    }
  };

  const handleManualEntry = () => {
    setShowActionSheet(false);
    const today = new Date().toISOString().split('T')[0];
    setEditingItem({
      receipt_date: today,
      shop_name: '',
      amount_jpy: 0,
      tax_type: '内税',
      category: '餐飲',
      payment_method: '現金',
      location: determineRegion(today),
      payer_avatar: 'Jason',
      items: [],
      dedupe_id: `${Date.now()}_manual`
    });
    setIsConfirming(true);
  };

  const saveToDB = async (item) => {
    if (item.type === TYPE_TRANSLATE_JP) {
      alert("此為翻譯結果，無法直接儲存為帳目。請手動建立記帳項目。");
      return;
    }
    if (!item.shop_name || !item.amount_jpy) {
      alert("請輸入店名與總金額！");
      return;
    }
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

  const deleteRecord = async (id) => {
    if (!window.confirm('確定要刪除這筆紀錄嗎？')) return;
    try {
      const res = await fetch(`${SUPABASE_REST}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      });
      if (res.ok) fetchData();
    } catch (e) { alert('刪除時發生錯誤'); }
  };

  const saveSettings = () => {
    localStorage.setItem('tripSettings', JSON.stringify(settings));
    alert('設定已更新');
  };

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

  const HomeView = () => (
    <div className="view fade-in">
      <h1 className="page-title" style={{color: 'var(--text-primary)'}}>{settings.tripName}</h1>
      <div className="grid-2-home">
        <div className="card dash-card">
          <div className="dash-head"><Banknote size={16} color="#FF9500"/> 今日支出</div>
          <div className="dash-val" style={{color: 'var(--text-primary)'}}>¥{todayJPY.toLocaleString()}</div>
          <div className="dash-sub">≈ NT${Math.round(todayJPY * settings.rate).toLocaleString()}</div>
        </div>
        <div className="card dash-card">
          <div className="dash-head"><BarChart3 size={16} color="#007AFF"/> 旅程累計</div>
          <div className="dash-val" style={{color: 'var(--text-primary)'}}>¥{totalJPY.toLocaleString()}</div>
          <div className="dash-sub">均分: NT${Math.round((totalJPY * settings.rate) / settings.split).toLocaleString()}</div>
        </div>
        <div className="card dash-card">
          <div className="dash-head"><Target size={16} color="#34C759"/> 預算進度</div>
          <div className="dash-val" style={{color: 'var(--text-primary)'}}>{budgetPercent}%</div>
          <div className="progress-bg"><div className="progress-fill" style={{width: `${budgetPercent}%`}}></div></div>
        </div>
        <div className="card dash-card">
          <div className="dash-head"><CalendarDays size={16} color="#FF2D55"/> 旅程狀態</div>
          <div className="dash-val" style={{fontSize: '1.1rem', marginTop: '6px', color: 'var(--text-primary)'}}>{getTripStatus()}</div>
        </div>
      </div>
      
      <div className="card" style={{padding: '12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'15px'}}>
        <div style={{display:'flex', alignItems:'center', gap: '8px', color:'var(--blue)'}}>
          <MapPin size={16} />
          <span style={{fontSize:'0.9rem', fontStyle:'italic'}}>{determineRegion(todayStr)} 行程中</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap: '8px', color:'var(--text-secondary)'}}>
          <span style={{fontSize:'0.85rem'}}>匯率: {settings.rate}</span>
          <AlertCircle size={15} style={{color: 'var(--blue)'}} />
        </div>
      </div>

      <h3 className="section-title">今日花費</h3>
      <div className="list-container">
        {history.filter(h => h.receipt_date === todayStr).map((item, i) => (
          <div key={i} className="item-card" onClick={() => { setEditingItem(item); setIsConfirming(true); }}>
            <div className="item-icon-box" style={{background: 'var(--blue-light)', color: 'var(--blue)'}}>{item.payer_avatar?.substring(0,1) || '我'}</div>
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
          <div className="val" style={{color: 'var(--text-primary)'}}>¥{totalJPY.toLocaleString()}</div>
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
                <div className="item-icon-box" style={{background: 'var(--blue-light)', color: 'var(--blue)'}}>{item.payer_avatar?.substring(0,1) || '我'}</div>
                <div className="item-info">
                  <div className="name">{item.shop_name}</div>
                  <div className="meta"><span className="tag">{item.category}</span> {item.payment_method} · {item.tax_type}</div>
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
        <h1 className="page-title" style={{color: 'var(--text-primary)'}}>統計分析</h1>
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
      <h1 className="page-title" style={{color: 'var(--text-primary)'}}>設定</h1>
      <div className="menu-group">
        <div className="menu-item"><span>旅程名稱</span><input className="settings-input" style={{textAlign:'right', width:'150px'}} value={settings.tripName} onChange={e => setSettings({...settings, tripName: e.target.value})} /></div>
        <div className="menu-item"><span>出發日期</span><input type="date" className="settings-input" value={settings.startDate} onChange={e => setSettings({...settings, startDate: e.target.value})} /></div>
        <div className="menu-item"><span>結束日期</span><input type="date" className="settings-input" value={settings.endDate} onChange={e => setSettings({...settings, endDate: e.target.value})} /></div>
      </div>
      <div className="menu-group" style={{marginTop:'20px'}}>
        <div className="menu-item"><span>匯率 (JPY to TWD)</span><input type="number" step="0.001" className="settings-input" value={settings.rate} onChange={e => setSettings({...settings, rate: Number(e.target.value)})} /></div>
        <div className="menu-item"><span>預算 (JPY)</span><input type="number" className="settings-input" value={settings.budget} onChange={e => setSettings({...settings, budget: Number(e.target.value)})} /></div>
        <div className="menu-item"><span>分帳人數</span>
          <div className="input-with-icon" style={{width:'80px', paddingRight:'10px'}}>
            <Users size={16} color="var(--text-secondary)" />
            <input type="number" style={{width:'100%', border:'none', background:'transparent', textAlign:'right', outline:'none', color:'var(--text-primary)'}} value={settings.split} onChange={e => setSettings({...settings, split: Number(e.target.value)})} />
          </div>
        </div>
      </div>
      <div className="menu-group" style={{marginTop:'20px'}}>
        <div className="menu-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
          <span style={{marginBottom:'10px'}}>行程地區 (自動判斷用)</span>
          <textarea className="settings-input" style={{width:'100%', height:'80px', textAlign:'left', padding:'10px', background:'var(--bg-color)', borderRadius:'8px'}} value={settings.schedule} onChange={e => setSettings({...settings, schedule: e.target.value})} placeholder="例如:&#10;東京 4/16-4/21" />
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
    if (editingItem.type === TYPE_TRANSLATE_JP) {
      return (
        // 🚀 修改：為翻譯視窗加上特殊的類別 translate-overlay 
        <div className="edit-overlay fade-in translate-overlay">
          <nav className="edit-nav blur-header">
            {/* 🚀 修改：取消按鈕同時清除圖片狀態 */}
            <button className="icon-btn" onClick={() => { setIsConfirming(false); setOriginalImageBase64(null); }}><X size={24} /></button>
            <h2 style={{color: 'var(--text-primary)'}}>翻譯與對照</h2>
            <div style={{width: '32px'}}></div>
          </nav>
          
          {/* 🚀 究極修改：Kuilkuil 風格雙面板佈局核心 */}
          <div className="translate-panes-wrapper">
            
            {/* ⬆️ 上半部區域：原始圖片 + OCR 原文 */}
            <div className="translate-pane top-pane scroll-pane">
              <div className="pane-content">
                {/* 顯示原始上傳圖片 */}
                {originalImageBase64 && (
                    <img src={`data:image/jpeg;base64,${originalImageBase64}`} alt="Original" className="original-preview" />
                )}
                <div className="list-header"><h3 style={{color: 'var(--text-secondary)'}}>日文原文 (OCR)</h3></div>
                {/* 使用特殊的 ocr-text 類別處理貼近原始排版的換行 */}
                <p className="ocr-text">{editingItem.original_text || '無法偵測到文字'}</p>
              </div>
            </div>

            {/* ⬇️ 下半部區域：繁中翻譯 */}
            <div className="translate-pane bottom-pane scroll-pane">
              <div className="pane-content">
                <div className="list-header"><h3 style={{color: 'var(--blue)'}}>繁中翻譯 (AI)</h3></div>
                {/* 使用特殊的 translation-text 類別處理貼近原始排版的換行 */}
                <p className="translation-text">{editingItem.translated_text || '翻譯失敗'}</p>
                
                {/* 整合金額換算提示卡 */}
                {editingItem.price_jpy && (
                  <div className="price-alert-card">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div className="dash-head" style={{color: 'var(--blue)', marginBottom: 0}}><Banknote size={16}/> 偵測到金額 (日幣)</div>
                      <div className="jpy" style={{color: 'var(--blue)', fontSize: '1.3rem'}}>¥{editingItem.price_jpy.toLocaleString()}</div>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--border-color)'}}>
                      <div className="dash-sub" style={{color: 'var(--blue)'}}>折合台幣 (匯率 {settings.rate})</div>
                      <div className="twd" style={{color: 'var(--blue)', fontWeight:'600'}}>≈ NT${Math.round(editingItem.price_jpy * settings.rate).toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="edit-overlay fade-in">
        <nav className="edit-nav blur-header">
          <button className="icon-btn" onClick={() => setIsConfirming(false)}><X size={24} /></button>
          <h2 style={{color: 'var(--text-primary)'}}>確認內容</h2>
          <button onClick={() => saveToDB(editingItem)} className="save-btn">儲存</button>
        </nav>
        
        <div className="edit-content">
          <div className="card">
            <div className="edit-group"><label>店家名稱</label><input placeholder="請輸入店名" value={editingItem.shop_name} onChange={e => setEditingItem({...editingItem, shop_name: e.target.value})} /></div>
            <div className="grid-2">
              <div className="edit-group"><label>日期</label><input type="date" value={editingItem.receipt_date} onChange={e => setEditingItem({...editingItem, receipt_date: e.target.value})} /></div>
              <div className="edit-group"><label>分類</label>
                <select value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})}>
                  <option>餐飲</option><option>購物</option><option>交通</option><option>住宿</option><option>門票</option><option>娛樂</option><option>生活</option><option>藥品</option><option>其他</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="edit-group"><label>地區</label>
                <div className="input-with-icon"><MapPin size={16} color="var(--text-secondary)" /><input value={editingItem.location} onChange={e => setEditingItem({...editingItem, location: e.target.value})} /></div>
              </div>
              <div className="edit-group"><label>付款方式</label>
                <select value={editingItem.payment_method} onChange={e => setEditingItem({...editingItem, payment_method: e.target.value})}>
                  <option>現金</option><option>信用卡</option><option>PayPay</option><option>Suica</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="edit-group"><label>記帳人</label>
                <div className="input-with-icon"><Users size={16} color="var(--text-secondary)" /><input value={editingItem.payer_avatar} onChange={e => setEditingItem({...editingItem, payer_avatar: e.target.value})} /></div>
              </div>
              <div className="edit-group"><label>稅制</label>
                <select value={editingItem.tax_type} onChange={e => setEditingItem({...editingItem, tax_type: e.target.value})}>
                  <option>内税</option><option>外税</option><option>免税</option>
                </select>
              </div>
            </div>
            <div className="edit-group" style={{marginTop:'10px'}}><label>總額 (JPY)</label>
              <input type="number" style={{fontSize:'1.8rem', fontWeight:'800', color:'var(--blue)'}} value={editingItem.amount_jpy || ''} placeholder="0" onChange={e => setEditingItem({...editingItem, amount_jpy: Number(e.target.value)})} />
            </div>
          </div>

          <div className="card">
            <div className="list-header"><h3 style={{color: 'var(--text-primary)'}}>購買明細</h3><span className="add-btn" onClick={() => setEditingItem({...editingItem, items: [...(editingItem.items||[]), {translated_name:'', price:0}]})}><Plus size={16} style={{verticalAlign:'middle', marginRight:'4px'}}/>新增品項</span></div>
            {editingItem.items && editingItem.items.map((item, idx) => (
              <div key={idx} className="edit-item-row" style={{position: 'relative'}}>
                <div className="item-names" style={{paddingRight: '30px'}}>
                  <input className="primary-input" placeholder="中文品名" value={item.translated_name || ''} onChange={e => {
                    const newItems = [...editingItem.items];
                    newItems[idx].translated_name = e.target.value;
                    setEditingItem({...editingItem, items: newItems});
                  }} />
                  <div className="secondary-text">{item.original_name}</div>
                </div>
                <div className="item-val">
                  <span className="currency-symbol">¥</span>
                  <input type="number" value={item.price || ''} placeholder="0" onChange={e => {
                    const newItems = [...editingItem.items];
                    newItems[idx].price = Number(e.target.value);
                    setEditingItem({...editingItem, items: newItems});
                  }} />
                </div>
                <button 
                  onClick={() => {
                    const newItems = editingItem.items.filter((_, index) => index !== idx);
                    setEditingItem({...editingItem, items: newItems});
                  }}
                  style={{position: 'absolute', right: 0, top: '15px', background:'none', border:'none', color:'#FF3B30', padding: '5px', cursor: 'pointer'}}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
            {(!editingItem.items || editingItem.items.length === 0) && <div className="empty-state">尚無明細資料</div>}
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
      
      {showActionSheet && (
        <div className="action-sheet-overlay" onClick={() => setShowActionSheet(false)}>
          <div className="action-sheet fade-up" onClick={e => e.stopPropagation()}>
            <div className="sheet-menu">
              <button onClick={() => { setActionSheetContext(TYPE_RECEIPT_PARSE); cameraInputRef.current.click(); }}><Camera size={20} /> 📸 拍攝收據 (記帳用)</button>
              <button onClick={() => { setActionSheetContext(TYPE_TRANSLATE_JP); cameraInputRef.current.click(); }}><Languages size={20} style={{color:CAT_COLORS[9]}} /> 📸 拍攝翻譯 (日文對照)</button>
              <div style={{borderBottom: '0.5px solid var(--border-color)', margin: '0 15px'}}></div>
              <button onClick={() => { setActionSheetContext(TYPE_RECEIPT_PARSE); fileInputRef.current.click(); }}><ImageIcon size={20} /> 🖼️ 從相簿選擇 (記帳用)</button>
              <button onClick={() => { setActionSheetContext(TYPE_TRANSLATE_JP); fileInputRef.current.click(); }}><ImageIcon size={20} style={{color:CAT_COLORS[9]}} /> 🖼️ 從相簿選擇 (日文對照)</button>
              <div style={{borderBottom: '0.5px solid var(--border-color)', margin: '0 15px'}}></div>
              <button onClick={handleManualEntry}><PenSquare size={20} /> ✏️ 手動輸入紀錄</button>
            </div>
            <button className="sheet-cancel" onClick={() => setShowActionSheet(false)}>取消</button>
          </div>
        </div>
      )}

      {/* 隱藏的檔案輸入框，透過 useRef 觸發 */}
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
      
      <nav className="tab-bar blur-nav">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}><Home size={22} /><span>首頁</span></button>
        <button className={activeTab === 'records' ? 'active' : ''} onClick={() => setActiveTab('records')}><List size={22} /><span>紀錄</span></button>
        <div className="fab-container">
          {/* FAB 預設為記帳上下文 */}
          <div className="scan-fab shadow-lg" onClick={() => { setActionSheetContext(TYPE_RECEIPT_PARSE); setShowActionSheet(true); }}>
            <Camera size={26} color="#fff" />
          </div>
        </div>
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}><BarChart3 size={22} /><span>統計</span></button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}><Settings size={22} /><span>設定</span></button>
      </nav>
    </div>
  );
}

export default App;