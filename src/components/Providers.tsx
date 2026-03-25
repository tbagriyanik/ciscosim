'use client';

import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { FeatureFlagProvider } from '@/contexts/FeatureFlagContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
        <LanguageProvider>
          <LayoutProvider>
            <FeatureFlagProvider>
              <TooltipProvider>
                <SidebarProvider>
                  {children}
                </SidebarProvider>
              </TooltipProvider>
            </FeatureFlagProvider>
        </LayoutProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
