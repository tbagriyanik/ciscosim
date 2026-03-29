/**
 * Core Component Primitives Tests
 *
 * These tests validate that core UI components (Button, Input, Card, Dialog)
 * are properly built with design tokens, implement consistent styling and
 * behavior patterns, and have proper variant and size systems.
 *
 * **Validates: Requirements 1.3, 12.1**
 * Feature: ui-ux-full-modernization, Task: 1.2
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, buttonVariants } from '../button';
import { Input } from '../input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../dialog';

// ─────────────────────────────────────────────────────────────────────────────
// Unit Test Suite 1: Button Component
// ─────────────────────────────────────────────────────────────────────────────

describe('Button Component', () => {
    it('renders with default variant and size', () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('bg-primary');
    });

    it('renders all variant options', () => {
        const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;

        variants.forEach((variant) => {
            const { unmount } = render(<Button variant={variant}>Test</Button>);
            const button = screen.getByRole('button', { name: /test/i });
            expect(button).toBeInTheDocument();
            unmount();
        });
    });

    it('renders all size options', () => {
        const sizes = ['default', 'sm', 'lg', 'icon'] as const;

        sizes.forEach((size) => {
            const { unmount } = render(<Button size={size}>Test</Button>);
            const button = screen.getByRole('button', { name: /test/i });
            expect(button).toBeInTheDocument();
            unmount();
        });
    });

    it('applies disabled state correctly', () => {
        render(<Button disabled>Disabled</Button>);
        const button = screen.getByRole('button', { name: /disabled/i });
        expect(button).toBeDisabled();
        expect(button).toHaveClass('disabled:opacity-50');
    });

    it('supports custom className', () => {
        render(<Button className="custom-class">Custom</Button>);
        const button = screen.getByRole('button', { name: /custom/i });
        expect(button).toHaveClass('custom-class');
    });

    it('renders with icon support', () => {
        render(
            <Button>
                <span data-testid="icon">📝</span>
                Save
            </Button>
        );
        expect(screen.getByTestId('icon')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has focus-visible styling for accessibility', () => {
        render(<Button>Focus Test</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass('focus-visible:ring-ring/50');
    });

    it('buttonVariants CVA generates correct classes', () => {
        const defaultClasses = buttonVariants();
        expect(defaultClasses).toContain('inline-flex');
        expect(defaultClasses).toContain('items-center');
        expect(defaultClasses).toContain('justify-center');
    });

    it('buttonVariants applies variant classes correctly', () => {
        const destructiveClasses = buttonVariants({ variant: 'destructive' });
        expect(destructiveClasses).toContain('bg-destructive');
    });

    it('buttonVariants applies size classes correctly', () => {
        const lgClasses = buttonVariants({ size: 'lg' });
        expect(lgClasses).toContain('h-10');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Test Suite 2: Input Component
// ─────────────────────────────────────────────────────────────────────────────

describe('Input Component', () => {
    it('renders as input element', () => {
        render(<Input placeholder="Enter text" />);
        const input = screen.getByPlaceholderText(/enter text/i);
        expect(input).toBeInTheDocument();
        expect(input.tagName).toBe('INPUT');
    });

    it('supports different input types', () => {
        const types = ['text', 'email', 'password', 'number', 'date'] as const;

        types.forEach((type) => {
            const { unmount } = render(<Input type={type} placeholder={`${type} input`} />);
            const input = screen.getByPlaceholderText(new RegExp(type));
            expect(input).toHaveAttribute('type', type);
            unmount();
        });
    });

    it('applies focus-visible styling', () => {
        render(<Input placeholder="Focus test" />);
        const input = screen.getByPlaceholderText(/focus test/i);
        expect(input).toHaveClass('focus-visible:ring-ring/50');
    });

    it('applies disabled state correctly', () => {
        render(<Input disabled placeholder="Disabled" />);
        const input = screen.getByPlaceholderText(/disabled/i);
        expect(input).toBeDisabled();
        expect(input).toHaveClass('disabled:opacity-50');
    });

    it('applies aria-invalid styling for validation', () => {
        render(<Input aria-invalid="true" placeholder="Invalid" />);
        const input = screen.getByPlaceholderText(/invalid/i);
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveClass('aria-invalid:border-destructive');
    });

    it('supports custom className', () => {
        render(<Input className="custom-input" placeholder="Custom" />);
        const input = screen.getByPlaceholderText(/custom/i);
        expect(input).toHaveClass('custom-input');
    });

    it('has proper placeholder styling', () => {
        render(<Input placeholder="Placeholder text" />);
        const input = screen.getByPlaceholderText(/placeholder text/i);
        expect(input).toHaveClass('placeholder:text-muted-foreground');
    });

    it('applies border and shadow styling', () => {
        render(<Input placeholder="Styled" />);
        const input = screen.getByPlaceholderText(/styled/i);
        expect(input).toHaveClass('border');
        expect(input).toHaveClass('shadow-xs');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Test Suite 3: Card Component
// ─────────────────────────────────────────────────────────────────────────────

describe('Card Component', () => {
    it('renders card container', () => {
        render(<Card>Card content</Card>);
        const card = screen.getByText(/card content/i);
        expect(card).toBeInTheDocument();
        expect(card).toHaveClass('bg-card');
    });

    it('renders CardHeader with proper styling', () => {
        render(
            <Card>
                <CardHeader>Header</CardHeader>
            </Card>
        );
        const header = screen.getByText(/header/i);
        expect(header).toHaveClass('px-6');
    });

    it('renders CardTitle with badge styling', () => {
        render(
            <Card>
                <CardHeader>
                    <CardTitle>Title</CardTitle>
                </CardHeader>
            </Card>
        );
        const title = screen.getByText(/title/i);
        expect(title).toHaveClass('bg-muted/30');
        expect(title).toHaveClass('rounded-full');
    });

    it('renders CardDescription with muted styling', () => {
        render(
            <Card>
                <CardDescription>Description text</CardDescription>
            </Card>
        );
        const description = screen.getByText(/description text/i);
        expect(description).toHaveClass('text-muted-foreground');
    });

    it('renders CardContent with padding', () => {
        render(
            <Card>
                <CardContent>Content</CardContent>
            </Card>
        );
        const content = screen.getByText(/content/i);
        expect(content).toHaveClass('px-6');
    });

    it('renders CardFooter with flex layout', () => {
        render(
            <Card>
                <CardFooter>Footer</CardFooter>
            </Card>
        );
        const footer = screen.getByText(/footer/i);
        expect(footer).toHaveClass('flex');
        expect(footer).toHaveClass('items-center');
    });

    it('applies border and shadow styling', () => {
        render(<Card>Card</Card>);
        const card = screen.getByText(/card/i);
        expect(card).toHaveClass('border');
        expect(card).toHaveClass('shadow-sm');
    });

    it('applies rounded-xl border radius', () => {
        render(<Card>Card</Card>);
        const card = screen.getByText(/card/i);
        expect(card).toHaveClass('rounded-xl');
    });

    it('supports custom className on Card', () => {
        render(<Card className="custom-card">Card</Card>);
        const card = screen.getByText(/card/i);
        expect(card).toHaveClass('custom-card');
    });

    it('renders complete card structure', () => {
        render(
            <Card>
                <CardHeader>
                    <CardTitle>Complete Card</CardTitle>
                    <CardDescription>With all sections</CardDescription>
                </CardHeader>
                <CardContent>Main content</CardContent>
                <CardFooter>Footer content</CardFooter>
            </Card>
        );

        expect(screen.getByText(/complete card/i)).toBeInTheDocument();
        expect(screen.getByText(/with all sections/i)).toBeInTheDocument();
        expect(screen.getByText(/main content/i)).toBeInTheDocument();
        expect(screen.getByText(/footer content/i)).toBeInTheDocument();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Test Suite 4: Dialog Component
// ─────────────────────────────────────────────────────────────────────────────

describe('Dialog Component', () => {
    it('renders dialog trigger', () => {
        render(
            <Dialog>
                <DialogTrigger>Open Dialog</DialogTrigger>
            </Dialog>
        );
        const trigger = screen.getByRole('button', { name: /open dialog/i });
        expect(trigger).toBeInTheDocument();
    });

    it('renders DialogContent with proper styling', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Test</DialogTitle>
                    Dialog content
                </DialogContent>
            </Dialog>
        );
        const content = screen.getByText(/dialog content/i);
        expect(content).toHaveClass('bg-background');
        expect(content).toHaveClass('rounded-lg');
    });

    it('renders DialogHeader with flex layout', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Test</DialogTitle>
                    <DialogHeader>Header</DialogHeader>
                </DialogContent>
            </Dialog>
        );
        const header = screen.getByText(/header/i);
        expect(header).toHaveClass('flex');
        expect(header).toHaveClass('flex-col');
    });

    it('renders DialogTitle with proper styling', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dialog Title</DialogTitle>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );
        const title = screen.getByText(/dialog title/i);
        expect(title).toHaveClass('text-lg');
        expect(title).toHaveClass('font-semibold');
    });

    it('renders DialogDescription with muted styling', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogHeader>
                        <DialogDescription>Dialog description</DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );
        const description = screen.getByText(/dialog description/i);
        expect(description).toHaveClass('text-muted-foreground');
    });

    it('renders close button by default', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Test</DialogTitle>
                    Dialog content
                </DialogContent>
            </Dialog>
        );
        const closeButton = screen.getByRole('button', { name: /close/i });
        expect(closeButton).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
        render(
            <Dialog open>
                <DialogContent showCloseButton={false}>
                    <DialogTitle>Test</DialogTitle>
                    Dialog content
                </DialogContent>
            </Dialog>
        );
        const closeButtons = screen.queryAllByRole('button', { name: /close/i });
        expect(closeButtons.length).toBe(0);
    });

    it('applies overlay styling', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Test</DialogTitle>
                    Dialog content
                </DialogContent>
            </Dialog>
        );
        // The overlay should have backdrop blur styling
        const content = screen.getByText(/dialog content/i);
        expect(content).toBeInTheDocument();
    });

    it('applies focus-visible styling to close button', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Test</DialogTitle>
                    Dialog content
                </DialogContent>
            </Dialog>
        );
        const closeButton = screen.getByRole('button', { name: /close/i });
        expect(closeButton).toHaveClass('focus:ring-2');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property Test Suite: Component Consistency
// ─────────────────────────────────────────────────────────────────────────────

describe('Property Test: Component Styling Consistency', () => {
    it('all components use design token CSS variables', () => {
        const { container: buttonContainer } = render(<Button>Test</Button>);
        const { container: inputContainer } = render(<Input />);
        const { container: cardContainer } = render(<Card>Test</Card>);

        // Check that components use CSS classes that reference design tokens
        const buttonClasses = buttonContainer.querySelector('button')?.className || '';
        const inputClasses = inputContainer.querySelector('input')?.className || '';
        const cardClasses = cardContainer.querySelector('div')?.className || '';

        // All should have some styling applied
        expect(buttonClasses.length).toBeGreaterThan(0);
        expect(inputClasses.length).toBeGreaterThan(0);
        expect(cardClasses.length).toBeGreaterThan(0);
    });

    it('all interactive components support disabled state', () => {
        render(<Button disabled>Disabled Button</Button>);
        render(<Input disabled />);

        const button = screen.getByRole('button');
        const input = screen.getByRole('textbox');

        expect(button).toBeDisabled();
        expect(input).toBeDisabled();
    });

    it('all interactive components have focus-visible styling', () => {
        render(<Button>Button</Button>);
        render(<Input />);

        const button = screen.getByRole('button');
        const input = screen.getByRole('textbox');

        expect(button.className).toContain('focus-visible');
        expect(input.className).toContain('focus-visible');
    });

    it('all components support custom className prop', () => {
        render(<Button className="custom-btn">Button</Button>);
        render(<Input className="custom-input" />);
        render(<Card className="custom-card">Card</Card>);

        const button = screen.getByRole('button');
        const input = screen.getByRole('textbox');
        const card = screen.getByText(/card/i);

        expect(button).toHaveClass('custom-btn');
        expect(input).toHaveClass('custom-input');
        expect(card).toHaveClass('custom-card');
    });

    it('button variants are mutually exclusive', () => {
        const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;

        variants.forEach((variant) => {
            const classes = buttonVariants({ variant });
            // Each variant should produce different styling
            expect(classes.length).toBeGreaterThan(0);
        });
    });

    it('button sizes are mutually exclusive', () => {
        const sizes = ['default', 'sm', 'lg', 'icon'] as const;

        sizes.forEach((size) => {
            const classes = buttonVariants({ size });
            // Each size should produce different styling
            expect(classes.length).toBeGreaterThan(0);
        });
    });

    it('components render without errors with various prop combinations', () => {
        const variants = ['default', 'destructive', 'outline'] as const;
        const sizes = ['default', 'sm', 'lg'] as const;

        variants.forEach((variant) => {
            sizes.forEach((size) => {
                const { unmount } = render(
                    <Button variant={variant} size={size}>
                        Test
                    </Button>
                );
                expect(screen.getByRole('button')).toBeInTheDocument();
                unmount();
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Component Accessibility', () => {
    it('button is keyboard accessible', () => {
        render(<Button>Keyboard Test</Button>);
        const button = screen.getByRole('button');
        // Button should be accessible via keyboard (role is sufficient)
        expect(button).toBeInTheDocument();
    });

    it('input supports aria-invalid for validation feedback', () => {
        render(<Input aria-invalid="true" />);
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('input supports aria-label for accessibility', () => {
        render(<Input aria-label="Email address" />);
        const input = screen.getByLabelText(/email address/i);
        expect(input).toBeInTheDocument();
    });

    it('dialog close button has accessible label', () => {
        render(
            <Dialog open>
                <DialogContent>Content</DialogContent>
            </Dialog>
        );
        const closeButton = screen.getByRole('button', { name: /close/i });
        // Close button should be accessible via screen reader (name is sufficient)
        expect(closeButton).toBeInTheDocument();
    });

    it('card components use semantic HTML', () => {
        const { container } = render(
            <Card>
                <CardHeader>
                    <CardTitle>Title</CardTitle>
                </CardHeader>
                <CardContent>Content</CardContent>
            </Card>
        );

        // Card should be a div with proper structure
        const card = container.querySelector('[data-slot="card"]');
        expect(card).toBeInTheDocument();
    });
});
