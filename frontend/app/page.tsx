'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Zap, Search, ShoppingCart, ShieldCheck, UserCheck, Headset, Sparkles,
  Mail, Users, X, Plus, Minus, Trash2, Package, CreditCard, ChevronDown,
  BadgeCheck, Clock, FileText, HelpCircle, ArrowRight, Store,
} from 'lucide-react';

// API 走相对路径 /api，经 Nginx 反代到后端。不要写死 localhost，否则访客浏览器会连访客自己的本机。
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Product = { id: string; slug: string; name: string; description: string; price_cents: number; available_stock: number; category_name?: string; includes_text?: string; usage_text?: string; after_sales_text?: string; stock_type?: string };
type Category = { id: string; slug: string; name: string };
type CartItem = { slug: string; name: string; price_cents: number; qty: number };

// 每个分类的配色与图标
const CAT_STYLE: Record<string, { gradient: string; soft: string; icon: any; ring: string }> = {
  ai:       { gradient: 'from-indigo-500 via-indigo-600 to-violet-600', soft: 'bg-indigo-50 text-indigo-600', icon: Sparkles,    ring: 'ring-indigo-200' },
  verify:   { gradient: 'from-emerald-500 via-emerald-600 to-teal-600',  soft: 'bg-emerald-50 text-emerald-600', icon: ShieldCheck, ring: 'ring-emerald-200' },
  accounts: { gradient: 'from-sky-500 via-sky-600 to-blue-600',          soft: 'bg-sky-50 text-sky-600',         icon: Users,       ring: 'ring-sky-200' },
  ids:      { gradient: 'from-amber-500 via-amber-600 to-orange-600',     soft: 'bg-amber-50 text-amber-600',     icon: Mail,        ring: 'ring-amber-200' },
  services: { gradient: 'from-rose-500 via-rose-600 to-pink-600',         soft: 'bg-rose-50 text-rose-600',       icon: Headset,     ring: 'ring-rose-200' },
};
const defaultStyle = CAT_STYLE.ai;

const fmt = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 text-neutral-500 px-2.5 py-0.5 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />缺货</span>;
  if (stock <= 5)
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs ring-1 ring-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />低库存 · {stock}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs ring-1 ring-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />有货</span>;
}

export default function Home() {
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState('all');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [orderNo, setOrderNo] = useState('');
  const [queryContact, setQueryContact] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [querying, setQuerying] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'alipay' | 'wechat'>('alipay');
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetch(`${API}/categories`).then(r => r.json()).then(setCats).catch(() => {});
    fetch(`${API}/products`).then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  // 锁定时滚动（弹窗/抽屉打开时）
  useEffect(() => {
    document.body.style.overflow = (selected || showCart || checkoutOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected, showCart, checkoutOpen]);

  const nameToSlug = useMemo(() => {
    const m: Record<string, string> = {};
    cats.forEach(c => { m[c.name] = c.slug; });
    return m;
  }, [cats]);

  const styleOf = (p: Product) => CAT_STYLE[nameToSlug[p.category_name || ''] || ''] || defaultStyle;

  const filtered = useMemo(() => {
    return products.filter(p => {
      const catOk = activeCat === 'all' || nameToSlug[p.category_name || ''] === activeCat;
      const qOk = !q || p.name.includes(q) || p.description.includes(q);
      return catOk && qOk;
    });
  }, [products, activeCat, q, nameToSlug]);

  const countOf = (slug: string) => products.filter(p => nameToSlug[p.category_name || ''] === slug).length;

  const total = cart.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const f = prev.find(x => x.slug === p.slug);
      if (f) return prev.map(x => x.slug === p.slug ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, { slug: p.slug, name: p.name, price_cents: p.price_cents, qty: 1 }];
    });
  };
  const changeQty = (slug: string, delta: number) => {
    setCart(prev => prev.map(x => x.slug === slug ? { ...x, qty: Math.max(1, x.qty + delta) } : x));
  };
  const removeItem = (slug: string) => setCart(prev => prev.filter(x => x.slug !== slug));

  const openCheckout = () => {
    if (cart.length === 0) return;
    setPlaceErr('');
    setCheckoutOpen(true);
    setShowCart(false);
  };

  async function confirmCheckout() {
    setPlacing(true);
    setPlaceErr('');
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({ slug: c.slug, qty: c.qty })),
          contact_email: email.trim(),
          contact_phone: phone.trim(),
          pay_channel: channel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlaceErr(data.error || '下单失败，请稍后重试');
        setPlacing(false);
        return;
      }
      // payUrl 已是相对路径（/api/payments/mock/pay?...）或真实支付网关的绝对 URL，直接跳转，不要再拼 localhost。
      if (data.pay?.payUrl) window.location.href = data.pay.payUrl;
      else window.location.href = `/pay/success?order_no=${data.order.order_no}`;
    } catch (e: any) {
      setPlaceErr('网络错误，请稍后重试');
      setPlacing(false);
    }
  }

  async function queryOrder() {
    if (!orderNo.trim()) return;
    setQuerying(true);
    setQueryResult(null);
    try {
      const params = new URLSearchParams();
      if (queryContact.includes('@')) params.set('email', queryContact.trim());
      else if (queryContact.trim()) params.set('phone', queryContact.trim());
      const res = await fetch(`${API}/orders/${encodeURIComponent(orderNo.trim())}${params.toString() ? '?' + params.toString() : ''}`);
      const data = await res.json();
      setQueryResult(res.ok ? data : { error: data.error || '查询失败' });
    } catch {
      setQueryResult({ error: '网络错误，请稍后重试' });
    } finally {
      setQuerying(false);
    }
  }

  const statusLabel = (s: string) => {
    if (s === 'delivered' || s === 'paid') return { text: '已发货', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
    if (s === 'pending') return { text: '待支付', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
    return { text: s, cls: 'bg-neutral-100 text-neutral-600 ring-neutral-200' };
  };

  const renderPayload = (payload: any) => {
    if (!payload) return null;
    const codes: string[] = Array.isArray(payload) ? payload.map(String)
      : Array.isArray(payload.codes) ? payload.codes.map(String)
      : payload.code ? [String(payload.code)] : [];
    if (!codes.length) return <span className="text-xs text-neutral-400">人工交付，客服会与你联系</span>;
    return (
      <div className="mt-2 space-y-1.5">
        {codes.map((c, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-neutral-900 px-3 py-2">
            <code className="text-xs text-emerald-300 font-mono break-all">{c}</code>
            <button
              onClick={() => navigator.clipboard?.writeText(c)}
              className="shrink-0 text-[11px] text-neutral-300 hover:text-white border border-white/20 rounded-full px-2.5 py-0.5"
            >复制</button>
          </div>
        ))}
      </div>
    );
  };

  const faqs = [
    { q: '游客可以购买吗？', a: '可以。下单时填写邮箱或手机号，付款成功后凭订单号在「订单查询」里查看卡密，无需注册。' },
    { q: '付款后多久发货？', a: '卡密类商品支付成功后自动即时发货，卡密会显示在订单查询结果中；人工交付类商品会有客服主动与你联系。' },
    { q: '可以退款吗？', a: '未使用的卡密可以申请退款；已使用或已查看的卡密不支持自动退款，人工服务类请联系客服协商。' },
    { q: '订单号丢了怎么办？', a: '下单时填写的邮箱或手机号会作为查询凭证，在「订单查询」中输入任意一项即可找回订单并查看卡密。' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部公告条 */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white text-center text-xs sm:text-sm py-2 px-4">
        <Zap className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />
        付款后自动发货 · 订单查询可查看卡密 · 演示商品为占位，上线前请替换真实商品
      </div>

      {/* 导航 */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-neutral-200/70">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <a href="#" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Store className="w-5 h-5 text-white" />
            </span>
            <span className="font-bold text-lg tracking-tight">数字商品商城</span>
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">演示版</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-600">
            <a href="#products" className="hover:text-indigo-600 transition">全部商品</a>
            <a href="#flow" className="hover:text-indigo-600 transition">购买流程</a>
            <a href="#query" className="hover:text-indigo-600 transition">订单查询</a>
            <a href="#faq" className="hover:text-indigo-600 transition">常见问题</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/admin" className="hidden sm:inline-flex text-sm text-neutral-500 hover:text-indigo-600 px-3 py-2 transition">后台管理</a>
            <button
              onClick={() => setShowCart(true)}
              className="relative inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white pl-4 pr-5 py-2.5 text-sm font-medium hover:bg-neutral-800 transition shadow-lg shadow-neutral-900/10"
            >
              <ShoppingCart className="w-4 h-4" />
              购物车
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 英雄区 */}
      <section className="relative overflow-hidden bg-[#0f0c29]">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-[#171233] to-violet-950" />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/30 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute top-10 right-1/4 w-40 h-40 rounded-full bg-violet-500/20 blur-2xl animate-float-slow" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 px-3.5 py-1.5 text-xs text-indigo-200 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              全自动发货 · 7×24 小时即买即得
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
              数字商品，
              <span className="text-gradient">付款即到手</span>
            </h1>
            <p className="text-indigo-200/80 mt-4 text-base sm:text-lg leading-relaxed">
              AI 会员、验证服务、账号与邮箱 ID —— 选购、支付、自动发货，全程无需等待人工。
            </p>
            <div className="mt-8 relative max-w-xl">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                placeholder="搜索商品，例如：AI 会员、Apple ID…"
                className="w-full rounded-2xl bg-white pl-12 pr-5 py-4 text-[15px] shadow-2xl shadow-black/30 outline-none placeholder:text-neutral-400 focus:ring-4 focus:ring-indigo-500/40 transition"
              />
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-indigo-200/90">
              <span className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" />支付成功自动发货</span>
              <span className="inline-flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-emerald-400" />游客可直接购买</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-sky-400" />订单可查可退</span>
            </div>
          </div>
        </div>
        <div className="relative h-6 bg-[#fafbfc] rounded-t-[2rem]" />
      </section>

      {/* 商品区 */}
      <main id="products" className="max-w-6xl mx-auto px-4 w-full -mt-2 scroll-mt-20">
        {/* 分类标签 */}
        <div className="flex gap-2.5 flex-wrap py-6">
          <button
            onClick={() => setActiveCat('all')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ring-1 ${
              activeCat === 'all'
                ? 'bg-neutral-900 text-white ring-neutral-900 shadow-lg shadow-neutral-900/15'
                : 'bg-white text-neutral-600 ring-neutral-200 hover:ring-neutral-400 hover:text-neutral-900'
            }`}
          >
            <Package className="w-4 h-4" />全部
            <span className={`text-xs ${activeCat === 'all' ? 'text-neutral-300' : 'text-neutral-400'}`}>{products.length}</span>
          </button>
          {cats.map(c => {
            const st = CAT_STYLE[c.slug] || defaultStyle;
            const Icon = st.icon;
            const active = activeCat === c.slug;
            return (
              <button
                key={c.slug}
                onClick={() => setActiveCat(c.slug)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ring-1 ${
                  active
                    ? 'bg-neutral-900 text-white ring-neutral-900 shadow-lg shadow-neutral-900/15'
                    : `bg-white text-neutral-600 ring-neutral-200 hover:ring-neutral-400 hover:text-neutral-900`
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${active ? 'bg-white/15 text-white' : st.soft}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {c.name}
                <span className={`text-xs ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>{countOf(c.slug)}</span>
              </button>
            );
          })}
        </div>

        {/* 商品网格 */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-4">
            {filtered.map(p => {
              const st = styleOf(p);
              const Icon = st.icon;
              const soldOut = p.available_stock <= 0;
              return (
                <div key={p.id} className="card-hover group bg-white rounded-3xl overflow-hidden ring-1 ring-neutral-200/70 flex flex-col">
                  <button onClick={() => setSelected(p)} className={`relative h-36 bg-gradient-to-br ${st.gradient} flex items-center justify-center overflow-hidden text-left`}>
                    <Icon className="w-14 h-14 text-white/90 drop-shadow-lg transition-transform duration-300 group-hover:scale-110" strokeWidth={1.6} />
                    <Icon className="absolute -right-5 -bottom-6 w-32 h-32 text-white/10 rotate-12" strokeWidth={1.2} />
                    <span className="absolute top-3 right-3"><StockBadge stock={p.available_stock} /></span>
                  </button>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs text-neutral-400 font-medium">{p.category_name}</div>
                    <h3 className="font-bold mt-1 leading-snug">{p.name}</h3>
                    <p className="text-[13px] text-neutral-500 line-clamp-2 mt-1.5 flex-1">{p.description}</p>
                    <div className="flex items-end justify-between mt-3">
                      <div>
                        <div className="text-[11px] text-neutral-400">售价</div>
                        <div className="text-xl font-extrabold text-rose-600 tracking-tight">{fmt(p.price_cents)}</div>
                      </div>
                      {p.stock_type === 'manual' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-100 rounded-full px-2 py-1"><Headset className="w-3 h-3" />人工交付</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => setSelected(p)} className="flex-1 rounded-full py-2 text-sm font-medium ring-1 ring-neutral-200 hover:ring-neutral-400 hover:bg-neutral-50 transition">
                        详情
                      </button>
                      <button
                        onClick={() => addToCart(p)}
                        disabled={soldOut}
                        className={`flex-[1.4] rounded-full py-2 text-sm font-semibold transition inline-flex items-center justify-center gap-1.5 ${
                          soldOut
                            ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                            : 'bg-neutral-900 text-white hover:bg-indigo-600 shadow-md shadow-neutral-900/10'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {soldOut ? '已售罄' : '加入购物车'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-neutral-400">
            <Package className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p>没有找到相关商品，换个关键词试试</p>
          </div>
        )}

        {/* 购买流程 + 订单查询 */}
        <div id="flow" className="grid md:grid-cols-2 gap-5 mt-12 scroll-mt-24">
          <div className="bg-white rounded-3xl p-6 sm:p-7 ring-1 ring-neutral-200/70">
            <h2 className="font-bold text-lg flex items-center gap-2"><CreditCard className="w-5 h-5 text-indigo-600" />购买流程</h2>
            <ol className="mt-5 space-y-4">
              {[
                { t: '挑选商品', d: '浏览分类或搜索，找到需要的数字商品，加入购物车。' },
                { t: '填写联系方式', d: '留下邮箱或手机号，用于订单查询与找回卡密。' },
                { t: '选择支付方式', d: '支持支付宝 / 微信支付，扫码即付。' },
                { t: '自动发货', d: '支付成功后卡密即时显示，订单页可随时查询。' },
              ].map((s, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center shadow-md shadow-indigo-500/25">{i + 1}</span>
                  <div>
                    <div className="font-semibold text-[15px]">{s.t}</div>
                    <div className="text-sm text-neutral-500 mt-0.5">{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div id="query" className="bg-white rounded-3xl p-6 sm:p-7 ring-1 ring-neutral-200/70 scroll-mt-24">
            <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" />订单查询</h2>
            <p className="text-sm text-neutral-500 mt-1.5">输入订单号，凭下单时的邮箱或手机号验证后查看卡密。</p>
            <div className="mt-4 space-y-2.5">
              <input
                value={orderNo} onChange={e => setOrderNo(e.target.value)}
                placeholder="订单号（必填）"
                className="w-full rounded-xl ring-1 ring-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <input
                value={queryContact} onChange={e => setQueryContact(e.target.value)}
                placeholder="下单时的邮箱或手机号（必填，用于验证）"
                className="w-full rounded-xl ring-1 ring-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button
                onClick={queryOrder}
                disabled={querying || !orderNo.trim()}
                className="w-full rounded-xl bg-neutral-900 text-white py-2.5 text-sm font-semibold hover:bg-indigo-600 transition disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />{querying ? '查询中…' : '查询订单'}
              </button>
            </div>
            {queryResult && (
              <div className="mt-4 animate-pop-in">
                {queryResult.error ? (
                  <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm px-4 py-3">
                    查询失败：{queryResult.error === 'order not found' ? '订单号不存在' : queryResult.error === 'contact mismatch' ? '联系方式与订单不匹配' : queryResult.error}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-neutral-500 break-all">{queryResult.order.order_no}</span>
                      {(() => { const s = statusLabel(queryResult.order.status); return <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ring-1 ${s.cls}`}>{s.text}</span>; })()}
                    </div>
                    <div className="text-sm mt-2.5 space-y-2">
                      {(queryResult.items || []).map((it: any) => (
                        <div key={it.id}>
                          <div className="flex justify-between font-medium">
                            <span>{it.product_name} × {it.quantity}</span>
                            <span>{fmt(it.unit_price_cents * it.quantity)}</span>
                          </div>
                          {renderPayload(it.delivery_payload)}
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-neutral-200 mt-3 pt-2.5 flex justify-between font-bold text-[15px]">
                      <span>实付</span><span className="text-rose-600">{fmt(queryResult.order.total_cents)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" className="mt-12 scroll-mt-24">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><HelpCircle className="w-5 h-5 text-indigo-600" />常见问题</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={i} className="bg-white rounded-2xl ring-1 ring-neutral-200/70 overflow-hidden">
                  <button onClick={() => setOpenFaq(open ? null : i)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                    <span className="font-semibold text-[15px]">{f.q}</span>
                    <ChevronDown className={`w-5 h-5 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <p className="px-5 pb-5 text-sm text-neutral-500 leading-relaxed animate-fade-in">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="mt-16 border-t border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </span>
            <div>
              <div className="font-bold text-sm">数字商品商城</div>
              <div className="text-xs text-neutral-400">原创演示版 · 自动发货</div>
            </div>
          </div>
          <p className="text-xs text-neutral-400 text-center sm:text-right leading-relaxed">
            演示商品与价格均为占位，上线前请替换真实商品与卡密。<br />遇到问题请联系客服并提供订单号。
          </p>
        </div>
      </footer>

      {/* 商品详情弹窗 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl max-w-lg w-full overflow-hidden animate-pop-in max-h-[90vh] overflow-y-auto nice-scroll" onClick={e => e.stopPropagation()}>
            {(() => { const st = styleOf(selected); const Icon = st.icon; return (
              <div className={`h-40 bg-gradient-to-br ${st.gradient} relative flex items-center justify-center`}>
                <Icon className="w-16 h-16 text-white/90 drop-shadow-lg" strokeWidth={1.6} />
                <Icon className="absolute -right-6 -bottom-8 w-40 h-40 text-white/10 rotate-12" strokeWidth={1.2} />
                <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/25 text-white flex items-center justify-center hover:bg-black/45 transition">
                  <X className="w-4 h-4" />
                </button>
                <span className="absolute bottom-4 left-5"><StockBadge stock={selected.available_stock} /></span>
              </div>
            ); })()}
            <div className="p-6">
              <div className="text-xs text-neutral-400 font-medium">{selected.category_name}</div>
              <h2 className="text-xl font-extrabold mt-1 tracking-tight">{selected.name}</h2>
              <p className="text-neutral-600 mt-2 text-[15px] leading-relaxed">{selected.description}</p>
              <div className="mt-5 space-y-3 text-sm">
                {[
                  { k: '包含内容', v: selected.includes_text, icon: Package },
                  { k: '使用方式', v: selected.usage_text, icon: FileText },
                  { k: '售后说明', v: selected.after_sales_text, icon: Headset },
                ].map((row, i) => row.v ? (
                  <div key={i} className="flex gap-3 rounded-xl bg-neutral-50 ring-1 ring-neutral-100 px-4 py-3">
                    <row.icon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div><span className="font-semibold">{row.k}：</span><span className="text-neutral-600">{row.v}</span></div>
                  </div>
                ) : null)}
                <div className="flex items-center gap-2 text-sm text-neutral-500 px-1">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  发货方式：{selected.stock_type === 'manual' ? '人工交付（客服联系）' : '支付成功后自动发货'}
                </div>
              </div>
              <div className="flex items-center justify-between mt-6">
                <div>
                  <div className="text-[11px] text-neutral-400">售价</div>
                  <div className="text-2xl font-extrabold text-rose-600 tracking-tight">{fmt(selected.price_cents)}</div>
                </div>
                <div className="text-xs text-neutral-400">库存 {selected.available_stock} 件</div>
              </div>
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => { addToCart(selected); setSelected(null); setShowCart(true); }}
                  disabled={selected.available_stock <= 0}
                  className="flex-1 rounded-full py-3 font-semibold text-sm bg-neutral-900 text-white hover:bg-indigo-600 transition shadow-lg shadow-neutral-900/15 disabled:opacity-40 inline-flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {selected.available_stock <= 0 ? '已售罄' : '加入购物车'}
                </button>
                <button onClick={() => setSelected(null)} className="px-6 rounded-full py-3 text-sm font-medium ring-1 ring-neutral-200 hover:bg-neutral-50 transition">关闭</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 购物车抽屉 */}
      {showCart && (
        <div className="fixed inset-0 z-50 animate-fade-in" onClick={() => setShowCart(false)}>
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white rounded-l-3xl shadow-2xl flex flex-col animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
              <h2 className="font-extrabold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />购物车
                {cartCount > 0 && <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">{cartCount} 件</span>}
              </h2>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center transition">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto nice-scroll px-6 py-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-400 py-16">
                  <ShoppingCart className="w-12 h-12 text-neutral-200 mb-3" />
                  <p className="text-sm">购物车是空的</p>
                  <button onClick={() => { setShowCart(false); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-4 text-sm text-indigo-600 font-medium inline-flex items-center gap-1">
                    去挑选商品 <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(c => (
                    <div key={c.slug} className="flex items-center gap-3 rounded-2xl ring-1 ring-neutral-100 bg-neutral-50/60 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.name}</div>
                        <div className="text-xs text-neutral-400 mt-0.5">{fmt(c.price_cents)} / 件</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(c.slug, -1)} className="w-7 h-7 rounded-full ring-1 ring-neutral-200 bg-white flex items-center justify-center hover:ring-indigo-400 transition">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">{c.qty}</span>
                        <button onClick={() => changeQty(c.slug, 1)} className="w-7 h-7 rounded-full ring-1 ring-neutral-200 bg-white flex items-center justify-center hover:ring-indigo-400 transition">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="w-16 text-right text-sm font-bold">{fmt(c.price_cents * c.qty)}</div>
                      <button onClick={() => removeItem(c.slug)} className="text-neutral-300 hover:text-rose-500 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setCart([])} className="text-xs text-neutral-400 hover:text-rose-500 transition">清空购物车</button>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-neutral-100 px-6 py-5 bg-white rounded-bl-3xl">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-neutral-500">合计</span>
                  <span className="text-2xl font-extrabold text-rose-600 tracking-tight">{fmt(total)}</span>
                </div>
                <button onClick={openCheckout} className="w-full rounded-full py-3.5 font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition shadow-lg shadow-indigo-600/25 inline-flex items-center justify-center gap-2">
                  去结算 <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* 结算弹窗 */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => !placing && setCheckoutOpen(false)}>
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 animate-pop-in max-h-[90vh] overflow-y-auto nice-scroll" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-lg">确认订单</h2>
              <button onClick={() => !placing && setCheckoutOpen(false)} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center transition">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-100 p-4 space-y-2 text-sm">
              {cart.map(c => (
                <div key={c.slug} className="flex justify-between">
                  <span className="text-neutral-600 truncate mr-3">{c.name} × {c.qty}</span>
                  <span className="font-medium shrink-0">{fmt(c.price_cents * c.qty)}</span>
                </div>
              ))}
              <div className="border-t border-neutral-200 pt-2 flex justify-between font-bold">
                <span>应付</span><span className="text-rose-600 text-lg">{fmt(total)}</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">支付方式</div>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  { id: 'alipay', name: '支付宝', cls: 'ring-blue-500 bg-blue-50', dot: 'bg-blue-500' },
                  { id: 'wechat', name: '微信支付', cls: 'ring-emerald-500 bg-emerald-50', dot: 'bg-emerald-500' },
                ] as const).map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setChannel(ch.id)}
                    className={`rounded-2xl py-3.5 px-4 text-sm font-semibold ring-2 transition inline-flex items-center justify-center gap-2 ${
                      channel === ch.id ? ch.cls : 'ring-neutral-200 bg-white hover:ring-neutral-300'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${ch.dot}`} />
                    {ch.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="text-sm font-semibold">联系方式 <span className="font-normal text-neutral-400">（用于订单查询与找回卡密）</span></div>
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="邮箱（建议填写）" type="email"
                className="w-full rounded-xl ring-1 ring-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="手机号（可选）" type="tel"
                className="w-full rounded-xl ring-1 ring-neutral-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            {placeErr && (
              <div className="mt-3 rounded-xl bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm px-4 py-2.5 animate-fade-in">{placeErr}</div>
            )}
            <button
              onClick={confirmCheckout}
              disabled={placing}
              className="mt-5 w-full rounded-full py-3.5 font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <BadgeCheck className="w-5 h-5" />
              {placing ? '正在创建订单…' : `确认支付 ${fmt(total)}`}
            </button>
            <p className="text-[11px] text-neutral-400 text-center mt-3">演示环境为模拟支付，不会产生真实扣款</p>
          </div>
        </div>
      )}
    </div>
  );
}
