import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    OptimizedDeviceIcon,
    LazyOptimizedDeviceIcon,
    EagerOptimizedDeviceIcon,
} from '../assets/OptimizedDeviceIcon';
import {
    ResponsiveImage,
    LazyResponsiveImage,
    EagerResponsiveImage,
} from '../assets/ResponsiveImage';
import {
    fetchSVG,
    clearSVGCache,
    getSVGCacheSize,
    inlineSVG,
    optimizeSVG,
    createInlineSVGElement,
    batchInlineSVGs,
    preloadSVGs,
    getSVGStats,
} from '../assets/svgInliner';

/**
 * Unit Tests for Image Optimization System
 * Tests OptimizedDeviceIcon, ResponsiveImage, and SVG inlining utilities
 */

describe('OptimizedDeviceIcon', () => {
    it('should render device icon with default props', () => {
        const { container } = render(
            <OptimizedDeviceIcon type="pc" alt="PC icon" />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render with custom width and height', () => {
        const { container } = render(
            <OptimizedDeviceIcon type="router" width={32} height={32} alt="Router" />
        );
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveStyle('width: 32px');
        expect(wrapper).toHaveStyle('height: 32px');
    });

    it('should apply custom className', () => {
        const { container } = render(
            <OptimizedDeviceIcon
                type="switch"
                className="custom-class"
                alt="Switch"
            />
        );
        expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should render with active state', () => {
        const { container } = render(
            <OptimizedDeviceIcon type="pc" active={true} alt="Active PC" />
        );
        const svg = container.querySelector('svg');
        // Check that the SVG has the drop-shadow class applied
        expect(svg?.className.baseVal).toContain('drop-shadow');
    });

    it('should render with custom color', () => {
        const { container } = render(
            <OptimizedDeviceIcon type="router" color="#FF0000" alt="Red router" />
        );
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('stroke', '#FF0000');
    });

    it('should render LazyOptimizedDeviceIcon with lazy loading', () => {
        const { container } = render(
            <LazyOptimizedDeviceIcon type="pc" alt="Lazy PC" />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render EagerOptimizedDeviceIcon with eager loading', () => {
        const { container } = render(
            <EagerOptimizedDeviceIcon type="router" alt="Eager router" />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should support all device types', () => {
        const types = ['pc', 'router', 'switch'] as const;
        types.forEach(type => {
            const { container } = render(
                <OptimizedDeviceIcon type={type} alt={`${type} icon`} />
            );
            expect(container.querySelector('svg')).toBeInTheDocument();
        });
    });
});

describe('ResponsiveImage', () => {
    it('should render image with required props', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test image"
                width={800}
                height={600}
            />
        );
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('alt', 'Test image');
    });

    it('should generate sizes attribute from breakpoints', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
                breakpoints={[
                    { breakpoint: 640, width: 320 },
                    { breakpoint: 1024, width: 512 },
                ]}
            />
        );
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('sizes');
    });

    it('should use custom sizes attribute when provided', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
                sizes="(max-width: 640px) 100vw, 50vw"
            />
        );
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('sizes', '(max-width: 640px) 100vw, 50vw');
    });

    it('should set eager loading when priority is true', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
                priority={true}
            />
        );
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('loading', 'eager');
    });

    it('should set lazy loading by default', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
            />
        );
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('should apply custom className', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
                className="custom-img"
            />
        );
        const img = container.querySelector('img');
        expect(img).toHaveClass('custom-img');
    });

    it('should apply container className', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
                containerClassName="custom-container"
            />
        );
        const div = container.querySelector('.custom-container');
        expect(div).toBeInTheDocument();
    });

    it('should calculate aspect ratio correctly', () => {
        const { container } = render(
            <ResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
            />
        );
        const div = container.firstChild as HTMLElement;
        // 600/800 * 100 = 75%
        expect(div).toHaveStyle('padding-bottom: 75%');
    });

    it('should render LazyResponsiveImage with lazy loading', () => {
        const { container } = render(
            <LazyResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
            />
        );
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('should render EagerResponsiveImage with eager loading', () => {
        const { container } = render(
            <EagerResponsiveImage
                src="/test.jpg"
                alt="Test"
                width={800}
                height={600}
            />
        );
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('loading', 'eager');
    });
});

describe('SVG Inlining Utilities', () => {
    beforeEach(() => {
        clearSVGCache();
    });

    it('should inline SVG with attributes', () => {
        const svgContent = '<svg><circle cx="12" cy="12" r="10" /></svg>';
        const result = inlineSVG(svgContent, { class: 'icon', id: 'test' });
        expect(result).toContain('class="icon"');
        expect(result).toContain('id="test"');
    });

    it('should inline SVG without attributes', () => {
        const svgContent = '<svg><circle cx="12" cy="12" r="10" /></svg>';
        const result = inlineSVG(svgContent);
        expect(result).toBe(svgContent);
    });

    it('should optimize SVG by removing XML declaration', () => {
        const svgContent = '<?xml version="1.0"?><svg><circle /></svg>';
        const result = optimizeSVG(svgContent);
        expect(result).not.toContain('<?xml');
    });

    it('should optimize SVG by removing comments', () => {
        const svgContent = '<svg><!-- comment --><circle /></svg>';
        const result = optimizeSVG(svgContent);
        expect(result).not.toContain('<!--');
    });

    it('should optimize SVG by removing extra whitespace', () => {
        const svgContent = '<svg>  <circle   />  </svg>';
        const result = optimizeSVG(svgContent);
        // After optimization, multiple spaces should be reduced
        expect(result.length).toBeLessThan(svgContent.length);
    });

    it('should create inline SVG element with class', () => {
        const svgContent = '<svg><circle /></svg>';
        const result = createInlineSVGElement(svgContent, 'icon-class');
        expect(result).toContain('class="icon-class"');
    });

    it('should create inline SVG element with aria-label', () => {
        const svgContent = '<svg><circle /></svg>';
        const result = createInlineSVGElement(svgContent, undefined, 'Test icon');
        expect(result).toContain('aria-label="Test icon"');
        expect(result).toContain('role="img"');
    });

    it('should cache SVG content', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<svg><circle /></svg>',
        });
        global.fetch = mockFetch;

        const url = 'https://example.com/icon.svg';
        await fetchSVG(url);
        expect(getSVGCacheSize()).toBe(1);

        // Second call should use cache
        await fetchSVG(url);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should clear SVG cache', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<svg><circle /></svg>',
        });
        global.fetch = mockFetch;

        const url = 'https://example.com/icon.svg';
        await fetchSVG(url);
        expect(getSVGCacheSize()).toBe(1);

        clearSVGCache();
        expect(getSVGCacheSize()).toBe(0);
    });

    it('should batch inline multiple SVGs', async () => {
        const svgs = [
            { content: '<svg><circle /></svg>' },
            { content: '<svg><rect /></svg>' },
            { content: '<svg><path /></svg>' },
        ];

        const results = await batchInlineSVGs(svgs);
        expect(results).toHaveLength(3);
        expect(results[0]).toContain('<svg>');
        expect(results[1]).toContain('<svg>');
        expect(results[2]).toContain('<svg>');
    });

    it('should handle batch inline errors gracefully', async () => {
        const svgs = [
            { content: '<svg><circle /></svg>' },
            { url: 'https://invalid.com/icon.svg' }, // Will fail
        ];

        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        global.fetch = mockFetch;

        const results = await batchInlineSVGs(svgs);
        expect(results).toHaveLength(2);
        expect(results[0]).toContain('<svg>');
        expect(results[1]).toBe('');
    });

    it('should preload SVGs', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<svg><circle /></svg>',
        });
        global.fetch = mockFetch;

        const urls = [
            'https://example.com/icon1.svg',
            'https://example.com/icon2.svg',
        ];

        await preloadSVGs(urls);
        expect(getSVGCacheSize()).toBe(2);
    });

    it('should get SVG stats', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<svg><circle /></svg>',
        });
        global.fetch = mockFetch;

        const url = 'https://example.com/icon.svg';
        await fetchSVG(url);

        const stats = getSVGStats();
        expect(stats.cacheSize).toBe(1);
        expect(stats.cachedUrls).toContain(url);
    });

    it('should handle fetch errors', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        global.fetch = mockFetch;

        const url = 'https://example.com/icon.svg';
        await expect(fetchSVG(url)).rejects.toThrow('Network error');
    });

    it('should handle fetch response errors', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            statusText: 'Not Found',
        });
        global.fetch = mockFetch;

        const url = 'https://example.com/icon.svg';
        await expect(fetchSVG(url)).rejects.toThrow('Failed to fetch SVG');
    });
});
