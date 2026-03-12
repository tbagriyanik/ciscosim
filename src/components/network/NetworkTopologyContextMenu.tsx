import type { RefObject } from 'react';
import { Trash2, Undo2, Redo2 } from 'lucide-react';
import { NOTE_COLORS, NOTE_FONT_SIZES, NOTE_OPACITY } from './networkTopology.constants';
import { CanvasDevice, CanvasNote, ContextMenuState } from './networkTopology.types';

interface NetworkTopologyContextMenuProps {
  contextMenu: ContextMenuState | null;
  contextMenuRef: RefObject<HTMLDivElement>;
  isDark: boolean;
  language: string;
  noteFonts: string[];
  notes: CanvasNote[];
  devices: CanvasDevice[];
  selectedDeviceIds: string[];
  clipboardLength: number;
  noteClipboardLength: number;
  historyIndex: number;
  historyLength: number;
  onClose: () => void;
  onUpdateNoteStyle: (noteId: string, patch: Partial<Pick<CanvasNote, 'color' | 'font' | 'fontSize' | 'opacity'>>) => void;
  onNoteCut: (noteId: string) => void;
  onNoteCopy: (noteId: string) => void;
  onNotePaste: (noteId: string) => void;
  onNoteDeleteText: (noteId: string) => void;
  onNoteSelectAllText: (noteId: string) => void;
  onPasteNotes: (x: number, y: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onOpenDevice: (device: CanvasDevice) => void;
  onCutDevices: (deviceIds: string[]) => void;
  onCopyDevices: (deviceIds: string[]) => void;
  onPasteDevice?: () => void;
  onDeleteDevices: (deviceIds: string[]) => void;
  onStartConfig: (deviceId: string) => void;
  onStartPing: (deviceId: string) => void;
  onSaveToHistory: () => void;
  onClearDeviceSelection: () => void;
}

export function NetworkTopologyContextMenu({
  contextMenu,
  contextMenuRef,
  isDark,
  language,
  noteFonts,
  notes,
  devices,
  selectedDeviceIds,
  clipboardLength,
  noteClipboardLength,
  historyIndex,
  historyLength,
  onClose,
  onUpdateNoteStyle,
  onNoteCut,
  onNoteCopy,
  onNotePaste,
  onNoteDeleteText,
  onNoteSelectAllText,
  onPasteNotes,
  onUndo,
  onRedo,
  onSelectAll,
  onOpenDevice,
  onCutDevices,
  onCopyDevices,
  onPasteDevice,
  onDeleteDevices,
  onStartConfig,
  onStartPing,
  onSaveToHistory,
  onClearDeviceSelection,
}: NetworkTopologyContextMenuProps) {
  if (!contextMenu) return null;

  const renderMenuItem = (opts: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    icon: 'open' | 'cut' | 'copy' | 'paste' | 'delete' | 'select' | 'undo' | 'redo' | 'config' | 'ping';
    shortcut?: string;
  }) => {
    const { label, onClick, disabled, icon, shortcut } = opts;
    const iconNode = (() => {
      const cls = 'w-4.5 h-4.5';
      switch (icon) {
        case 'open':
          return (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16v10H4z" />
              <path d="M8 20h8" />
              <path d="M10 16h4" />
            </svg>
          );
        case 'cut':
          return (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M20 4L8.5 12" />
              <path d="M20 20L8.5 12" />
            </svg>
          );
        case 'copy':
          return (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="10" height="10" rx="2" />
              <rect x="5" y="5" width="10" height="10" rx="2" />
            </svg>
          );
        case 'paste':
          return (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 4h6l1 2h3v14H5V6h3z" />
              <path d="M9 4v2h6V4" />
            </svg>
          );
        case 'delete':
          return <Trash2 className={cls} />;
        case 'select':
          return (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h6v6H4z" />
              <path d="M14 14h6v6h-6z" />
              <path d="M14 4h6v6h-6z" />
              <path d="M4 14h6v6H4z" />
            </svg>
          );
        case 'undo':
          return <Undo2 className={cls} />;
        case 'redo':
          return <Redo2 className={cls} />;
        case 'config':
          return (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <g>
                <circle cx="12" cy="12" r="4" />
                <circle cx="12" cy="12" r="6.5" />
                <path d="M12 3.5v2" />
                <path d="M12 18.5v2" />
                <path d="M3.5 12h2" />
                <path d="M18.5 12h2" />
                <path d="M5.9 5.9l1.4 1.4" />
                <path d="M16.7 16.7l1.4 1.4" />
                <path d="M18.1 5.9l-1.4 1.4" />
                <path d="M7.3 16.7l-1.4 1.4" />
              </g>
            </svg>
          );
        case 'ping':
          return (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16" />
              <path d="M4 6l8 7 8-7" />
              <path d="M4 6v12h16V6" />
            </svg>
          );
      }
    })();

    return (
      <button
        onClick={() => !disabled && onClick()}
        disabled={disabled}
        aria-disabled={disabled}
        className={`w-full px-2.5 py-2 text-sm text-left flex items-center gap-2 justify-between ${disabled
          ? `${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-not-allowed`
          : `${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}`}
      >
        <span className="flex items-center gap-2">
          <span className="shrink-0 p-0.5">
            {iconNode}
          </span>
          {label}
        </span>
        {shortcut && <span className="text-[11px] opacity-50">{shortcut}</span>}
      </button>
    );
  };

  return (
    <div
      ref={contextMenuRef}
      className={`context-menu fixed z-50 py-1 rounded-lg shadow-xl min-w-[140px] max-w-[240px] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
        maxHeight: '60vh',
        overflow: 'auto',
        resize: contextMenu.mode.startsWith('note') ? 'both' : 'none',
        minWidth: contextMenu.mode.startsWith('note') ? 180 : undefined,
        minHeight: contextMenu.mode.startsWith('note') ? 120 : undefined
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.noteId && contextMenu.mode === 'note-style' && (
        <div className="px-2 py-2 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            {language === 'tr' ? 'Not Biçimi' : 'Note Style'}
          </div>

          <div className="grid grid-cols-5 gap-1">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { color: c }); onClose(); }}
                className="w-4 h-4 rounded border border-black/10"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              {language === 'tr' ? 'Yazı Tipi' : 'Font'}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {noteFonts.map((f) => (
                <button
                  key={f}
                  onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { font: f }); onClose(); }}
                  className={`px-2 py-1 rounded text-left text-[11px] ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                  style={{ fontFamily: f }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              {language === 'tr' ? 'Boyut' : 'Size'}
            </div>
            <div className="flex gap-1">
              {NOTE_FONT_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { fontSize: s }); onClose(); }}
                  className={`px-2 py-1 rounded text-[11px] ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              {language === 'tr' ? 'Saydamlık' : 'Opacity'}
            </div>
            <div className="flex gap-1">
              {NOTE_OPACITY.map((o) => (
                <button
                  key={o}
                  onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { opacity: o }); onClose(); }}
                  className={`px-2 py-1 rounded text-[11px] ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                >
                  {Math.round(o * 100)}%
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {contextMenu.noteId && contextMenu.mode === 'note-edit' && (
        <div className="px-2 py-2 space-y-1">
          {(() => {
            const note = notes.find(n => n.id === contextMenu.noteId);
            const noteText = note?.text || '';
            const hasText = noteText.trim().length > 0;
            return (
              <>
                {renderMenuItem({
                  label: language === 'tr' ? 'Kes' : 'Cut',
                  icon: 'cut',
                  shortcut: 'Ctrl+X',
                  disabled: !hasText,
                  onClick: () => { onNoteCut(contextMenu.noteId!); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Kopyala' : 'Copy',
                  icon: 'copy',
                  shortcut: 'Ctrl+C',
                  disabled: !hasText,
                  onClick: () => { onNoteCopy(contextMenu.noteId!); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Yapıştır' : 'Paste',
                  icon: 'paste',
                  shortcut: 'Ctrl+V',
                  onClick: () => { onNotePaste(contextMenu.noteId!); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Sil' : 'Delete',
                  icon: 'delete',
                  shortcut: 'Del',
                  disabled: !hasText,
                  onClick: () => { onNoteDeleteText(contextMenu.noteId!); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Tümünü Seç' : 'Select All',
                  icon: 'select',
                  shortcut: 'Ctrl+A',
                  onClick: () => { onNoteSelectAllText(contextMenu.noteId!); onClose(); }
                })}
              </>
            );
          })()}
        </div>
      )}

      {contextMenu.mode === 'canvas' && (
        <div className="px-2 py-2 space-y-1">
          {renderMenuItem({
            label: language === 'tr' ? 'Yapıştır' : 'Paste',
            icon: 'paste',
            shortcut: 'Ctrl+V',
            disabled: (noteClipboardLength === 0) && (!onPasteDevice || clipboardLength === 0),
            onClick: () => {
              if (onPasteDevice && clipboardLength > 0) {
                onPasteDevice();
              } else {
                onPasteNotes(contextMenu.x, contextMenu.y);
              }
              onClose();
            }
          })}
          {renderMenuItem({
            label: language === 'tr' ? 'Geri Al' : 'Undo',
            icon: 'undo',
            shortcut: 'Ctrl+Z',
            disabled: historyIndex <= 0,
            onClick: () => { onUndo(); onClose(); }
          })}
          {renderMenuItem({
            label: language === 'tr' ? 'Yinele' : 'Redo',
            icon: 'redo',
            shortcut: 'Ctrl+Y',
            disabled: historyIndex >= historyLength - 1,
            onClick: () => { onRedo(); onClose(); }
          })}
          {renderMenuItem({
            label: language === 'tr' ? 'Tümünü Seç' : 'Select All',
            icon: 'select',
            shortcut: 'Ctrl+A',
            disabled: devices.length === 0 && notes.length === 0,
            onClick: () => { onSelectAll(); onClose(); }
          })}
        </div>
      )}

      {contextMenu.deviceId && contextMenu.mode === 'device' && (
        <div className="px-2 py-2 space-y-1">
          {(() => {
            const device = devices.find((d) => d.id === contextMenu.deviceId);
            const canPaste = !!onPasteDevice && clipboardLength > 0;
            const hasSelection = selectedDeviceIds.includes(contextMenu.deviceId!);
            const targets = hasSelection ? selectedDeviceIds : [contextMenu.deviceId!];
            return (
              <>
                {renderMenuItem({
                  label: language === 'tr' ? 'Aç' : 'Open',
                  icon: 'open',
                  onClick: () => { if (device) onOpenDevice(device); onClose(); },
                  disabled: !device
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Kes' : 'Cut',
                  icon: 'cut',
                  shortcut: 'Ctrl+X',
                  disabled: !device,
                  onClick: () => { onSaveToHistory(); onCutDevices(targets); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Kopyala' : 'Copy',
                  icon: 'copy',
                  shortcut: 'Ctrl+C',
                  disabled: !device,
                  onClick: () => { onCopyDevices(targets); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Yapıştır' : 'Paste',
                  icon: 'paste',
                  shortcut: 'Ctrl+V',
                  disabled: !canPaste,
                  onClick: () => { if (onPasteDevice) onPasteDevice(); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Sil' : 'Delete',
                  icon: 'delete',
                  shortcut: 'Del',
                  disabled: !device,
                  onClick: () => {
                    onSaveToHistory();
                    onDeleteDevices(targets);
                    onClearDeviceSelection();
                    onClose();
                  }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Tümünü Seç' : 'Select All',
                  icon: 'select',
                  shortcut: 'Ctrl+A',
                  disabled: devices.length === 0,
                  onClick: () => { onSelectAll(); onClose(); }
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Yapılandır' : 'Configure',
                  icon: 'config',
                  onClick: () => { onStartConfig(contextMenu.deviceId!); onClose(); },
                  disabled: !device
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Ping' : 'Ping',
                  icon: 'ping',
                  onClick: () => { onStartPing(contextMenu.deviceId!); onClose(); },
                  disabled: !device
                })}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
