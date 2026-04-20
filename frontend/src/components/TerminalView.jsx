import React, { useEffect, useRef } from 'react';
import { Terminal, CheckCircle2, XCircle, Info, Flag } from 'lucide-react';

export default function TerminalView({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Live Output</span>
          <span className="ml-auto badge badge-blue">0 events</span>
        </div>

        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 text-xs text-gray-400 font-mono">SP-API Gateway — Live Stream</span>
          </div>
          <div className="px-5 py-6">
            <p className="text-sm font-semibold text-gray-800">No output yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Start an action on the left. Logs will stream here in real time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getLogMeta = (log) => {
    switch (log.type) {
      case 'info':
        return { Icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', label: 'INFO', text: log.message };
      case 'success':
        return {
          Icon: CheckCircle2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          label: 'SUCCESS',
          text: `[${log.sku || ''}] Updated successfully${log.response ? ` · status: ${log.response?.status || JSON.stringify(log.response)}` : ''}`,
        };
      case 'error':
        return {
          Icon: XCircle,
          color: 'text-red-600',
          bg: 'bg-red-50',
          label: 'ERROR',
          text: `[${log.sku || 'SYSTEM'}] ${log.message}`,
        };
      case 'complete':
        return { Icon: Flag, color: 'text-amber-700', bg: 'bg-amber-50', label: 'DONE', text: log.message };
      default:
        return { Icon: Info, color: 'text-gray-600', bg: 'bg-gray-50', label: 'LOG', text: log.message };
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Live Output</span>
        <span className="ml-auto badge badge-blue">{logs.length} events</span>
      </div>

      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        {/* Terminal title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-xs text-gray-400 font-mono">SP-API Gateway — Live Stream</span>
        </div>

        {/* Log entries */}
        <div className="bg-white max-h-72 overflow-y-auto px-4 py-3 space-y-2 font-mono text-xs">
          {logs.map((log, i) => {
            const { Icon, color, bg, label, text } = getLogMeta(log);
            return (
              <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg ${bg}`}>
                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color}`} />
                <span className={`font-bold ${color} mr-2`}>{label}</span>
                <span className="text-gray-700 leading-relaxed break-all">{text}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
