# Implementation Plan: Phase 1 UI/UX Performance Optimizations

## Overview

This implementation plan addresses critical performance issues in the Network Simulator 2026 application. The optimizations will be implemented in four phases: Zustand selectors, NetworkTopologyView memoization, CSS animations, and component cleanup. Each task builds on the previous tasks to ensure incremental progress.

## Tasks

- [x] 1. Implement Zustand Selectors
  - [x] 1.1 Add selector functions to appStore.ts
    - Create selectors for topology state (devices, connections, notes, selectedDeviceId, zoom, pan)
    - Create selectors for device states (switchStates, pcOutputs)
    - Create selectors for UI state (activeTab, activePanel, sidebarOpen)
    - _Requirements: 1.1, 1.3_
  
  - [x] 1.2 Update components to use selectors
    - Update NetworkTopologyView to use topology selectors
    - Update AppFooter to use device state selectors
    - Update TaskCard to use device state selectors
    - Update Terminal to use device state selectors
    - Update PCPanel to use device state selectors
    - Update VlanPanel to use device state selectors
    - Update SecurityPanel to use device state selectors
    - Update PortPanel to use device state selectors
    - Update QuickCommands to use device state selectors
    - _Requirements: 1.4_
  
  - [x] 1.3 Write property test for selector granularity
    - **Property 1: Selector Granularity**
    - **Validates: Requirements 1.2**
    - Test that components only re-render when their selected state changes

- [x] 2. Memoize NetworkTopologyView Component
  - [x] 2.1 Add React.memo to NetworkTopologyView
    - Implement custom comparison function
    - Compare only props that affect rendering (topology data, selected nodes, viewport)
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.2 Write property test for memoization
    - **Property 2: NetworkTopologyView Memoization**
    - **Validates: Requirements 2.2, 2.3**
    - Test that NetworkTopologyView doesn't re-render on unrelated prop changes

- [x] 3. Replace Framer Motion with CSS Animations
  - [x] 3.1 Add CSS animation utility classes to globals.css
    - Create fade-in/fade-out classes
    - Create scale-in/scale-out classes
    - Create slide-up/slide-down classes
    - Create smooth transition classes
    - _Requirements: 3.1_
  
  - [x] 3.2 Replace framer-motion in BottomSheet
    - Replace AnimatePresence with CSS classes
    - Replace motion.div with div + CSS classes
    - Maintain visual appearance
    - _Requirements: 3.2, 3.3_
  
  - [x] 3.3 Replace framer-motion in AppFooter
    - Replace motion.footer with footer + CSS classes
    - Replace motion.div with div + CSS classes
    - Maintain visual appearance
    - _Requirements: 3.2, 3.3_
  
  - [x] 3.4 Replace framer-motion in TaskCard
    - Replace AnimatePresence with CSS classes
    - Replace motion.div with div + CSS classes
    - Maintain visual appearance
    - _Requirements: 3.2, 3.3_
  
  - [x] 3.5 Replace framer-motion in Terminal
    - Replace AnimatePresence with CSS classes
    - Replace motion.div with div + CSS classes
    - Maintain visual appearance
    - _Requirements: 3.2, 3.3_
  
  - [x] 3.6 Write property test for CSS animation visual fidelity
    - **Property 3: CSS Animation Visual Fidelity**
    - **Validates: Requirements 3.3**
    - Test that CSS animations match framer-motion output

- [x] 4. Audit and Remove Unused Radix UI Components
  - [x] 4.1 Audit Radix UI component usage
    - Identify all Radix UI components in use
    - Identify unused Radix UI components
    - Document findings
    - _Requirements: 4.1, 4.2_
  
  - [x] 4.2 Remove unused Radix UI imports
    - Remove unused imports from all files
    - Verify no compilation errors
    - _Requirements: 4.2_
  
  - [x] 4.3 Update package.json
    - Remove unused Radix UI dependencies
    - Run npm install to update lock file
    - _Requirements: 4.3_
  
  - [x] 4.4 Write property test for bundle size reduction
    - **Property 4: Bundle Size Reduction**
    - **Validates: Requirements 4.4**
    - Test that bundle size is reduced after cleanup

- [x] 5. Performance Validation
  - [x] 5.1 Verify no visual regressions
    - Test all components visually
    - Compare before/after screenshots
    - Document any regressions
    - _Requirements: 5.4_
  
  - [x] 5.2 Check bundle size reduction
    - Run `npm run build`
    - Compare bundle sizes before/after
    - Verify at least 10% reduction
    - _Requirements: 5.3_
  
  - [x] 5.3 Test mobile performance
    - Test on mobile device or Chrome DevTools
    - Verify time to interactive reduced by 20%
    - Verify frame rate maintains 30 FPS during scrolling/panning
    - _Requirements: 5.1, 5.2_
  
  - [x] 5.4 Write property test for performance improvement
    - **Property 5: Performance Improvement**
    - **Validates: Requirements 5.1**
    - Test that time to interactive is reduced by 20%

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Final Checkpoint - Performance Validation Complete
  - Verify all performance targets are met
  - Ensure no visual regressions
  - Confirm bundle size reduction targets achieved

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation should be done incrementally, with testing at each step
- Performance metrics should be measured before and after each optimization to verify improvements
