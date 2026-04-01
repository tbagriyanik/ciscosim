'use client';

import React from 'react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

export interface AccessibleButtonProps extends ButtonProps {
    ariaLabel?: string;
    ariaDescribedBy?: string;
    ariaExpanded?: boolean;
    ariaControls?: string;
    ariaPressed?: boolean;
    tooltip?: string;
}

export const AccessibleButton = React.forwardRef<HTMLButtonElement, AccessibleButtonProps>(
    ({ ariaLabel, ariaDescribedBy, ariaExpanded, ariaControls, ariaPressed, tooltip, className, children, ...props }, ref) => {
        return (
            <Button
                ref={ref}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                aria-expanded={ariaExpanded}
                aria-controls={ariaControls}
                aria-pressed={ariaPressed}
                title={tooltip}
                className={cn(className)}
                {...props}
            >
                {children}
            </Button>
        );
    }
);

AccessibleButton.displayName = 'AccessibleButton';
