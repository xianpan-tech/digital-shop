'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Package, KeyRound, LogOut, Search, Plus,
  X, Eye, RotateCcw, Upload, Store, TrendingUp, CircleAlert, Pencil,
  BadgeCheck, ChevronRight, ShieldCheck,
} from 'lucide-react';

// API 走相对路径 /api，经 Nginx 反代到后端。不要写死 localhost，否则访客浏览器会连访客自己的本机。
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

// 后台管理页：先登录（POST /api/auth/login 拿 JWT），再带 token 调后台接口。
// token 只存在 sessionStorage，关标签页即失效；401 时自动回到登录表单。
// 已接通的后端接口：订单列表/详情/退款、商品列表/新建/编辑（含上下架）、卡密列表/批量导入。
// 后端暂未提供：分类管理、商品删除（用下架代替）。

type Order = any;
type Product = any;
type Code = any;

const fmt = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const fmtTime = (t: string) => new Date(t).toLocaleString('zh-CN', { hour12: false });

const STATUS: Record<string, { text: string; cls: string }> = {
  pending:   { text: '待支付', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  paid:      { text: '已支付', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  delivered: { text: '已发货', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  refunded:  { text: '已退款', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  cancelled: { text: '已取消', cls: 'bg-neutral-100 text-neutral-500 ring-neutral-200' },
};
const statusOf = (s: string) => STATUS[s] || { text: s, cls: 'bg-neutral-100 text-neutral-600 ring-neutral-200' };

const CODE_STATUS: Record<string, { text: string; cls: string }> = {
  available: { text: '可售', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  sold:      { text: '已售', cls: 'bg-neutral-100 text-neutral-500 ring-neutral-200' },
  refunded:  { text: '已退回', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

export default function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<'overview' | 'orders' | 'products' | 'codes'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [categories, setCategories] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // 订单
  const [orderQ, setOrderQ] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [orderDetail, setOrderDetail] = useState<{ order: Order; items: any[] } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundConfirm, setRefundConfirm] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundErr, setRefundErr] = useState('');

  // 商品
  const [productModal, setProductModal] = useState<null | { mode: 'create' } | { mode: 'edit'; p: Product }>(null);
  const [pForm, setPForm] = useState({ slug: '', name: '', description: '', priceYuan: '', category_id: '', stock_type: 'code', includes_text: '', usage_text: '', after_sales_text: '' });
  const [pSaving, setPSaving] = useState(false);
  const [pErr, setPErr] = useState('');

  // 卡密
  const [codeProduct, setCodeProduct] = useState('all');
  const [codeStatus, setCodeStatus] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [importProduct, setImportProduct] = useState('');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_token');
    if (saved) setToken(saved);
    fetch(`${API}/categories`).then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const authFetch = useCallback(async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('admin_token');
      setToken(null);
      throw new Error('登录已失效，请重新登录');
    }
    return res;
  }, [token]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [o, p, c] = await Promise.all([
        authFetch('/admin/orders').then(r => r.json()),
        authFetch('/admin/products').then(r => r.json()),
        authFetch('/admin/codes').then(r => r.json()),
      ]);
      setOrders(Array.isArray(o) ? o : []);
      setProducts(Array.isArray(p) ? p : []);
      setCodes(Array.isArray(c) ? c : []);
    } catch { /* 401 已处理 */ } finally {
      setLoading(false);
    }
  }, [token, authFetch]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setLoginError(data.error || '登录失败，请检查邮箱和密码'); return; }
      sessionStorage.setItem('admin_token', data.token);
      setToken(data.token);
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    sessionStorage.removeItem('admin_token');
    setToken(null);
    setOrders([]); setProducts([]); setCodes([]);
  }

  // ---- 概览统计 ----
  const stats = useMemo(() => {
    const revenue = orders.filter(o => ['paid', 'delivered'].includes(o.status)).reduce((s, o) => s + (o.total_cents || 0), 0);
    const pending = orders.filter(o => o.status === 'pending').length;
    const availableCodes = codes.filter(c => c.status === 'available').length;
    const lowStock = products.filter(p => p.stock_type !== 'manual' && (stockOf(p.id) <= 5) && p.is_active);
    return { revenue, pending, availableCodes, lowStock };
    function stockOf(pid: string) { return codes.filter(c => c.product_id === pid && c.status === 'available').length; }
  }, [orders, products, codes]);

  const stockOf = useCallback((pid: string) => codes.filter(c => c.product_id === pid && c.status === 'available').length, [codes]);

  // ---- 订单 ----
  const filteredOrders = useMemo(() => orders.filter(o => {
    const qOk = !orderQ || o.order_no.toLowerCase().includes(orderQ.toLowerCase()) || (o.contact_email || '').includes(orderQ) || (o.contact_phone || '').includes(orderQ);
    const sOk = orderStatus === 'all' || o.status === orderStatus;
    return qOk && sOk;
  }), [orders, orderQ, orderStatus]);

  async function openOrder(id: string) {
    setRefundReason(''); setRefundConfirm(false); setRefundErr('');
    try {
      const data = await authFetch(`/admin/orders/${id}`).then(r => r.json());
      setOrderDetail(data);
    } catch { /* 已处理 */ }
  }

  async function doRefund() {
    if (!orderDetail || !refundConfirm) return;
    setRefunding(true); setRefundErr('');
    try {
      const res = await authFetch(`/admin/orders/${orderDetail.order.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ confirm_unused: true, reason: refundReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setRefundErr(data.error || '退款失败'); return; }
      setOrderDetail(null);
      showToast('已退款，卡密已回滚到可售');
      loadAll();
    } catch (e: any) {
      setRefundErr(e.message);
    } finally {
      setRefunding(false);
    }
  }

  // ---- 商品 ----
  function openCreateProduct() {
    setPForm({ slug: '', name: '', description: '', priceYuan: '', category_id: categories[0]?.id || '', stock_type: 'code', includes_text: '', usage_text: '', after_sales_text: '' });
    setPErr('');
    setProductModal({ mode: 'create' });
  }
  function openEditProduct(p: Product) {
    setPForm({ slug: p.slug, name: p.name, description: p.description || '', priceYuan: (p.price_cents / 100).toString(), category_id: p.category_id || '', stock_type: p.stock_type || 'code', includes_text: p.includes_text || '', usage_text: p.usage_text || '', after_sales_text: p.after_sales_text || '' });
    setPErr('');
    setProductModal({ mode: 'edit', p });
  }
  async function saveProduct() {
    setPSaving(true); setPErr('');
    try {
      const price_cents = Math.round(parseFloat(pForm.priceYuan || '0') * 100);
      if (!pForm.name.trim()) { setPErr('商品名必填'); return; }
      if (productModal?.mode === 'create') {
        if (!pForm.slug.trim()) { setPErr('slug 必填（英文短横线，如 ai-pro）'); return; }
        const res = await authFetch('/admin/products', {
          method: 'POST',
          body: JSON.stringify({ slug: pForm.slug.trim(), name: pForm.name.trim(), description: pForm.description, price_cents, category_id: pForm.category_id || null, stock_type: pForm.stock_type }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setPErr(data.error || '创建失败'); return; }
        showToast('商品已创建');
      } else if (productModal?.mode === 'edit') {
        // 后端 PUT 仅支持 name / description / price_cents / is_active
        const res = await authFetch(`/admin/products/${productModal.p.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: pForm.name.trim(), description: pForm.description, price_cents }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setPErr(data.error || '保存失败'); return; }
        showToast('商品已更新');
      }
      setProductModal(null);
      loadAll();
    } catch (e: any) {
      setPErr(e.message);
    } finally {
      setPSaving(false);
    }
  }
  async function toggleActive(p: Product) {
    try {
      await authFetch(`/admin/products/${p.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !p.is_active }) });
      showToast(p.is_active ? '已下架' : '已上架');
      loadAll();
    } catch { /* 已处理 */ }
  }

  // ---- 卡密 ----
  const filteredCodes = useMemo(() => codes.filter(c => {
    const pOk = codeProduct === 'all' || c.product_id === codeProduct;
    const sOk = codeStatus === 'all' || c.status === codeStatus;
    return pOk && sOk;
  }), [codes, codeProduct, codeStatus]);

  async function doImport() {
    const list = importText.split('\n').map(s => s.trim()).filter(Boolean);
    if (!importProduct) { setImportErr('先选商品'); return; }
    if (!list.length) { setImportErr('请粘贴卡密，一行一条'); return; }
    setImporting(true); setImportErr('');
    try {
      const res = await authFetch('/admin/codes', { method: 'POST', body: JSON.stringify({ product_id: importProduct, codes: list }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setImportErr(data.error || '导入失败'); return; }
      showToast(`已导入 ${data.count ?? list.length} 条卡密`);
      setImportOpen(false); setImportText('');
      loadAll();
    } catch (e: any) {
      setImportErr(e.message);
    } finally {
      setImporting(false);
    }
  }

  // ================= 登录页 =================
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0f0c29] relative overflow-hidden flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-[#171233] to-violet-950" />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="relative w-full max-w-md animate-pop-in">
          <div className="flex items-center gap-3 justify-center mb-6">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Store className="w-6 h-6 text-white" />
            </span>
            <div>
              <div className="text-white font-extrabold text-xl tracking-tight">数字商品商城</div>
              <div className="text-indigo-300/80 text-xs">商家后台管理</div>
            </div>
          </div>
          <form onSubmit={login} className="bg-white rounded-3xl p-7 shadow-2xl space-y-4">
            <div>
              <label className="text-sm font-semibold">管理员邮箱</label>
              <input
                className="mt-1.5 w-full rounded-xl ring-1 ring-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">密码</label>
              <input
                className="mt-1.5 w-full rounded-xl ring-1 ring-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              />
            </div>
            {loginError && <p className="text-sm text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-4 py-2.5">{loginError}</p>}
            <button
              className="w-full rounded-full py-3 font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              type="submit" disabled={loggingIn}
            >
              <ShieldCheck className="w-4 h-4" />{loggingIn ? '登录中…' : '登录后台'}
            </button>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              首次使用请在服务器上执行：<code className="bg-neutral-100 rounded px-1">node backend/src/scripts/create-admin.js 邮箱 强密码（至少 12 位）</code>
            </p>
          </form>
          <a href="/" className="block text-center text-indigo-300/80 hover:text-white text-sm mt-5 transition">← 返回商城首页</a>
        </div>
      </div>
    );
  }

  // ================= 后台主界面 =================
  const navItems = [
    { id: 'overview' as const, name: '数据概览', icon: LayoutDashboard },
    { id: 'orders' as const, name: '订单管理', icon: ShoppingBag, badge: stats.pending > 0 ? stats.pending : undefined },
    { id: 'products' as const, name: '商品管理', icon: Package },
    { id: 'codes' as const, name: '卡密管理', icon: KeyRound },
  ];

  const inputCls = 'rounded-xl ring-1 ring-neutral-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white';

  return (
    <div className="min-h-screen bg-[#fafbfc] flex">
      {/* 侧边栏 */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-[#12102e] text-white sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </span>
          <div>
            <div className="font-bold text-[15px] leading-tight">数字商品商城</div>
            <div className="text-[11px] text-indigo-300/70">商家后台</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(n => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                tab === n.id ? 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-900/40' : 'text-indigo-200/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <n.icon className="w-4.5 h-4.5 w-5 h-5" />
              {n.name}
              {n.badge !== undefined && <span className="ml-auto text-[11px] font-bold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5">{n.badge} 待付</span>}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5 space-y-1">
          <a href="/" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-indigo-200/70 hover:bg-white/5 hover:text-white transition">
            <Eye className="w-5 h-5" />查看店铺
          </a>
          <button onClick={logout} className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-indigo-200/70 hover:bg-white/5 hover:text-white transition">
            <LogOut className="w-5 h-5" />退出登录
          </button>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex-1 min-w-0">
        {/* 移动端顶栏 */}
        <div className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-bold">商家后台</span>
            <button onClick={logout} className="text-sm text-neutral-500 inline-flex items-center gap-1"><LogOut className="w-4 h-4" />退出</button>
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto nice-scroll">
            {navItems.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium ring-1 transition ${tab === n.id ? 'bg-neutral-900 text-white ring-neutral-900' : 'bg-white ring-neutral-200 text-neutral-600'}`}>
                {n.name}
              </button>
            ))}
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* ---------- 概览 ---------- */}
          {tab === 'overview' && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-extrabold tracking-tight">数据概览</h1>
              <p className="text-sm text-neutral-500 mt-1">{loading ? '正在加载…' : '店铺经营一眼看清'}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {[
                  { label: '累计营收（已付/已发货）', value: fmt(stats.revenue), icon: TrendingUp, cls: 'from-indigo-500 to-violet-600 shadow-indigo-500/25' },
                  { label: '订单总数', value: String(orders.length), icon: ShoppingBag, cls: 'from-sky-500 to-blue-600 shadow-sky-500/25' },
                  { label: '待支付订单', value: String(stats.pending), icon: CircleAlert, cls: 'from-amber-500 to-orange-600 shadow-amber-500/25' },
                  { label: '可售卡密', value: String(stats.availableCodes), icon: KeyRound, cls: 'from-emerald-500 to-teal-600 shadow-emerald-500/25' },
                ].map((c, i) => (
                  <div key={i} className="bg-white rounded-3xl p-5 ring-1 ring-neutral-200/70">
                    <span className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${c.cls} shadow-lg flex items-center justify-center`}>
                      <c.icon className="w-5 h-5 text-white" />
                    </span>
                    <div className="text-2xl font-extrabold mt-3 tracking-tight">{c.value}</div>
                    <div className="text-xs text-neutral-400 mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>

              {stats.lowStock.length > 0 && (
                <div className="mt-5 bg-amber-50 ring-1 ring-amber-200 rounded-3xl p-5">
                  <div className="font-bold text-amber-900 flex items-center gap-2"><CircleAlert className="w-4.5 h-4.5 w-5 h-5" />库存不足（≤5）</div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {stats.lowStock.map(p => (
                      <button key={p.id} onClick={() => { setCodeProduct(p.id); setImportProduct(p.id); setTab('codes'); setImportOpen(true); }} className="text-sm bg-white ring-1 ring-amber-200 rounded-full px-3.5 py-1.5 hover:ring-amber-400 transition">
                        {p.name} · 剩 {stockOf(p.id)} <span className="text-amber-600 font-medium">去补货 →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl ring-1 ring-neutral-200/70 mt-5 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                  <h2 className="font-bold">最新订单</h2>
                  <button onClick={() => setTab('orders')} className="text-sm text-indigo-600 font-medium inline-flex items-center gap-0.5">全部订单 <ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="divide-y divide-neutral-50">
                  {orders.slice(0, 5).map(o => (
                    <button key={o.id} onClick={() => openOrder(o.id)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-neutral-50 transition">
                      <span className="font-mono text-xs text-neutral-500 truncate">{o.order_no}</span>
                      <span className={`ml-auto text-xs font-medium rounded-full px-2.5 py-0.5 ring-1 ${statusOf(o.status).cls}`}>{statusOf(o.status).text}</span>
                      <span className="font-bold text-sm w-20 text-right">{fmt(o.total_cents)}</span>
                    </button>
                  ))}
                  {orders.length === 0 && <p className="px-5 py-8 text-center text-sm text-neutral-400">暂无订单</p>}
                </div>
              </div>
            </div>
          )}

          {/* ---------- 订单 ---------- */}
          {tab === 'orders' && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-extrabold tracking-tight">订单管理</h1>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <div className="relative flex-1 min-w-52">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input value={orderQ} onChange={e => setOrderQ(e.target.value)} placeholder="搜订单号 / 邮箱 / 手机号" className={`${inputCls} w-full pl-10`} />
                </div>
                <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} className={inputCls}>
                  <option value="all">全部状态</option>
                  <option value="pending">待支付</option>
                  <option value="paid">已支付</option>
                  <option value="delivered">已发货</option>
                  <option value="refunded">已退款</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
              <div className="bg-white rounded-3xl ring-1 ring-neutral-200/70 mt-4 overflow-hidden">
                <div className="overflow-x-auto nice-scroll">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                        <th className="font-medium px-5 py-3.5">订单号</th>
                        <th className="font-medium px-3 py-3.5">商品数</th>
                        <th className="font-medium px-3 py-3.5">金额</th>
                        <th className="font-medium px-3 py-3.5">渠道</th>
                        <th className="font-medium px-3 py-3.5">状态</th>
                        <th className="font-medium px-3 py-3.5">联系方式</th>
                        <th className="font-medium px-3 py-3.5">时间</th>
                        <th className="font-medium px-5 py-3.5 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {filteredOrders.map(o => (
                        <tr key={o.id} className="hover:bg-neutral-50/70 transition">
                          <td className="px-5 py-3 font-mono text-xs">{o.order_no}</td>
                          <td className="px-3 py-3">{o.item_count ?? '-'}</td>
                          <td className="px-3 py-3 font-bold">{fmt(o.total_cents)}</td>
                          <td className="px-3 py-3 text-neutral-500">{o.pay_channel === 'alipay' ? '支付宝' : o.pay_channel === 'wechat' ? '微信' : o.pay_channel || '-'}</td>
                          <td className="px-3 py-3"><span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ring-1 ${statusOf(o.status).cls}`}>{statusOf(o.status).text}</span></td>
                          <td className="px-3 py-3 text-neutral-500 text-xs">{o.contact_email || o.contact_phone || '-'}</td>
                          <td className="px-3 py-3 text-neutral-500 text-xs whitespace-nowrap">{fmtTime(o.created_at)}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => openOrder(o.id)} className="text-indigo-600 font-medium hover:text-indigo-800 inline-flex items-center gap-1"><Eye className="w-4 h-4" />详情</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredOrders.length === 0 && <p className="py-10 text-center text-sm text-neutral-400">没有符合条件的订单</p>}
                </div>
              </div>
            </div>
          )}

          {/* ---------- 商品 ---------- */}
          {tab === 'products' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-extrabold tracking-tight">商品管理</h1>
                <button onClick={openCreateProduct} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-4.5 px-5 py-2.5 text-sm font-semibold hover:bg-indigo-600 transition shadow-lg shadow-neutral-900/10">
                  <Plus className="w-4 h-4" />新建商品
                </button>
              </div>
              <div className="bg-white rounded-3xl ring-1 ring-neutral-200/70 mt-5 overflow-hidden">
                <div className="overflow-x-auto nice-scroll">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                        <th className="font-medium px-5 py-3.5">商品</th>
                        <th className="font-medium px-3 py-3.5">分类</th>
                        <th className="font-medium px-3 py-3.5">价格</th>
                        <th className="font-medium px-3 py-3.5">库存（可售卡密）</th>
                        <th className="font-medium px-3 py-3.5">发货</th>
                        <th className="font-medium px-3 py-3.5">状态</th>
                        <th className="font-medium px-5 py-3.5 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-neutral-50/70 transition">
                          <td className="px-5 py-3">
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-neutral-400 font-mono">{p.slug}</div>
                          </td>
                          <td className="px-3 py-3 text-neutral-500">{p.category_name || '-'}</td>
                          <td className="px-3 py-3 font-bold">{fmt(p.price_cents)}</td>
                          <td className="px-3 py-3">
                            {p.stock_type === 'manual'
                              ? <span className="text-neutral-400">人工交付</span>
                              : <span className={stockOf(p.id) <= 5 ? 'text-amber-600 font-semibold' : ''}>{stockOf(p.id)} 条</span>}
                          </td>
                          <td className="px-3 py-3 text-neutral-500">{p.stock_type === 'manual' ? '人工' : '自动（卡密）'}</td>
                          <td className="px-3 py-3">
                            <button onClick={() => toggleActive(p)} className={`relative w-11 h-6 rounded-full transition ${p.is_active ? 'bg-emerald-500' : 'bg-neutral-300'}`} title={p.is_active ? '点击下架' : '点击上架'}>
                              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${p.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                            <span className="ml-2 text-xs text-neutral-400">{p.is_active ? '上架中' : '已下架'}</span>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openEditProduct(p)} className="text-indigo-600 font-medium hover:text-indigo-800 inline-flex items-center gap-1 mr-4"><Pencil className="w-4 h-4" />编辑</button>
                            {p.stock_type !== 'manual' && (
                              <button onClick={() => { setCodeProduct(p.id); setImportProduct(p.id); setTab('codes'); setImportOpen(true); }} className="text-emerald-600 font-medium hover:text-emerald-800 inline-flex items-center gap-1"><Upload className="w-4 h-4" />补卡密</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {products.length === 0 && <p className="py-10 text-center text-sm text-neutral-400">暂无商品，点右上角新建</p>}
                </div>
              </div>
              <p className="text-xs text-neutral-400 mt-3">说明：编辑可改名称、描述、价格；上下架点开关即可。分类调整与商品硬删除后端暂未提供，下架可代替删除。</p>
            </div>
          )}

          {/* ---------- 卡密 ---------- */}
          {tab === 'codes' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight">卡密管理</h1>
                <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-indigo-600 transition shadow-lg shadow-neutral-900/10">
                  <Upload className="w-4 h-4" />批量导入卡密
                </button>
              </div>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <select value={codeProduct} onChange={e => setCodeProduct(e.target.value)} className={inputCls}>
                  <option value="all">全部商品</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={codeStatus} onChange={e => setCodeStatus(e.target.value)} className={inputCls}>
                  <option value="all">全部状态</option>
                  <option value="available">可售</option>
                  <option value="sold">已售</option>
                  <option value="refunded">已退回</option>
                </select>
                <span className="text-sm text-neutral-400 self-center">共 {filteredCodes.length} 条（列表最多显示最近 500 条）</span>
              </div>
              <div className="bg-white rounded-3xl ring-1 ring-neutral-200/70 mt-4 overflow-hidden">
                <div className="overflow-x-auto nice-scroll">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead>
                      <tr className="text-left text-xs text-neutral-400 border-b border-neutral-100">
                        <th className="font-medium px-5 py-3.5">卡密</th>
                        <th className="font-medium px-3 py-3.5">商品</th>
                        <th className="font-medium px-3 py-3.5">状态</th>
                        <th className="font-medium px-3 py-3.5">导入时间</th>
                        <th className="font-medium px-5 py-3.5">售出时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {filteredCodes.map(c => {
                        const cs = CODE_STATUS[c.status] || { text: c.status, cls: 'bg-neutral-100 text-neutral-600 ring-neutral-200' };
                        return (
                          <tr key={c.id} className="hover:bg-neutral-50/70 transition">
                            <td className="px-5 py-3 font-mono text-xs break-all max-w-72">{c.code_text}</td>
                            <td className="px-3 py-3 text-neutral-600">{c.product_name || '-'}</td>
                            <td className="px-3 py-3"><span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ring-1 ${cs.cls}`}>{cs.text}</span></td>
                            <td className="px-3 py-3 text-neutral-500 text-xs whitespace-nowrap">{fmtTime(c.created_at)}</td>
                            <td className="px-5 py-3 text-neutral-500 text-xs whitespace-nowrap">{c.sold_at ? fmtTime(c.sold_at) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredCodes.length === 0 && <p className="py-10 text-center text-sm text-neutral-400">没有符合条件的卡密</p>}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ---------- 订单详情弹窗 ---------- */}
      {orderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setOrderDetail(null)}>
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 animate-pop-in max-h-[90vh] overflow-y-auto nice-scroll" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-lg">订单详情</h2>
                <p className="font-mono text-xs text-neutral-400 mt-1 break-all">{orderDetail.order.order_no}</p>
              </div>
              <span className={`text-xs font-medium rounded-full px-2.5 py-1 ring-1 ${statusOf(orderDetail.order.status).cls}`}>{statusOf(orderDetail.order.status).text}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
              <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-100 px-4 py-3"><div className="text-xs text-neutral-400">金额</div><div className="font-extrabold text-lg mt-0.5">{fmt(orderDetail.order.total_cents)}</div></div>
              <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-100 px-4 py-3"><div className="text-xs text-neutral-400">支付渠道</div><div className="font-semibold mt-1">{orderDetail.order.pay_channel === 'alipay' ? '支付宝' : orderDetail.order.pay_channel === 'wechat' ? '微信' : orderDetail.order.pay_channel || '-'}</div></div>
              <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-100 px-4 py-3 col-span-2"><div className="text-xs text-neutral-400">联系方式</div><div className="font-medium mt-0.5 break-all">{orderDetail.order.contact_email || '-'} {orderDetail.order.contact_phone || ''}</div></div>
              <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-100 px-4 py-3 col-span-2"><div className="text-xs text-neutral-400">下单时间</div><div className="font-medium mt-0.5">{fmtTime(orderDetail.order.created_at)}</div></div>
            </div>
            <h3 className="font-bold mt-5 mb-2">商品明细</h3>
            <div className="space-y-2.5">
              {orderDetail.items.map((it: any) => (
                <div key={it.id} className="rounded-2xl ring-1 ring-neutral-100 px-4 py-3">
                  <div className="flex justify-between text-sm font-medium"><span>{it.product_name} × {it.quantity}</span><span>{fmt(it.unit_price_cents * it.quantity)}</span></div>
                  {it.delivery_payload ? (
                    <div className="mt-2 rounded-lg bg-neutral-900 px-3 py-2">
                      <code className="text-xs text-emerald-300 font-mono break-all">{typeof it.delivery_payload === 'string' ? it.delivery_payload : JSON.stringify(it.delivery_payload)}</code>
                    </div>
                  ) : <p className="text-xs text-neutral-400 mt-1.5">未发货 / 人工交付</p>}
                </div>
              ))}
            </div>
            {['paid', 'delivered'].includes(orderDetail.order.status) && (
              <div className="mt-6 rounded-2xl ring-1 ring-rose-200 bg-rose-50/60 p-4">
                <h3 className="font-bold text-rose-900 flex items-center gap-2"><RotateCcw className="w-4 h-4" />退款</h3>
                <p className="text-xs text-rose-700/80 mt-1">退款后订单内卡密将回滚为可售。仅当卡密确认未被买家使用时才可退款。</p>
                <input value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="退款原因（可选）" className="mt-3 w-full rounded-xl ring-1 ring-rose-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-white" />
                <label className="flex items-start gap-2 mt-3 text-sm text-rose-900 cursor-pointer">
                  <input type="checkbox" checked={refundConfirm} onChange={e => setRefundConfirm(e.target.checked)} className="mt-0.5 accent-rose-600" />
                  我确认该订单的卡密未被使用
                </label>
                {refundErr && <p className="text-sm text-rose-700 mt-2">{refundErr}</p>}
                <button onClick={doRefund} disabled={!refundConfirm || refunding} className="mt-3 w-full rounded-full py-2.5 bg-rose-600 text-white text-sm font-bold hover:bg-rose-500 transition disabled:opacity-40">
                  {refunding ? '退款中…' : '确认退款'}
                </button>
              </div>
            )}
            <button onClick={() => setOrderDetail(null)} className="mt-5 w-full rounded-full py-2.5 ring-1 ring-neutral-200 text-sm font-medium hover:bg-neutral-50 transition">关闭</button>
          </div>
        </div>
      )}

      {/* ---------- 商品新建/编辑弹窗 ---------- */}
      {productModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setProductModal(null)}>
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 animate-pop-in max-h-[90vh] overflow-y-auto nice-scroll" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-lg">{productModal.mode === 'create' ? '新建商品' : '编辑商品'}</h2>
              <button onClick={() => setProductModal(null)} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center"><X className="w-4 h-4 text-neutral-500" /></button>
            </div>
            <div className="space-y-3.5 mt-5">
              {productModal.mode === 'create' && (
                <>
                  <div>
                    <label className="text-sm font-semibold">slug（唯一标识，英文短横线）</label>
                    <input value={pForm.slug} onChange={e => setPForm({ ...pForm, slug: e.target.value })} placeholder="如 ai-pro-month" className={`${inputCls} w-full mt-1.5`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold">分类</label>
                      <select value={pForm.category_id} onChange={e => setPForm({ ...pForm, category_id: e.target.value })} className={`${inputCls} w-full mt-1.5`}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold">发货方式</label>
                      <select value={pForm.stock_type} onChange={e => setPForm({ ...pForm, stock_type: e.target.value })} className={`${inputCls} w-full mt-1.5`}>
                        <option value="code">自动（卡密库）</option>
                        <option value="manual">人工交付</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-semibold">商品名</label>
                <input value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} className={`${inputCls} w-full mt-1.5`} />
              </div>
              <div>
                <label className="text-sm font-semibold">价格（元）</label>
                <input value={pForm.priceYuan} onChange={e => setPForm({ ...pForm, priceYuan: e.target.value })} type="number" min="0" step="0.01" className={`${inputCls} w-full mt-1.5`} />
              </div>
              <div>
                <label className="text-sm font-semibold">描述</label>
                <textarea value={pForm.description} onChange={e => setPForm({ ...pForm, description: e.target.value })} rows={3} className={`${inputCls} w-full mt-1.5 resize-none`} />
              </div>
              {productModal.mode === 'create' && (
                <p className="text-xs text-neutral-400">包含/使用/售后文案创建后暂不支持在页面修改（后端编辑接口未开放这三个字段），需要改时联系我改代码或直接改数据库。</p>
              )}
              {pErr && <p className="text-sm text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-4 py-2.5">{pErr}</p>}
              <button onClick={saveProduct} disabled={pSaving} className="w-full rounded-full py-3 font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <BadgeCheck className="w-4 h-4" />{pSaving ? '保存中…' : '保存商品'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 卡密导入弹窗 ---------- */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setImportOpen(false)}>
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 animate-pop-in max-h-[90vh] overflow-y-auto nice-scroll" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-lg">批量导入卡密</h2>
              <button onClick={() => setImportOpen(false)} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center"><X className="w-4 h-4 text-neutral-500" /></button>
            </div>
            <div className="space-y-3.5 mt-5">
              <div>
                <label className="text-sm font-semibold">选择商品</label>
                <select value={importProduct} onChange={e => setImportProduct(e.target.value)} className={`${inputCls} w-full mt-1.5`}>
                  <option value="">请选择</option>
                  {products.filter(p => p.stock_type !== 'manual').map(p => <option key={p.id} value={p.id}>{p.name}（可售 {stockOf(p.id)} 条）</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">卡密（一行一条）</label>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8} placeholder={'CODE-XXXX-0001\nCODE-XXXX-0002\n…'} className={`${inputCls} w-full mt-1.5 font-mono text-xs resize-none`} />
                <p className="text-xs text-neutral-400 mt-1">将导入 {importText.split('\n').map(s => s.trim()).filter(Boolean).length} 条</p>
              </div>
              {importErr && <p className="text-sm text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded-xl px-4 py-2.5">{importErr}</p>}
              <button onClick={doImport} disabled={importing} className="w-full rounded-full py-3 font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />{importing ? '导入中…' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-neutral-900 text-white text-sm font-medium rounded-full px-5 py-2.5 shadow-2xl animate-pop-in inline-flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-emerald-400" />{toast}
        </div>
      )}
    </div>
  );
}
