import React, { useState } from 'react';
import { Eraser, AlertTriangle, ChevronDown, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

const ATTRIBUTES = [
  { key: 'title',              label: 'Product Title',          group: 'Text',   note: 'item_name field' },
  { key: 'description',        label: 'Description',            group: 'Text',   note: 'product_description' },
  { key: 'search_terms',       label: 'Search Terms (Keywords)',group: 'Text',   note: 'generic_keyword' },
  { key: 'bullet_point_1',     label: 'Bullet Point 1',         group: 'Bullets',note: 'bullet_point[0]' },
  { key: 'bullet_point_2',     label: 'Bullet Point 2',         group: 'Bullets',note: 'bullet_point[1]' },
  { key: 'bullet_point_3',     label: 'Bullet Point 3',         group: 'Bullets',note: 'bullet_point[2]' },
  { key: 'bullet_point_4',     label: 'Bullet Point 4',         group: 'Bullets',note: 'bullet_point[3]' },
  { key: 'bullet_point_5',     label: 'Bullet Point 5',         group: 'Bullets',note: 'bullet_point[4]' },
  { key: 'main_image',         label: 'Main Image',             group: 'Images', note: 'main_product_image_locator' },
  { key: 'lifestyle_image_1',  label: 'Lifestyle Image 1',      group: 'Images', note: 'other_product_image_locator_1' },
  { key: 'lifestyle_image_2',  label: 'Lifestyle Image 2',      group: 'Images', note: 'other_product_image_locator_2' },
  { key: 'lifestyle_image_3',  label: 'Lifestyle Image 3',      group: 'Images', note: 'other_product_image_locator_3' },
  { key: 'lifestyle_image_4',  label: 'Lifestyle Image 4',      group: 'Images', note: 'other_product_image_locator_4' },
  { key: 'lifestyle_image_5',  label: 'Lifestyle Image 5',      group: 'Images', note: 'other_product_image_locator_5' },
  { key: 'lifestyle_image_6',  label: 'Lifestyle Image 6',      group: 'Images', note: 'other_product_image_locator_6' },
  { key: 'lifestyle_image_7',  label: 'Lifestyle Image 7',      group: 'Images', note: 'other_product_image_locator_7' },
  { key: 'lifestyle_image_8',  label: 'Lifestyle Image 8',      group: 'Images', note: 'other_product_image_locator_8' },
  { key: 'why_choose_us_image',label: 'Why Choose Us Image',    group: 'Images', note: 'other_product_image_locator_2' },
];

const MARKETPLACES = [
  { code: 'IN', label: '🇮🇳  India' },
  { code: 'US', label: '🇺🇸  United States' },
  { code: 'UK', label: '🇬🇧  United Kingdom' },
  { code: 'EU', label: '🇩🇪  Germany / EU' },
  { code: 'CA', label: '🇨🇦  Canada' },
];

const GROUP_COLORS = {
  Text:    'bg-blue-50 text-blue-700 border-blue-200',
  Bullets: 'bg-violet-50 text-violet-700 border-violet-200',
  Images:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ClearAttribute({ accountType, clientId, accountId, setLogs }) {
  const [sku, setSku] = useState('');
  const [asin, setAsin] = useState('');
  const [country, setCountry] = useState('IN');
  const [attributeKey, setAttributeKey] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedAttr = ATTRIBUTES.find(a => a.key === attributeKey);
  const canSubmit = !!clientId && sku.trim() && attributeKey && confirmed && !isLoading;

  const handleSubmit = async () => {
    if (!clientId) {
      setLogs([{ type: 'error', message: 'Please select a client first.' }]);
      return;
    }
    setIsLoading(true);
    setLogs([{
      type: 'info',
      message: `${dryRun ? '[DRY RUN] ' : ''}Removing "${selectedAttr?.label}" for SKU ${sku.trim()}…`
    }]);

    try {
      const res = await apiFetch('/api/listing/attribute', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku.trim(),
          asin: asin.trim() || null,
          country,
          attribute_key: attributeKey,
          dry_run: dryRun,
          account_type: accountType,
          client_id: clientId,
          override_id: (accountId || '').trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setLogs(prev => [...prev, {
          type: 'success',
          sku: sku.trim(),
          message: `Attribute "${selectedAttr?.label}" cleared successfully`,
          response: data
        }]);
        if (!dryRun) {
          setSku('');
          setAsin('');
          setAttributeKey('');
          setConfirmed(false);
        }
      } else {
        setLogs(prev => [...prev, {
          type: 'error',
          sku: sku.trim(),
          message: data.detail || 'Unknown API error'
        }]);
      }
    } catch (err) {
      setLogs(prev => [...prev, {
        type: 'error',
        sku: sku.trim(),
        message: `Network error: ${err.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Group attributes for rendering
  const groups = ['Text', 'Bullets', 'Images'];

  return (
    <div className="space-y-6">

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          This calls <code className="font-mono bg-blue-100 px-1 rounded">PATCH patchListingsItem</code> with{' '}
          <code className="font-mono bg-blue-100 px-1 rounded">op: "delete"</code> (JSON Patch RFC 6902).
          It removes only the selected attribute, leaving the rest of the listing untouched.
          <strong className="text-blue-900"> Not supported for Vendor Central.</strong>
        </p>
      </div>

      {/* Identifiers Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Merchant SKU
          </label>
          <input
            type="text"
            className="input-field font-mono"
            placeholder="e.g. MY-SKU-001"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Amazon ASIN
          </label>
          <input
            type="text"
            className="input-field font-mono"
            placeholder="e.g. B08ABC123X"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
          />
        </div>
        <div className="md:col-span-2 lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Marketplace
          </label>
          <div className="relative">
            <select
              className="select-field"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {MARKETPLACES.map(m => (
                <option key={m.code} value={m.code}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Attribute picker grid */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Select Attribute to Clear
        </label>
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group}>
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">{group}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {ATTRIBUTES.filter(a => a.group === group).map(attr => {
                  const isSelected = attributeKey === attr.key;
                  return (
                    <button
                      key={attr.key}
                      onClick={() => setAttributeKey(attr.key)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all duration-150 
                        ${isSelected
                          ? 'bg-gray-900 border-gray-900 text-white shadow-md'
                          : `${GROUP_COLORS[group]} hover:opacity-80`}`}
                    >
                      <div className="font-semibold text-[12px] leading-tight">{attr.label}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-gray-300' : 'opacity-60'}`}>
                        {attr.note}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected attribute summary */}
      {selectedAttr && (
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-gray-700">
            Will clear <strong className="text-gray-900">{selectedAttr.label}</strong>
            {' '}(<code className="font-mono text-xs bg-gray-100 px-1 rounded">{selectedAttr.note}</code>)
            {' '}for SKU <strong className="font-mono text-gray-900">{sku || '—'}</strong> on {country}
          </p>
        </div>
      )}

      {/* Dry run toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none group">
        <div
          onClick={() => setDryRun(p => !p)}
          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
            ${dryRun ? 'bg-amber-500 border-amber-500' : 'border-gray-300 group-hover:border-amber-400'}`}
        >
          {dryRun && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <input type="checkbox" className="sr-only" checked={dryRun} onChange={() => setDryRun(p => !p)} />
        <span className="text-sm text-gray-600">
          <strong className={dryRun ? 'text-amber-700' : 'text-gray-900'}>
            {dryRun ? 'Dry Run Mode — no changes will be made' : 'Live Mode — changes will be applied to Amazon'}
          </strong>
        </span>
      </label>

      {/* Confirmation */}
      <label className="flex items-center gap-3 cursor-pointer select-none group">
        <div
          onClick={() => setConfirmed(p => !p)}
          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
            ${confirmed ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-500'}`}
        >
          {confirmed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <input type="checkbox" className="sr-only" checked={confirmed} onChange={() => setConfirmed(p => !p)} />
        <span className="text-sm text-gray-600">
          I confirm I want to <strong className="text-gray-900">clear this attribute</strong> from the Amazon listing.
        </span>
      </label>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-3.5 rounded-xl text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all
          ${canSubmit
            ? dryRun
              ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md hover:shadow-lg'
              : 'bg-gray-900 text-white hover:bg-gray-700 shadow-md hover:shadow-lg'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
      >
        <Eraser className="w-4 h-4" />
        {isLoading
          ? 'Clearing attribute…'
          : dryRun
            ? 'Validate (Dry Run) →'
            : 'Clear Attribute →'}
      </button>
    </div>
  );
}
