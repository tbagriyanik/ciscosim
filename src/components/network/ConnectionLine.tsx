import React, { memo } from 'react';
import { CanvasConnection, CanvasDevice } from './networkTopology.types';
import { CableType, isCableCompatible, CableInfo } from '@/lib/network/types';

interface ConnectionLineProps {
  connection: CanvasConnection;
  sourceDevice: CanvasDevice;
  targetDevice: CanvasDevice;
  isDark: boolean;
  isDragging?: boolean;
  totalSameConns: number;
  sameConnIndex: number;
  getPortPosition: (device: CanvasDevice, portId: string) => { x: number; y: number };
  CABLE_COLORS: Record<string, { primary: string; bg: string; text: string; border: string }>;
}

export const ConnectionLine = memo(function ConnectionLine({
  connection,
  sourceDevice,
  targetDevice,
  isDark,
  isDragging = false,
  totalSameConns,
  sameConnIndex,
  getPortPosition,
  CABLE_COLORS
}: ConnectionLineProps) {
  // Get port positions for more accurate connection lines
  const source = getPortPosition(sourceDevice, connection.sourcePort);
  const target = getPortPosition(targetDevice, connection.targetPort);

  // Check cable compatibility - use pink color for incompatible cables
  const cableInfoForConnection = {
    connected: true,
    cableType: connection.cableType,
    sourceDevice: sourceDevice.type === 'router' ? 'switch' : sourceDevice.type,
    targetDevice: targetDevice.type === 'router' ? 'switch' : targetDevice.type,
    sourcePort: connection.sourcePort,
    targetPort: connection.targetPort,
  };
  
  // Cast to specific types to satisfy TS if needed, but the logic is sound
  const isCompatible = isCableCompatible(cableInfoForConnection as CableInfo);
  
  // Check if either port is shutdown
  const sourcePort = sourceDevice.ports.find(p => p.id === connection.sourcePort);
  const targetPort = targetDevice.ports.find(p => p.id === connection.targetPort);
  const isShutdown = sourcePort?.shutdown || targetPort?.shutdown;
  
  const isEffectivelyActive = connection.active && isCompatible && !isShutdown;
  const color = !isCompatible ? CABLE_COLORS.error.primary : 
                isShutdown ? (isDark ? '#475569' : '#94a3b8') : // Gray if shutdown
                CABLE_COLORS[connection.cableType].primary;

  // Calculate offset for parallel lines (spread out from center)
  const maxOffset = 20;
  const offset = totalSameConns > 1
    ? (sameConnIndex - (totalSameConns - 1) / 2) * (maxOffset / Math.max(totalSameConns - 1, 1))
    : 0;

  // Calculate control points for smooth curve with offset
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  // Apply perpendicular offset for parallel lines
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  // const len = Math.sqrt(dx * dx + dy * dy) || 1; // Unused
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len * offset;
  const perpY = dx / len * offset;

  const controlPoint1 = {
    x: midX + perpX,
    y: source.y + perpY + Math.abs(offset) * 0.5
  };
  const controlPoint2 = {
    x: midX + perpX,
    y: target.y + perpY - Math.abs(offset) * 0.5
  };

  const pathD = `M ${source.x} ${source.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${target.x} ${target.y}`;
  const reversePathD = `M ${target.x} ${target.y} C ${controlPoint2.x} ${controlPoint2.y}, ${controlPoint1.x} ${controlPoint1.y}, ${source.x} ${source.y}`;

  return (
    <g>
      {/* Visual Connection line */}
      <path
        d={pathD}
        stroke={isCompatible ? color : '#ef4444'}
        strokeWidth={3}
        fill="none"
        strokeDasharray={isCompatible ? 'none' : '6,3'}
        className="pointer-events-none"
      />

      {/* Animated data flow - only for compatible cables and NOT during dragging */}
      {isEffectivelyActive && !isDragging && (
        <>
          <circle r="4" fill={color}>
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={pathD}
            />
          </circle>
          <circle r="4" fill={color}>
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              begin="1s"
              path={reversePathD}
            />
          </circle>
        </>
      )}
      {/* Connection label */}
      {totalSameConns > 1 ? (
        <>
          <text
            x={midX + perpX}
            y={midY + perpY - 8}
            fill="none"
            stroke={isDark ? '#0f172a' : '#ffffff'}
            strokeWidth="4"
            strokeLinejoin="round"
            fontSize="10"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {connection.sourcePort} ↔ {connection.targetPort}
          </text>
          <text
            x={midX + perpX}
            y={midY + perpY - 8}
            fill={color}
            fontSize="10"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {connection.sourcePort} ↔ {connection.targetPort}
          </text>
        </>
      ) : (
        <>
          <text
            x={midX}
            y={midY - 10}
            fill="none"
            stroke={isDark ? '#0f172a' : '#ffffff'}
            strokeWidth="4"
            strokeLinejoin="round"
            fontSize="10"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {connection.sourcePort} ↔ {connection.targetPort}
          </text>
          <text
            x={midX}
            y={midY - 10}
            fill={color}
            fontSize="10"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {connection.sourcePort} ↔ {connection.targetPort}
          </text>
        </>
      )}
    </g>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.connection.id === nextProps.connection.id &&
    prevProps.connection.active === nextProps.connection.active &&
    prevProps.sourceDevice.x === nextProps.sourceDevice.x &&
    prevProps.sourceDevice.y === nextProps.sourceDevice.y &&
    prevProps.targetDevice.x === nextProps.targetDevice.x &&
    prevProps.targetDevice.y === nextProps.targetDevice.y &&
    prevProps.sourceDevice.ports.find(p => p.id === prevProps.connection.sourcePort)?.shutdown === 
    nextProps.sourceDevice.ports.find(p => p.id === nextProps.connection.sourcePort)?.shutdown &&
    prevProps.targetDevice.ports.find(p => p.id === prevProps.connection.targetPort)?.shutdown === 
    nextProps.targetDevice.ports.find(p => p.id === nextProps.connection.targetPort)?.shutdown &&
    prevProps.totalSameConns === nextProps.totalSameConns &&
    prevProps.sameConnIndex === nextProps.sameConnIndex &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.isDragging === nextProps.isDragging
  );
});
