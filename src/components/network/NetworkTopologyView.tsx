import React from 'react';
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';
import { NetworkTopologyContextMenu } from './NetworkTopologyContextMenu';
import { NetworkTopologyPortSelectorModal } from './NetworkTopologyPortSelectorModal';
import { CABLE_COLORS, MIN_ZOOM, MAX_ZOOM } from './networkTopology.constants';

type NetworkTopologyViewProps = Record<string, any>;

export function NetworkTopologyView(props: NetworkTopologyViewProps) {
  const {
    isDark,
    language,
    isMobile,
    cableInfo,
    devices,
    connections,
    notes,
    selectedDeviceIds,
    selectedNoteIds,
    activeDeviceId,
    isDrawingConnection,
    isActuallyDragging,
    isTouchDragging,
    draggedDevice,
    touchDraggedDevice,
    selectAllMode,
    pan,
    zoom,
    canvasRef,
    handleCanvasMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    setIsDrawingConnection,
    setConnectionStart,
    setSelectAllMode,
    handleDeviceMouseDown,
    handleDeviceClick,
    handleDeviceDoubleClick,
    handleContextMenu,
    handleDeviceTouchStart,
    handleDeviceTouchMove,
    handleDeviceTouchEnd,
    renderDevice,
    renderTempConnection,
    renderConnectionHandle,
    handleNoteTouchStart,
    handleNoteContextMenu,
    handleNoteMouseDown,
    handleNoteResizeStart,
    noteTextareaRefs,
    updateNoteText,
    saveToHistory,
    onTopologyChange,
    addNote,
    setIsPaletteOpen,
    setShowPortSelector,
    setPortSelectorStep,
    setSelectedSourcePort,
    resetView,
    toggleFullscreen,
    getCanvasDimensions,
    getPortPosition,
    handlePortHover,
    handlePortMouseLeave,
    showPortSelector,
    portSelectorStep,
    selectedSourcePort,
    closePortSelector,
    handlePortSelectorSelectPort,
    portTooltip,
    deviceTooltip,
    contextMenu,
    contextMenuRef,
    noteFonts,
    noteClipboard,
    clipboard,
    historyIndex,
    history,
    handleUndo,
    handleRedo,
    selectAllDevices,
    handleDeviceDoubleClick: openDevice,
    cutDevice,
    copyDevice,
    pasteDevice,
    deleteDevice,
    startDeviceConfig,
    setPingSource,
    saveToHistory: saveHistory,
    deleteNote,
    handleNoteTextCut,
    handleNoteTextCopy,
    handleNoteTextPaste,
    handleNoteTextDelete,
    handleNoteTextSelectAll,
    pasteNotes,
    updateNoteStyle,
    connectionError,
    renderMobilePalette,
    renderMobileBottomBar,
    pingSource,
    startPingAnimation,
    pingAnimation,
  } = props;

  return (
    <div className="relative w-full h-full">
      {/* Header with Tools */}
      {renderMobileBottomBar()}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="w-full flex-1 min-h-[450px] overflow-hidden cursor-grab active:cursor-grabbing relative touch-none select-none"
        onMouseDown={handleCanvasMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (isDrawingConnection) {
            setIsDrawingConnection(false);
            setConnectionStart(null);
          }
          if (selectAllMode) {
            setSelectAllMode(false);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e)}
      >
        <svg width="100%" height="100%" className="select-none">
          <g
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: '0 0',
              willChange: 'transform'
            }}
          >
            <defs>
              <clipPath id="canvasClip">
                <rect x="0" y="0" width={getCanvasDimensions().width} height={getCanvasDimensions().height} />
              </clipPath>
              <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill={isDark ? '#334155' : '#94a3b8'} />
              </pattern>
            </defs>

            <g clipPath="url(#canvasClip)">
              <rect
                x="0"
                y="0"
                width={getCanvasDimensions().width}
                height={getCanvasDimensions().height}
                fill={isDark ? '#1e293b' : '#f8fafc'}
              />
              <rect
                x="0"
                y="0"
                width={getCanvasDimensions().width}
                height={getCanvasDimensions().height}
                fill="url(#gridPattern)"
              />

              {connections.map((conn: any, index: number) => {
                const sourceDevice = devices.find((d: any) => d.id === conn.sourceDeviceId);
                const targetDevice = devices.find((d: any) => d.id === conn.targetDeviceId);
                if (!sourceDevice || !targetDevice) return null;

                const sameDeviceConnections = connections.filter(
                  (c: any) =>
                    (c.sourceDeviceId === conn.sourceDeviceId && c.targetDeviceId === conn.targetDeviceId) ||
                    (c.sourceDeviceId === conn.targetDeviceId && c.targetDeviceId === conn.sourceDeviceId)
                );
                const sameConnIndex = sameDeviceConnections.findIndex((c: any) => c.id === conn.id);
                const totalSameConns = sameDeviceConnections.length;

                return (
                  <g key={`line-${conn.id}`}>
                    <ConnectionLine
                      connection={conn}
                      sourceDevice={sourceDevice}
                      targetDevice={targetDevice}
                      isDark={isDark}
                      isDragging={isActuallyDragging || isTouchDragging}
                      totalSameConns={totalSameConns}
                      sameConnIndex={sameConnIndex}
                      getPortPosition={getPortPosition}
                      CABLE_COLORS={CABLE_COLORS as any}
                    />
                    {renderConnectionHandle(conn)}
                  </g>
                );
              })}

              {renderTempConnection()}

              {devices.map((device: any) => {
                const isCurrentlyDragging =
                  (draggedDevice === device.id && isActuallyDragging) ||
                  (touchDraggedDevice === device.id && isTouchDragging);
                return (
                  <DeviceNode
                    key={device.id}
                    device={device}
                    isSelected={selectedDeviceIds.includes(device.id)}
                    isDragging={isCurrentlyDragging}
                    isActive={activeDeviceId === device.id}
                    isDark={isDark}
                    onMouseDown={(e: any, id: string) => handleDeviceMouseDown(e, id)}
                    onClick={(e: any, dev: any) => handleDeviceClick(e, dev)}
                    onDoubleClick={() => handleDeviceDoubleClick(device)}
                    onContextMenu={(e: any, id: string) => handleContextMenu(e, id)}
                    onTouchStart={(e: any, id: string) => handleDeviceTouchStart(e, id)}
                    onTouchMove={handleDeviceTouchMove}
                    onTouchEnd={handleDeviceTouchEnd}
                    renderDeviceContent={renderDevice}
                  />
                );
              })}

              {notes.map((note: any) => (
                <foreignObject
                  key={note.id}
                  x={note.x}
                  y={note.y}
                  width={note.width}
                  height={note.height}
                  data-note-id={note.id}
                  className="pointer-events-none"
                >
                  <div
                    className={`pointer-events-auto relative flex flex-col w-full h-full rounded-lg shadow-lg border ${isDark
                      ? 'border-amber-300/60 text-slate-900'
                      : 'border-yellow-200 text-slate-800'
                      } ${selectedNoteIds.includes(note.id) ? 'ring-2 ring-emerald-400/70' : ''}`}
                    data-note-id={note.id}
                    style={{ backgroundColor: note.color, fontFamily: note.font, opacity: note.opacity }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        props.setSelectedNoteIds((prev: any[]) => prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]);
                      } else {
                        props.setSelectedNoteIds([note.id]);
                        props.setSelectedDeviceIds([]);
                      }
                    }}
                    onTouchStart={(e) => handleNoteTouchStart(e, note.id)}
                    onContextMenu={(e) => handleNoteContextMenu(e, note.id, 'note-edit')}
                  >
                    <div
                      data-note-drag-handle
                      onMouseDown={(e) => handleNoteMouseDown(e, note.id)}
                      onContextMenu={(e) => handleNoteContextMenu(e, note.id, 'note-style')}
                      className={`flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-widest cursor-move select-none ${isDark ? 'bg-black/10' : 'bg-black/5'
                        }`}
                      style={{ height: props.NOTE_HEADER_HEIGHT }}
                    >
                      <span />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                        className="px-1.5 py-0.5 rounded hover:bg-black/10"
                        title={language === 'tr' ? 'Sil' : 'Delete'}
                      >
                        <props.Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <textarea
                      ref={(el) => { noteTextareaRefs.current[note.id] = el; }}
                      data-note-textarea
                      value={note.text}
                      onChange={(e) => updateNoteText(note.id, e.target.value)}
                      onBlur={() => {
                        saveToHistory();
                        if (onTopologyChange) {
                          onTopologyChange(devices, connections, notes);
                        }
                      }}
                      className="flex-1 px-2 py-1 bg-transparent outline-none resize-none"
                      style={{ fontSize: note.fontSize, height: note.height - props.NOTE_HEADER_HEIGHT - 6 }}
                    />
                    {!isMobile && (
                      <div
                        className="absolute right-1 bottom-1 w-4 h-4 cursor-se-resize"
                        onMouseDown={(e) => handleNoteResizeStart(e, note.id)}
                        title={language === 'tr' ? 'Boyutu Değiştir' : 'Resize'}
                      >
                        <svg viewBox="0 0 12 12" className="w-full h-full text-black/50">
                          <path d="M4 12 L12 4" stroke="currentColor" strokeWidth="1" />
                          <path d="M7 12 L12 7" stroke="currentColor" strokeWidth="1" />
                          <path d="M10 12 L12 10" stroke="currentColor" strokeWidth="1" />
                        </svg>
                      </div>
                    )}
                  </div>
                </foreignObject>
              ))}

              {pingAnimation && (() => {
                const { path, currentHopIndex, progress, success } = pingAnimation;
                if (!path || path.length < 2 || success !== null) return null;
                const fromDevice = devices.find((d: any) => d.id === path[currentHopIndex]);
                const toDevice = devices.find((d: any) => d.id === path[currentHopIndex + 1]);
                if (!fromDevice || !toDevice) return null;
                const conn = connections.find(
                  (c: any) =>
                    (c.sourceDeviceId === fromDevice.id && c.targetDeviceId === toDevice.id) ||
                    (c.sourceDeviceId === toDevice.id && c.targetDeviceId === fromDevice.id)
                );
                let source: { x: number; y: number };
                let target: { x: number; y: number };
                if (conn) {
                  source = getPortPosition(fromDevice, conn.sourceDeviceId === fromDevice.id ? conn.sourcePort : conn.targetPort);
                  target = getPortPosition(toDevice, conn.sourceDeviceId === toDevice.id ? conn.sourcePort : conn.targetPort);
                } else {
                  source = props.getDeviceCenter(fromDevice);
                  target = props.getDeviceCenter(toDevice);
                }
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                const sameDeviceConnections = connections.filter(
                  (c: any) =>
                    (c.sourceDeviceId === fromDevice.id && c.targetDeviceId === toDevice.id) ||
                    (c.sourceDeviceId === toDevice.id && c.targetDeviceId === fromDevice.id)
                );
                const sameConnIndex = conn ? sameDeviceConnections.findIndex((c: any) => c.id === conn.id) : 0;
                const totalSameConns = sameDeviceConnections.length;
                const maxOffset = 20;
                const offset = totalSameConns > 1
                  ? (sameConnIndex - (totalSameConns - 1) / 2) * (maxOffset / Math.max(totalSameConns - 1, 1))
                  : 0;
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const perpX = -dy / len * offset;
                const perpY = dx / len * offset;
                const controlPoint1 = { x: midX + perpX, y: source.y + perpY + Math.abs(offset) * 0.5 };
                const controlPoint2 = { x: midX + perpX, y: target.y + perpY - Math.abs(offset) * 0.5 };
                const t = progress;
                const t2 = t * t;
                const t3 = t2 * t;
                const mt = 1 - t;
                const mt2 = mt * mt;
                const mt3 = mt2 * mt;
                const bezierX = mt3 * source.x + 3 * mt2 * t * controlPoint1.x + 3 * mt * t2 * controlPoint2.x + t3 * target.x;
                const bezierY = mt3 * source.y + 3 * mt2 * t * controlPoint1.y + 3 * mt * t2 * controlPoint2.y + t3 * target.y;
                const angle = Math.atan2(target.y - source.y, target.x - source.x);
                const envelopeOffsetX = Math.sin(angle) * 20;
                const envelopeOffsetY = -Math.cos(angle) * 20;
                return (
                  <g key={`ping-${currentHopIndex}`}>
                    <g transform={`translate(${bezierX + envelopeOffsetX}, ${bezierY + envelopeOffsetY})`}>
                      <circle r="10" fill="#06b6d4" opacity={0.2} className="animate-ping" />
                      <rect x="-12" y="-8" width="24" height="16" rx="2" fill="#06b6d4" stroke="#0891b2" strokeWidth="1.5" />
                      <path d="M-9 -5 L0 3 L9 -5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </g>
                  </g>
                );
              })()}
            </g>

            <rect
              x="0"
              y="0"
              width={getCanvasDimensions().width}
              height={getCanvasDimensions().height}
              fill="none"
              stroke={isDark ? '#3b82f6' : '#2563eb'}
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom},${4 / zoom}`}
              opacity={0.7}
            />
            <text
              x={getCanvasDimensions().width - 80}
              y={getCanvasDimensions().height - 10}
              fill={isDark ? '#64748b' : '#64748b'}
              fontSize={12 / zoom}
              fontFamily="monospace"
            >
              {getCanvasDimensions().width} X {getCanvasDimensions().height}
            </text>
          </g>
        </svg>
      </div>

      {/* Zoom Controls - Desktop Only - Top Right */}
      <div
        className={`hidden md:flex absolute top-2 right-2 items-center gap-1 px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800/90' : 'bg-white/90'
          } shadow-lg`}
      >
        <button
          onClick={() => setZoom((z: number) => {
            const newZoom = Math.max(MIN_ZOOM, z - 0.25);
            if (!canvasRef.current) return newZoom;
            const rect = canvasRef.current.getBoundingClientRect();
            const cursorX = rect.width / 2;
            const cursorY = rect.height / 2;
            props.setPan((prevPan: any) => ({
              x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
              y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
            }));
            return newZoom;
          })}
          className={`w-7 h-7 flex items-center justify-center rounded ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
        >
          -
        </button>
        <span className={`text-xs font-mono w-12 text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z: number) => {
            const newZoom = Math.min(MAX_ZOOM, z + 0.25);
            if (!canvasRef.current) return newZoom;
            const rect = canvasRef.current.getBoundingClientRect();
            const cursorX = rect.width / 2;
            const cursorY = rect.height / 2;
            props.setPan((prevPan: any) => ({
              x: cursorX - (cursorX - prevPan.x) * (newZoom / z),
              y: cursorY - (cursorY - prevPan.y) * (newZoom / z)
            }));
            return newZoom;
          })}
          className={`w-7 h-7 flex items-center justify-center rounded ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
        >
          +
        </button>
        <div className={`w-px h-5 ${isDark ? 'bg-slate-600' : 'bg-slate-300'} mx-1`} />
        <button
          onClick={resetView}
          className={`px-2 py-1 text-xs rounded ${isDark
            ? 'hover:bg-slate-700 text-slate-300'
            : 'hover:bg-slate-100 text-slate-600'
            }`}
        >
          {language === 'tr' ? 'Sıfırla' : 'Reset'}
        </button>
        <button
          onClick={toggleFullscreen}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark
            ? 'hover:bg-slate-700 text-slate-300'
            : 'hover:bg-slate-100 text-slate-600'
            }`}
        >
          {props.isFullscreen ? (language === 'tr' ? 'Çık' : 'Exit') : (language === 'tr' ? 'Tam Ekran' : 'Fullscreen')}
        </button>
      </div>

      {/* Connection Error Toast */}
      {connectionError && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 bg-red-600 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">{connectionError}</span>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {renderMobilePalette()}

      <NetworkTopologyPortSelectorModal
        isOpen={showPortSelector}
        isDark={isDark}
        language={language}
        devices={devices}
        cableType={cableInfo.cableType}
        portSelectorStep={portSelectorStep}
        selectedSourcePort={selectedSourcePort}
        onClose={closePortSelector}
        onCableTypeChange={(type: any) => props.onCableChange({ ...cableInfo, cableType: type })}
        onSelectPort={handlePortSelectorSelectPort}
      />

      <NetworkTopologyContextMenu
        contextMenu={contextMenu}
        contextMenuRef={contextMenuRef}
        isDark={isDark}
        language={language}
        noteFonts={noteFonts}
        notes={notes}
        devices={devices}
        selectedDeviceIds={selectedDeviceIds}
        clipboardLength={clipboard.length}
        noteClipboardLength={noteClipboard.length}
        historyIndex={historyIndex}
        historyLength={history.length}
        onClose={() => props.setContextMenu(null)}
        onUpdateNoteStyle={updateNoteStyle}
        onNoteCut={handleNoteTextCut}
        onNoteCopy={handleNoteTextCopy}
        onNotePaste={handleNoteTextPaste}
        onNoteDeleteText={handleNoteTextDelete}
        onNoteSelectAllText={handleNoteTextSelectAll}
        onPasteNotes={pasteNotes}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSelectAll={selectAllDevices}
        onOpenDevice={(device: any) => openDevice(device)}
        onCutDevices={cutDevice}
        onCopyDevices={copyDevice}
        onPasteDevice={pasteDevice || undefined}
        onDeleteDevices={(ids: string[]) => ids.forEach((id) => deleteDevice(id))}
        onStartConfig={startDeviceConfig}
        onStartPing={(id: string) => setPingSource(id)}
        onSaveToHistory={saveHistory}
        onClearDeviceSelection={() => props.setSelectedDeviceIds([])}
      />

      {/* Port Tooltip */}
      {portTooltip && portTooltip.visible && (
        <div
          className={`fixed z-[100] pointer-events-none transition-opacity duration-300 ${portTooltip.visible ? 'opacity-100' : 'opacity-0'
            }`}
          style={{
            left: portTooltip.x,
            top: portTooltip.y - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div
            className={`px-3 py-2 rounded-xl shadow-2xl border backdrop-blur-md ${isDark
              ? 'bg-slate-900/90 border-slate-700 text-white shadow-cyan-500/10'
              : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
              }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${devices.find((d: any) => d.id === portTooltip.deviceId)?.ports.find((p: any) => p.id === portTooltip.portId)?.shutdown
                ? 'bg-red-500'
                : devices.find((d: any) => d.id === portTooltip.deviceId)?.ports.find((p: any) => p.id === portTooltip.portId)?.status === 'connected'
                  ? 'bg-green-500'
                  : 'bg-slate-400'
                }`} />
              <span className="text-[10px] font-black tracking-widest uppercase opacity-60">
                {portTooltip.portId}
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="text-xs font-bold">
                {language === 'tr' ? 'Durum:' : 'Status:'}{' '}
                <span className={
                  devices.find((d: any) => d.id === portTooltip.deviceId)?.ports.find((p: any) => p.id === portTooltip.portId)?.shutdown
                    ? 'text-red-500'
                    : devices.find((d: any) => d.id === portTooltip.deviceId)?.ports.find((p: any) => p.id === portTooltip.portId)?.status === 'connected'
                      ? 'text-green-500'
                      : 'text-slate-400'
                }>
                  {devices.find((d: any) => d.id === portTooltip.deviceId)?.ports.find((p: any) => p.id === portTooltip.portId)?.shutdown
                    ? (language === 'tr' ? 'Kapalı (Shutdown)' : 'Shutdown')
                    : devices.find((d: any) => d.id === portTooltip.deviceId)?.ports.find((p: any) => p.id === portTooltip.portId)?.status === 'connected'
                      ? (language === 'tr' ? 'Bağlı (Up)' : 'Connected (Up)')
                      : (language === 'tr' ? 'Bağlı Değil (Down)' : 'Not Connected (Down)')
                  }
                </span>
              </div>

              {devices.find((d: any) => d.id === portTooltip.deviceId)?.ports.find((p: any) => p.id === portTooltip.portId)?.status === 'connected' && (
                <div className="text-[10px] opacity-70">
                  {language === 'tr' ? 'Fiziksel bağlantı aktif' : 'Physical link active'}
                </div>
              )}
            </div>

            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] ${isDark ? 'border-t-slate-800' : 'border-t-white'
              }`} />
          </div>
        </div>
      )}

      {/* Device Tooltip */}
      {deviceTooltip && deviceTooltip.visible && (
        <div
          className={`fixed z-[100] pointer-events-none transition-opacity duration-300 ${deviceTooltip.visible ? 'opacity-100' : 'opacity-0'
            }`}
          style={{
            left: deviceTooltip.x,
            top: deviceTooltip.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div
            className={`px-3 py-2 rounded-xl shadow-2xl border backdrop-blur-md ${isDark
              ? 'bg-slate-900/90 border-slate-700 text-white shadow-cyan-500/10'
              : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
              }`}
          >
            {(() => {
              const device = devices.find((d: any) => d.id === deviceTooltip.deviceId);
              if (!device) return null;
              const model = device.type === 'switch' ? 'WS-C2960-24TT-L' : device.type === 'router' ? 'ISR-4321' : 'PC';
              const openPorts = device.ports.filter((p: any) => !p.shutdown).length;
              const closedPorts = device.ports.length - openPorts;
              return (
                <div className="space-y-0.5 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${device.status === 'offline' ? 'bg-black' : 'bg-emerald-500'}`} />
                    <span className="font-black tracking-widest uppercase opacity-70">
                      {device.type === 'pc' ? 'PC' : device.type === 'switch' ? 'SWITCH' : 'ROUTER'}
                    </span>
                  </div>
                  <div className="text-xs font-bold">{device.name}</div>
                  <div className="opacity-70">{model}</div>
                  <div>
                    {language === 'tr'
                      ? `Güç: ${device.status === 'offline' ? 'Kapalı' : 'Açık'}`
                      : `Power: ${device.status === 'offline' ? 'Off' : 'On'}`}
                  </div>
                  <div>
                    {language === 'tr'
                      ? `Portlar: ${openPorts} açık / ${closedPorts} kapalı`
                      : `Ports: ${openPorts} open / ${closedPorts} closed`}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
