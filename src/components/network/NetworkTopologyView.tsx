import React, { useMemo } from 'react';
import { ConnectionLine } from './ConnectionLine';
import { DeviceNode } from './DeviceNode';
import { PingAnimationOverlay } from './PingAnimationOverlay';
import NetworkTopologyContextMenu from './NetworkTopologyContextMenu';
import { NetworkTopologyPortSelectorModal } from './NetworkTopologyPortSelectorModal';
import { CABLE_COLORS, MIN_ZOOM, MAX_ZOOM } from './networkTopology.constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { performanceMonitor } from '@/lib/performance/monitoring';

type NetworkTopologyViewProps = Record<string, any>;

// Custom comparison function for React.memo
// Only re-renders when props that affect rendering change
const arePropsEqual = (prevProps: NetworkTopologyViewProps, nextProps: NetworkTopologyViewProps) => {
  // Compare primitive props
  if (prevProps.isDark !== nextProps.isDark) return false;
  if (prevProps.language !== nextProps.language) return false;
  if (prevProps.isMobile !== nextProps.isMobile) return false;

  // Compare topology data
  if (prevProps.devices !== nextProps.devices) return false;
  if (prevProps.connections !== nextProps.connections) return false;
  if (prevProps.notes !== nextProps.notes) return false;

  // Compare selection state
  if (prevProps.selectedDeviceIds !== nextProps.selectedDeviceIds) return false;
  if (prevProps.selectedNoteIds !== nextProps.selectedNoteIds) return false;
  if (prevProps.activeDeviceId !== nextProps.activeDeviceId) return false;

  // Compare viewport state
  if (prevProps.pan !== nextProps.pan) return false;
  if (prevProps.zoom !== nextProps.zoom) return false;

  // Compare drawing/connection state
  if (prevProps.isDrawingConnection !== nextProps.isDrawingConnection) return false;
  if (prevProps.isActuallyDragging !== nextProps.isActuallyDragging) return false;
  if (prevProps.isTouchDragging !== nextProps.isTouchDragging) return false;
  if (prevProps.draggedDevice !== nextProps.draggedDevice) return false;
  if (prevProps.touchDraggedDevice !== nextProps.touchDraggedDevice) return false;
  if (prevProps.selectAllMode !== nextProps.selectAllMode) return false;

  // Compare port selector state
  if (prevProps.showPortSelector !== nextProps.showPortSelector) return false;
  if (prevProps.portSelectorStep !== nextProps.portSelectorStep) return false;
  if (prevProps.selectedSourcePort !== nextProps.selectedSourcePort) return false;

  // Compare context menu state
  if (prevProps.contextMenu !== nextProps.contextMenu) return false;

  // Compare note state
  if (prevProps.noteFonts !== nextProps.noteFonts) return false;
  if (prevProps.noteClipboard !== nextProps.noteClipboard) return false;
  if (prevProps.clipboard !== nextProps.clipboard) return false;

  // Compare undo/redo state
  if (prevProps.canUndo !== nextProps.canUndo) return false;
  if (prevProps.canRedo !== nextProps.canRedo) return false;

  // Compare connection error
  if (prevProps.connectionError !== nextProps.connectionError) return false;

  // Compare ping state
  if (prevProps.pingSource !== nextProps.pingSource) return false;
  if (prevProps.pingAnimation !== nextProps.pingAnimation) return false;

  // Compare fullscreen state
  if (prevProps.isFullscreen !== nextProps.isFullscreen) return false;

  // Compare function references (these are stable refs from parent)
  // If any of these change, the component should re-render
  if (prevProps.canvasRef !== nextProps.canvasRef) return false;
  if (prevProps.handleCanvasMouseDown !== nextProps.handleCanvasMouseDown) return false;
  if (prevProps.handleTouchStart !== nextProps.handleTouchStart) return false;
  if (prevProps.handleTouchMove !== nextProps.handleTouchMove) return false;
  if (prevProps.handleTouchEnd !== nextProps.handleTouchEnd) return false;
  if (prevProps.setIsDrawingConnection !== nextProps.setIsDrawingConnection) return false;
  if (prevProps.setConnectionStart !== nextProps.setConnectionStart) return false;
  if (prevProps.setSelectAllMode !== nextProps.setSelectAllMode) return false;
  if (prevProps.handleDeviceMouseDown !== nextProps.handleDeviceMouseDown) return false;
  if (prevProps.handleDeviceClick !== nextProps.handleDeviceClick) return false;
  if (prevProps.handleDeviceDoubleClick !== nextProps.handleDeviceDoubleClick) return false;
  if (prevProps.handleContextMenu !== nextProps.handleContextMenu) return false;
  if (prevProps.handleDeviceTouchStart !== nextProps.handleDeviceTouchStart) return false;
  if (prevProps.handleDeviceTouchMove !== nextProps.handleDeviceTouchMove) return false;
  if (prevProps.handleDeviceTouchEnd !== nextProps.handleDeviceTouchEnd) return false;
  if (prevProps.renderDevice !== nextProps.renderDevice) return false;
  if (prevProps.renderTempConnection !== nextProps.renderTempConnection) return false;
  if (prevProps.renderConnectionHandle !== nextProps.renderConnectionHandle) return false;
  if (prevProps.handleNoteTouchStart !== nextProps.handleNoteTouchStart) return false;
  if (prevProps.handleNoteContextMenu !== nextProps.handleNoteContextMenu) return false;
  if (prevProps.handleNoteMouseDown !== nextProps.handleNoteMouseDown) return false;
  if (prevProps.handleNoteResizeStart !== nextProps.handleNoteResizeStart) return false;
  if (prevProps.updateNoteText !== nextProps.updateNoteText) return false;
  if (prevProps.onTopologyChange !== nextProps.onTopologyChange) return false;
  if (prevProps.addNote !== nextProps.addNote) return false;
  if (prevProps.setIsPaletteOpen !== nextProps.setIsPaletteOpen) return false;
  if (prevProps.setShowPortSelector !== nextProps.setShowPortSelector) return false;
  if (prevProps.setPortSelectorStep !== nextProps.setPortSelectorStep) return false;
  if (prevProps.setSelectedSourcePort !== nextProps.setSelectedSourcePort) return false;
  if (prevProps.resetView !== nextProps.resetView) return false;
  if (prevProps.toggleFullscreen !== nextProps.toggleFullscreen) return false;
  if (prevProps.getCanvasDimensions !== nextProps.getCanvasDimensions) return false;
  if (prevProps.getPortPosition !== nextProps.getPortPosition) return false;
  if (prevProps.handlePortHover !== nextProps.handlePortHover) return false;
  if (prevProps.handlePortMouseLeave !== nextProps.handlePortMouseLeave) return false;
  if (prevProps.closePortSelector !== nextProps.closePortSelector) return false;
  if (prevProps.handlePortSelectorSelectPort !== nextProps.handlePortSelectorSelectPort) return false;
  if (prevProps.deleteNote !== nextProps.deleteNote) return false;
  if (prevProps.handleNoteTextCut !== nextProps.handleNoteTextCut) return false;
  if (prevProps.handleNoteTextCopy !== nextProps.handleNoteTextCopy) return false;
  if (prevProps.handleNoteTextPaste !== nextProps.handleNoteTextPaste) return false;
  if (prevProps.handleNoteTextDelete !== nextProps.handleNoteTextDelete) return false;
  if (prevProps.handleNoteTextSelectAll !== nextProps.handleNoteTextSelectAll) return false;
  if (prevProps.onDuplicateNote !== nextProps.onDuplicateNote) return false;
  if (prevProps.pasteNotes !== nextProps.pasteNotes) return false;
  if (prevProps.updateNoteStyle !== nextProps.updateNoteStyle) return false;
  if (prevProps.renderMobilePalette !== nextProps.renderMobilePalette) return false;
  if (prevProps.renderMobileBottomBar !== nextProps.renderMobileBottomBar) return false;
  if (prevProps.startPingAnimation !== nextProps.startPingAnimation) return false;
  if (prevProps.setZoom !== nextProps.setZoom) return false;
  if (prevProps.setPan !== nextProps.setPan) return false;
  if (prevProps.setSelectedDeviceIds !== nextProps.setSelectedDeviceIds) return false;
  if (prevProps.setSelectedNoteIds !== nextProps.setSelectedNoteIds) return false;
  if (prevProps.cutDevice !== nextProps.cutDevice) return false;
  if (prevProps.copyDevice !== nextProps.copyDevice) return false;
  if (prevProps.pasteDevice !== nextProps.pasteDevice) return false;
  if (prevProps.deleteDevice !== nextProps.deleteDevice) return false;
  if (prevProps.togglePowerDevices !== nextProps.togglePowerDevices) return false;
  if (prevProps.startDeviceConfig !== nextProps.startDeviceConfig) return false;
  if (prevProps.setPingSource !== nextProps.setPingSource) return false;
  if (prevProps.handleUndo !== nextProps.handleUndo) return false;
  if (prevProps.handleRedo !== nextProps.handleRedo) return false;
  if (prevProps.selectAllDevices !== nextProps.selectAllDevices) return false;
  if (prevProps.Trash2 !== nextProps.Trash2) return false;
  if (prevProps.NOTE_HEADER_HEIGHT !== nextProps.NOTE_HEADER_HEIGHT) return false;
  if (prevProps.noteTextareaRefs !== nextProps.noteTextareaRefs) return false;
  if (prevProps.getDeviceCenter !== nextProps.getDeviceCenter) return false;
  if (prevProps.onCableChange !== nextProps.onCableChange) return false;
  if (prevProps.cableInfo !== nextProps.cableInfo) return false;
  if (prevProps.deviceTooltip !== nextProps.deviceTooltip) return false;
  if (prevProps.portTooltip !== nextProps.portTooltip) return false;
  if (prevProps.contextMenuRef !== nextProps.contextMenuRef) return false;

  return true;
};

export const NetworkTopologyView = React.memo(
  (props: NetworkTopologyViewProps) => {
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
      togglePowerDevices,
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

    // 10.1 - Virtualization + LOD: render only objects near viewport.
    const viewport = useMemo(() => {
      const fallbackWidth = Math.min(1920, canvasDimensions.width);
      const fallbackHeight = Math.min(1080, canvasDimensions.height);
      const viewportWidth = canvasRef?.current?.clientWidth || fallbackWidth;
      const viewportHeight = canvasRef?.current?.clientHeight || fallbackHeight;
      const margin = Math.max(220, 240 / Math.max(zoom, 0.25));

      const left = (-pan.x) / zoom - margin;
      const top = (-pan.y) / zoom - margin;
      const right = (viewportWidth - pan.x) / zoom + margin;
      const bottom = (viewportHeight - pan.y) / zoom + margin;

      return { left, top, right, bottom };
    }, [canvasDimensions.height, canvasDimensions.width, canvasRef, pan.x, pan.y, zoom]);

    const visibleDevices = useMemo(() => {
      return devices.filter((device: any) => {
        const width = device.type === 'pc' ? 90 : 130;
        const height = 100;
        return (
          device.x + width >= viewport.left &&
          device.x <= viewport.right &&
          device.y + height >= viewport.top &&
          device.y <= viewport.bottom
        );
      });
    }, [devices, viewport.bottom, viewport.left, viewport.right, viewport.top]);

    const visibleDeviceIdSet = useMemo(() => {
      return new Set(visibleDevices.map((d: any) => d.id));
    }, [visibleDevices]);

    const visibleConnections = useMemo(() => {
      return connections.filter((conn: any) => {
        const source = deviceById.get(conn.sourceDeviceId);
        const target = deviceById.get(conn.targetDeviceId);
        if (!source || !target) return false;

        if (visibleDeviceIdSet.has(source.id) || visibleDeviceIdSet.has(target.id)) return true;

        const minX = Math.min(source.x, target.x);
        const maxX = Math.max(source.x, target.x);
        const minY = Math.min(source.y, target.y);
        const maxY = Math.max(source.y, target.y);
        return !(
          maxX < viewport.left ||
          minX > viewport.right ||
          maxY < viewport.top ||
          minY > viewport.bottom
        );
      });
    }, [connections, deviceById, viewport.bottom, viewport.left, viewport.right, viewport.top, visibleDeviceIdSet]);

    const visibleNotes = useMemo(() => {
      return notes.filter((note: any) => {
        return (
          note.x + note.width >= viewport.left &&
          note.x <= viewport.right &&
          note.y + note.height >= viewport.top &&
          note.y <= viewport.bottom
        );
      });
    }, [notes, viewport.bottom, viewport.left, viewport.right, viewport.top]);

    const isFarZoom = zoom < 0.6;
    const isVeryFarZoom = zoom < 0.4;
    const showConnectionAnimations = !isFarZoom;
    const showConnectionLabels = !isVeryFarZoom;
    const trackInteraction = <T,>(fn: () => T) => performanceMonitor.trackInteraction(fn);

    return (
      <div className="relative w-full h-full min-h-0 flex flex-col">
        {/* Header with Tools */}
        {renderMobileBottomBar()}

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="w-full flex-1 min-h-0 h-full overflow-hidden cursor-grab active:cursor-grabbing relative touch-none select-none"
          onMouseDown={(e) => trackInteraction(() => handleCanvasMouseDown(e))}
          onTouchStart={(e) => trackInteraction(() => handleTouchStart(e))}
          onTouchMove={(e) => trackInteraction(() => handleTouchMove(e))}
          onTouchEnd={(e) => trackInteraction(() => handleTouchEnd(e))}
          onClick={() => {
            trackInteraction(() => {
              if (isDrawingConnection) {
                setIsDrawingConnection(false);
                setConnectionStart(null);
              }
              if (selectAllMode) {
                setSelectAllMode(false);
              }
            });
          }}
          onContextMenu={(e) => trackInteraction(() => handleContextMenu(e))}
        >
          <svg width="100%" height="100%" className="block select-none canvas-no-select">
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

                {visibleConnections.map((conn: any) => {
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
                        showAnimation={showConnectionAnimations}
                        showLabel={showConnectionLabels}
                      />
                      {!isVeryFarZoom && renderConnectionHandle(conn)}
                    </g>
                  );
                })}

                {renderTempConnection()}

                {visibleDevices.map((device: any) => {
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
                      onMouseDown={(e: any, id: string) => trackInteraction(() => handleDeviceMouseDown(e, id))}
                      onClick={(e: any, dev: any) => trackInteraction(() => handleDeviceClick(e, dev))}
                      onDoubleClick={() => trackInteraction(() => handleDeviceDoubleClick(device))}
                      onContextMenu={(e: any, id: string) => trackInteraction(() => handleContextMenu(e, id))}
                      onTouchStart={(e: any, id: string) => trackInteraction(() => handleDeviceTouchStart(e, id))}
                      onTouchMove={(e: any) => trackInteraction(() => handleDeviceTouchMove(e))}
                      onTouchEnd={(e: any) => trackInteraction(() => handleDeviceTouchEnd(e))}
                      renderDeviceContent={renderDevice}
                    />
                  );
                })}

                {visibleNotes.map((note: any) => (
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
                        className={`flex items-center justify-between px-2 text-[10px] font-semibold tracking-widest cursor-move select-none ${isDark ? 'bg-black/10' : 'bg-black/5'
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
                {pingAnimation && (
                  <PingAnimationOverlay
                    key={`ping-${pingAnimation.frame}`}
                    pingAnimation={pingAnimation}
                    devices={devices}
                    connections={connections}
                    getPortPosition={getPortPosition}
                    getDeviceCenter={props.getDeviceCenter}
                    language={language}
                  />
                )}
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
            onClick={() => trackInteraction(() => props.setZoom((z: number) => {
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
            }))}
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
            onClick={() => trackInteraction(() => props.setZoom((z: number) => {
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
            }))}
            className={`w-8 h-8 flex items-center justify-center rounded text-lg font-bold touch-target transition-colors ${isDark ? 'hover:bg-slate-700 hover:text-cyan-400 text-slate-300' : 'hover:bg-slate-100 hover:text-cyan-600 text-slate-600'
              }`}
            aria-label="Zoom in"
          >
            +
          </button>
          <div className={`w-px h-5 ${isDark ? 'bg-slate-600' : 'bg-slate-300'} mx-0.5 hidden md:block`} />
          <button
            onClick={() => trackInteraction(() => resetView())}
            className={`hidden md:block px-2 py-1 text-xs rounded transition-colors ${isDark
              ? 'hover:bg-slate-700 hover:text-amber-400 text-slate-300'
              : 'hover:bg-slate-100 hover:text-amber-600 text-slate-600'
              }`}
            title={`${language === 'tr' ? 'Sıfırla' : 'Reset'} ${!isMobile ? '(Shift+R)' : ''}`}
          >
            {language === 'tr' ? 'Sıfırla' : 'Reset'}
          </button>
          <button
            onClick={() => trackInteraction(() => toggleFullscreen())}
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
          onTogglePowerDevices={togglePowerDevices}
          onStartConfig={startDeviceConfig}
          onStartPing={(id: string) => setPingSource(id)}
          onSaveToHistory={() => { }}
          onClearDeviceSelection={() => props.setSelectedDeviceIds([])}
        />
      </div>
    );
  },
  arePropsEqual
);
