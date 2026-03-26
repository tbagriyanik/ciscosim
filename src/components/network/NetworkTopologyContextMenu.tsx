'use client';

import { useState, useEffect, type RefObject } from 'react';
import {
  Trash2, Undo2, Redo2, Scissors, Copy, ClipboardPaste,
  MousePointer2, ExternalLink, Mail, Shield, Layers,
  Database, Terminal as TerminalIcon, CheckSquare, Power
} from 'lucide-react';
import { NOTE_COLORS, NOTE_FONT_SIZES, NOTE_OPACITY } from './networkTopology.constants';
import { CanvasDevice, CanvasNote, ContextMenuState } from './networkTopology.types';

interface NetworkTopologyContextMenuProps {
  contextMenu: ContextMenuState | null;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  isDark: boolean;
  language: string;
  noteFonts: string[];
  notes: CanvasNote[];
  devices: CanvasDevice[];
  note?: CanvasNote;
  selectedDeviceIds: string[];
  clipboardLength: number;
  noteClipboardLength: number;
  canUndo: boolean;
  canRedo: boolean;
  onClose: () => void;
  onUpdateNoteStyle: (id: string, style: any) => void;
  onNoteCut: (id: string) => void;
  onNoteCopy: (id: string) => void;
  onNotePaste: (id: string) => void;
  onNoteDeleteText: (id: string) => void;
  onNoteSelectAllText: (id: string) => void;
  onDuplicateNote: (id: string) => void;
  onPasteNotes: (x: number, y: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onOpenDevice: (d: CanvasDevice) => void;
  onCutDevices: (ids: string[]) => void;
  onCopyDevices: (ids: string[]) => void;
  onPasteDevice?: () => void;
  onDeleteDevices: (ids: string[]) => void;
  onStartConfig: (id: string) => void;
  onStartPing: (id: string) => void;
  onTogglePowerDevices: (ids: string[]) => void;
  onSaveToHistory: () => void;
  onClearDeviceSelection: () => void;
}

export default function NetworkTopologyContextMenu({
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
  canUndo,
  canRedo,
  onClose,
  onUpdateNoteStyle,
  onNoteCut,
  onNoteCopy,
  onNotePaste,
  onNoteDeleteText,
  onNoteSelectAllText,
  onDuplicateNote,
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
  onTogglePowerDevices,
  onSaveToHistory,
  onClearDeviceSelection,
  note
}: NetworkTopologyContextMenuProps) {
  const [position, setPosition] = useState({ x: contextMenu?.x || 0, y: contextMenu?.y || 0 });

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'undo': return <Undo2 className="w-4 h-4" />;
      case 'redo': return <Redo2 className="w-4 h-4" />;
      case 'trash':
      case 'delete': return <Trash2 className="w-4 h-4" />;
      case 'cut': return <Scissors className="w-4 h-4" />;
      case 'copy': return <Copy className="w-4 h-4" />;
      case 'paste': return <ClipboardPaste className="w-4 h-4" />;
      case 'select': return <CheckSquare className="w-4 h-4" />;
      case 'open': return <ExternalLink className="w-4 h-4" />;
      case 'ping': return <Mail className="w-4 h-4" />;
      case 'power': return <Power className="w-4 h-4" />;
      default: return null;
    }
  };

  const renderMenuItem = ({ label, icon, shortcut, onClick, disabled }: {
    label: string;
    icon?: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${disabled
        ? 'opacity-30 cursor-not-allowed'
        : isDark ? 'text-slate-200 hover:bg-slate-700/80 hover:text-cyan-400' : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-600'
        }`}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="opacity-80 group-hover:opacity-100">{renderIcon(icon)}</span>}
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-[10px] opacity-40 font-mono tracking-tighter ml-4">{shortcut}</span>}
    </button>
  );

  useEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const { offsetWidth, offsetHeight } = contextMenuRef.current;
      const x = Math.min(contextMenu.x, window.innerWidth - offsetWidth - 10);
      const y = Math.min(contextMenu.y, window.innerHeight - offsetHeight - 10);
      setPosition({ x: Math.max(10, x), y: Math.max(10, y) });
    }
  }, [contextMenu?.x, contextMenu?.y, contextMenuRef]);

  // Render logic follows hook calls
  if (!contextMenu) return null;

  return (
    <div
      ref={contextMenuRef}
      className={`context-menu fixed z-50 py-1 rounded-lg shadow-xl min-w-[140px] max-w-[240px] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
      style={{
        left: position.x,
        top: position.y,
        maxHeight: '70vh',
        overflowY: 'auto',
        resize: contextMenu.mode.startsWith('note') ? 'both' : 'none',
        minWidth: contextMenu.mode.startsWith('note') ? 180 : undefined,
        minHeight: contextMenu.mode.startsWith('note') ? 120 : undefined,
        maxWidth: '300px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.noteId && contextMenu.mode === 'note-style' && (
        <div className="px-2 py-2 space-y-2">
          <div className="text-[10px]  tracking-widest text-slate-500">
            {language === 'tr' ? 'Not Biçimi' : 'Note Style'}
          </div>

          <div className="grid grid-cols-5 gap-1">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { color: c }); onClose(); }}
                className={`w-4 h-4 rounded border ${note?.color === c ? 'ring-2 ring-cyan-500' : 'border-black/10'}`}
                style={{ backgroundColor: c, outline: note?.color === c ? '2px solid cyan' : 'none' }}
                title={c}
              />
            ))}
          </div>

          <div className="space-y-1">
            <div className="text-[10px]  tracking-widest text-slate-500">
              {language === 'tr' ? 'Yazı Tipi' : 'Font'}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {noteFonts.map((f) => (
                <button
                  key={f}
                  onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { font: f }); onClose(); }}
                  className={`px-2 py-1 rounded text-left text-[11px] ${note?.font === f
                    ? (isDark ? 'bg-slate-600 text-white border-cyan-500 border' : 'bg-slate-200 text-black border-cyan-500 border')
                    : (isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700')
                    }`}
                  style={{ fontFamily: f }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] tracking-widest text-slate-500">
              {language === 'tr' ? 'Boyut' : 'Size'}
            </div>
            <div className="flex gap-1">
              {NOTE_FONT_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { fontSize: s }); onClose(); }}
                  className={`px-2 py-1 rounded text-[11px] ${note?.fontSize === s
                    ? (isDark ? 'bg-slate-600 text-white border-cyan-500 border' : 'bg-slate-200 text-black border-cyan-500 border')
                    : (isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700')
                    }`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] tracking-widest text-slate-500">
              {language === 'tr' ? 'Saydamlık' : 'Opacity'}
            </div>
            <div className="flex gap-1">
              {NOTE_OPACITY.map((o) => (
                <button
                  key={o}
                  onClick={() => { onUpdateNoteStyle(contextMenu.noteId!, { opacity: o }); onClose(); }}
                  className={`px-2 py-1 rounded text-[11px] ${note?.opacity === o
                    ? (isDark ? 'bg-slate-600 text-white border-cyan-500 border' : 'bg-slate-200 text-black border-cyan-500 border')
                    : (isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700')
                    }`}
                >
                  {Math.round(o * 100)}%
                </button>
              ))}
            </div>
          </div>
          <div className="pt-1 border-t border-slate-700/30">
            {renderMenuItem({
              label: language === 'tr' ? 'Çoğalt' : 'Duplicate',
              icon: 'copy',
              onClick: () => { onDuplicateNote(contextMenu.noteId!); onClose(); }
            })}
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
            disabled: !canUndo,
            onClick: () => { onUndo(); onClose(); }
          })}
          {renderMenuItem({
            label: language === 'tr' ? 'Yinele' : 'Redo',
            icon: 'redo',
            shortcut: 'Ctrl+Y',
            disabled: !canRedo,
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
                  shortcut: 'Enter',
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
                  label: language === 'tr' ? 'Ping' : 'Ping',
                  icon: 'ping',
                  onClick: () => { onStartPing(contextMenu.deviceId!); onClose(); },
                  disabled: !device
                })}
                {renderMenuItem({
                  label: language === 'tr' ? 'Güç Aç/Kapat' : 'Power ON/OFF',
                  icon: 'power',
                  onClick: () => { onSaveToHistory(); onTogglePowerDevices(targets); onClose(); },
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

