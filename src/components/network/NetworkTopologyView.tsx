import React, { useMemo } from 'react';
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';
import { PingAnimationOverlay } from './PingAnimationOverlay';
import NetworkTopologyContextMenu from './NetworkTopologyContextMenu';
import { NetworkTopologyPortSelectorModal } from './NetworkTopologyPortSelectorModal';
import { CABLE_COLORS, MIN_ZOOM, MAX_ZOOM } from './networkTopology.constants';
import { useLanguage } from '@/contexts/LanguageContext';

type NetworkTopologyViewProps = Record<string, any>;

export function NetworkTopologyView(props: NetworkTopologyViewProps) {
  const { t } = useLanguage();
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
    canUndo,
    canRedo,
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
    deleteNote,
    handleNoteTextCut,
    handleNoteTextCopy,
    handleNoteTextPaste,
    handleNoteTextDelete,
    handleNoteTextSelectAll,
    onDuplicateNote,
    pasteNotes,
    updateNoteStyle,
    connectionError,
    renderMobilePalette,
    renderMobileBottomBar,
    pingSource,
    startPingAnimation,
    pingAnimation,
  } = props;

  // Pre-compute canvas dimensions once per render (avoid 6 repeated calls)
  const canvasDimensions = useMemo(() => getCanvasDimensions(), [getCanvasDimensions]);

  // Pre-compute device lookup map for O(1) access
  const deviceById = useMemo<Map<string, any>>(
    () => new Map(devices.map((d: any) => [d.id, d] as [string, any])),
    [devices]
  );

  // Pre-compute connection groups for O(1) curve offset lookup
  const connectionGroupMap = useMemo(() => {
    const map = new Map<string, { conns: any[]; indexById: Map<string, number> }>();
    connections.forEach((conn: any) => {
      const keyA = `${conn.sourceDeviceId}||${conn.targetDeviceId}`;
      const keyB = `${conn.targetDeviceId}||${conn.sourceDeviceId}`;
      const canonKey = keyA < keyB ? keyA : keyB;
      if (!map.has(canonKey)) map.set(canonKey, { conns: [], indexById: new Map() });
      const group = map.get(canonKey)!;
      group.indexById.set(conn.id, group.conns.length);
      group.conns.push(conn);
    });
    return map;
  }, [connections]);

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
        <svg width="100%" height="100%" className="select-none canvas-no-select">
          <g
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: '0 0',
              willChange: 'transform'
            }}
          >
            <defs>
              <clipPath id="canvasClip">
                <rect x="0" y="0" width={canvasDimensions.width} height={canvasDimensions.height} />
              </clipPath>
              <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill={isDark ? '#334155' : '#94a3b8'} />
              </pattern>
            </defs>

            <g clipPath="url(#canvasClip)">
              <rect
                x="0"
                y="0"
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                fill={isDark ? '#1e293b' : '#f8fafc'}
              />
              <rect
                x="0"
                y="0"
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                fill="url(#gridPattern)"
              />

              {connections.map((conn: any) => {
                const sourceDevice = deviceById.get(conn.sourceDeviceId);
                const targetDevice = deviceById.get(conn.targetDeviceId);
                if (!sourceDevice || !targetDevice) return null;

                const keyA = `${conn.sourceDeviceId}||${conn.targetDeviceId}`;
                const keyB = `${conn.targetDeviceId}||${conn.sourceDeviceId}`;
                const canonKey = keyA < keyB ? keyA : keyB;
                const group = connectionGroupMap.get(canonKey);
                const totalSameConns = group?.conns.length ?? 1;
                const sameConnIndex = group?.indexById.get(conn.id) ?? 0;

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
                        title={t.delete}
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
                        title={t.resize}
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

              {/* Ping Animation Overlay */}
              <PingAnimationOverlay
                pingAnimation={pingAnimation}
                devices={devices}
                connections={connections}
                getPortPosition={getPortPosition}
                getDeviceCenter={props.getDeviceCenter}
                language={language}
              />
            </g>

            <rect
              x="0"
              y="0"
              width={canvasDimensions.width}
              height={canvasDimensions.height}
              fill="none"
              stroke={isDark ? '#3b82f6' : '#2563eb'}
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom},${4 / zoom}`}
              opacity={0.7}
            />
            <text
              x={canvasDimensions.width - 80}
              y={canvasDimensions.height - 10}
              fill={isDark ? '#64748b' : '#64748b'}
              fontSize={12 / zoom}
              fontFamily="monospace"
            >
              {canvasDimensions.width} X {canvasDimensions.height}
            </text>
          </g>
        </svg>
      </div>

      {/* Zoom Controls - All screen sizes */}
      <div
        className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800/90' : 'bg-white/90'
          } shadow-lg`}
      >
        <button
          onClick={() => props.setZoom((z: number) => {
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
          className={`w-8 h-8 flex items-center justify-center rounded text-lg font-bold touch-target transition-colors ${isDark ? 'hover:bg-slate-700 hover:text-cyan-400 text-slate-300' : 'hover:bg-slate-100 hover:text-cyan-600 text-slate-600'
            }`}
          aria-label="Zoom out"
        >
          -
        </button>
        <span className={`text-xs font-mono w-12 text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => props.setZoom((z: number) => {
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
          className={`w-8 h-8 flex items-center justify-center rounded text-lg font-bold touch-target transition-colors ${isDark ? 'hover:bg-slate-700 hover:text-cyan-400 text-slate-300' : 'hover:bg-slate-100 hover:text-cyan-600 text-slate-600'
            }`}
          aria-label="Zoom in"
        >
          +
        </button>
        <div className={`w-px h-5 ${isDark ? 'bg-slate-600' : 'bg-slate-300'} mx-0.5 hidden md:block`} />
        <button
          onClick={resetView}
          className={`hidden md:block px-2 py-1 text-xs rounded transition-colors ${isDark
            ? 'hover:bg-slate-700 hover:text-amber-400 text-slate-300'
            : 'hover:bg-slate-100 hover:text-amber-600 text-slate-600'
            }`}
          title={`${language === 'tr' ? 'Sıfırla' : 'Reset'} ${!isMobile ? '(Shift+R)' : ''}`}
        >
          {language === 'tr' ? 'Sıfırla' : 'Reset'}
        </button>
        <button
          onClick={toggleFullscreen}
          className={`hidden md:flex px-2 py-1 text-xs rounded items-center gap-1 transition-colors ${isDark
            ? 'hover:bg-slate-700 hover:text-purple-400 text-slate-300'
            : 'hover:bg-slate-100 hover:text-purple-600 text-slate-600'
            }`}
          title={props.isFullscreen ? (language === 'tr' ? 'Çık' : 'Exit') : (language === 'tr' ? 'Tam Ekran' : 'Fullscreen')}
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
        canUndo={props.canUndo}
        canRedo={props.canRedo}
        onClose={() => props.setContextMenu(null)}
        onUpdateNoteStyle={updateNoteStyle}
        onNoteCut={handleNoteTextCut}
        onNoteCopy={handleNoteTextCopy}
        onNotePaste={handleNoteTextPaste}
        onNoteDeleteText={handleNoteTextDelete}
        onNoteSelectAllText={handleNoteTextSelectAll}
        onDuplicateNote={onDuplicateNote}
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
        onSaveToHistory={() => {}}
        onClearDeviceSelection={() => props.setSelectedDeviceIds([])}
      />
    </div>
  );
}
