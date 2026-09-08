'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ClipboardPaste, Copy, ListChecks, Scissors, Trash2 } from 'lucide-react';
import { colors } from '@/lib/design-tokens/colors';
import { sanitizeHTML } from '@/lib/security/sanitizer';

interface PythonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isDark: boolean;
  placeholder?: string;
  fontSize?: number;
  wordWrap?: boolean;
}

const CODE_WORDS = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
  'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'None', 'not', 'or', 'pass', 'raise',
  'return', 'True', 'try', 'while', 'with', 'yield',
  'print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'dict',
  'set', 'tuple', 'enumerate', 'zip', 'open', 'input', 'sum', 'min', 'max',
  'abs', 'round', 'sorted', 'reversed', 'type', 'isinstance',
  'math', 'random', 'json', 'datetime', 'os', 'sys',
  'function', 'const', 'let', 'var', 'console', 'log', 'return', 'echo',
];

export const SYNTAX_COLORS = {
  keyword: colors.purple[400],
  builtin: colors.theme.accent,
  string: colors.green[300],
  number: colors.amber[400],
  constant: '#fb7185',
  comment: colors.topology.subText,
} as const;

function highlightCode(code: string): string {
  const token = /(#.*$|\/\/.*$|(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b\d+(?:\.\d+)?\b|\b(?:True|False|None|true|false|null|undefined)\b|\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|not|or|pass|raise|return|try|while|with|yield|function|const|let|var)\b|\b(?:print|len|range|str|int|float|bool|list|dict|set|tuple|enumerate|zip|open|input|sum|min|max|abs|round|sorted|reversed|type|isinstance|console|log|echo)\b)/gm;

  let output = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(code))) {
    output += code.slice(lastIndex, match.index);
    const text = match[0];
    const raw = match[0];

    let kind = 'keyword';
    if (raw.startsWith('#') || raw.startsWith('//')) {
      kind = 'comment';
    } else if (raw.startsWith('"') || raw.startsWith("'") || raw.startsWith('`')) {
      kind = 'string';
    } else if (/^\d/.test(raw)) {
      kind = 'number';
    } else if (/^(True|False|None|true|false|null|undefined)$/.test(raw)) {
      kind = 'constant';
    } else if (/^(print|len|range|str|int|float|bool|list|dict|set|tuple|enumerate|zip|open|input|sum|min|max|abs|round|sorted|reversed|type|isinstance|console|log|echo)$/.test(raw)) {
      kind = 'builtin';
    }

    const color = SYNTAX_COLORS[kind as keyof typeof SYNTAX_COLORS] || SYNTAX_COLORS.comment;

    output += `<span style="color:${color}${kind === 'comment' ? ';font-style:italic;opacity:0.8' : ''}">${text}</span>`;
    lastIndex = match.index + raw.length;
  }

  const result = output + code.slice(lastIndex) + (code.endsWith('\n') ? ' ' : '');
  return result;
}

export function PythonCodeEditor({ value, onChange, onKeyDown, isDark, placeholder, fontSize = 14, wordWrap = true }: PythonCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const dragLineRef = useRef<number | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [caretPos, setCaretPos] = useState({ top: 36, left: 16 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editorWidth, setEditorWidth] = useState(800);

  const wrapThreshold = Math.max(20, Math.floor((editorWidth - 64) / Math.max(1, fontSize * 0.6)));
  const highlighted = useMemo(() => sanitizeHTML(highlightCode(value)), [value]);
  const gutterRows = useMemo(() => {
    const rows: Array<{ label: string; lineIndex: number }> = [];
    value.split('\n').forEach((line, lineIndex) => {
      const visualLines = wordWrap ? Math.max(1, Math.ceil(Math.max(1, line.length) / wrapThreshold)) : 1;
      rows.push({ label: String(lineIndex + 1), lineIndex });
      for (let continuation = 1; continuation < visualLines; continuation++) rows.push({ label: '', lineIndex });
    });
    return rows;
  }, [value, wordWrap, wrapThreshold]);

  const selectLine = (lineIndex: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const lines = value.split('\n');
    const start = lines.slice(0, lineIndex).reduce((total, line) => total + line.length + 1, 0);
    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = start + lines[lineIndex].length;
    setContextMenu(null);
  };

  const selectLineRange = (startLine: number, endLine: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const lines = value.split('\n');
    const first = Math.min(startLine, endLine);
    const last = Math.max(startLine, endLine);
    const start = lines.slice(0, first).reduce((total, line) => total + line.length + 1, 0);
    const end = lines.slice(0, last + 1).reduce((total, line) => total + line.length + 1, 0) - 1;
    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = end;
  };

  const suggestions = useMemo(() => {
    if (!currentWord) return [];
    return CODE_WORDS.filter((word) => word.startsWith(currentWord) && word !== currentWord).slice(0, 8);
  }, [currentWord]);

  const updateCaretPosition = (textarea: HTMLTextAreaElement) => {
    const selStart = textarea.selectionStart;
    const textBefore = textarea.value.slice(0, selStart);
    const lines = textBefore.split('\n');
    const lineIndex = lines.length - 1;
    const colIndex = lines[lineIndex].length;

    const lineHeight = 20;
    const charWidth = 8.2;

    const top = Math.min(Math.max(16, textarea.clientHeight - 100), lineIndex * lineHeight + 36 - textarea.scrollTop);
    const left = Math.min(Math.max(16, textarea.clientWidth - 180), colIndex * charWidth + 16 - textarea.scrollLeft);

    setCaretPos({ top, left });
  };

  const complete = (word: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const prefix = value.slice(0, start).replace(/[A-Za-z_]\w*$/, '');
    const next = prefix + word + value.slice(start);
    onChange(next);
    setSuggestionsOpen(false);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = prefix.length + word.length;
    });
  };

  const updateCompletionContext = (textarea: HTMLTextAreaElement, nextValue: string) => {
    const word = nextValue.slice(0, textarea.selectionStart).match(/[A-Za-z_]\w*$/)?.[0] || '';
    setCurrentWord(word);
    updateCaretPosition(textarea);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const edit = async (action: 'cut' | 'copy' | 'paste' | 'delete' | 'selectAll') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (action === 'selectAll') textarea.select();
    else if (action === 'delete') onChange(value.slice(0, start) + value.slice(end));
    else if (action === 'copy' || action === 'cut') {
      await navigator.clipboard?.writeText(value.slice(start, end));
      if (action === 'cut') onChange(value.slice(0, start) + value.slice(end));
    } else {
      const text = await navigator.clipboard?.readText();
      if (text) onChange(value.slice(0, start) + text + value.slice(end));
    }
    setContextMenu(null);
    textarea.focus();
  };

  useEffect(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [value]);

  useEffect(() => {
    if (!editorRef.current) return;
    const observer = new ResizeObserver(entries => setEditorWidth(entries[0]?.contentRect.width || 800));
    observer.observe(editorRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, [contextMenu]);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(focusTimer);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab' || (event.ctrlKey && event.code === 'Space') || (event.metaKey && event.code === 'Space')) {
      event.stopPropagation();
    }
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      setSuggestionsOpen(true);
      setSuggestionIndex(0);
      if (textareaRef.current) {
        updateCaretPosition(textareaRef.current);
      }
      return;
    }
    if (suggestionsOpen && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSuggestionIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Tab' || event.key === 'Enter') {
        event.preventDefault();
        complete(suggestions[suggestionIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setSuggestionsOpen(false);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div ref={editorRef} data-code-editor="true" className={`relative flex-1 min-h-0 overflow-hidden ${isDark ? 'bg-secondary-950 text-secondary-100' : 'bg-white text-secondary-900'}`}>
      <div ref={gutterRef} aria-hidden="true" className={`absolute inset-y-0 left-0 z-20 w-12 overflow-hidden border-r p-4 pr-2 text-right font-mono text-xs leading-relaxed select-none ${isDark ? 'border-secondary-800 bg-secondary-900/70 text-secondary-600' : 'border-secondary-200 bg-secondary-100/70 text-secondary-500'}`} style={{ fontSize, lineHeight: String(Math.round(fontSize * 1.5)) + 'px' }}>
        {gutterRows.map((row, index) => (
          <button key={row.lineIndex + '-' + index} type="button" tabIndex={-1}
            onPointerDown={(event) => {
              event.preventDefault();
              dragLineRef.current = row.lineIndex;
              selectLine(row.lineIndex);
            }}
            onPointerEnter={(event) => {
              if ((event.buttons & 1) === 1 && dragLineRef.current !== null) {
                selectLineRange(dragLineRef.current, row.lineIndex);
              }
            }}
            onPointerUp={() => { dragLineRef.current = null; }}
            style={{ height: String(Math.round(fontSize * 1.5)) + 'px', lineHeight: String(Math.round(fontSize * 1.5)) + 'px' }} className={row.label ? 'block w-full cursor-pointer text-right hover:text-primary-500' : 'block w-full cursor-default text-right'}>
            {row.label}
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] overflow-hidden pl-16 pt-4">
        {value.split('\n').map((line, lineIndex) => {
          const indentation = line.match(/^[ \t]+/)?.[0] || '';
          const level = Math.floor(indentation.replace(/\t/g, '    ').length / 4);
          if (level === 0) return null;
          return (
            <div key={lineIndex} className="absolute left-16" style={{ top: String(16 + lineIndex * Math.round(fontSize * 1.5)) + 'px', height: String(Math.round(fontSize * 1.5)) + 'px' }}>
              {Array.from({ length: level }, (_, guideIndex) => (
                <span key={guideIndex} className="absolute top-0 bottom-0 w-px" style={{ left: String(guideIndex * fontSize * 2.4) + 'px', backgroundColor: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(71,85,105,0.28)' }} />
              ))}
            </div>
          );
        })}
      </div>
      {wordWrap && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[6] overflow-hidden pl-16 pt-4">
          {value.split('\n').map((line, lineIndex) => line.length > wrapThreshold ? (
            <span
              key={lineIndex}
              className="absolute text-xs"
              style={{
                top: String(16 + lineIndex * Math.round(fontSize * 1.5)) + 'px',
                left: String(Math.max(64, editorWidth - 24)) + 'px',
                color: isDark ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.7)',
              }}
            >↵</span>
          ) : null)}
        </div>
      )}
      <pre
        ref={preRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 m-0 overflow-hidden p-4 pl-16 font-mono text-xs leading-relaxed sm:text-sm ${wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} ${isDark ? 'text-secondary-200' : 'text-secondary-900'
          }`}
        style={{
          tabSize: 4,
          fontSize,
          lineHeight: String(Math.round(fontSize * 1.5)) + 'px',
        }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          updateCompletionContext(event.target, event.target.value);
          setSuggestionsOpen(true);
          setSuggestionIndex(0);
        }}
        onClick={(event) => updateCompletionContext(event.currentTarget, event.currentTarget.value)}
        onKeyUp={(event) => updateCompletionContext(event.currentTarget, event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => {
          event.preventDefault();
          const bounds = editorRef.current?.getBoundingClientRect();
          if (!bounds) return;
          const menuWidth = 170;
          const menuHeight = 210;
          setContextMenu({
            x: Math.max(8, Math.min(event.clientX - bounds.left, bounds.width - menuWidth - 8)),
            y: Math.max(8, Math.min(event.clientY - bounds.top, bounds.height - menuHeight - 8)),
          });
        }}
        onScroll={handleScroll}
        wrap={wordWrap ? 'soft' : 'off'}
        placeholder={placeholder}
        spellCheck={false}
        style={{ tabSize: 4, fontSize, lineHeight: String(Math.round(fontSize * 1.5)) + 'px', fontFamily: 'var(--font-geist-mono)', color: 'transparent', WebkitTextFillColor: 'transparent' }}
        className={`relative z-10 h-full w-full resize-none bg-transparent p-4 pl-16 font-mono text-xs leading-relaxed caret-primary-400 outline-none sm:text-sm ${isDark
            ? 'text-transparent placeholder:text-secondary-600 selection:bg-primary-800/50'
            : 'text-transparent placeholder:text-secondary-400 selection:bg-primary-200/60'
          }`}
        autoFocus
      />
      {contextMenu && (
        <div className="absolute z-[10020] min-w-40 rounded-md border border-secondary-700 bg-secondary-900 p-1 text-xs text-secondary-100 shadow-xl" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(event) => event.stopPropagation()}>
          {([
            ['cut', 'Kes', Scissors],
            ['copy', 'Kopyala', Copy],
            ['paste', 'Yapıştır', ClipboardPaste],
            ['separator', '', null],
            ['delete', 'Sil', Trash2],
            ['selectAll', 'Tümünü seç', ListChecks],
          ] as const).map(([action, label, Icon]) => action === 'separator' ? (
            <div key={action} className="my-1 border-t border-secondary-700" />
          ) : (
            <button key={action} type="button" className="block w-full rounded px-3 py-1.5 text-left hover:bg-primary-500/20" onClick={() => void edit(action)}>
              <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{label}</span>
            </button>
          ))}
        </div>
      )}
      {suggestionsOpen && suggestions.length > 0 && (
        <div
          className={`absolute z-30 min-w-44 overflow-hidden rounded-lg border shadow-2xl transition-all ${isDark ? 'border-secondary-700 bg-secondary-900/95 backdrop-blur-md' : 'border-secondary-300 bg-white/95 backdrop-blur-md'
            }`}
          style={{ top: `${caretPos.top}px`, left: `${caretPos.left}px` }}
        >
          <div className={`px-2 py-1 text-[10px] font-sans font-semibold border-b ${isDark ? 'border-secondary-800 text-secondary-400' : 'border-secondary-200 text-secondary-500'}`}>
            Oto Tamamlama (Tab / Enter)
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                complete(suggestion);
              }}
              className={`block w-full px-3 py-1.5 text-left font-mono text-xs transition-colors ${index === suggestionIndex
                  ? isDark
                    ? 'bg-primary-900/80 text-primary-200 font-bold'
                    : 'bg-primary-100 text-primary-800 font-bold'
                  : isDark
                    ? 'text-secondary-200 hover:bg-secondary-800'
                    : 'text-secondary-700 hover:bg-secondary-100'
                }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
