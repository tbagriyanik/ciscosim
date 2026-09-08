import React, { useState, useMemo } from 'react';
import { Trash2, Eraser, Search, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useAppStore } from '@/lib/store/appStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { CABLE_COLORS } from './networkTopology.constants';
import { getConnectionStatusMessage } from './networkTopology.helpers';
import { DraggableWindowWrapper } from './DraggableWindowWrapper';
import { useDrag } from '@/hooks/useDrag';
import { useIsMobile } from '@/hooks/use-breakpoint';
import { ProtocolTreeDetails } from './ProtocolTreeDetails';
import { PacketHexDump } from './PacketHexDump';
import type { CanvasConnection } from './networkTopology.types';

interface PacketCapturePanelProps {
  activeCaptureConnectionId: string;
  clearCapturedPackets: (id: string) => void;
  clearAllCapturedPackets: () => void;
  setActiveCaptureConnection: (id: string | null) => void;
  capturedPacketsMap: Record<string, { id: string; timestamp: number; sourceIp: string; targetIp: string; protocol: string; info: string; }[]>;
  t: Record<string, string>;
  isDark: boolean;
  connections?: CanvasConnection[];
}

const ITEMS_PER_PAGE = 10;

export const PacketCapturePanel = ({
  activeCaptureConnectionId,
  clearCapturedPackets,
  clearAllCapturedPackets,
  setActiveCaptureConnection,
  capturedPacketsMap,
  t,
  isDark,
  connections: connectionList
}: PacketCapturePanelProps) => {
  const devices = useAppStore(state => state.topology.devices);
  const graphicsQuality = useAppStore(state => state.graphicsQuality);
  const storedConnections = useAppStore(state => state.topology.connections);
  const connections = connectionList || storedConnections;
  const { language } = useLanguage();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [excludeQuery, setExcludeQuery] = useState('cdp');
  const [showExclude, setShowExclude] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isTreeExpanded, setIsTreeExpanded] = useState(false);
  const [isHexExpanded, setIsHexExpanded] = useState(false);

  const conn = connections.find(c => c.id === activeCaptureConnectionId);
  let connectionLabel = activeCaptureConnectionId;
  if (conn) {
    const srcDev = devices.find(d => d.id === conn.sourceDeviceId);
    const tgtDev = devices.find(d => d.id === conn.targetDeviceId);
    if (srcDev && tgtDev) {
      connectionLabel = `${srcDev.name} ${conn.sourcePort} - ${conn.targetPort} ${tgtDev.name}`;
    }
  }

  const statusMessage = conn ? getConnectionStatusMessage(conn, devices, language) : '';
  const hasError = conn && statusMessage !== 'Bağlantı sorunsuz' && statusMessage !== 'Connection OK';

  const [columnOrder, setColumnOrder] = useState(['time', 'source', 'dest', 'protocol', 'info']);

  const dragProps = useDrag({
    storageKey: 'packetCapture',
    defaultPosition: typeof window !== 'undefined' ? { x: Math.max(16, window.innerWidth - 640), y: window.innerHeight - 520 } : { x: 0, y: 0 },
    defaultSize: { width: 620, height: 500 },
    minSize: { width: 450, height: 350 },
    mode: 'drag-resize'
  });

  const rawPackets = capturedPacketsMap[activeCaptureConnectionId] || [];
  const [selectedPacket, setSelectedPacket] = useState<typeof rawPackets[number] | null>(null);

  // Reset page when connection or search/exclude query changes (adjust state during render)
  const resetKey = `${activeCaptureConnectionId}|${searchQuery}|${excludeQuery}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setCurrentPage(1);
  }

  const filteredPackets = useMemo(() => {
    let list = [...rawPackets].reverse();

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(pkt =>
        pkt.sourceIp.toLowerCase().includes(q) ||
        pkt.targetIp.toLowerCase().includes(q) ||
        pkt.protocol.toLowerCase().includes(q) ||
        pkt.info.toLowerCase().includes(q)
      );
    }

    if (excludeQuery.trim()) {
      const terms = excludeQuery
        .toLowerCase()
        .split(/[,;\s]+/)
        .map(t => t.trim())
        .filter(Boolean);

      if (terms.length > 0) {
        list = list.filter(pkt => {
          const src = pkt.sourceIp.toLowerCase();
          const tgt = pkt.targetIp.toLowerCase();
          const proto = pkt.protocol.toLowerCase();
          const info = pkt.info.toLowerCase();

          return !terms.some(term =>
            src.includes(term) ||
            tgt.includes(term) ||
            proto.includes(term) ||
            info.includes(term)
          );
        });
      }
    }

    return list;
  }, [rawPackets, searchQuery, excludeQuery]);

  // Auto-select first packet if none selected or if selected is lost
  const activePacket = useMemo(() => {
    if (selectedPacket && filteredPackets.some(p => p.id === selectedPacket.id)) {
      return selectedPacket;
    }
    return filteredPackets[0] || null;
  }, [selectedPacket, filteredPackets]);

  const totalPages = Math.max(1, Math.ceil(filteredPackets.length / ITEMS_PER_PAGE));
  const paginatedPackets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPackets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPackets, currentPage]);

  const onDragStart = (e: React.DragEvent, idx: number) => { e.dataTransfer.setData('text/plain', idx.toString()); };
  const onDrop = (e: React.DragEvent, targetIdx: number) => {
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIdx === targetIdx || isNaN(sourceIdx)) return;
    const newOrder = [...columnOrder];
    const [moved] = newOrder.splice(sourceIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    setColumnOrder(newOrder);
  };

  const renderHeader = (col: string, idx: number) => {
    const labelMap: Record<string, string> = { time: t.time, source: t.source, dest: t.dest, protocol: t.proto, info: t.info };
    return (
      <th
        key={col}
        draggable
        onDragStart={e => onDragStart(e, idx)}
        onDrop={e => onDrop(e, idx)}
        onDragOver={e => e.preventDefault()}
        className="px-2 py-1 border-b dark:border-secondary-700 cursor-grab active:cursor-grabbing hover:bg-secondary-200 dark:hover:bg-secondary-700 transition-colors select-none text-center"
      >
        {labelMap[col] || col}
      </th>
    );
  };

  const cableColors = CABLE_COLORS as Record<string, { primary: string; bg: string; text: string; border: string }>;

  const PROTOCOL_NUMBERS: Record<string, string> = {
    ICMP: '1',
    ICMPv6: '58',
    TCP: '6',
    UDP: '17',
    GRE: '47',
    OSPF: '89',
    EIGRP: '88',
    ARP: '0x0806',
    RARP: '0x8035',
    STP: '0x4242',
    HTTP: '80',
    HTTPS: '443',
    FTP: '21',
    SMTP: '25',
    POP3: '110',
    IMAP: '143',
    DNS: '53',
    DHCP: '67',
    SSH: '22',
    TELNET: '23',
    NTP: '123',
  };

  const protocolWithNumber = (protocol: string): string => {
    const num = PROTOCOL_NUMBERS[protocol];
    return num ? `${protocol} (${num})` : protocol;
  };

  return (
    <DraggableWindowWrapper
      id="packetCapture"
      className={graphicsQuality === 'low'
        ? `graphics-low-solid ${isDark ? '!bg-secondary-950 !border-secondary-800' : '!bg-white !border-secondary-200'}`
        : isMobile
          ? `${isDark ? '!bg-secondary-950/80 !border-secondary-700' : '!bg-white/80 !border-secondary-300'}`
          : `liquid-glass-light ${isDark ? '!bg-secondary-950/40 border-emerald-950/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]' : '!bg-white/60 border-emerald-950/80 shadow-[0_8px_28px_rgba(15,23,42,0.12)]'}`}
      title={
        <div className="flex flex-col gap-0.5 pointer-events-none">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: cableColors[conn?.cableType || 'straight']?.primary || 'var(--color-primary-500)' }}
            />
            <span className="text-xs font-bold">{t.packetAnalysis}</span>
            <span className="text-[10px] opacity-50 font-mono">({connectionLabel})</span>
          </div>
          {hasError && (
            <span className="text-[9px] text-error-500 dark:text-error-400 font-medium pl-[18px]">
              ⚠️ {statusMessage}
            </span>
          )}
        </div>
      }
      isOpen={!!activeCaptureConnectionId}
      onClose={() => setActiveCaptureConnection(null)}
      isDark={isDark}
      modalPosition={dragProps.position}
      modalSize={dragProps.size}
      handlePointerDown={dragProps.handlePointerDown}
      handleResizeStart={dragProps.handleResizeStart}
      mobileFullScreen={true}
      headerActions={
        <>
          <button
            onClick={(e) => { e.stopPropagation(); clearAllCapturedPackets(); }}
            className="p-1.5 rounded transition-colors flex items-center justify-center hover:bg-secondary-200 dark:hover:bg-secondary-700"
            title={t.clearAllCapture}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Eraser className="w-4 h-4 text-error-500" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); clearCapturedPackets(activeCaptureConnectionId); }}
            className="p-1.5 rounded transition-colors flex items-center justify-center hover:bg-secondary-200 dark:hover:bg-secondary-700"
            title={t.clearCapture}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-4 h-4 text-error-500" />
          </button>
        </>
      }
    >
      <div className="flex-1 flex flex-col min-h-0 relative h-full">
        {/* Filter Bar */}
        <div className={`p-1.5 border-b flex flex-col gap-1.5 text-[11px] shrink-0 ${graphicsQuality === 'low' ? (isDark ? 'border-secondary-800 bg-secondary-950' : 'border-secondary-200 bg-white') : isMobile ? (isDark ? 'border-secondary-700 bg-secondary-900' : 'border-secondary-300 bg-secondary-50') : (isDark ? 'border-secondary-800 bg-secondary-900/60' : 'border-secondary-200 bg-secondary-50/60')}`}>
          <div className="flex items-center gap-1.5 w-full">
            <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'tr' ? 'IP, protokol veya içerik ara...' : 'Search IP, protocol or info...'}
              className={`flex-1 bg-transparent outline-none text-xs placeholder:opacity-40 ${isDark ? 'text-white' : 'text-slate-900'}`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-0.5 rounded-full hover:bg-secondary-200 dark:hover:bg-secondary-700 opacity-60 hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowExclude(!showExclude)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${showExclude || excludeQuery
                ? isDark ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-amber-500 text-amber-800 bg-amber-50'
                : isDark ? 'border-secondary-700 text-secondary-300 opacity-60 hover:opacity-100' : 'border-secondary-300 text-secondary-700 opacity-60 hover:opacity-100'
                }`}
              title={language === 'tr' ? 'Dışlama filtresini aç/kapat' : 'Toggle exclude filter'}
            >
              {language === 'tr' ? 'Dışla' : 'Exclude'}
            </button>
          </div>

          {(showExclude || excludeQuery) && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded border shadow-sm ${isDark ? (graphicsQuality === 'low' ? 'border-secondary-700 bg-secondary-800' : 'border-secondary-700 bg-secondary-800/80') : 'border-secondary-300 bg-white'}`}>
              <span className={`text-[10px] font-bold shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                {language === 'tr' ? 'Dışlanacak:' : 'Exclude:'}
              </span>
              <input
                type="text"
                value={excludeQuery}
                onChange={(e) => setExcludeQuery(e.target.value)}
                placeholder={language === 'tr' ? 'cdp, arp, stp (virgül veya boşluk ile)...' : 'cdp, arp, stp (comma or space separated)...'}
                className={`w-full bg-transparent outline-none text-xs ${isDark ? 'text-slate-100 placeholder:text-secondary-500' : 'text-slate-900 placeholder:text-slate-400'}`}
              />
              {excludeQuery && (
                <button
                  onClick={() => setExcludeQuery('')}
                  className="p-0.5 rounded-full hover:bg-secondary-200 dark:hover:bg-secondary-700 opacity-60 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3-Pane Split View */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pr-3.5 pb-2">

          {/* Pane 1: Top Packet List */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="custom-scrollbar flex-1 overflow-auto w-full">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className={`sticky top-0 z-10 ${graphicsQuality === 'low' ? (isDark ? 'bg-secondary-950' : 'bg-secondary-100') : isMobile ? (isDark ? 'bg-secondary-900' : 'bg-secondary-100') : (isDark ? 'bg-secondary-950/90' : 'bg-secondary-100/90')} ${graphicsQuality === 'high' && !isMobile ? 'backdrop-blur-sm' : ''}`}>
                  <tr>
                    {columnOrder.map((col, idx) => renderHeader(col, idx))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackets.length ? (
                    paginatedPackets.map((pkt: { id: string; timestamp: number; sourceIp: string; targetIp: string; protocol: string; info: string; }) => {
                      const isSelected = activePacket?.id === pkt.id;
                      return (
                        <tr
                          key={pkt.id}
                          onClick={() => setSelectedPacket(pkt)}
                          className={`border-b last:border-0 cursor-pointer select-none transition-colors ${isSelected
                            ? isDark ? 'bg-primary-600/40 text-white font-semibold' : 'bg-primary-500/20 text-slate-900 font-semibold'
                            : isDark ? 'border-secondary-800/40 hover:bg-secondary-800/35' : 'border-secondary-100/30 hover:bg-secondary-50/40'
                            }`}
                        >
                          {columnOrder.map(col => {
                            switch (col) {
                              case 'time': {
                                const date = new Date(pkt.timestamp);
                                const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
                                return <td className="px-2 py-1 font-mono opacity-60 text-right" key="time">{timeStr}</td>;
                              }
                              case 'source':
                                return <td className="px-2 py-1 font-mono" key="source">{pkt.sourceIp}</td>;
                              case 'dest':
                                return <td className="px-2 py-1 font-mono" key="dest">{pkt.targetIp}</td>;
                              case 'protocol': {
                                const getProtocolColor = (proto: string) => {
                                  switch (proto.toUpperCase()) {
                                    case 'ICMP': return 'text-primary-500';
                                    case 'ICMPV6':
                                    case 'NDP': return 'text-cyan-500 dark:text-cyan-400';
                                    case 'ARP': return 'text-amber-500';
                                    case 'STP': return 'text-emerald-500';
                                    case 'HTTP': return 'text-sky-500 dark:text-sky-400';
                                    case 'HTTPS': return 'text-blue-500 dark:text-blue-400';
                                    case 'FTP': return 'text-cyan-500 dark:text-cyan-400';
                                    case 'SMTP':
                                    case 'POP3':
                                    case 'IMAP':
                                    case 'MAIL': return 'text-rose-500 dark:text-rose-400';
                                    case 'DNS': return 'text-indigo-500 dark:text-indigo-400';
                                    case 'DHCP': return 'text-orange-500 dark:text-orange-400';
                                    case 'SSH':
                                    case 'TELNET': return 'text-teal-500 dark:text-teal-400';
                                    default: return 'text-purple-500';
                                  }
                                };
                                return <td className={`px-2 py-1 font-bold ${getProtocolColor(pkt.protocol)}`} key="proto">{protocolWithNumber(pkt.protocol)}</td>;
                              }
                              case 'info':
                                return <td className="px-2 py-1 italic opacity-80" key="info">{pkt.info}</td>;
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={columnOrder.length} className="px-4 py-8 text-center opacity-40 italic">
                        {searchQuery ? (language === 'tr' ? 'Aramayla eşleşen paket bulunamadı.' : 'No packets matching search query.') : t.noPacketsCaptured}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {filteredPackets.length > 0 && (
              <div className={`px-2 py-1 border-t flex items-center justify-between text-[10px] select-none shrink-0 ${graphicsQuality === 'low' ? (isDark ? 'border-secondary-800 bg-secondary-950' : 'border-secondary-200 bg-secondary-100') : isMobile ? (isDark ? 'border-secondary-700 bg-secondary-900' : 'border-secondary-300 bg-secondary-50') : (isDark ? 'border-secondary-800 bg-secondary-950/60' : 'border-secondary-200 bg-secondary-100/60')}`}>
                <span className="opacity-60">
                  {language === 'tr'
                    ? `Toplam ${filteredPackets.length} paket (Sayfa ${currentPage} / ${totalPages})`
                    : `Total ${filteredPackets.length} packets (Page ${currentPage} of ${totalPages})`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-0.5 rounded hover:bg-secondary-200 dark:hover:bg-secondary-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-bold font-mono text-[10px]">{currentPage}</span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-0.5 rounded hover:bg-secondary-200 dark:hover:bg-secondary-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Pinned Collapsible Panes */}
          <div className="mt-auto shrink-0 flex flex-col">
            {/* Pane 2: Middle Protocol Details Tree */}
            <div className={`border-t dark:border-secondary-800 border-secondary-200 overflow-hidden flex flex-col transition-all ${isTreeExpanded ? 'h-[160px]' : 'h-auto'}`}>
              <button
                type="button"
                onClick={() => setIsTreeExpanded(prev => !prev)}
                className={`w-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase border-b flex items-center justify-between transition-colors select-none ${isDark ? 'bg-secondary-900/90 text-secondary-400 border-secondary-800 hover:bg-secondary-800/80' : 'bg-secondary-100 text-secondary-600 border-secondary-200 hover:bg-secondary-200/80'}`}
              >
                <span>{language === 'tr' ? '2. Katman / Protokol Ağacı' : '2. Protocol Details Tree'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isTreeExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isTreeExpanded && (
                activePacket ? (
                  <ProtocolTreeDetails packet={activePacket} isDark={isDark} language={language} />
                ) : (
                  <div className="p-4 text-center text-xs opacity-40 italic">
                    {language === 'tr' ? 'Detayları görmek için listeden paket seçin' : 'Select a packet from the list to inspect protocol tree'}
                  </div>
                )
              )}
            </div>

            {/* Pane 3: Bottom Hex & ASCII Dump */}
            <div className={`border-t dark:border-secondary-800 border-secondary-200 overflow-hidden flex flex-col transition-all ${isHexExpanded ? 'h-[130px]' : 'h-auto'}`}>
              <button
                type="button"
                onClick={() => setIsHexExpanded(prev => !prev)}
                className={`w-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase flex items-center justify-between transition-colors select-none ${isHexExpanded ? 'border-b' : ''} ${isDark ? 'bg-secondary-900/90 text-secondary-400 border-secondary-800 hover:bg-secondary-800/80' : 'bg-secondary-100 text-secondary-600 border-secondary-200 hover:bg-secondary-200/80'}`}
              >
                <span>{language === 'tr' ? '3. Bayt Dökümü (Hex / ASCII)' : '3. Packet Bytes (Hex / ASCII)'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isHexExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isHexExpanded && (
                activePacket ? (
                  <PacketHexDump packet={activePacket} isDark={isDark} />
                ) : (
                  <div className="p-4 text-center text-xs opacity-40 italic">
                    {language === 'tr' ? 'Bayt dökümü için paket seçin' : 'Select a packet to view hex bytes'}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </DraggableWindowWrapper>
  );
};
