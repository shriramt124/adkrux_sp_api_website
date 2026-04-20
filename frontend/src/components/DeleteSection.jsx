import React, { useState } from 'react';
import { Trash2, AlertTriangle, ChevronDown } from 'lucide-react';
import { apiFetch } from '../lib/api';

const MARKETPLACES = [
  { code: 'IN', label: '🇮🇳  India' },
  { code: 'US', label: '🇺🇸  United States' },
  { code: 'UK', label: '🇬🇧  United Kingdom' },
  { code: 'EU', label: '🇩🇪  Germany / EU' },
  { code: 'CA', label: '🇨🇦  Canada' },
];

export default function DeleteSection({ accountType, clientId, accountId, setLogs }) {
  const [sku, setSku] = useState('');
  const [asin, setAsin] = useState('');
  const [country, setCountry] = useState('IN');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const canDelete = !!clientId && sku.trim().length > 0 && confirmed && !isDeleting;

  const handleDelete = async () => {
    if (!clientId) {
      setLogs([{ type: 'error', message: 'Please select a client first.' }]);
      return;
    }
    setIsDeleting(true);
    setLogs([{ type: 'info', message: `Initiating DELETE for ${sku.trim()} on marketplace ${country}…` }]);

    try {
      const res = await apiFetch('/api/listing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sku: sku.trim(), 
          asin: asin.trim() || null,
          country, 
          account_type: accountType,
          client_id: clientId,
          override_id: (accountId || '').trim() || null,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setLogs(prev => [...prev, { type: 'success', sku: sku.trim(), response: data }]);
        setSku('');
        setConfirmed(false);
      } else {
        setLogs(prev => [...prev, { type: 'error', sku: sku.trim(), message: data.detail || 'Unknown API error' }]);
      }
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', sku: sku.trim(), message: `Network error: ${err.message}` }]);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-red-600 leading-relaxed">
          This calls the <code className="font-mono bg-red-100 px-1 rounded">DELETE /listings/2021-08-01/items</code> SP-API endpoint.
          It permanently removes the listing from the selected marketplace. This cannot be easily undone.
        </p>
      </div>

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
              {MARKETPLACES.map((m) => (
                <option key={m.code} value={m.code}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none group">
        <div
          onClick={() => setConfirmed(p => !p)}
          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
            ${confirmed ? 'bg-red-600 border-red-600' : 'border-gray-300 group-hover:border-red-400'}`}
        >
          {confirmed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <input type="checkbox" className="sr-only" checked={confirmed} onChange={() => setConfirmed(p => !p)} />
        <span className="text-sm text-gray-600">
          I understand this will <strong className="text-gray-900">permanently delete</strong> this listing from Amazon.
        </span>
      </label>

      <button
        onClick={handleDelete}
        disabled={!canDelete}
        className={`w-full py-3 rounded-xl text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all
          ${canDelete
            ? 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
      >
        <Trash2 className="w-4 h-4" />
        {isDeleting ? 'Deleting listing…' : 'Delete This Listing'}
      </button>
    </div>
  );
}
