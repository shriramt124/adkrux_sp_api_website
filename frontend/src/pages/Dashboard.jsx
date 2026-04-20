import React, { useState } from 'react';
import { Store, Building2, Upload, Trash2, Eraser } from 'lucide-react';
import UploadSection from '../components/UploadSection';
import DeleteSection from '../components/DeleteSection';
import ClearAttribute from '../components/ClearAttribute';
import TerminalView from '../components/TerminalView';
import { apiFetch } from '../lib/api';

const TABS = [
  { id: 'upload', label: 'Bulk Upload',      Icon: Upload },
  { id: 'delete', label: 'Delete Listing',   Icon: Trash2 },
  { id: 'clear',  label: 'Clear Attribute',  Icon: Eraser },
];

export default function Dashboard() {
  const [accountType, setAccountType] = useState('seller');
  const [activeTab, setActiveTab] = useState('upload');
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const uploadStopRef = React.useRef(null);

  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [accountId, setAccountId] = useState('');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch('/api/clients');
        const data = await res.json();
        if (!alive) return;
        const list = data?.clients || [];
        setClients(list);
        const first = list[0];
        if (first && !clientId) {
          setClientId(first.id);
          setAccountId(accountType === 'vendor' ? (first.default_vendor_code || '') : (first.default_seller_id || ''));
        }
      } catch {
        if (!alive) return;
        setClients([]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    setAccountId(accountType === 'vendor' ? (c.default_vendor_code || '') : (c.default_seller_id || ''));
  }, [accountType]);

  const onClientChange = (newId) => {
    setClientId(newId);
    const c = clients.find(x => x.id === newId);
    if (c) {
      setAccountId(accountType === 'vendor' ? (c.default_vendor_code || '') : (c.default_seller_id || ''));
    } else {
      setAccountId('');
    }
  };

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Page header */}
        <div className="mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">SP-API Gateway</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage Amazon listings via Listings Items API v2021-08-01.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLogs([])}
              className="btn-secondary text-sm"
            >
              Clear Output
            </button>
            {activeTab === 'upload' && (
              <button
                type="button"
                onClick={() => uploadStopRef.current?.()}
                disabled={!isProcessing}
                className={`text-sm font-bold rounded-xl px-4 py-2 transition-all
                  ${isProcessing ? 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                Stop
              </button>
            )}
            <span
              className={`badge ${isProcessing ? 'badge-amber' : 'badge-blue'}`}
            >
              {isProcessing ? 'RUNNING' : 'IDLE'}
            </span>
          </div>
        </div>

        {/* Account type toggle */}
        <div className="flex items-center gap-2 mb-6 p-1 bg-white border border-gray-200 rounded-xl w-fit">
          <button
            onClick={() => setAccountType('seller')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150
              ${accountType === 'seller'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Store className="w-4 h-4" /> Seller Central
          </button>
          <button
            onClick={() => setAccountType('vendor')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150
              ${accountType === 'vendor'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Building2 className="w-4 h-4" /> Vendor Central
          </button>
        </div>

        {/* Client + Identifier */}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Client
            </label>
            <select
              className="select-field"
              value={clientId}
              onChange={(e) => onClientChange(e.target.value)}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              {accountType === 'vendor' ? 'Vendor Code (Editable)' : 'Seller ID (Editable)'}
            </label>
            <input
              type="text"
              className="input-field font-mono"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder={accountType === 'vendor' ? 'e.g. 3O93D' : 'e.g. A2XXXXXX'}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Override is optional; must match the selected client’s refresh token.
            </p>
          </div>
        </div>

        {/* Main layout: left controls, right output */}
        <div className="grid lg:grid-cols-[1fr,420px] gap-6 items-start">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Tab nav */}
            <div className="flex flex-wrap border-b border-gray-100">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setLogs([]); }}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold transition-colors border-b-2 -mb-px
                    ${activeTab === id
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700'}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-5 sm:p-6 md:p-8">
              {activeTab === 'upload' && (
                <UploadSection
                  accountType={accountType}
                  clientId={clientId}
                  accountId={accountId}
                  setLogs={setLogs}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                  stopRef={uploadStopRef}
                />
              )}
              {activeTab === 'delete' && (
                <DeleteSection accountType={accountType} clientId={clientId} accountId={accountId} setLogs={setLogs} />
              )}
              {activeTab === 'clear' && (
                <ClearAttribute accountType={accountType} clientId={clientId} accountId={accountId} setLogs={setLogs} />
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-24">
            <TerminalView logs={logs} />
          </div>
        </div>

        {/* Tiny footer note */}
        <p className="text-xs text-gray-400 text-center mt-6">
          Credentials are loaded server-side per client — no secrets stored in browser.
        </p>
      </div>
    </div>
  );
}
