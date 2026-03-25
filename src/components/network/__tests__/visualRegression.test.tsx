import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

describe('Visual Regression Stability', () => {
  it('keeps button structure stable', () => {
    const { container } = render(<Button>Action</Button>);
    expect(container.querySelector('button')).toBeTruthy();
    expect(container.firstElementChild?.tagName).toBe('BUTTON');
    expect(container.firstElementChild?.className).toContain('inline-flex');
  });

  it('keeps card structure stable', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Panel</CardTitle>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>
    );

    expect(container.querySelector('[data-slot="card"]') || container.firstElementChild).toBeTruthy();
    expect(container.textContent).toContain('Panel');
    expect(container.textContent).toContain('Content');
  });

  it('maintains consistent class surface across renders', () => {
    const first = render(<Button variant="default">A</Button>);
    const second = render(<Button variant="default">B</Button>);

    expect(first.container.firstElementChild?.className).toBe(second.container.firstElementChild?.className);
  });
});
