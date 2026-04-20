import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Trash2, CloudLightning, CheckCircle, ArrowRight,
  ShieldCheck, Globe2, RefreshCcw
} from 'lucide-react';
import Logo from '../components/Logo';

const features = [
  {
    icon: Upload,
    title: 'Bulk Excel Upload',
    desc: 'Drop your .xlsx file and update titles, bullet points, images, and keywords for hundreds of ASINs simultaneously.',
  },
  {
    icon: CloudLightning,
    title: 'Real-Time SSE Streaming',
    desc: 'Watch each listing update land on Amazon live — no waiting, no polling, no page reloads required.',
  },
  {
    icon: Trash2,
    title: 'Precision Listing Deletion',
    desc: 'Remove a specific product SKU from any marketplace with a targeted DELETE call, not a full catalog wipe.',
  },
  {
    icon: ShieldCheck,
    title: 'Dry Run Mode',
    desc: 'Validate your entire payload against the SP-API without writing a single change to the catalog.',
  },
  {
    icon: Globe2,
    title: 'Multi-Marketplace Support',
    desc: 'India, US, UK, EU, Canada — automatically routes to the correct regional endpoint and language tag.',
  },
  {
    icon: RefreshCcw,
    title: 'Smart Product-Type Detection',
    desc: 'Auto-fetches the exact product type from the Catalog Items API so every PATCH is schema-valid.',
  },
];

const steps = [
  { n: '01', title: 'Prepare your Excel', desc: 'Add SKU, Country, and the attribute columns you want to update.' },
  { n: '02', title: 'Choose your account', desc: 'Toggle between Seller Central or Vendor Central credentials.' },
  { n: '03', title: 'Select update flags', desc: 'Pick only the attributes to patch, preventing unintended overwrites.' },
  { n: '04', title: 'Hit Deploy', desc: 'Watch the live terminal stream Amazon SP-API results in real time.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="pt-16 bg-white text-gray-900">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative bg-white overflow-hidden border-b border-gray-100">
        {/* subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            opacity: 0.35,
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 py-32 text-center">
          {/* pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-semibold text-gray-600 tracking-wide mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SP-API v2021-08-01 · Live on Amazon
          </div>

          <h1 className="text-6xl md:text-7xl font-black text-gray-950 tracking-tighter leading-[1.05] mb-6">
            Update Amazon<br />
            <span className="text-gray-400">listings at the speed</span><br />
            of code.
          </h1>

          <p className="text-lg text-gray-500 max-w-lg mx-auto mb-10 leading-relaxed font-normal">
            A purpose-built SP-API gateway for Seller &amp; Vendor Central.
            Bulk-patch attributes, stream live results, and delete listings —
            all from one clean interface.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary text-base px-7 py-3.5 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Open Dashboard <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-use-case-guide"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-base px-7 py-3.5 hover:-translate-y-0.5 transition-all"
            >
              SP-API Docs ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '6',    label: 'Marketplaces' },
            { value: 'SSE',  label: 'Streaming logs' },
            { value: '7',    label: 'Update flags' },
            { value: '100%', label: 'Schema-validated' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black text-gray-950 tracking-tighter leading-none mb-1">{s.value}</div>
              <div className="text-sm font-medium text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">Capabilities</p>
          <h2 className="text-4xl font-black text-gray-950 tracking-tight">
            Everything you need,<br />nothing you don't.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group p-6 rounded-2xl border border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition-all duration-200"
            >
              <div className="w-9 h-9 bg-gray-950 rounded-lg flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-[15px]">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">Workflow</p>
            <h2 className="text-4xl font-black text-gray-950 tracking-tight">Live in four steps.</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10">
            {steps.map(({ n, title, desc }) => (
              <div key={n}>
                <div className="text-6xl font-black text-gray-200 leading-none mb-4 select-none">{n}</div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="bg-gray-950 rounded-3xl px-10 py-16 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="relative">
            <h2 className="text-4xl font-black text-white tracking-tight mb-4">
              Ready to sync your catalog?
            </h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-base leading-relaxed">
              Open the dashboard, drop your Excel file, and watch your Amazon listings update in real time.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-950 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg text-base"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-auto" alt="Logo" />
          </div>
          <p className="text-xs text-gray-400">Built for Amazon Vendor & Seller Central · Listings Items API v2021-08-01</p>
        </div>
      </footer>
    </div>
  );
}
