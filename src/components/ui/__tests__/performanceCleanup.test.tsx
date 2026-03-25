import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppSkeleton } from '../AppSkeleton';
import { LoadingOverlay } from '../LoadingOverlay';

describe('Final performance cleanup', () => {
  it('keeps loading surfaces CSS-only and lightweight', () => {
    const skeleton = render(<AppSkeleton />);
    expect(skeleton.container.querySelectorAll('svg').length).toBe(0);
    expect(skeleton.container.textContent).toBe('');
    skeleton.unmount();

    const overlay = render(<LoadingOverlay message="Working" />);
    expect(overlay.container.textContent).toContain('Working');
    expect(overlay.container.querySelectorAll('svg').length).toBe(0);
  });

  it('keeps the loading overlay structurally simple', () => {
    const { container } = render(<LoadingOverlay />);
    expect(container.firstElementChild?.className).toContain('backdrop-blur-sm');
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });
});
