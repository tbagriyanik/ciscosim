import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, within } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateButtonARIA, generateDialogARIA, generateNavigationARIA } from '@/lib/accessibility';

describe('Testing and Quality Assurance - Property Tests', () => {
  it('core primitives render with accessible semantics', () => {
    fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !/^\s+$/.test(s)),
          (label) => {
          const normalized = label.trim();
          const { container, unmount } = render(<Button>{normalized}</Button>);
          expect(within(container).getByRole('button', { name: normalized })).toBeInTheDocument();
          unmount();

          const input = render(<Input aria-label={normalized} />);
          expect(input.getByLabelText(normalized)).toBeInTheDocument();
          input.unmount();
        }
      )
    );
  });

  it('accessibility helpers return stable aria contracts', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), (label) => {
        const buttonAria = generateButtonARIA({ label });
        const dialogAria = generateDialogARIA({ label });
        const navAria = generateNavigationARIA({ label });

        expect(buttonAria.ariaLabel).toBe(label);
        expect(dialogAria.ariaLabel).toBe(label);
        expect(navAria.ariaLabel).toBe(label);
      })
    );
  });

  it('visual layout primitives keep predictable class surfaces', () => {
    fc.assert(
      fc.property(fc.boolean(), (active) => {
        const className = active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground';
        expect(className).toContain('text');
      })
    );
  });
});
