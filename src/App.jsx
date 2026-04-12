import { useState, useEffect } from 'react';
import { UploadCloud, Loader2, Receipt, PieChart as ChartIcon, List, MapPin, Phone, WifiOff, ExternalLink, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './App.css';

const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#8884d8'];
const JPY_TO_TWD = 0.21;

function App() {
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // ⚠️ 檢查這裡：確認這是你的 Cloudflare Worker 網址
  const WORKER_URL = 'https://receipt-parser.jason093010.workers.dev';

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || isOffline) return;
    
    setIsUploading(true);
    setCurrentResult(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64String = reader.result.split(',')[1];
      try {
        const response = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, payer_avatar: 'Jason' }),
        });
        const result = await response.json();
        if (result.success) {
          setCurrentResult(result.data);
          setHistory(prev => {
            const exists = prev.find(item => item.dedupe_id === result.data.dedupe_id);
            return exists ? prev : [result.data, ...prev];
          });
        } else {
          alert('解析出錯：' + result.error);
        }
      } catch (error) {
        alert('連線失敗：' + error.message);
      } finally {
        setIsUploading(false);
      }
    };
  };

  // --- 關鍵修復：定義圖表資料邏輯 ---
  const chartData = history.length > 0 ? Object.values(
    history.reduce((acc, curr) => {
      const cat = curr.category || '未分類';
      acc[cat] = acc[cat] || { name: cat, value: 0 };
      acc[cat].value += Number(curr.amount_jpy || 0);
      return acc;
    }, {})
  ) : [];

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      {isOffline && (
        <div style={{ backgroundColor: '#ff4757', color: '#fff', padding: '10px', textAlign: 'center', borderRadius: '10px', marginBottom: '20px' }}>
          <WifiOff size={18} inline /> 目前離線，請檢查網路連線。
        </div>
      )}

      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '1.8rem', color: '#1a1a1a', marginBottom: '5px' }}>🚀 東京行自動記帳神器</h1>
        <p style={{ color: '#666' }}>10 人團戰專用 · AI 自動翻譯</p>
      </header>

      {/* 上傳區 */}
      <section style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', textAlign: 'center', border: '2px dashed #ddd' }}>
        {isUploading ? (
          <div>
            <Loader2 size={48} className="spinner" color="#007AFF" />
            <p style={{ marginTop: '15px', color: '#007AFF', fontWeight: '600' }}>AI 正在掃描並翻譯明細...</p>
          </div>
        ) : (
          <label style={{ cursor: isOffline ? 'not-allowed' : 'pointer' }}>
            <UploadCloud size={60} color={isOffline ? '#ccc' : '#007AFF'} />
            <h3 style={{ marginTop: '10px' }}>拍收據照片</h3>
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isOffline} />
          </label>
        )}
      </section>

      {/* 辨識結果 */}
      {currentResult && (
        <section style={{ marginTop: '25px', backgroundColor: '#fff', padding: '25px', borderRadius: '24px', borderLeft: '8px solid #2ecc71', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ margin: 0 }}>{currentResult.shop_name}</h2>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff4757' }}>¥{currentResult.amount_jpy}</div>
              <div style={{ color: '#777', fontSize: '0.9rem' }}>≈ NT$ {Math.round(currentResult.amount_jpy * JPY_TO_TWD)}</div>
            </div>
          </div>

          <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentResult.address && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentResult.address)}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#007AFF', textDecoration: 'none', fontSize: '0.9rem' }}>
                <MapPin size={16} /> {currentResult.address} <ExternalLink size={14} />
              </a>
            )}
            <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Users size={14} /> 10 人均分：每人約 NT$ {Math.ceil((currentResult.amount_jpy * JPY_TO_TWD) / 10)}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee', color: '#888', fontSize: '0.8rem', textAlign: 'left' }}>
                <th style={{ paddingBottom: '10px' }}>品項</th>
                <th style={{ textAlign: 'right' }}>金額</th>
              </tr>
            </thead>
            <tbody>
              {currentResult.items?.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                  <td style={{ padding: '10px 0' }}>
                    <div style={{ fontSize: '0.9rem' }}>{item.original_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#007AFF' }}>{item.translated_name}</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '500' }}>¥{item.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 統計圖表區 */}
      {history.length > 0 && (
        <section style={{ marginTop: '30px', backgroundColor: '#fff', padding: '25px', borderRadius: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ChartIcon size={20} /> 消費比例 (JPY)</h3>
          <div style={{ height: '250px', marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 歷史清單 */}
      {history.length > 0 && (
        <section style={{ marginTop: '30px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><List size={20} /> 歷史消費紀錄</h3>
          {history.map((item, idx) => (
            <div key={idx} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{item.shop_name}</div>
                <div style={{ fontSize: '0.8rem', color: '#999' }}>{item.receipt_date}</div>
              </div>
              <div style={{ fontWeight: 'bold', color: '#ff4757' }}>¥{item.amount_jpy}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default App;