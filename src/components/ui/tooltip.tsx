"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
 delayDuration = 0,
 ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
 return (
 <TooltipPrimitive.Provider
 data-slot="tooltip-provider"
 delayDuration={delayDuration}
 {...props}
 />
 )
}

function Tooltip({
 ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
 return (
 <TooltipProvider>
 <TooltipPrimitive.Root data-slot="tooltip" {...props} />
 </TooltipProvider>
 )
}

function TooltipTrigger({
 ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
 return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
 className,
 sideOffset = 0,
 hideArrow = false,
 children,
 ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & { hideArrow?: boolean }) {
 return (
 <TooltipPrimitive.Portal>
 <TooltipPrimitive.Content
 data-slot="tooltip-content"
 sideOffset={sideOffset}
 className={cn(
 "bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-full border border-border/50 px-4 py-1.5 text-xs text-balance dark:border-slate-700 dark:shadow-[0_4px_12px_rgba(255,255,255,0.05)]",
 className
 )}
 {...props}
 sideOffset={8}
 side="bottom"
 >
 {children}
 {!hideArrow && (
 <TooltipPrimitive.Arrow className="fill-popover border-t border-l border-border/50 dark:border-slate-700 z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
 )}
 </TooltipPrimitive.Content>
 </TooltipPrimitive.Portal>
 )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
