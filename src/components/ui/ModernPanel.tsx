'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { X, GripHorizontal } from 'lucide-react';
import { useLayout } from '@/contexts/LayoutContext';

export interface ModernPanelProps {
    id: string;
    title: string;
    children: ReactNode;
    onClose?: () => void;
    resizable?: boolean;
    collapsible?: boolean;
    defaultWidth?: number;
    defaultHeight?: number;
    minWidth?: number;
    minHeight?: number;
    className?: string;
    style?: React.CSSProperties;
    headerAction?: ReactNode;
    noPadding?: boolean;
    headerStart?: ReactNode;
    footer?: ReactNode;
    mobileAutoHeight?: boolean;
    hideTitle?: boolean;
    hideHeader?: boolean;
}

export function ModernPanel({
    id,
    title,
    children,
    onClose,
    resizable = true,
    collapsible = true,
    defaultWidth = 400,
    defaultHeight = 600,
    minWidth = 250,
    minHeight = 300,
    className,
    style,
    headerAction,
    headerStart,
    footer,
    mobileAutoHeight = false,
    noPadding = false,
    hideTitle = false,
    hideHeader = false,
}: ModernPanelProps) {
    const { panelLayout } = useLayout();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [width, setWidth] = useState(defaultWidth);
    const [height, setHeight] = useState(defaultHeight);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mediaQuery = window.matchMedia('(max-width: 1023px)');
        const updateIsMobile = () => setIsMobile(mediaQuery.matches);

        updateIsMobile();
        mediaQuery.addEventListener('change', updateIsMobile);

        return () => {
            mediaQuery.removeEventListener('change', updateIsMobile);
        };
    }, []);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            const newWidth = Math.max(minWidth, startWidth + deltaX);
            const newHeight = Math.max(minHeight, startHeight + deltaY);

            setWidth(newWidth);
            setHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const isOverlay = panelLayout === 'overlay';
    const isStacked = panelLayout === 'stacked';
    const canResize = resizable && isOverlay && !isMobile;
    const canCollapse = collapsible && !isMobile;
    const overlayMobileStyle: React.CSSProperties = {};
    if (isOverlay && isMobile) {
        overlayMobileStyle.width = '100vw';
        overlayMobileStyle.left = "5px";
        overlayMobileStyle.right = "5px";
    }

    return (
        <div
            className={cn(
                'flex flex-col bg-background border rounded-lg shadow-lg overflow-hidden',
                isOverlay && 'fixed z-40',
                isStacked && 'relative',
                className
            )}
            style={{
                width: isOverlay ? (isMobile ? '100vw' : width) : '100%',
                height: '550px',
                ...overlayMobileStyle,
                ...style
            }}
        >
            {/* Header */}
            {!hideHeader && (
                <div
                    className={cn(
                        "flex items-center justify-between gap-2 p-4 border-b bg-muted/50",
                        isMobile && "p-3 min-h-[48px] touch-manipulation"
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {canResize && (
                            <GripHorizontal className="w-4 h-4 text-muted-foreground cursor-grab" />
                        )}
                        {headerStart}
                        {!hideTitle && (
                            <h2 className={cn(
                                "font-semibold flex-1 truncate",
                                isMobile ? "text-sm" : "text-sm"
                            )}>{title}</h2>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {headerAction}
                        {canCollapse && (
                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                className={cn(
                                    "p-1 hover:bg-accent rounded",
                                    isMobile && "p-2 min-w-[36px] min-h-[36px]"
                                )}
                                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                            >
                                {isCollapsed ? '▼' : '▲'}
                            </button>
                        )}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className={cn(
                                    "p-1 hover:bg-accent rounded",
                                    isMobile && "p-2 min-w-[36px] min-h-[36px]"
                                )}
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            {!isCollapsed && (
                <div className="flex-1 overflow-y-auto p-4">
                    {children}
                    {footer && <div className="mt-4 border-t pt-3">{footer}</div>}
                </div>
            )}

            {/* Resize Handle */}
            {canResize && (
                <div
                    onMouseDown={handleResizeStart}
                    className={cn(
                        'absolute bottom-0 right-0 w-4 h-4 cursor-se-resize',
                        isResizing && 'bg-primary'
                    )}
                    style={{
                        background: 'linear-gradient(135deg, transparent 50%, currentColor 50%)',
                        color: 'var(--color-border)',
                    }}
                />
            )}
        </div>
    );
}

export interface PanelContainerProps {
    panels: Array<{
        id: string;
        title: string;
        content: ReactNode;
        onClose?: () => void;
    }>;
    className?: string;
}

export function PanelContainer({ panels, className }: PanelContainerProps) {
    const { panelLayout } = useLayout();

    if (panelLayout === 'overlay') {
        return (
            <div className={cn('relative w-full h-full', className)}>
                {panels.map((panel, index) => (
                    <ModernPanel
                        key={panel.id}
                        id={panel.id}
                        title={panel.title}
                        onClose={panel.onClose}
                        className="absolute"
                        style={{
                            right: `${index * 20}px`,
                            top: `${index * 20}px`,
                        } as React.CSSProperties}
                    >
                        {panel.content}
                    </ModernPanel>
                ))}
            </div>
        );
    }

    if (panelLayout === 'stacked') {
        return (
            <div className={cn('flex flex-col gap-2', className)}>
                {panels.map((panel) => (
                    <ModernPanel
                        key={panel.id}
                        id={panel.id}
                        title={panel.title}
                        onClose={panel.onClose}
                        defaultHeight={200}
                    >
                        {panel.content}
                    </ModernPanel>
                ))}
            </div>
        );
    }

    // Docked layout
    return (
        <div className={cn('flex gap-2', className)}>
            {panels.map((panel) => (
                <ModernPanel
                    key={panel.id}
                    id={panel.id}
                    title={panel.title}
                    onClose={panel.onClose}
                    defaultWidth={300}
                    resizable={false}
                >
                    {panel.content}
                </ModernPanel>
            ))}
        </div>
    );
}
