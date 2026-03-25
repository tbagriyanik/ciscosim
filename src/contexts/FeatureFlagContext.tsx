'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface FeatureFlags {
  modernShell: boolean;
  accessibilityEnhancements: boolean;
  performanceGuardrails: boolean;
}

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  setFlag: (key: keyof FeatureFlags, enabled: boolean) => void;
}

const defaultFlags: FeatureFlags = {
  modernShell: true,
  accessibilityEnhancements: true,
  performanceGuardrails: true,
};

const STORAGE_KEY = 'netsim_feature_flags';

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined);

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setFlags({ ...defaultFlags, ...JSON.parse(saved) });
      }
    } catch {
      // ignore malformed flag payloads
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch {
      // ignore persistence failures
    }
  }, [flags]);

  const value = useMemo(() => ({
    flags,
    setFlag: (key: keyof FeatureFlags, enabled: boolean) => {
      setFlags(prev => ({ ...prev, [key]: enabled }));
    },
  }), [flags]);

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}
