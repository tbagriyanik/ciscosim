'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './button';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export function BottomSheet({ isOpen, onClose, title, children, className }: BottomSheetProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [showSheet, setShowSheet] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Handle sheet visibility with animation state
    useEffect(() => {
        if (isOpen) {
            setShowSheet(true);
            document.body.style.overflow = 'hidden';
        } else {
            // Delay hiding to allow exit animation
            const timer = setTimeout(() => {
                setShowSheet(false);
            }, 300); // Match CSS animation duration
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isMounted) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity duration-300 ease-out",
                    showSheet && isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sheet */}
            <div
                className={cn(
                    "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-2xl bg-background shadow-2xl md:hidden transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    className,
                    showSheet && isOpen ? "translate-y-0" : "translate-y-[100%]"
                )}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                {/* Handle */}
                <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto p-4 pb-8">
                    {children}
                </div>
            </div>
        </>
    );
}
