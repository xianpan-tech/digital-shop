'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { BadgeCheck, ArrowLeft } from 'lucide-react';

function Content() {
  const sp = useSearchParams();
  const orderNo = sp.get('order_no') || '';
  return (
    <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl ring-1 ring-neutral-200/70 shadow-xl max-w-md w-full p-8 text-center animate-pop-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <BadgeCheck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold mt-5 tracking-tight">支付成功</h1>
        {orderNo && (
          <p className="mt-3 font-mono text-xs text-neutral-500 bg-neutral-50 ring-1 ring-neutral-100 rounded-xl px-4 py-2.5 break-all">
            订单号：{orderNo}
          </p>
        )}
        <p className="text-sm text-neutral-500 mt-3 leading-relaxed">
          自动发货已处理，请到首页「订单查询」输入订单号查看卡密。
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-6 py-3 text-sm font-semibold hover:bg-indigo-600 transition shadow-lg shadow-neutral-900/10"
        >
          <ArrowLeft className="w-4 h-4" />返回首页查卡密
        </a>
      </div>
    </div>
  );
}

export default function PaySuccess() {
  return <Suspense><Content /></Suspense>;
}
