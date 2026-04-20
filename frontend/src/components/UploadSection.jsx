import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, Rocket, Square } from 'lucide-react';
import { apiFetch } from '../lib/api';

const FLAG_LABELS = {
  search_terms:       { label: 'Search Terms',            desc: 'Backend keywords' },
  title:              { label: 'Product Title',           desc: 'rcm title column' },
  description:        { label: 'Description',             desc: 'descrp column' },
  bullet_points:      { label: 'Bullet Points',           desc: 'rcm kf1 – kf5' },
  main_image:         { label: 'Main Image',              desc: 'main_image URL' },
  lifestyle_images:   { label: 'Lifestyle Images',        desc: 'lifestyle_image_1–8' },
  why_choose_us_image:{ label: 'Why Choose Us Image',     desc: 'slot 2' },
  dry_run:            { label: 'Dry Run Mode',            desc: 'No real changes', danger: true },
};

export default function UploadSection({
  accountType,
  clientId,
  accountId,
  setLogs,
  isProcessing,
  setIsProcessing,
  stopRef,
}) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const readerRef = useRef(null);
  const [showColumns, setShowColumns] = useState(false);

  const [flags, setFlags] = useState({
    search_terms: true,
    title: false,
    description: false,
    bullet_points: false,
    main_image: false,
    lifestyle_images: false,
    why_choose_us_image: false,
    dry_run: true,
  });

  const toggleFlag = (key) => setFlags(prev => ({ ...prev, [key]: !prev[key] }));

  const requiredColumns = useMemo(() => {
    const core = [
      { col: 'sku_required', note: 'Merchant SKU (or use ASIN in sku)' },
      { col: 'Country', note: 'Marketplace code (IN/US/UK/EU/CA)' },
    ];

    const byFlag = [];
    if (flags.search_terms) byFlag.push({ col: 'search terms', note: 'Search Terms flag' });
    if (flags.title) byFlag.push({ col: 'rcm title', note: 'Title flag' });
    if (flags.description) byFlag.push({ col: 'descrp', note: 'Description flag' });
    if (flags.bullet_points) byFlag.push({ col: 'rcm kf1–kf5', note: 'Bullet Points flag' });
    if (flags.main_image) byFlag.push({ col: 'main_image', note: 'Main Image URL' });
    if (flags.lifestyle_images) byFlag.push({ col: 'lifestyle_image_1–8', note: 'Lifestyle Image URLs' });
    if (flags.why_choose_us_image) byFlag.push({ col: 'why_choose_us_image', note: 'WCU image URL' });

    return { core, byFlag };
  }, [flags]);

  const stopProcessing = () => {
    try {
      abortControllerRef.current?.abort();
    } catch {}
    try {
      readerRef.current?.cancel();
    } catch {}
    abortControllerRef.current = null;
    readerRef.current = null;
    setIsProcessing(false);
    setLogs((prev) => [...prev, { type: 'complete', message: 'Stopped by user.' }]);
  };

  useEffect(() => {
    if (!stopRef) return;
    stopRef.current = stopProcessing;
    return () => {
      if (stopRef.current === stopProcessing) stopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopRef]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const startProcessing = async () => {
    if (!file) return;
    if (!clientId) {
      setLogs([{ type: 'error', message: 'Please select a client first.' }]);
      return;
    }
    setIsProcessing(true);
    setLogs([{ type: 'info', message: 'Connecting to SP-API gateway…' }]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('flags', JSON.stringify(flags));
      formData.append('account_type', accountType);
      formData.append('client_id', clientId || '');
      formData.append('override_id', (accountId || '').trim());

      const response = await apiFetch('/api/process', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const payload = JSON.parse(part.replace('data: ', ''));
              setLogs(prev => [...prev, payload]);
            } catch {}
          }
        }
      }
    } catch (err) {
      const wasAborted = abortControllerRef.current?.signal?.aborted || err?.name === 'AbortError';
      if (wasAborted) {
        setLogs(prev => [...prev, { type: 'complete', message: 'Stopped.' }]);
      } else {
        setLogs(prev => [...prev, { type: 'error', message: `Request failed: ${err.message}` }]);
      }
    } finally {
      abortControllerRef.current = null;
      readerRef.current = null;
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
          ${isDragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
          ${file ? 'border-emerald-300 bg-emerald-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
        />
        {file ? (
          <div className="flex flex-col items-center text-emerald-700">
            <CheckCircle2 className="w-10 h-10 mb-3" />
            <p className="font-semibold text-lg">{file.name}</p>
            <p className="text-sm text-emerald-500 mt-1">Ready to deploy</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <UploadCloud className="w-10 h-10 mb-3 text-gray-300" />
            <p className="font-semibold text-gray-700">Drop your Excel file here</p>
            <p className="text-sm mt-1">or click to browse — accepts .xlsx</p>
          </div>
        )}
      </div>

      {/* Excel columns (clean + collapsible) */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Excel Template</p>
            <p className="text-sm text-gray-600 mt-1">
              Required columns update automatically based on flags.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowColumns((p) => !p)}
            className="btn-secondary text-sm"
          >
            {showColumns ? 'Hide' : 'Show'} columns
          </button>
        </div>

        {showColumns && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Always required</p>
              <div className="flex flex-wrap gap-2">
                {requiredColumns.core.map((c) => (
                  <span key={c.col} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-gray-200">
                    <code className="text-gray-800 font-mono text-[11px]">{c.col}</code>
                    <span className="text-[11px] text-gray-500">{c.note}</span>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Needed for selected flags</p>
              {requiredColumns.byFlag.length === 0 ? (
                <p className="text-sm text-gray-500">No update columns required right now.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {requiredColumns.byFlag.map((c) => (
                    <div key={c.col} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                      <code className="text-gray-800 font-mono text-[11px] bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">{c.col}</code>
                      <span className="text-xs text-gray-500">{c.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Flags */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Update Flags</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(flags).map(([key, value]) => {
            const meta = FLAG_LABELS[key];
            return (
              <label
                key={key}
                className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all duration-150
                  ${meta.danger
                    ? (value ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/30')
                    : (value ? 'border-gray-900 bg-gray-900' : 'border-gray-200 hover:border-gray-300 bg-white')}`}
              >
                <div className="pt-0.5">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                    ${meta.danger
                      ? (value ? 'bg-amber-500 border-amber-500' : 'border-gray-300')
                      : (value ? 'bg-white border-white' : 'border-gray-300')}`}>
                    {value && (
                      <svg className={`w-2.5 h-2.5 ${meta.danger ? 'text-white' : 'text-gray-900'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <input type="checkbox" checked={value} onChange={() => toggleFlag(key)} className="sr-only" />
                <div>
                  <p className={`text-xs font-semibold leading-tight ${value && !meta.danger ? 'text-white' : meta.danger && value ? 'text-amber-800' : 'text-gray-700'}`}>
                    {meta.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${value && !meta.danger ? 'text-gray-300' : 'text-gray-400'}`}>
                    {meta.desc}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Submit / Stop */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          onClick={startProcessing}
          disabled={!file || isProcessing}
          className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2
            ${!file || isProcessing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-700 shadow-lg hover:shadow-xl'}`}
        >
          <Rocket className={`w-5 h-5 ${isProcessing ? 'animate-bounce' : ''}`} />
          {isProcessing ? 'Running…' : 'Start Deployment'}
        </button>
        <button
          type="button"
          onClick={stopProcessing}
          disabled={!isProcessing}
          className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2
            ${!isProcessing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm'}`}
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
      </div>
    </div>
  );
}
