import { useState, useRef, useEffect, useCallback } from 'react';

export interface ModalPosition { x: number; y: number }
export interface ModalSize { width: number; height: number }

interface DragState {
    active: boolean;
    type: 'drag' | 'resize';
    modal: 'tasks' | 'cli';
    direction?: string;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startW: number;
    startH: number;
    raf: number | null;
}

const STORAGE_KEYS = {
    tasks: { position: 'tasks-modal-position', size: 'tasks-modal-size' },
    cli: { position: 'cli-modal-position', size: 'cli-modal-size' },
} as const;

function loadModalLayout(modal: 'tasks' | 'cli', defaultSize: ModalSize) {
    if (typeof window === 'undefined') return { position: null, size: defaultSize };
    const maxW = window.innerWidth - 40;
    const maxH = window.innerHeight - 40;
    const keys = STORAGE_KEYS[modal];

    let size = { ...defaultSize };
    const savedSize = localStorage.getItem(keys.size);
    if (savedSize) {
        const p = JSON.parse(savedSize);
        size = { width: Math.min(p.width, maxW), height: Math.min(p.height, maxH) };
    } else {
        size = { width: Math.min(maxW, defaultSize.width), height: Math.min(maxH, defaultSize.height) };
    }

    let position: ModalPosition | null = null;
    const savedPos = localStorage.getItem(keys.position);
    if (savedPos) {
        const p = JSON.parse(savedPos);
        position = {
            x: Math.max(0, Math.min(p.x, window.innerWidth - size.width)),
            y: Math.max(0, Math.min(p.y, window.innerHeight - size.height)),
        };
    } else {
        position = {
            x: Math.max(0, (window.innerWidth - size.width) / 2),
            y: Math.max(0, (window.innerHeight - size.height) / 2),
        };
    }

    return { position, size };
}

export function useModalDragResize(defaultSize: ModalSize = { width: 1200, height: 700 }) {
    const [tasksModalPosition, setTasksModalPosition] = useState<ModalPosition>({ x: 20, y: 20 });
    const [tasksModalSize, setTasksModalSize] = useState<ModalSize>(defaultSize);
    const [cliModalPosition, setCliModalPosition] = useState<ModalPosition>({ x: 20, y: 20 });
    const [cliModalSize, setCliModalSize] = useState<ModalSize>(defaultSize);

    // Load persisted layout after hydration
    useEffect(() => {
        const tasks = loadModalLayout('tasks', defaultSize);
        if (tasks.position) setTasksModalPosition(tasks.position);
        setTasksModalSize(tasks.size);

        const cli = loadModalLayout('cli', defaultSize);
        if (cli.position) setCliModalPosition(cli.position);
        setCliModalSize(cli.size);
    }, []);

    // Persist on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.tasks.position, JSON.stringify(tasksModalPosition));
        localStorage.setItem(STORAGE_KEYS.tasks.size, JSON.stringify(tasksModalSize));
    }, [tasksModalPosition, tasksModalSize]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.cli.position, JSON.stringify(cliModalPosition));
        localStorage.setItem(STORAGE_KEYS.cli.size, JSON.stringify(cliModalSize));
    }, [cliModalPosition, cliModalSize]);

    // Refs to always hold latest values for drag handlers
    const dragStateRef = useRef<DragState | null>(null);
    const tasksModalPositionRef = useRef(tasksModalPosition);
    const tasksModalSizeRef = useRef(tasksModalSize);
    const cliModalPositionRef = useRef(cliModalPosition);
    const cliModalSizeRef = useRef(cliModalSize);

    useEffect(() => { tasksModalPositionRef.current = tasksModalPosition; }, [tasksModalPosition]);
    useEffect(() => { tasksModalSizeRef.current = tasksModalSize; }, [tasksModalSize]);
    useEffect(() => { cliModalPositionRef.current = cliModalPosition; }, [cliModalPosition]);
    useEffect(() => { cliModalSizeRef.current = cliModalSize; }, [cliModalSize]);

    const handleMouseDown = useCallback((e: React.MouseEvent, modalType: 'tasks' | 'cli') => {
        const header = (e.target as HTMLElement).closest('[data-modal-header]');
        if (!header) return;
        if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
        e.preventDefault();
        e.stopPropagation();
        const pos = modalType === 'tasks' ? tasksModalPositionRef.current : cliModalPositionRef.current;
        const size = modalType === 'tasks' ? tasksModalSizeRef.current : cliModalSizeRef.current;
        dragStateRef.current = {
            active: true, type: 'drag', modal: modalType,
            startX: e.clientX, startY: e.clientY,
            startPosX: pos.x, startPosY: pos.y,
            startW: size.width, startH: size.height, raf: null,
        };
    }, []);

    const handleResizeStart = useCallback((
        e: React.MouseEvent,
        direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
        modalType: 'tasks' | 'cli',
    ) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = modalType === 'tasks' ? tasksModalPositionRef.current : cliModalPositionRef.current;
        const size = modalType === 'tasks' ? tasksModalSizeRef.current : cliModalSizeRef.current;
        dragStateRef.current = {
            active: true, type: 'resize', modal: modalType, direction,
            startX: e.clientX, startY: e.clientY,
            startPosX: pos.x, startPosY: pos.y,
            startW: size.width, startH: size.height, raf: null,
        };
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const ds = dragStateRef.current;
            if (!ds?.active) return;
            if (ds.raf) cancelAnimationFrame(ds.raf);
            ds.raf = requestAnimationFrame(() => {
                const ds2 = dragStateRef.current;
                if (!ds2?.active) return;
                const setPosition = ds2.modal === 'tasks' ? setTasksModalPosition : setCliModalPosition;
                const setSize = ds2.modal === 'tasks' ? setTasksModalSize : setCliModalSize;

                if (ds2.type === 'drag') {
                    setPosition({
                        x: ds2.startPosX + (e.clientX - ds2.startX),
                        y: ds2.startPosY + (e.clientY - ds2.startY),
                    });
                } else if (ds2.type === 'resize' && ds2.direction) {
                    const dx = e.clientX - ds2.startX;
                    const dy = e.clientY - ds2.startY;
                    let newW = ds2.startW, newH = ds2.startH, newX = ds2.startPosX, newY = ds2.startPosY;
                    if (ds2.direction.includes('e')) newW = Math.max(400, ds2.startW + dx);
                    if (ds2.direction.includes('s')) newH = Math.max(300, ds2.startH + dy);
                    if (ds2.direction.includes('w')) { newW = Math.max(400, ds2.startW - dx); newX = ds2.startPosX + (ds2.startW - newW); }
                    if (ds2.direction.includes('n')) { newH = Math.max(300, ds2.startH - dy); newY = ds2.startPosY + (ds2.startH - newH); }
                    setSize({ width: newW, height: newH });
                    setPosition({ x: newX, y: newY });
                }
            });
        };

        const handleMouseUp = () => {
            if (dragStateRef.current?.raf) cancelAnimationFrame(dragStateRef.current.raf);
            dragStateRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return {
        tasksModalPosition,
        tasksModalSize,
        cliModalPosition,
        cliModalSize,
        handleMouseDown,
        handleResizeStart,
    };
}
