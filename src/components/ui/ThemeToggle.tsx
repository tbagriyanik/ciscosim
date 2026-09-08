'use client';

import { Moon, Sun } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
    isDark: boolean;
    lightLabel: string;
    darkLabel: string;
    onToggle: () => void;
    className?: string;
}

export function ThemeToggle({ isDark, lightLabel, darkLabel, onToggle, className }: ThemeToggleProps) {
    const label = isDark ? lightLabel : darkLabel;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    onClick={onToggle}
                    className={cn(
                        'h-8 w-8 rounded flex items-center justify-center transition-all ui-hover-surface',
                        isDark ? 'text-secondary-300 hover:text-yellow-300' : 'text-secondary-500 hover:text-yellow-600',
                        className,
                    )}
                >
                    {isDark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
                </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
