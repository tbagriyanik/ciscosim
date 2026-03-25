import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { FeatureFlagProvider, useFeatureFlags } from '../FeatureFlagContext';

describe('FeatureFlagContext', () => {
  it('exposes default rollout flags', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FeatureFlagProvider>{children}</FeatureFlagProvider>
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    expect(result.current.flags.modernShell).toBe(true);
    expect(result.current.flags.accessibilityEnhancements).toBe(true);
    expect(result.current.flags.performanceGuardrails).toBe(true);
  });

  it('allows feature flags to be updated', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FeatureFlagProvider>{children}</FeatureFlagProvider>
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    act(() => {
      result.current.setFlag('modernShell', false);
    });

    expect(result.current.flags.modernShell).toBe(false);
  });
});
