import React, { useMemo } from 'react';
import { CanvasDevice, CanvasConnection } from './networkTopology.types';

interface PingAnimationOverlayProps {
  pingAnimation: {
    path: string[];
    currentHopIndex: number;
    progress: number;
    frame: number;
    success: boolean | null;
    sourceId: string;
    targetId: string;
  } | null;
  devices: CanvasDevice[];
  connections: CanvasConnection[];
  getPortPosition: (device: CanvasDevice, portId: string) => { x: number; y: number };
  getDeviceCenter: (device: CanvasDevice) => { x: number; y: number };
  language: 'tr' | 'en';
}

export function PingAnimationOverlay({
  pingAnimation,
  devices,
  connections,
  getPortPosition,
  getDeviceCenter,
  language
}: PingAnimationOverlayProps) {
  const animationElement = useMemo(() => {
    if (!pingAnimation) return null;

    const { path, currentHopIndex, progress, success, frame } = pingAnimation;
    if (!path || path.length < 2 || success !== null) return null;

    // Get current hop devices
    const fromDevice = devices.find(d => d.id === path[currentHopIndex]);
    const toDevice = devices.find(d => d.id === path[currentHopIndex + 1]);
    if (!fromDevice || !toDevice) return null;

    // Find connection between these devices to get the bezier curve
    const conn = connections.find(
      c => (c.sourceDeviceId === fromDevice.id && c.targetDeviceId === toDevice.id) ||
        (c.sourceDeviceId === toDevice.id && c.targetDeviceId === fromDevice.id)
    );

    // Get port positions for this connection
    let source: { x: number; y: number };
    let target: { x: number; y: number };

    if (conn) {
      source = getPortPosition(fromDevice, conn.sourceDeviceId === fromDevice.id ? conn.sourcePort : conn.targetPort);
      target = getPortPosition(toDevice, conn.sourceDeviceId === toDevice.id ? conn.sourcePort : conn.targetPort);
    } else {
      source = getDeviceCenter(fromDevice);
      target = getDeviceCenter(toDevice);
    }

    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;

    const sameDeviceConnections = connections.filter(
      c => (c.sourceDeviceId === fromDevice.id && c.targetDeviceId === toDevice.id) ||
        (c.sourceDeviceId === toDevice.id && c.targetDeviceId === fromDevice.id)
    );
    const sameConnIndex = conn ? sameDeviceConnections.findIndex(c => c.id === conn.id) : 0;
    const totalSameConns = sameDeviceConnections.length;
    const maxOffset = 20;
    const offset = totalSameConns > 1
      ? (sameConnIndex - (totalSameConns - 1) / 2) * (maxOffset / Math.max(totalSameConns - 1, 1))
      : 0;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
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

    // Bezier curve calculation (Cubic Bezier)
    const t = progress;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const bezierX = mt3 * source.x + 3 * mt2 * t * controlPoint1.x + 3 * mt * t2 * controlPoint2.x + t3 * target.x;
    const bezierY = mt3 * source.y + 3 * mt2 * t * controlPoint1.y + 3 * mt * t2 * controlPoint2.y + t3 * target.y;

    // Calculate angle for the envelope
    const angle = Math.atan2(target.y - source.y, target.x - source.x);

    // Offset envelope slightly to the side of the line
    const envelopeOffsetX = Math.sin(angle) * 20;
    const envelopeOffsetY = -Math.cos(angle) * 20;

    return (
      <g key={`ping-${currentHopIndex}-${frame}`}>
        <g
          transform={`translate(${bezierX + envelopeOffsetX}, ${bezierY + envelopeOffsetY})`}
        >

          {/* Envelope body */}
          <rect
            x="-12" y="-8" width="24" height="16" rx="2"
            fill="#06b6d4"
            stroke="#0891b2"
            strokeWidth="1.5"
          />
          {/* Envelope flap */}
          <path
            d="M-9 -5 L0 3 L9 -5"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </g>
    );
  }, [pingAnimation, devices, connections, getPortPosition, getDeviceCenter]);

  return animationElement;
}
