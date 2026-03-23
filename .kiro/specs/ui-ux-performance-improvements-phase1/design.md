# Design Document: Phase 1 UI/UX Performance Optimizations

## Overview

This design addresses critical performance issues in the Network Simulator 2026 application. The analysis identified four main areas for optimization:

1. **Zustand Selectors**: Implement granular state access to prevent cascading re-renders
2. **NetworkTopologyView Memoization**: Add React.memo to prevent unnecessary re-renders
3. **CSS Animations**: Replace framer-motion with CSS transitions for simple effects
4. **Component Cleanup**: Audit and remove unused Radix UI dependencies

These optimizations will provide immediate performance improvements, particularly on mobile devices, while maintaining visual fidelity.

## Architecture

### Current Architecture Issues

The application currently suffers from:

- **Full store subscriptions**: Components subscribe to the entire Zustand store, causing re-renders when unrelated state changes
- **No component memoization**: NetworkTopologyView re-renders on any parent update
- **JavaScript animations**: Framer Motion animations block the main thread
- **Unused dependencies**: Radix UI components imported but not used

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Network Simulator 2026                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Zustand Store  │  │  React.memo     │  │   CSS        │ │
│  │  + Selectors    │  │  NetworkTopology│  │  Animations  │ │
│  └────────┬────────┘  └─────────────────┘  └──────────────┘ │
│           │                                                  │
│           └───────────┐  ┌──────────────────────────────────┘
│                       │  │
│  ┌────────────────────┴──┴────────────────────────────────┐ │
│  │              Radix UI Audit & Cleanup                  │ │
│  │  - Audit component usage                               │ │
│  │  - Remove unused imports                               │ │
│  │  - Update package.json                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Zustand Selectors

**File**: `src/lib/store/appStore.ts`

Add selector functions for granular state access:

```typescript
// Selectors for topology state
export const selectTopology = (state: AppState) => state.topology;
export const selectDevices = (state: AppState) => state.topology.devices;
export const selectConnections = (state: AppState) => state.topology.connections;
export const selectNotes = (state: AppState) => state.topology.notes;
export const selectSelectedDeviceId = (state: AppState) => state.topology.selectedDeviceId;
export const selectZoom = (state: AppState) => state.topology.zoom;
export const selectPan = (state: AppState) => state.topology.pan;

// Selectors for device states
export const selectDeviceStates = (state: AppState) => state.deviceStates;
export const selectSwitchStates = (state: AppState) => state.deviceStates.switchStates;
export const selectPCOutputs = (state: AppState) => state.deviceStates.pcOutputs;

// Selectors for UI state
export const selectActiveTab = (state: AppState) => state.activeTab;
export const selectActivePanel = (state: AppState) => state.activePanel;
export const selectSidebarOpen = (state: AppState) => state.sidebarOpen;
```

### NetworkTopologyView Component

**File**: `src/components/network/NetworkTopologyView.tsx`

Add React.memo with custom comparison function:

```typescript
const arePropsEqual = (prevProps: NetworkTopologyViewProps, nextProps: NetworkTopologyViewProps) => {
  // Compare only props that affect rendering
  return (
    prevProps.isDark === nextProps.isDark &&
    prevProps.language === nextProps.language &&
    prevProps.isMobile === nextProps.isMobile &&
    prevProps.devices === nextProps.devices &&
    prevProps.connections === nextProps.connections &&
    prevProps.notes === nextProps.notes &&
    prevProps.selectedDeviceIds === nextProps.selectedDeviceIds &&
    prevProps.selectedNoteIds === nextProps.selectedNoteIds &&
    prevProps.activeDeviceId === nextProps.activeDeviceId &&
    prevProps.pan === nextProps.pan &&
    prevProps.zoom === nextProps.zoom &&
    prevProps.isDrawingConnection === nextProps.isDrawingConnection &&
    prevProps.isActuallyDragging === nextProps.isActuallyDragging &&
    prevProps.isTouchDragging === nextProps.isTouchDragging &&
    prevProps.draggedDevice === nextProps.draggedDevice &&
    prevProps.touchDraggedDevice === nextProps.touchDraggedDevice &&
    prevProps.selectAllMode === nextProps.selectAllMode &&
    prevProps.canvasRef === nextProps.canvasRef &&
    prevProps.isFullscreen === nextProps.isFullscreen &&
    prevProps.canUndo === nextProps.canUndo &&
    prevProps.canRedo === nextProps.canRedo &&
    prevProps.connectionError === nextProps.connectionError &&
    prevProps.pingSource === nextProps.pingSource &&
    prevProps.pingAnimation === nextProps.pingAnimation &&
    prevProps.portSelectorStep === nextProps.portSelectorStep &&
    prevProps.showPortSelector === nextProps.showPortSelector &&
    prevProps.selectedSourcePort === nextProps.selectedSourcePort &&
    prevProps.contextMenu === nextProps.contextMenu &&
    prevProps.noteFonts === nextProps.noteFonts &&
    prevProps.noteClipboard === nextProps.noteClipboard &&
    prevProps.clipboard === nextProps.clipboard &&
    prevProps.cableInfo === nextProps.cableInfo &&
    prevProps.renderDevice === nextProps.renderDevice &&
    prevProps.getCanvasDimensions === nextProps.getCanvasDimensions &&
    prevProps.getPortPosition === nextProps.getPortPosition &&
    prevProps.getDeviceCenter === nextProps.getDeviceCenter &&
    prevProps.handleCanvasMouseDown === nextProps.handleCanvasMouseDown &&
    prevProps.handleTouchStart === nextProps.handleTouchStart &&
    prevProps.handleTouchMove === nextProps.handleTouchMove &&
    prevProps.handleTouchEnd === nextProps.handleTouchEnd &&
    prevProps.setIsDrawingConnection === nextProps.setIsDrawingConnection &&
    prevProps.setConnectionStart === nextProps.setConnectionStart &&
    prevProps.setSelectAllMode === nextProps.setSelectAllMode &&
    prevProps.handleDeviceMouseDown === nextProps.handleDeviceMouseDown &&
    prevProps.handleDeviceClick === nextProps.handleDeviceClick &&
    prevProps.handleDeviceDoubleClick === nextProps.handleDeviceDoubleClick &&
    prevProps.handleContextMenu === nextProps.handleContextMenu &&
    prevProps.handleDeviceTouchStart === nextProps.handleDeviceTouchStart &&
    prevProps.handleDeviceTouchMove === nextProps.handleDeviceTouchMove &&
    prevProps.handleDeviceTouchEnd === nextProps.handleDeviceTouchEnd &&
    prevProps.renderTempConnection === nextProps.renderTempConnection &&
    prevProps.renderConnectionHandle === nextProps.renderConnectionHandle &&
    prevProps.handleNoteTouchStart === nextProps.handleNoteTouchStart &&
    prevProps.handleNoteContextMenu === nextProps.handleNoteContextMenu &&
    prevProps.handleNoteMouseDown === nextProps.handleNoteMouseDown &&
    prevProps.handleNoteResizeStart === nextProps.handleNoteResizeStart &&
    prevProps.updateNoteText === nextProps.updateNoteText &&
    prevProps.onTopologyChange === nextProps.onTopologyChange &&
    prevProps.addNote === nextProps.addNote &&
    prevProps.setIsPaletteOpen === nextProps.setIsPaletteOpen &&
    prevProps.setShowPortSelector === nextProps.setShowPortSelector &&
    prevProps.setPortSelectorStep === nextProps.setPortSelectorStep &&
    prevProps.setSelectedSourcePort === nextProps.setSelectedSourcePort &&
    prevProps.resetView === nextProps.resetView &&
    prevProps.toggleFullscreen === nextProps.toggleFullscreen &&
    prevProps.handlePortHover === nextProps.handlePortHover &&
    prevProps.handlePortMouseLeave === nextProps.handlePortMouseLeave &&
    prevProps.closePortSelector === nextProps.closePortSelector &&
    prevProps.handlePortSelectorSelectPort === nextProps.handlePortSelectorSelectPort &&
    prevProps.deleteNote === nextProps.deleteNote &&
    prevProps.handleNoteTextCut === nextProps.handleNoteTextCut &&
    prevProps.handleNoteTextCopy === nextProps.handleNoteTextCopy &&
    prevProps.handleNoteTextPaste === nextProps.handleNoteTextPaste &&
    prevProps.handleNoteTextDelete === nextProps.handleNoteTextDelete &&
    prevProps.handleNoteTextSelectAll === nextProps.handleNoteTextSelectAll &&
    prevProps.onDuplicateNote === nextProps.onDuplicateNote &&
    prevProps.pasteNotes === nextProps.pasteNotes &&
    prevProps.updateNoteStyle === nextProps.updateNoteStyle &&
    prevProps.connectionError === nextProps.connectionError &&
    prevProps.renderMobilePalette === nextProps.renderMobilePalette &&
    prevProps.renderMobileBottomBar === nextProps.renderMobileBottomBar &&
    prevProps.startPingAnimation === nextProps.startPingAnimation &&
    prevProps.setZoom === nextProps.setZoom &&
    prevProps.setPan === nextProps.setPan &&
    prevProps.setSelectedDeviceIds === nextProps.setSelectedDeviceIds &&
    prevProps.setSelectedNoteIds === nextProps.setSelectedNoteIds &&
    prevProps.cutDevice === nextProps.cutDevice &&
    prevProps.copyDevice === nextProps.copyDevice &&
    prevProps.pasteDevice === nextProps.pasteDevice &&
    prevProps.deleteDevice === nextProps.deleteDevice &&
    prevProps.togglePowerDevices === nextProps.togglePowerDevices &&
    prevProps.startDeviceConfig === nextProps.startDeviceConfig &&
    prevProps.setPingSource === nextProps.setPingSource &&
    prevProps.handleUndo === nextProps.handleUndo &&
    prevProps.handleRedo === nextProps.handleRedo &&
    prevProps.selectAllDevices === nextProps.selectAllDevices &&
    prevProps.Trash2 === nextProps.Trash2 &&
    prevProps.NOTE_HEADER_HEIGHT === nextProps.NOTE_HEADER_HEIGHT &&
    prevProps.noteTextareaRefs === nextProps.noteTextareaRefs
  );
};

export const NetworkTopologyView = React.memo(
  (props: NetworkTopologyViewProps) => { /* ... */ },
  arePropsEqual
);
```

### CSS Animation Utility Classes

**File**: `src/app/globals.css`

Add CSS utility classes for common animations:

```css
/* Fade in/out */
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

.animate-fade-out {
  animation: fadeOut 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Scale */
.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.animate-scale-out {
  animation: scaleOut 0.3s ease-out forwards;
}

@keyframes scaleIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes scaleOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0); opacity: 0; }
}

/* Slide up/down */
.animate-slide-up {
  animation: slideUp 0.3s ease-out forwards;
}

.animate-slide-down {
  animation: slideDown 0.3s ease-out forwards;
}

@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Smooth transitions */
.transition-all-smooth {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-opacity-smooth {
  transition: opacity 0.3s ease-out;
}

.transition-transform-smooth {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Component Cleanup

**Files to Audit**:
- `src/components/ui/BottomSheet.tsx` - Uses framer-motion
- `src/components/network/AppFooter.tsx` - Uses framer-motion
- `src/components/network/TaskCard.tsx` - Uses framer-motion
- `src/components/network/Terminal.tsx` - Uses framer-motion

**Unused Radix UI Components** (to be removed):
- `@radix-ui/react-accordion`
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-progress`
- `@radix-ui/react-slider`
- `@radix-ui/react-switch`
- `@radix-ui/react-toggle-group`
- `@radix-ui/react-toggle`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-toast`
- `@radix-ui/react-dialog`
- `@radix-ui/react-sheet`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-popover`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-separator`
- `@radix-ui/react-avatar`
- `@radix-ui/react-breadcrumb`
- `@radix-ui/react-collapsible`

**Radix UI Components in Use**:
- `@radix-ui/react-slot` (button, badge, etc.)
- `@radix-ui/react-label`
- `@radix-ui/react-dialog`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-toast`
- `@radix-ui/react-select`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-tabs`
- `@radix-ui/react-slider`
- `@radix-ui/react-switch`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-popover`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-separator`
- `@radix-ui/react-avatar`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-accordion`
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-progress`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-toggle-group`
- `@radix-ui/react-toggle`
- `@radix-ui/react-sheet`
- `@radix-ui/react-sidebar`

## Data Models

No new data models are required for this phase. The existing models will be used with the new selectors.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Selector Granularity

*For any* state update in the Zustand store, only components that subscribe to the changed state slice shall re-render, and components that subscribe to unchanged state slices shall not re-render.

**Validates: Requirements 1.2**

### Property 2: NetworkTopologyView Memoization

*For any* parent component update that does not change the props affecting NetworkTopologyView rendering (topology data, selected nodes, viewport, etc.), the NetworkTopologyView component shall not re-render.

**Validates: Requirements 2.2, 2.3**

### Property 3: CSS Animation Visual Fidelity

*For any* animation that is replaced with CSS, the visual appearance and timing shall be identical to the original framer-motion implementation.

**Validates: Requirements 3.3**

### Property 4: Bundle Size Reduction

*For any* unused Radix UI component, removing its import and dependency shall reduce the final bundle size without affecting functionality.

**Validates: Requirements 4.4**

### Property 5: Performance Improvement

*For any* mobile device loading the application, the time to interactive shall be reduced by at least 20% after implementing all optimizations.

**Validates: Requirements 5.1**

### Property 6: Frame Rate Maintenance

*For any* scrolling or panning operation on the network topology, the frame rate shall maintain at least 30 FPS.

**Validates: Requirements 5.2**

### Property 7: Bundle Size Reduction Target

*For any* build of the application, the total JavaScript bundle size shall be reduced by at least 10% after implementing all optimizations.

**Validates: Requirements 5.3**

### Property 8: Visual Fidelity

*For any* component modified during this phase, the visual appearance shall remain identical to the original implementation.

**Validates: Requirements 5.4**

## Error Handling

### Selector Errors

- If a selector references a non-existent state property, TypeScript will catch this at compile time
- Runtime errors in selectors will be caught by the Zustand error boundary

### Memoization Errors

- If the comparison function incorrectly identifies props as equal, components may not re-render when expected
- This will be caught during testing with property-based tests

### CSS Animation Errors

- If CSS classes are not properly defined, animations will fail gracefully (no animation, but component still renders)
- Missing keyframes will result in instant state changes instead of smooth transitions

### Component Cleanup Errors

- If a component is incorrectly identified as unused, removing it will cause runtime errors
- These will be caught during testing and build processes

## Testing Strategy

### Dual Testing Approach

**Unit Tests**:
- Test specific selector functions with known state slices
- Test NetworkTopologyView memoization with prop changes
- Test CSS animation classes for correct application
- Test component cleanup by verifying unused imports are removed

**Property-Based Tests**:
- Test selector granularity across many state update scenarios
- Test NetworkTopologyView memoization with random prop combinations
- Test CSS animation timing and visual output
- Test bundle size reduction across multiple builds

### Property-Based Testing Configuration

**Library**: `vitest` with `@vitest/ui` for property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tests will run in CI/CD pipeline

### Test Implementation

**Selector Tests**:
```typescript
// Feature: ui-ux-performance-improvements-phase1, Property 1: Selector Granularity
it('selector granularity: only subscribed components re-render', () => {
  // Test that updating unrelated state doesn't trigger re-renders
});
```

**Memoization Tests**:
```typescript
// Feature: ui-ux-performance-improvements-phase1, Property 2: NetworkTopologyView Memoization
it('memoization: NetworkTopologyView does not re-render on unrelated prop changes', () => {
  // Test that memoization prevents re-renders
});
```

**CSS Animation Tests**:
```typescript
// Feature: ui-ux-performance-improvements-phase1, Property 3: CSS Animation Visual Fidelity
it('css animations: visual fidelity maintained', () => {
  // Test that CSS animations match framer-motion output
});
```

**Bundle Size Tests**:
```typescript
// Feature: ui-ux-performance-improvements-phase1, Property 4: Bundle Size Reduction
it('bundle size: unused dependencies removed', () => {
  // Test that bundle size is reduced after cleanup
});
```

### Manual Testing Checklist

- [ ] Verify no visual regressions in all components
- [ ] Check bundle size reduction with `npm run build`
- [ ] Test mobile performance with Chrome DevTools
- [ ] Verify all animations work correctly
- [ ] Test state management with React DevTools
