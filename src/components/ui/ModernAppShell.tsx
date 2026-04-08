'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ModernAppShellProps {
    children?: ReactNode;
    main?: ReactNode;
    sidebar?: ReactNode;
    header?: ReactNode;
    headerExtras?: ReactNode;
    footer?: ReactNode;
    sidebarFooter?: ReactNode;
    mainBefore?: ReactNode;
    mainAfter?: ReactNode;
    className?: string;
    sidebarWidth?: number;
    collapsible?: boolean;
}

export function ModernAppShell({
    children,
    main,
    sidebar,
    header,
    headerExtras,
    footer,
    sidebarFooter,
    mainBefore,
    mainAfter,
    className,
    sidebarWidth = 240,
    collapsible = false,
}: ModernAppShellProps) {
    const [sidebarOpen, setSidebarOpen] = React.useState(true);

    return (
        <div className={cn('flex flex-col h-full w-full', className)}>
            {(header || headerExtras) && (
                <header className="flex-shrink-0 border-b bg-background flex items-center justify-between">
                    {header}
                    {headerExtras && <div className="flex items-center">{headerExtras}</div>}
                </header>
            )}
            <div className="p-4">
                {sidebar && (
                    <aside
                        className={cn(
                            'flex-shrink-0 border-r bg-muted/30 transition-all duration-200 flex flex-col',
                            !sidebarOpen && 'w-0 '
                        )}
                        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
                    >
                        {collapsible && (
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="absolute top-2 right-2 p-1 rounded hover:bg-accent"
                                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                            >
                                {sidebarOpen ? '◀' : '▶'}
                            </button>
                        )}
                        <div className="flex-1">{sidebar}</div>
                        {sidebarFooter && <div className="flex-shrink-0">{sidebarFooter}</div>}
                    </aside>
                )}
                <main className="flex-1 min-w-0 overflow-auto flex flex-col">
                    {mainBefore && <div>{mainBefore}</div>}
                    <div className="flex-1">{main ?? children}</div>
                    {mainAfter && <div>{mainAfter}</div>}
                </main>
            </div>
            {footer && (
                <footer className="flex-shrink-0 border-t bg-background">
                    {footer}
                </footer>
            )}
        </div>
    );
}

ModernAppShell.displayName = 'ModernAppShell';

export interface NavigationItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    badge?: string | number;
    onClick?: () => void;
}

export interface ModernNavigationProps {
    items: NavigationItem[];
    className?: string;
}

export function ModernNavigation({ items, className }: ModernNavigationProps) {
    return (
        <nav className={cn('flex flex-col gap-1 p-2', className)} aria-label="Sidebar navigation">
            {items.map((item) => (
                <button
                    key={item.id}
                    onClick={item.onClick}
                    className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left',
                        item.active
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                    aria-current={item.active ? 'page' : undefined}
                >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && (
                        <span className="ml-auto text-xs bg-primary/20 text-primary rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                            {item.badge}
                        </span>
                    )}
                </button>
            ))}
        </nav>
    );
}

export function ModernBottomNavigation({ items, className }: ModernNavigationProps) {
    return (
        <nav className={cn('flex items-center justify-around border-t bg-background px-2 py-1', className)} aria-label="Bottom navigation">
            {items.map((item) => (
                <button
                    key={item.id}
                    onClick={item.onClick}
                    className={cn(
                        'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors min-w-0',
                        item.active
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                    aria-current={item.active ? 'page' : undefined}
                >
                    <span className="relative">
                        {item.icon}
                        {item.badge !== undefined && (
                            <span className="absolute -top-1 -right-1 text-xs bg-primary text-primary-foreground rounded-full px-1 min-w-[1rem] text-center leading-tight">
                                {item.badge}
                            </span>
                        )}
                    </span>
                    <span className="truncate max-w-[4rem]">{item.label}</span>
                </button>
            ))}
        </nav>
    );
}
