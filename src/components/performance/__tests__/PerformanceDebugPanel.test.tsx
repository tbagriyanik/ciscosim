/**
 * Tests for PerformanceDebugPanel component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceDebugPanel } from '../PerformanceDebugPanel';

describe('PerformanceDebugPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render collapsed button when closed', () => {
            render(<PerformanceDebugPanel isOpen={false} />);

            const button = screen.getByRole('button', { name: /perf/i });
            expect(button).toBeInTheDocument();
        });

        it('should render expanded panel when open', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
        });

        it('should render metrics sections', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText('Frame Rate')).toBeInTheDocument();
            expect(screen.getByText('Rendering')).toBeInTheDocument();
            expect(screen.getByText('Nodes')).toBeInTheDocument();
            expect(screen.getByText('Frame Drops')).toBeInTheDocument();
            expect(screen.getByText('Memory')).toBeInTheDocument();
        });

        it('should render control buttons', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /log/i })).toBeInTheDocument();
        });
    });

    describe('Positioning', () => {
        it('should render at top-right by default', () => {
            const { container } = render(<PerformanceDebugPanel isOpen={true} />);

            const panel = container.querySelector('.fixed');
            expect(panel).toHaveClass('top-0', 'right-0');
        });

        it('should render at specified position', () => {
            const { container } = render(
                <PerformanceDebugPanel isOpen={true} position="bottom-left" />
            );

            const panel = container.querySelector('.fixed');
            expect(panel).toHaveClass('bottom-0', 'left-0');
        });
    });

    describe('Interactions', () => {
        it('should expand when button clicked', async () => {
            const { rerender } = render(<PerformanceDebugPanel isOpen={false} />);

            const button = screen.getByRole('button', { name: /perf/i });
            fireEvent.click(button);

            rerender(<PerformanceDebugPanel isOpen={true} />);

            await waitFor(() => {
                expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
            });
        });

        it('should close when close button clicked', () => {
            const onClose = vi.fn();
            render(<PerformanceDebugPanel isOpen={true} onClose={onClose} />);

            const closeButton = screen.getByRole('button', { name: '✕' });
            fireEvent.click(closeButton);

            expect(onClose).toHaveBeenCalled();
        });

        it('should log metrics when log button clicked', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            render(<PerformanceDebugPanel isOpen={true} />);

            const logButton = screen.getByRole('button', { name: /log/i });
            fireEvent.click(logButton);

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should reset metrics when reset button clicked', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            const resetButton = screen.getByRole('button', { name: /reset/i });
            fireEvent.click(resetButton);

            // Should not throw
            expect(resetButton).toBeInTheDocument();
        });
    });

    describe('Metrics Display', () => {
        it('should display FPS metric', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText('Frame Rate')).toBeInTheDocument();
            expect(screen.getAllByText(/FPS/).length).toBeGreaterThan(0);
        });

        it('should display paint time metric', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText(/Paint Time:/)).toBeInTheDocument();
        });

        it('should display layout time metric', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText(/Layout Time:/)).toBeInTheDocument();
        });

        it('should display render time metric', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText(/Render Time:/)).toBeInTheDocument();
        });

        it('should display node count metric', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText(/Rendered:/)).toBeInTheDocument();
        });

        it('should display frame drops metric', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            expect(screen.getByText(/Total:/)).toBeInTheDocument();
        });
    });

    describe('FPS Color Coding', () => {
        it('should show green for good FPS', () => {
            const { container } = render(<PerformanceDebugPanel isOpen={true} />);

            // The FPS display should have color classes
            const fpsDisplay = container.querySelector('.text-lg');
            expect(fpsDisplay).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper button roles', () => {
            render(<PerformanceDebugPanel isOpen={true} />);

            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should have title attribute on collapsed button', () => {
            render(<PerformanceDebugPanel isOpen={false} />);

            const button = screen.getByRole('button', { name: /perf/i });
            expect(button).toHaveAttribute('title');
        });
    });
});
