'use client';

import React from 'react';

import { CanvasDevice, CanvasConnection } from '../networkTopology.types';
import { SwitchState, Port } from '@/lib/network/types';
import { getWirelessSignalStrength } from '@/lib/network/connectivity';
import { getChannelBand, getDeviceWifiConfig, getApActiveSsids, wifiChannelMatches, wifiMacFilterMatches } from '@/lib/network/wireless';
import { getDeviceWidth } from '../networkTopology.helpers';
import {
  STATUS_COLORS,
  PORT_COLORS,
  SELECTION_HIGHLIGHT_COLOR
} from '../networkTopology.constants';

export interface DeviceRendererProps {
  device: CanvasDevice;
  topologyDevices: CanvasDevice[];
  isDragging?: boolean;
  isSelected: boolean;
  isDark: boolean;
  language: string;
  t: Record<string, string>;
  deviceStates?: Map<string, SwitchState>;
  deviceToConnectionsMap: Map<string, CanvasConnection[]>;
  graphicsQuality: 'low' | 'medium' | 'high';
  isDraggingInteractionDisabled: boolean;
  getLiveDeviceVlan: (device: CanvasDevice) => number | string | null;
  getIotMeasuredValue: (device: CanvasDevice) => string;
  handlePortHover: (e: React.MouseEvent<SVGGElement>, deviceId: string, portId: string) => void;
  handlePortMouseLeave: () => void;
  handlePortClick: (e: React.MouseEvent, deviceId: string, portId: string) => void;
  handleDeviceMouseDown: (e: React.MouseEvent, deviceId: string) => void;
  handleDevicePointerDown: (e: React.PointerEvent<SVGGElement>, deviceId: string) => void;
  handleDeviceClick: (e: React.MouseEvent, device: CanvasDevice) => void;
  handleDeviceKeyDown: (e: React.KeyboardEvent<SVGGElement>, device: CanvasDevice) => void;
  handleDeviceDoubleClick: (device: CanvasDevice) => void;
  handleDeviceMouseLeave: () => void;
  handleDeviceTouchStart: (e: React.TouchEvent<SVGGElement>, deviceId: string) => void;
  handleDeviceTouchMove: (e: React.TouchEvent<SVGGElement>) => void;
  handleDeviceTouchEnd: (e: React.TouchEvent<SVGGElement>) => void;
  _mousePosRef: React.MutableRefObject<{ x: number; y: number }>;
  isDrawingConnection?: boolean;
  connectionStart?: { deviceId: string; portId: string } | null;
}

const isSwitchDeviceType = (type: string) => type === 'switchL2' || type === 'switchL3';

const PORT_FRAME_OK = 'var(--color-secondary-50)';
const PORT_STP_BLOCKED = 'var(--color-pink-500)';
const PORT_STP_BLOCKED_STROKE = 'var(--color-pink-300)';
const PORT_GIGABIT_UP = 'var(--color-warning-500)';
const PORT_GIGABIT_UP_STROKE = 'var(--color-warning-300)';

const isGigabitPort = (portId: string) => portId.toLowerCase().startsWith('gi');

const wifiBarRects = [
  { x: 1, y: 10.5, width: 2.5, height: 3 },
  { x: 5, y: 8.5, width: 2.5, height: 5 },
  { x: 9, y: 6.5, width: 2.5, height: 7 },
  { x: 13, y: 4.5, width: 2.5, height: 9 },
  { x: 17, y: 2.5, width: 2.5, height: 11 },
];


export const DeviceRenderer = React.memo(function DeviceRenderer({
  device,
  topologyDevices,
  isDragging = false,
  isSelected,
  isDark,
  language,
  t,
  deviceStates,
  deviceToConnectionsMap,
  graphicsQuality,
  isDraggingInteractionDisabled,
  getLiveDeviceVlan,
  getIotMeasuredValue,
  handlePortHover,
  handlePortMouseLeave,
  handlePortClick,
  handleDeviceMouseDown,
  handleDevicePointerDown,
  handleDeviceClick,
  handleDeviceKeyDown,
  handleDeviceDoubleClick,
  handleDeviceMouseLeave,
  handleDeviceTouchStart,
  handleDeviceTouchMove,
  handleDeviceTouchEnd,
  _mousePosRef,
  isDrawingConnection = false,
  connectionStart = null
}: DeviceRendererProps) {
  void _mousePosRef;
  const isTargetingThisDevice = isDrawingConnection && connectionStart && connectionStart.deviceId !== device.id;
  const isTR = language === 'tr';
  const isSwitchDevice = (type: string) => type === 'switchL2' || type === 'switchL3' || type === 'hub';

  // Check if device has any connections
  const deviceConnections = deviceToConnectionsMap.get(device.id) || [];

  const isPoweredOff = device.status === 'offline';
  const isPcLike = device.type === 'pc' || device.type === 'iot' || device.type === 'mobile' || device.type === 'printer';


  const getConnectionForPort = (portId: string) =>
    deviceConnections.find((connection) =>
      (connection.sourceDeviceId === device.id && connection.sourcePort === portId) ||
      (connection.targetDeviceId === device.id && connection.targetPort === portId)
    );

  const isPortConnectionHealthy = (portId: string) => {
    const connection = getConnectionForPort(portId);
    return Boolean(connection && connection.active !== false);
  };

  const getPortFrameColor = (portId: string, hasProblem: boolean, isConnected: boolean) => {
    if (hasProblem) return isDark ? 'var(--color-secondary-700)' : 'var(--color-secondary-300)';
    if (isConnected && isPortConnectionHealthy(portId)) return isDark ? PORT_FRAME_OK : 'var(--color-secondary-900)';
    return isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
  };

  const deviceFill = isDark
    ? (device.type === 'hub'
      ? 'url(#hubGradientDark)'
      : device.type === 'mobile'
        ? 'url(#mobileGradientDark)'
        : device.type === 'printer'
          ? 'url(#printerGradientDark)'
          : device.type === 'cloud'
            ? 'url(#cloudGradientDark)'
            : device.type === 'iot'
              ? 'url(#iotGradientDark)'
              : device.type === 'firewall'
                ? 'url(#firewallGradientDark)'
                : device.type === 'wlc'
                  ? 'url(#wlcGradientDark)'
                  : isPcLike
                    ? 'url(#pcGradientDark)'
                    : isSwitchDevice(device.type)
                      ? (device.type === 'switchL3' ? 'url(#routerGradientDark)' : 'url(#switchGradientDark)')
                      : 'url(#routerGradientDark)')
    : (device.type === 'hub'
      ? 'url(#hubGradientLight)'
      : device.type === 'mobile'
        ? 'url(#mobileGradientLight)'
        : device.type === 'printer'
          ? 'url(#printerGradientLight)'
          : device.type === 'cloud'
            ? 'url(#cloudGradientLight)'
            : device.type === 'iot'
              ? 'url(#iotGradientLight)'
              : device.type === 'firewall'
                ? 'url(#firewallGradientLight)'
                : device.type === 'wlc'
                  ? 'url(#wlcGradientLight)'
                  : isPcLike
                    ? 'url(#pcGradientLight)'
                    : isSwitchDevice(device.type)
                      ? (device.type === 'switchL3' ? 'url(#routerGradientLight)' : 'url(#switchGradientLight)')
                      : 'url(#routerGradientLight)');

  // Calculate device height based on number of ports (8 per row for switch/router)
  const portsPerRow = isPcLike ? 2 : 8;
  const numRows = Math.ceil(device.ports.length / portsPerRow);
  const deviceHeight = isPcLike ? 85 : 80 + numRows * 14 + 5;
  const deviceWidth = getDeviceWidth(device.type);

  const isIotEffectivelyOn = device.type === 'iot' &&
    device.status !== 'offline' &&
    device.iot?.collaborationEnabled !== false &&
    device.iot?.value === true;

  const iotGlowColor = isIotEffectivelyOn
    ? (device.iot?.kind === 'lamp'
      ? 'var(--color-warning-400)'
      : device.iot?.kind === 'cooler'
        ? 'var(--color-accent-400)'
        : device.iot?.kind === 'heater'
          ? 'var(--color-error-500)'
          : null)
    : null;

  return (
    <g
      key={device.id}
      transform={`translate(${device.x}, ${device.y})`}
      className={`topology-device-draggable ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isDragging ? 'opacity-40' : ''}`}
      data-device-id={device.id}
      role="button"
      tabIndex={0}
      style={{ transition: isDragging ? 'none' : 'transform 0.12s ease-out' }}
      onMouseDown={(e) => handleDeviceMouseDown(e, device.id)}
      onPointerDown={(e) => handleDevicePointerDown(e, device.id)}
      onClick={(e) => handleDeviceClick(e, device)}
      onKeyDown={(e) => handleDeviceKeyDown(e, device)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleDeviceDoubleClick(device);
      }}
      onMouseLeave={handleDeviceMouseLeave}
      // Modern mobile browsers dispatch both pointer and touch events. The
      // pointer path owns dragging there; running the legacy touch path too
      // races its refs/state and makes a drag intermittently stop.
      onTouchStart={(e) => {
        if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
        handleDeviceTouchStart(e, device.id);
      }}
      onTouchMove={(e) => {
        if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
        handleDeviceTouchMove(e);
      }}
      onTouchEnd={(e) => {
        if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
        handleDeviceTouchEnd(e);
      }}
    >
      {/* Selection glow effect */}
      {isSelected && (
        <>
          <defs>
            <filter id="selectionGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={SELECTION_HIGHLIGHT_COLOR} floodOpacity="0.25" />
            </filter>
          </defs>
          {device.type === 'firewall' ? (
            <>
              <path d={`M 6 -4 L ${deviceWidth - 6} -4 Q ${deviceWidth + 4} -4 ${deviceWidth + 4} 6 L ${deviceWidth + 4} ${deviceHeight - 11} L ${deviceWidth / 2} ${deviceHeight + 4} L -4 ${deviceHeight - 11} L -4 6 Q -4 -4 6 -4 Z`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="4" opacity="0.5" filter="url(#selectionGlowFilter)" className="selection-glow" />
              <path d={`M 6 -4 L ${deviceWidth - 6} -4 Q ${deviceWidth + 4} -4 ${deviceWidth + 4} 6 L ${deviceWidth + 4} ${deviceHeight - 11} L ${deviceWidth / 2} ${deviceHeight + 4} L -4 ${deviceHeight - 11} L -4 6 Q -4 -4 6 -4 Z`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="2" opacity="0.35" className="selection-glow-outer" />
            </>
          ) : device.type === 'router' ? (
            <>
              <path d={`M ${16} -4 L ${deviceWidth - 16} -4 Q ${deviceWidth + 4} -4 ${deviceWidth + 4} 16 L ${deviceWidth + 4} ${deviceHeight + 4} L -4 ${deviceHeight + 4} L -4 16 Q -4 -4 16 -4`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="4" opacity="0.5" filter="url(#selectionGlowFilter)" className="selection-glow" />
              <path d={`M ${16} -4 L ${deviceWidth - 16} -4 Q ${deviceWidth + 4} -4 ${deviceWidth + 4} 16 L ${deviceWidth + 4} ${deviceHeight + 4} L -4 ${deviceHeight + 4} L -4 16 Q -4 -4 16 -4`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="2" opacity="0.35" className="selection-glow-outer" />
            </>
          ) : device.type === 'iot' ? (
            <>
              {device.iot?.sensorType === 'motion' && (
                <circle
                  cx={deviceWidth / 2}
                  cy={deviceHeight / 2}
                  r={75}
                  fill={isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.1)'}
                  stroke={isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)'}
                  strokeWidth="1"
                  strokeDasharray="4 2"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <path d={`M -4 -4 L ${deviceWidth + 4 - 10} -4 Q ${deviceWidth + 4} -4 ${deviceWidth + 4} 6 L ${deviceWidth + 4} ${deviceHeight + 4} L 6 ${deviceHeight + 4} Q -4 ${deviceHeight + 4} -4 ${deviceHeight + 4 - 10} L -4 -4 Z`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="4" opacity="0.5" filter="url(#selectionGlowFilter)" className="selection-glow" />
              <path d={`M -4 -4 L ${deviceWidth + 4 - 10} -4 Q ${deviceWidth + 4} -4 ${deviceWidth + 4} 6 L ${deviceWidth + 4} ${deviceHeight + 4} L 6 ${deviceHeight + 4} Q -4 ${deviceHeight + 4} -4 ${deviceHeight + 4 - 10} L -4 -4 Z`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="2" opacity="0.35" className="selection-glow-outer" />
            </>
          ) : isSwitchDeviceType(device.type) ? (
            <>
              <path d={`M -4 -4 L ${deviceWidth + 4} -4 L ${deviceWidth + 4} ${deviceHeight + 4 - 10} Q ${deviceWidth + 4} ${deviceHeight + 4} ${deviceWidth + 4 - 10} ${deviceHeight + 4} L 6 ${deviceHeight + 4} Q -4 ${deviceHeight + 4} -4 ${deviceHeight + 4 - 10} L -4 -4 Z`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="4" opacity="0.5" filter="url(#selectionGlowFilter)" className="selection-glow" />
              <path d={`M -4 -4 L ${deviceWidth + 4} -4 L ${deviceWidth + 4} ${deviceHeight + 4 - 10} Q ${deviceWidth + 4} ${deviceHeight + 4} ${deviceWidth + 4 - 10} ${deviceHeight + 4} L 6 ${deviceHeight + 4} Q -4 ${deviceHeight + 4} -4 ${deviceHeight + 4 - 10} L -4 -4 Z`} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="2" opacity="0.35" className="selection-glow-outer" />
            </>
          ) : (
            <>
              <rect x="-4" y="-4" width={deviceWidth + 8} height={deviceHeight + 8} rx={10} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="4" opacity="0.5" filter="url(#selectionGlowFilter)" className="selection-glow" />
              <rect x="-4" y="-4" width={deviceWidth + 8} height={deviceHeight + 8} rx={10} fill="none" stroke={SELECTION_HIGHLIGHT_COLOR} strokeWidth="2" opacity="0.35" className="selection-glow-outer" />
            </>
          )}
        </>
      )}

      {/* Radius indicator for motion/sound sensors */}
      {device.type === 'iot' && device.status !== 'offline' && device.iot?.collaborationEnabled !== false && (
        <>
          {device.iot?.sensorType === 'motion' && (
            <>
              <circle
                cx={deviceWidth / 2}
                cy={deviceHeight / 2}
                r={75}
                fill={isDark ? 'rgba(6, 182, 212, 0.05)' : 'rgba(6, 182, 212, 0.05)'}
                stroke={isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.1)'}
                strokeWidth="1"
                strokeDasharray="4 2"
                style={{ pointerEvents: 'none' }}
              />
              {graphicsQuality === 'high' && device.iot?.value === true && (
                <>
                  <circle
                    cx={deviceWidth / 2}
                    cy={deviceHeight / 2}
                    r={20}
                    fill="none"
                    stroke={isDark ? 'rgba(6, 182, 212, 0.6)' : 'rgba(6, 182, 212, 0.5)'}
                    strokeWidth="2"
                    className="iot-motion-ping"
                    style={{ pointerEvents: 'none', transformOrigin: `${deviceWidth / 2}px ${deviceHeight / 2}px` }}
                  />
                  <circle
                    cx={deviceWidth / 2}
                    cy={deviceHeight / 2}
                    r={20}
                    fill="none"
                    stroke={isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(6, 182, 212, 0.3)'}
                    strokeWidth="2"
                    className="iot-motion-ping-delayed"
                    style={{ pointerEvents: 'none', transformOrigin: `${deviceWidth / 2}px ${deviceHeight / 2}px` }}
                  />
                </>
              )}
            </>
          )}
          {device.iot?.sensorType === 'sound' && (
            <>
              {(() => {
                const dBValue = typeof device.iot?.value === 'number' ? device.iot.value : 0;
                const radius = Math.min(150, 50 + (dBValue / 120) * 100);
                const opacity = 0.1 + (dBValue / 120) * 0.3;

                return (
                  <circle
                    cx={deviceWidth / 2}
                    cy={deviceHeight / 2}
                    r={radius}
                    fill={isDark ? `rgba(34, 197, 94, ${opacity * 0.5})` : `rgba(34, 197, 94, ${opacity * 0.3})`}
                    stroke={isDark ? `rgba(34, 197, 94, ${opacity})` : `rgba(34, 197, 94, ${opacity * 0.8})`}
                    strokeWidth="1"
                    strokeDasharray="4 2"
                    className={graphicsQuality === 'high' ? 'iot-sound-pulse' : ''}
                    style={{ pointerEvents: 'none', ...(graphicsQuality === 'high' ? { transformOrigin: `${deviceWidth / 2}px ${deviceHeight / 2}px` } : {}) }}
                  />
                );
              })()}
            </>
          )}
        </>
      )}

      {device.type === 'iot' && iotGlowColor && (
        <path
          d={`M -6 -6 L ${deviceWidth + 6 - 10} -6 Q ${deviceWidth + 6} -6 ${deviceWidth + 6} 8 L ${deviceWidth + 6} ${deviceHeight + 6} L 8 ${deviceHeight + 6} Q -6 ${deviceHeight + 6} -6 ${deviceHeight + 6 - 10} L -6 -6 Z`}
          fill="none"
          stroke={iotGlowColor}
          strokeWidth="7"
          opacity={isSelected ? 0.4 : 0.7}
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 2px ${iotGlowColor})` }}
        />
      )}

      {/* Wireless Coverage Area */}
      {(() => {
        const isWirelessHost = device.type === 'router' || device.type === 'wlc';
        if (!isWirelessHost) return null;

        const wlanPort = device.ports.find(p => p.id === 'wlan0');
        const activeWifiConfig = deviceStates?.get(device.id)?.ports['wlan0']?.wifi || device.wifi;

        let isEnabled = false;
        if (device.type === 'wlc') isEnabled = true;
        else if (wlanPort) isEnabled = !wlanPort.shutdown;
        else if (activeWifiConfig) isEnabled = (activeWifiConfig as { enabled?: boolean }).enabled ?? true;

        if (!isEnabled || isPoweredOff) return null;

        const is5Ghz = getChannelBand(activeWifiConfig?.channel) === '5GHz';
        const coverageRadius = is5Ghz ? 250 : 150;

        return (
          <circle
            cx={deviceWidth / 2}
            cy={deviceHeight / 2}
            r={coverageRadius}
            fill={isDark ? 'rgba(99, 102, 241, 0.03)' : 'rgba(99, 102, 241, 0.04)'}
            stroke={isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.2)'}
            strokeWidth="1"
            strokeDasharray="8 4"
            style={{ pointerEvents: 'none' }}
          />
        );
      })()}

      {/* Device body */}
      {device.type === 'firewall' ? (
        <>
          <defs>
            <filter id="deviceShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity={isDark ? "0.15" : "0.1"} />
            </filter>
          </defs>
          <path
            d={`M 10 0 L ${deviceWidth - 10} 0 Q ${deviceWidth} 0 ${deviceWidth} 10 L ${deviceWidth} ${deviceHeight - 15} L ${deviceWidth / 2} ${deviceHeight} L 0 ${deviceHeight - 15} L 0 10 Q 0 0 10 0 Z`}
            fill={deviceFill}
            style={{ stroke: isDark ? 'var(--color-error-500)' : 'var(--color-secondary-300)' }}
            strokeWidth={1.5}
            className={isDragging ? '' : 'transition-all duration-150'}
            filter="url(#deviceShadow)"
          />
          {/* Shield Icon inside Firewall device */}
          <g transform={`translate(${deviceWidth / 2 - 17}, ${deviceHeight / 2 - 40})`} filter="url(#deviceShadow)">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ stroke: isDark ? 'var(--color-error-200)' : 'var(--color-error-600)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </g>
        </>
      ) : device.type === 'cloud' ? (
        <g>
          <path
            d={`M ${deviceWidth * 0.15} ${deviceHeight - 22}
                A 16 16 0 0 1 ${deviceWidth * 0.30} ${deviceHeight * 0.36}
                A 26 24 0 0 1 ${deviceWidth * 0.82} ${deviceHeight * 0.44}
                A 13 13 0 0 1 ${deviceWidth * 0.85} ${deviceHeight - 22}
                Z`}
            fill={deviceFill}
            style={{ stroke: isDark ? 'var(--color-sky-500)' : 'var(--color-secondary-300)' }}
            strokeWidth={1.5}
            className={isDragging ? '' : 'transition-all duration-150'}
            filter="url(#deviceShadow)"
          />
        </g>
      ) : device.type === 'router' ? (

        <path
          d={`M ${20} 0 L ${deviceWidth - 20} 0 Q ${deviceWidth} 0 ${deviceWidth} 20 L ${deviceWidth} ${deviceHeight} L 0 ${deviceHeight} L 0 20 Q 0 0 20 0`}
          fill={deviceFill}
          style={{ stroke: isDark ? 'var(--color-warning-500)' : 'var(--color-secondary-300)' }}
          strokeWidth={1.5}
          className={isDragging ? '' : 'transition-all duration-150'}
          filter="url(#deviceShadow)"
        />
      ) : device.type === 'mobile' ? (
        <rect
          width={deviceWidth}
          height={deviceHeight}
          rx={14}
          fill={deviceFill}
          style={{ stroke: isDark ? 'var(--color-sky-400)' : 'var(--color-sky-500)' }}
          strokeWidth={1.5}
          className={isDragging ? '' : 'transition-all duration-150'}
          filter="url(#deviceShadow)"
        />
      ) : device.type === 'printer' ? (
        <path
          d={`M 12 0 L ${deviceWidth - 12} 0 Q ${deviceWidth} 0 ${deviceWidth} 10 L ${deviceWidth} ${deviceHeight - 6} Q ${deviceWidth} ${deviceHeight} ${deviceWidth - 6} ${deviceHeight} L 6 ${deviceHeight} Q 0 ${deviceHeight} 0 ${deviceHeight - 6} L 0 10 Q 0 0 12 0 Z`}
          fill={deviceFill}
          style={{ stroke: isDark ? 'var(--color-amber-500)' : 'var(--color-secondary-300)' }}
          strokeWidth={1.5}
          className={isDragging ? '' : 'transition-all duration-150'}
          filter="url(#deviceShadow)"
        />
      ) : device.type === 'iot' ? (
        <path
          d={`M 0 0 L ${deviceWidth - 8} 0 Q ${deviceWidth} 0 ${deviceWidth} 8 L ${deviceWidth} ${deviceHeight} L 8 ${deviceHeight} Q 0 ${deviceHeight} 0 ${deviceHeight - 8} L 0 0 Z`}
          fill={deviceFill}
          style={{ stroke: isDark ? 'var(--color-secondary-500)' : 'var(--color-secondary-300)' }}
          strokeWidth={1.5}
          className={isDragging ? '' : 'transition-all duration-150'}
          filter="url(#deviceShadow)"
        />
      ) : isSwitchDeviceType(device.type) ? (
        <path
          d={`M 0 0 L ${deviceWidth} 0 L ${deviceWidth} ${deviceHeight - 8} Q ${deviceWidth} ${deviceHeight} ${deviceWidth - 8} ${deviceHeight} L 8 ${deviceHeight} Q 0 ${deviceHeight} 0 ${deviceHeight - 8} L 0 0 Z`}
          fill={deviceFill}
          style={{ stroke: isDark ? 'var(--color-accent-500)' : 'var(--color-secondary-300)' }}
          strokeWidth={1.5}
          className={isDragging ? '' : 'transition-all duration-150'}
          filter="url(#deviceShadow)"
        />
      ) : (
        <rect
          width={deviceWidth}
          height={deviceHeight}
          rx={8}
          fill={deviceFill}
          style={{
            stroke: isDark
              ? ((device.type as string) === 'pc' ? 'var(--color-primary-500)' : (device.type as string) === 'iot' ? 'var(--color-secondary-500)' : (device.type as string) === 'mobile' ? 'var(--color-emerald-500)' : (device.type as string) === 'printer' ? 'var(--color-amber-500)' : (device.type as string) === 'firewall' ? 'var(--color-error-500)' : isSwitchDeviceType(device.type) ? 'var(--color-accent-500)' : (device.type as string) === 'wlc' ? 'var(--color-warning-400)' : 'var(--color-warning-500)')
              : 'var(--color-secondary-300)'
          }}
          strokeWidth={1.5}
          className={isDragging ? '' : 'transition-all duration-150'}
          filter="url(#deviceShadow)"
        />
      )}


      {/* Device body highlight for 3D effect in dark mode */}
      {isDark && device.type !== 'mobile' && device.type !== 'printer' && device.type !== 'cloud' && (
        device.type === 'firewall' ? (
          <path
            d={`M 2 5 Q 2 2 5 2 L ${deviceWidth - 5} 2 Q ${deviceWidth - 2} 2 ${deviceWidth - 2} 5 L ${deviceWidth - 2} ${deviceHeight / 3} L 2 ${deviceHeight / 3} Z`}
            fill="white"
            opacity="0.08"
          />
        ) : device.type === 'router' ? (
          <path
            d={`M ${22} 2 L ${deviceWidth - 22} 2 Q ${deviceWidth - 2} 2 ${deviceWidth - 2} 20 L ${deviceWidth - 2} ${deviceHeight / 3} L 2 ${deviceHeight / 3} L 2 20 Q 2 2 22 2`}
            fill="white"
            opacity="0.08"
          />
        ) : device.type === 'iot' ? (
          <path
            d={`M 2 2 L ${deviceWidth - 2 - 6} 2 Q ${deviceWidth - 2} 2 ${deviceWidth - 2} 8 L ${deviceWidth - 2} ${deviceHeight / 3} L 8 ${deviceHeight / 3} Q 2 ${deviceHeight / 3} 2 ${deviceHeight / 3 - 6} L 2 2 Z`}
            fill="white"
            opacity="0.08"
          />
        ) : isSwitchDeviceType(device.type) ? (
          <path
            d={`M 2 2 L ${deviceWidth - 2} 2 L ${deviceWidth - 2} ${deviceHeight / 3} L 2 ${deviceHeight / 3} L 2 2 Z`}
            fill="white"
            opacity="0.08"
          />
        ) : (
          <rect
            x={2}
            y={2}
            width={deviceWidth - 4}
            height={deviceHeight / 3}
            rx={6}
            fill="white"
            opacity="0.08"
          />
        )
      )}

      {/* WiFi Status Icon */}
      {(() => {
        const wlanPort = device.ports.find(p => p.id === 'wlan0');
        const pcWifi = device.wifi;
        const usesWifiBars = device.type === 'pc' || device.type === 'iot' || device.type === 'mobile' || device.type === 'printer';
        const isSwitchL3 = device.type === 'switchL3';
        const isRouter = device.type === 'router';
        const isWlc = device.type === 'wlc';
        const devState = deviceStates?.get(device.id);
        const wlanState = devState?.ports['wlan0'];

        let wifiColor = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
        const showWifi = usesWifiBars || isSwitchL3 || isRouter || isWlc;

        let isEnabled = false;
        if (showWifi) {
          if (isWlc) isEnabled = true; // WLC her zaman kablosuz yeteneğe sahiptir
          else if (wlanPort) isEnabled = !wlanPort.shutdown;
          else isEnabled = pcWifi?.enabled !== false;
        }

        // Wireless connection state
        const hasActiveWirelessConn = deviceConnections.some(c => c.cableType === 'wireless' && c.active !== false);
        const hasWirelessConnLine = deviceConnections.some(c => c.cableType === 'wireless');
        if (usesWifiBars && isEnabled && !hasActiveWirelessConn && hasWirelessConnLine) {
          isEnabled = false;
        }

        const isConnected = wlanState?.status === 'connected' ||
          (isEnabled && (hasActiveWirelessConn || !hasWirelessConnLine));

        const activeWifiConfig = wlanState?.wifi || pcWifi;
        const isMacBlocked = usesWifiBars && !isConnected && !!pcWifi?.ssid && topologyDevices.some(ap => {
          if (ap.id === device.id || ap.status === 'offline') return false;
          const apState = deviceStates?.get(ap.id);
          const apWifi = getDeviceWifiConfig(ap, deviceStates);
          if (!apWifi || !pcWifi) return false;
          const matchingSsid = getApActiveSsids(apWifi, apState, deviceStates)
            .find(item => item.ssid.toLowerCase() === pcWifi.ssid.toLowerCase());
          if (!matchingSsid) return false;

          // Normalize configs for comparison
          const normalizedApWifi = {
            ...apWifi,
            security: apWifi.security || 'open',
            channel: apWifi.channel || '2.4GHz',
          };
          const normalizedPcWifi = {
            ...pcWifi,
            security: pcWifi.security || 'open',
            channel: pcWifi.channel || '2.4GHz',
          };

          if (!wifiChannelMatches(normalizedApWifi, normalizedPcWifi)) return false;
          const clientSecurity = (pcWifi.security || 'open').toLowerCase();
          const apSecurity = (matchingSsid.security || 'open').toLowerCase();
          if (clientSecurity !== apSecurity) return false;
          if (apSecurity !== 'open' && matchingSsid.password !== pcWifi.password) return false;
          return !wifiMacFilterMatches(apWifi, device, deviceStates);
        });

        if (showWifi && isEnabled && !isPoweredOff) {
          const isNetworkHost = isRouter || isWlc || isSwitchL3;
          if (isNetworkHost) {
            const needsConfig = !activeWifiConfig || activeWifiConfig.security === 'open' || activeWifiConfig.password === 'password123' || !activeWifiConfig.ssid;
            const hasError = isWlc && Object.values(devState?.ports || {}).some((p: Port) => p.status === 'err-disabled');
            if (hasError || needsConfig) {
              wifiColor = 'var(--color-warning-500)';
            } else {
              wifiColor = 'var(--color-success-500)';
            }
          } else {
            wifiColor = isConnected ? 'var(--color-success-500)' : 'var(--color-warning-500)';
          }
        }

        if (!showWifi) return null;

        const is5Ghz = getChannelBand(activeWifiConfig?.channel) === '5GHz';
        const hasPassword = activeWifiConfig?.security && activeWifiConfig.security !== 'open';

        if (usesWifiBars) {
          const activeColor = 'var(--color-success-500)';
          const dimColor = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
          const strength = (isPoweredOff || !isConnected) ? 0 : getWirelessSignalStrength(device, topologyDevices, deviceStates);

          return (
            <g transform={`translate(${deviceWidth - 23}, 7)`}>
              <title>{[`SSID: ${pcWifi?.ssid ?? 'N/A'}`, isConnected ? 'Bağlı' : 'Bağlı değil', `Sinyal: ${strength}/5`, `Güvenlik: ${pcWifi?.security ?? 'open'}`, `Kanal: ${pcWifi?.channel ?? 'N/A'}`, `Parola: ${pcWifi?.password ? 'Evet' : 'Hayır'}`].join(' • ')}</title>
              <svg x="-2" y="1" width="22" height="14" viewBox="0 0 22 14" className="pointer-events-none">
                {wifiBarRects.map((bar, index) => (
                  <rect
                    key={index}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    fill={strength >= index + 1 ? activeColor : dimColor}
                    rx="0.3"
                  />
                ))}
              </svg>
              {/* printer signal percentage removed */}
              {is5Ghz && (
                <text x="0" y="14" fontSize="4.5" fontWeight="900" fill={strength > 0 ? activeColor : dimColor} textAnchor="middle" style={{ pointerEvents: 'none' }}>
                  5
                </text>
              )}
              {hasPassword && (
                <g transform="translate(14, 10)">
                  <rect x="0" y="2" width="3.5" height="2.5" rx="0.5" fill={isDark ? 'var(--color-warning-400)' : 'var(--color-warning-500)'} />
                  <path d="M0.5 2V1.2C0.5 0.5 1 0 1.75 0C2.5 0 3 0.5 3 1.2V2" fill="none" stroke={isDark ? 'var(--color-warning-400)' : 'var(--color-warning-500)'} strokeWidth="0.8" />
                </g>
              )}
              {isMacBlocked && (
                <g transform="translate(13, 0)" aria-label="MAC blocked">
                  <circle cx="2.5" cy="2.5" r="2.5" fill="var(--color-error-500)" />
                  <path d="M1.2 1.2l2.6 2.6M3.8 1.2L1.2 3.8" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        }

        return (
          <g transform={`translate(${deviceWidth - 22}, 6)`}>
            <circle cx="8" cy="8" r="9" fill={isDark ? 'var(--color-secondary-900)' : 'var(--color-secondary-50)'} stroke={isDark ? 'var(--color-secondary-800)' : 'var(--color-secondary-200)'} strokeWidth="1" opacity="0.8" />
            <path
              d="M3 5.5a7.5 7.5 0 0 1 10 0M4.8 7.3a4.8 4.8 0 0 1 6.4 0M6.5 9.1a2.3 2.3 0 0 1 3 0M8 10.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1"
              fill="none"
              stroke={wifiColor}
              strokeWidth="1.25"
              strokeLinecap="round"
            />
            {is5Ghz && (
              <text x="4" y="14" fontSize="4.5" fontWeight="900" fill={wifiColor} textAnchor="middle" style={{ pointerEvents: 'none' }}>
                5
              </text>
            )}
            {hasPassword && (
              <g transform="translate(10, 10)">
                <rect x="0" y="2" width="3.5" height="2.5" rx="0.5" fill={isDark ? 'var(--color-warning-400)' : 'var(--color-warning-500)'} />
                <path d="M0.5 2V1.2C0.5 0.5 1 0 1.75 0C2.5 0 3 0.5 3 1.2V2" fill="none" stroke={isDark ? 'var(--color-warning-400)' : 'var(--color-warning-500)'} strokeWidth="0.8" />
              </g>
            )}
          </g>
        );
      })()}

      {/* Device Icon Visual */}
      <g transform={`translate(${deviceWidth / 2 - 16}, 12)`}>
        {device.type === 'pc' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : isDark ? 'var(--color-primary-200)' : 'var(--color-primary-700)' }} strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0 -2-2H5a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2z" />
          </svg>
        ) : device.type === 'mobile' ? (
          <g>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : (device.activeVoipCall ? (device.activeVoipCall.status === 'ringing' ? 'var(--color-warning-500)' : 'var(--color-success-500)') : (isDark ? 'var(--color-sky-300)' : 'var(--color-sky-600)')) }} strokeWidth="1.5">
              <rect x="7" y="2" width="10" height="20" rx="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="11" y1="18" x2="13" y2="18" strokeLinecap="round" />
              <line x1="10" y1="5" x2="14" y2="5" strokeLinecap="round" />
            </svg>
            {device.activeVoipCall && (
              (() => {
                const isCaller = device.activeVoipCall.callerId === device.id;
                const isRinging = device.activeVoipCall.status === 'ringing';
                const badgeBg = isRinging ? 'var(--color-amber-500)' : 'var(--color-emerald-500)';
                return (
                  <g transform="translate(-10, -6)">
                    <circle cx="8" cy="8" r="9" fill={badgeBg} />
                    {/* Handset shifted 1.5px to the left */}
                    <path d="M3.5 3.5C3.5 3.22 3.72 3 4 3H5.3C5.54 3 5.74 3.17 5.79 3.41L6.18 5.37C6.22 5.59 6.14 5.81 5.97 5.95L5.11 6.67C5.77 8.01 6.87 9.1 8.21 9.77L8.93 8.91C9.07 8.74 9.29 8.66 9.51 8.7L11.47 9.09C11.71 9.14 11.88 9.34 11.88 9.58V10.88C11.88 11.16 11.66 11.38 11.38 11.38C7.03 11.38 3.5 7.85 3.5 3.5Z" fill="white" />
                    {/* Direction arrow: outgoing = green (#22c55e), incoming = red (#ef4444) */}
                    {isCaller ? (
                      <path d="M11 1L16 1L16 6M16 1L11 6" stroke="var(--color-success-500)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M16 6L11 6L11 1M11 6L16 1" stroke="var(--color-error-500)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </g>
                );
              })()
            )}
          </g>
        ) : device.type === 'printer' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : isDark ? 'var(--color-pink-200)' : 'var(--color-pink-700)' }} strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
          </svg>
        ) : device.type === 'hub' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : isDark ? 'var(--color-teal-200)' : 'var(--color-teal-700)' }} strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="10" rx="2" />
            <circle cx="6" cy="12" r="1" fill="currentColor" />
            <circle cx="10" cy="12" r="1" fill="currentColor" />
            <circle cx="14" cy="12" r="1" fill="currentColor" />
            <circle cx="18" cy="12" r="1" fill="currentColor" />
          </svg>
        ) : device.type === 'cloud' ? null : device.type === 'iot' ? (
          <svg width="32" height="32" viewBox="0 -2 27 27" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : isDark ? 'var(--color-warning-100)' : 'var(--color-warning-800)' }} strokeWidth="1.5">
            <title>{`${device.name || 'IoT'} • ${device.iot?.sensorType || 'sensor'} • ${getIotMeasuredValue(device)}`}</title>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.247 7.761a6 6 0 0 1 0 8.478" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.075 4.933a10 10 0 0 1 0 14.134" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.925 19.067a10 10 0 0 1 0-14.134" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.753 16.239a6 6 0 0 1 0-8.478" />
            <circle strokeLinecap="round" strokeLinejoin="round" cx="12" cy="12" r="2" />
          </svg>
        ) : isSwitchDeviceType(device.type) ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : (device.type === 'switchL3' || device.switchModel === 'WS-C3650-24PS' ? (isDark ? 'var(--color-purple-200)' : 'var(--color-purple-700)') : (isDark ? 'var(--color-accent-200)' : 'var(--color-accent-700)')) }} strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 0 1 -2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2M5 12a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 -2-2m-2-4h.01M17 16h.01" />
          </svg>
        ) : device.type === 'router' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : isDark ? 'var(--color-purple-200)' : 'var(--color-purple-700)' }} strokeWidth="1.5">
            <circle strokeLinecap="round" strokeLinejoin="round" cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
          </svg>
        ) : device.type === 'wlc' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: isPoweredOff ? STATUS_COLORS.offline : isDark ? 'var(--color-indigo-200)' : 'var(--color-indigo-600)' }} strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14M12 5l-2 2m2-2l2 2m-2 12l-2-2m2 2l2-2M5 12l2-2m-2 2l2 2M19 12l-2-2m2 2l-2 2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
          </svg>
        ) : null}

      </g>



      {/* STP Overlay Bridge Badges */}
      {isSwitchDeviceType(device.type) && (() => {
        const deviceState = deviceStates?.get(device.id);
        const defaultStp = deviceState?.stpState?.[1]; // VLAN 1 is default
        if (!defaultStp) return null;
        const isRootBridge = defaultStp.isRoot === true;
        if (isRootBridge) {
          return (
            <g transform={`translate(${deviceWidth / 2}, 0)`}>
              <rect
                x="-22"
                y="-10"
                width="44"
                height="13"
                rx="3.5"
                fill="var(--color-warning-500)"
                stroke="var(--color-warning-400)"
                strokeWidth="1"
                className="animate-pulse"
              />
              <text
                y="-2.5"
                fill="var(--color-secondary-950)"
                fontSize="7.5"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                👑 ROOT
              </text>
            </g>
          );
        } else {
          return (
            <g transform={`translate(${deviceWidth / 2}, 0)`}>
              <rect
                x="-24"
                y="-10"
                width="48"
                height="13"
                rx="3.5"
                fill={isDark ? 'var(--color-secondary-800)' : 'var(--color-secondary-200)'}
                stroke={isDark ? 'var(--color-secondary-700)' : 'var(--color-secondary-300)'}
                strokeWidth="1"
              />
              <text
                y="-2.5"
                fill={isDark ? 'var(--color-secondary-200)' : 'var(--color-secondary-800)'}
                fontSize="6.5"
                fontWeight="semibold"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                Pri: {defaultStp.bridgeId.split('.')[0]}
              </text>
            </g>
          );
        }
      })()}

      {/* Device name */}
      <text
        x={deviceWidth / 2}
        y={58}
        style={{ fill: isSelected ? SELECTION_HIGHLIGHT_COLOR : isDark ? 'var(--color-secondary-100)' : 'var(--color-secondary-800)' }}
        fontSize="10"
        textAnchor="middle"
        fontWeight={isSelected ? '800' : 'bold'}
        className="select-none pointer-events-none"
      >
        {device.name}
      </text>

      {/* Device IP */}
      {(device.type === 'pc' || device.type === 'mobile' || device.type === 'printer') && (
        <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-secondary-400)' : 'var(--color-secondary-500)' }} fontSize={device.type === 'mobile' ? "9" : "10"} textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none">
          {device.ip || (device.ipConfigMode === 'dhcp' ? 'DHCP' : '0.0.0.0')}
        </text>
      )}

      {/* Device VLAN / IoT Measured Value / Printer Job Count */}
      {device.type === 'pc' && (
        <text x={deviceWidth / 2} y={81} style={{ fill: isDark ? 'var(--color-accent-400)' : 'var(--color-accent-700)' }} fontSize="9" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none">
          VLAN {String(getLiveDeviceVlan(device))}
        </text>
      )}
      {device.type === 'printer' && (
        <text x={deviceWidth / 2} y={81} style={{ fill: isDark ? 'var(--color-pink-400)' : 'var(--color-pink-700)' }} fontSize="9" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none">
          {(() => {
            const completedCount = (device.printJobs || []).filter(j => j.status === 'completed').length;
            const activeCount = (device.printJobs || []).filter(j => j.status === 'printing' || j.status === 'queued').length;
            return isTR
              ? `${completedCount} Görev Tamamlandı${activeCount > 0 ? ` (${activeCount} Yazdırılıyor)` : ''}`
              : `${completedCount} Jobs Completed${activeCount > 0 ? ` (${activeCount} Printing)` : ''}`;
          })()}
        </text>
      )}
      {device.type === 'iot' && (
        (() => {
          const kind = device.iot?.kind || 'sensor';
          const kindLabel = isTR
            ? (kind === 'lamp' ? 'Lamba' : kind === 'heater' ? 'Isıtıcı' : kind === 'cooler' ? 'Soğutucu' : 'Sensör')
            : (kind === 'lamp' ? 'Lamp' : kind === 'heater' ? 'Heater' : kind === 'cooler' ? 'Cooler' : 'Sensor');

          return (
            <text
              x={deviceWidth / 2}
              y={46}
              style={{ fill: isDark ? 'var(--color-secondary-300)' : 'var(--color-secondary-500)' }}
              fontSize="8"
              textAnchor="middle"
              className="select-none pointer-events-none italic opacity-80"
            >
              ({kindLabel})
            </text>
          );
        })()
      )}
      {device.type === 'iot' && (
        (() => {
          const isPoweredOff = device.status === 'offline';
          const isPassive = device.iot?.collaborationEnabled === false;
          if (isPoweredOff) {
            return (
              <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-secondary-400)' : 'var(--color-secondary-500)' }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                <tspan x={deviceWidth / 2} dy="6">{isTR ? 'Kapalı' : 'Off'}</tspan>
              </text>
            );
          }
          if (isPassive) {
            return (
              <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-secondary-400)' : 'var(--color-secondary-500)' }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                <tspan x={deviceWidth / 2} dy="6">{t.passive}</tspan>
              </text>
            );
          }

          const kind = device.iot?.kind;
          const sensorType = device.iot?.sensorType || 'temperature';
          const value = getIotMeasuredValue(device);
          const isControllable = kind === 'lamp' || kind === 'heater' || kind === 'cooler';

          if (isControllable) {
            const isActive = device.iot?.value ?? false;
            const statusColor = isActive ? (isDark ? 'var(--color-warning-400)' : 'var(--color-warning-500)') : (isDark ? 'var(--color-secondary-400)' : 'var(--color-secondary-500)');
            return (
              <text x={deviceWidth / 2} y={70} style={{ fill: statusColor }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                <tspan x={deviceWidth / 2} dy="6">{value}</tspan>
              </text>
            );
          }

          switch (sensorType) {
            case 'temperature':
              return (
                <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-success-400)' : 'var(--color-success-600)' }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                  <tspan x={deviceWidth / 2} dy="0">{t.temperature}:</tspan>
                  <tspan x={deviceWidth / 2} dy="12">{value}</tspan>
                </text>
              );
            case 'humidity':
              return (
                <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-primary-500)' : 'var(--color-primary-600)' }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                  <tspan x={deviceWidth / 2} dy="0">{t.humidity}:</tspan>
                  <tspan x={deviceWidth / 2} dy="12">{value}</tspan>
                </text>
              );
            case 'light':
              return (
                <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-warning-400)' : 'var(--color-warning-500)' }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                  <tspan x={deviceWidth / 2} dy="0">{t.lightLevel}:</tspan>
                  <tspan x={deviceWidth / 2} dy="12">{value}</tspan>
                </text>
              );
            case 'sound':
              return (
                <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-warning-600)' : 'var(--color-warning-600)' }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                  <tspan x={deviceWidth / 2} dy="0">{t.sensorSound}:</tspan>
                  <tspan x={deviceWidth / 2} dy="12">{value}</tspan>
                </text>
              );
            case 'motion':
              return (
                <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-600)' }} fontSize="10" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                  <tspan x={deviceWidth / 2} dy="0">{t.sensorMotion}:</tspan>
                  <tspan x={deviceWidth / 2} dy="12">{value}</tspan>
                </text>
              );
            default:
              return (
                <text x={deviceWidth / 2} y={70} style={{ fill: isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-600)' }} fontSize="9" textAnchor="middle" fontFamily="var(--font-geist-mono)" className="select-none pointer-events-none" filter="drop-shadow(0px 0px 1px rgba(0,0,0,1))">
                  {value}
                </text>
              );
          }
        })()
      )}

      {/* Ports rendering */}
      {isPcLike ? (
        device.ports.filter((port) => port.id !== 'wlan0').map((port, idx) => {
          const portSpacing = 18;
          const portX = deviceWidth - 8;
          const visiblePorts = device.ports.filter((item) => item.id !== 'wlan0');
          const visiblePortCount = visiblePorts.length;
          const startY = deviceHeight / 2 - ((visiblePortCount - 1) * portSpacing) / 2;
          const portY = startY + idx * portSpacing;
          const isConnected = port.status === 'connected';
          const isShutdown = port.shutdown;
          const isDeviceOffline = device.status === 'offline';
          const isStartPort = isDrawingConnection && connectionStart?.deviceId === device.id && connectionStart?.portId === port.id;
          const isTargetPort = isTargetingThisDevice && !isConnected;
          const hasProblem = isShutdown || isDeviceOffline || (isConnected && !isPortConnectionHealthy(port.id));

          const isConsolePort = port.id.toLowerCase().startsWith('com') || port.id.toLowerCase() === 'console';
          const portLabel = isConsolePort ? 'C' : 'E';

          const portColor = isStartPort ? 'var(--color-success-500)' :
            isTargetPort ? 'var(--color-warning-500)' :
              (isShutdown || isDeviceOffline) ? STATUS_COLORS.offline :
                isConsolePort
                  ? (isConnected ? PORT_COLORS.console.connected : PORT_COLORS.console.disconnected)
                  : device.type === 'iot'
                    ? PORT_COLORS.ethernet.connected
                    : (isConnected ? PORT_COLORS.ethernet.connected : PORT_COLORS.ethernet.disconnected);

          return (
            <g
              key={port.id}
              transform={`translate(${portX}, ${portY})`}
              style={{ cursor: isDraggingInteractionDisabled ? 'default' : 'pointer', pointerEvents: isDraggingInteractionDisabled ? 'none' : 'all' }}
              onMouseEnter={(e) => handlePortHover(e, device.id, port.id)}
              onMouseLeave={handlePortMouseLeave}
            >
              {isTargetPort && (
                <circle
                  r={12}
                  className="animate-pulse"
                  style={{ fill: 'var(--color-warning-500)', opacity: 0.3 }}
                />
              )}
              <circle
                r={9}
                fill="transparent"
                style={{ pointerEvents: isDraggingInteractionDisabled ? 'none' : 'all', cursor: isDraggingInteractionDisabled ? 'default' : 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handlePortClick(e, device.id, port.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              />
              <circle
                r={7}
                fill={portColor}
                stroke={isTargetPort ? 'var(--color-warning-400)' : getPortFrameColor(port.id, hasProblem, isConnected)}
                strokeWidth={isShutdown || isDeviceOffline || isConnected || isTargetPort ? 2 : 1}
                opacity={hasProblem && !isTargetPort ? 0.45 : 1}
                style={{ pointerEvents: 'none' }}
              />
              <text y={1} fill="var(--color-background)" fontSize="7" fontWeight="700" textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {portLabel}
              </text>
            </g>
          );
        })
      ) : (
        device.type === 'router' || device.type === 'wlc' ? (
          (() => {
            const filteredPorts = device.ports.filter(p => p.id !== 'wlan0' && !p.id.startsWith('service'));
            const giPorts = filteredPorts.filter(p => p.id.toLowerCase().startsWith('gi'));
            const otherPorts = filteredPorts.filter(p => !p.id.toLowerCase().startsWith('gi'));
            const portSpacing = 14;
            const rowSpacing = 14;
            const startX = 14;
            const startY = 80;

            const renderPort = (port: typeof filteredPorts[0], col: number, row: number) => {
              const portX = startX + col * portSpacing;
              const portY = startY + row * rowSpacing;
              const isConnected = port.status === 'connected';
              const isShutdown = port.shutdown;
              const isDeviceOffline = device.status === 'offline';

              const portId = port.id.toLowerCase();
              const isConsole = portId === 'console';
              const isGigabit = isGigabitPort(port.id);
              const isFastEthernet = portId.startsWith('fa');
              const isSerial = portId.startsWith('s') && !portId.startsWith('service');

              const portNum = port.label.replace(/\D/g, '');
              let displayNum = isConsole ? 'C' : (portNum ? parseInt(portNum, 10).toString() : 'C');
              if (isSerial) {
                const parts = portId.split('/');
                displayNum = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : parseInt(portNum, 10).toString();
              }

              const deviceState = deviceStates?.get(device.id);
              const simulatorPort = deviceState?.ports?.[port.id];
              const isSTPBlocked = simulatorPort?.spanningTree?.state === 'blocking' || simulatorPort?.spanningTree?.role === 'alternate';
              const isStartPort = isDrawingConnection && connectionStart?.deviceId === device.id && connectionStart?.portId === port.id;
              const deviceVlan = device.vlan || simulatorPort?.accessVlan || simulatorPort?.vlan || 1;
              const isVlan1 = deviceVlan === 1;
              const isBlocked = isSTPBlocked && isVlan1;
              const isTargetPort = isTargetingThisDevice && !isConnected;
              const hasProblem = isShutdown || isDeviceOffline || isBlocked || (isConnected && !isPortConnectionHealthy(port.id));

              let portFill: string;
              let portStroke: string;

              if (isStartPort) {
                portFill = 'var(--color-success-500)';
                portStroke = 'var(--color-success-400)';
              } else if (isTargetPort) {
                portFill = 'var(--color-warning-500)';
                portStroke = 'var(--color-warning-400)';
              } else if (isShutdown || isDeviceOffline) {
                portFill = 'var(--color-error-500)';
                portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
              } else if (isBlocked) {
                portFill = PORT_STP_BLOCKED;
                portStroke = PORT_STP_BLOCKED_STROKE;
              } else if (isConnected) {
                if (isConsole) { portFill = 'var(--color-accent-500)'; portStroke = isDark ? 'var(--color-accent-400)' : 'var(--color-accent-400)'; }
                else if (isGigabit) { portFill = PORT_GIGABIT_UP; portStroke = PORT_GIGABIT_UP_STROKE; }
                else if (isFastEthernet) { portFill = 'var(--color-primary-500)'; portStroke = isDark ? 'var(--color-primary-400)' : 'var(--color-primary-400)'; }
                else if (isSerial) { portFill = 'var(--color-success-500)'; portStroke = isDark ? 'var(--color-success-300)' : 'var(--color-success-300)'; }
                else { portFill = 'var(--color-primary-500)'; portStroke = isDark ? 'var(--color-primary-400)' : 'var(--color-primary-400)'; }
              } else {
                if (isConsole) { portFill = 'var(--color-accent-500)'; portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)'; }
                else if (isGigabit) { portFill = 'var(--color-secondary-500)'; portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)'; }
                else if (isFastEthernet) { portFill = 'var(--color-primary-500)'; portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)'; }
                else if (isSerial) { portFill = 'var(--color-success-500)'; portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)'; }
                else { portFill = 'var(--color-primary-500)'; portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)'; }
              }

              const hasStpInfo = isSwitchDeviceType(device.type) && simulatorPort?.spanningTree;
              const stpRole = simulatorPort?.spanningTree?.role;
              const roleAbbr = stpRole === 'root' ? 'RP' : stpRole === 'alternate' ? 'AP' : stpRole === 'backup' ? 'BP' : '';

              return (
                <g
                  key={port.id}
                  transform={`translate(${portX}, ${portY})`}
                  style={{ cursor: isDraggingInteractionDisabled ? 'default' : 'pointer', pointerEvents: isDraggingInteractionDisabled ? 'none' : 'all' }}
                  onMouseEnter={(e) => handlePortHover(e, device.id, port.id)}
                  onMouseLeave={handlePortMouseLeave}
                >
                  {isTargetPort && (
                    <circle
                      r={10}
                      className="animate-pulse"
                      style={{ fill: 'var(--color-warning-500)', opacity: 0.3 }}
                    />
                  )}
                  <circle
                    r={7} // Adjusted to prevent overlap (spacing is 14)
                    fill="transparent"
                    style={{ pointerEvents: isDraggingInteractionDisabled ? 'none' : 'all', cursor: isDraggingInteractionDisabled ? 'default' : 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handlePortClick(e, device.id, port.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                  <circle
                    r={6}
                    fill={portFill}
                    stroke={isBlocked || isTargetPort ? portStroke : getPortFrameColor(port.id, hasProblem, isConnected)}
                    strokeWidth={isShutdown || isDeviceOffline || isConnected || isTargetPort ? 2 : 1}
                    opacity={hasProblem && !isBlocked && !isTargetPort ? 0.45 : 1}
                    style={{ pointerEvents: 'none' }}
                  />
                  <text y={1} style={{ fill: 'var(--color-background)', userSelect: 'none', pointerEvents: 'none' }} fontSize="6" textAnchor="middle" dominantBaseline="middle">
                    {displayNum}
                  </text>
                  {hasStpInfo && roleAbbr && (
                    <g transform={`translate(0, ${row === 0 ? -11 : 11})`}>
                      <rect
                        x="-7"
                        y="-5"
                        width="14"
                        height="9"
                        rx="2"
                        fill={
                          stpRole === 'root'
                            ? 'var(--color-primary-500)'
                            : stpRole === 'designated'
                              ? 'var(--color-success-500)'
                              : 'var(--color-warning-500)'
                        }
                        stroke={isDark ? 'var(--color-secondary-950)' : 'var(--color-secondary-50)'}
                        strokeWidth="0.5"
                      />
                      <text
                        y="-0.5"
                        fill="white"
                        fontSize="5"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                      >
                        {roleAbbr}
                      </text>
                    </g>
                  )}
                </g>
              );
            };

            if (device.type === 'wlc') {
              const orderedPorts = [...giPorts, ...otherPorts];
              return <>{orderedPorts.map((port, idx) => renderPort(port, idx, 0))}</>;
            }
            return (
              <>
                {giPorts.map((port, idx) => renderPort(port, idx, 0))}
                {otherPorts.map((port, idx) => renderPort(port, idx, 1))}
              </>
            );
          })()
        ) : (
          device.ports
            .filter(p => !p.id.startsWith('vlan') && p.id !== 'wlan0')
            .map((port, idx) => {
              const portsPerRow = 8;
              const col = idx % portsPerRow;
              const row = Math.floor(idx / portsPerRow);
              const portSpacing = 14;
              const rowSpacing = 14;
              const startX = device.type === 'cloud' ? 44 : 14;
              const startY = 80;
              const portX = startX + col * portSpacing;
              const portY = startY + row * rowSpacing;
              const isConnected = port.status === 'connected';
              const isShutdown = port.shutdown;
              const isDeviceOffline = device.status === 'offline';

              const portId = port.id.toLowerCase();
              const isConsole = portId === 'console';
              const isGigabit = isGigabitPort(port.id);
              const isFastEthernet = portId.startsWith('fa');

              const portNum = port.label.replace(/\D/g, '');
              let displayNum = isConsole ? 'C' : (portNum ? parseInt(portNum, 10).toString() : 'C');
              if (device.type === 'cloud') {
                displayNum = port.id === 'eth0' ? '1' : port.id === 'eth1' ? '2' : port.id === 'eth2' ? '3' : port.id === 'eth3' ? '4' : (idx + 1).toString();
              }

              const deviceState = deviceStates?.get(device.id);
              const isStartPort = isDrawingConnection && connectionStart?.deviceId === device.id && connectionStart?.portId === port.id;
              const simulatorPort = deviceState?.ports?.[port.id];
              const isSTPBlocked = simulatorPort?.spanningTree?.state === 'blocking' || simulatorPort?.spanningTree?.role === 'alternate';
              const isTargetPort = isTargetingThisDevice && !isConnected;
              const hasProblem = isShutdown || isDeviceOffline || isSTPBlocked || (isConnected && !isPortConnectionHealthy(port.id));

              let portFill: string;
              let portStroke: string;

              if (isStartPort) {
                portFill = 'var(--color-success-500)';
                portStroke = 'var(--color-success-400)';
              } else if (isTargetPort) {
                portFill = 'var(--color-warning-500)';
                portStroke = 'var(--color-warning-400)';
              } else if (isShutdown || isDeviceOffline) {
                portFill = 'var(--color-error-500)';
                portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
              } else if (isSTPBlocked) {
                portFill = PORT_STP_BLOCKED;
                portStroke = PORT_STP_BLOCKED_STROKE;
              } else if (isConnected) {
                if (isConsole) {
                  portFill = 'var(--color-accent-500)';
                  portStroke = isDark ? 'var(--color-accent-400)' : 'var(--color-accent-400)';
                } else if (isGigabit) {
                  portFill = PORT_GIGABIT_UP;
                  portStroke = PORT_GIGABIT_UP_STROKE;
                } else if (isFastEthernet) {
                  portFill = 'var(--color-primary-500)';
                  portStroke = isDark ? 'var(--color-primary-400)' : 'var(--color-primary-400)';
                } else {
                  portFill = 'var(--color-primary-500)';
                  portStroke = isDark ? 'var(--color-primary-400)' : 'var(--color-primary-400)';
                }
              } else {
                if (isConsole) {
                  portFill = 'var(--color-accent-500)';
                  portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
                } else if (isGigabit) {
                  portFill = 'var(--color-secondary-500)';
                  portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
                } else if (isFastEthernet) {
                  portFill = 'var(--color-primary-500)';
                  portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
                } else {
                  portFill = 'var(--color-primary-500)';
                  portStroke = isDark ? 'var(--color-secondary-600)' : 'var(--color-secondary-400)';
                }
              }

              const hasStpInfo = isSwitchDeviceType(device.type) && simulatorPort?.spanningTree;
              const stpRole = simulatorPort?.spanningTree?.role;
              const roleAbbr = stpRole === 'root' ? 'RP' : stpRole === 'alternate' ? 'AP' : stpRole === 'backup' ? 'BP' : '';

              return (
                <g
                  key={port.id}
                  transform={`translate(${portX}, ${portY})`}
                  style={{ cursor: isDraggingInteractionDisabled ? 'default' : 'pointer', pointerEvents: isDraggingInteractionDisabled ? 'none' : 'all' }}
                  onMouseEnter={(e) => handlePortHover(e, device.id, port.id)}
                  onMouseLeave={handlePortMouseLeave}
                >
                  {isTargetPort && (
                    <circle
                      r={10}
                      className="animate-pulse"
                      style={{ fill: 'var(--color-warning-500)', opacity: 0.3 }}
                    />
                  )}
                  <circle
                    r={7} // Adjusted to prevent overlap (spacing is 14)
                    fill="transparent"
                    style={{ pointerEvents: isDraggingInteractionDisabled ? 'none' : 'all', cursor: isDraggingInteractionDisabled ? 'default' : 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handlePortClick(e, device.id, port.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                  <circle
                    r={6}
                    fill={portFill}
                    stroke={isSTPBlocked || isTargetPort ? portStroke : getPortFrameColor(port.id, hasProblem, isConnected)}
                    strokeWidth={isShutdown || isDeviceOffline || isConnected || isTargetPort ? 2 : 1}
                    opacity={hasProblem && !isSTPBlocked && !isTargetPort ? 0.45 : 1}
                    style={{ pointerEvents: 'none' }}
                  />
                  <text y={1} style={{ fill: 'var(--color-background)', userSelect: 'none', pointerEvents: 'none' }} fontSize="6" textAnchor="middle" dominantBaseline="middle">
                    {displayNum}
                  </text>
                  {hasStpInfo && roleAbbr && (
                    <g transform={`translate(0, ${row === 0 ? -11 : 11})`}>
                      <rect
                        x="-7"
                        y="-5"
                        width="14"
                        height="9"
                        rx="2"
                        fill={
                          stpRole === 'root'
                            ? 'var(--color-primary-500)'
                            : stpRole === 'designated'
                              ? 'var(--color-success-500)'
                              : 'var(--color-warning-500)'
                        }
                        stroke={isDark ? 'var(--color-secondary-950)' : 'var(--color-secondary-50)'}
                        strokeWidth="0.5"
                      />
                      <text
                        y="-0.5"
                        fill="white"
                        fontSize="5"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                      >
                        {roleAbbr}
                      </text>
                    </g>
                  )}
                </g>
              );
            })
        )
      )}
    </g>
  );
}, (prev, next) => {
  // Device objects are structurally shared by the simulation. This lets an
  // unrelated device update skip the expensive SVG subtree while still
  // refreshing a Wi-Fi device when the topology used for signal strength changes.
  const isWifiClientDevice =
    prev.device.type === 'pc' ||
    prev.device.type === 'iot' ||
    prev.device.type === 'mobile' ||
    prev.device.type === 'printer' ||
    Boolean(prev.device.wifi) ||
    Boolean(prev.device.ports?.some(p => p.id === 'wlan0'));

  const wifiContextChanged = isWifiClientDevice
    ? prev.topologyDevices !== next.topologyDevices || prev.deviceStates !== next.deviceStates
    : false;
  return prev.device === next.device &&
    prev.isDragging === next.isDragging &&
    prev.isSelected === next.isSelected &&
    prev.isDark === next.isDark &&
    prev.language === next.language &&
    prev.t === next.t &&
    prev.deviceStates === next.deviceStates &&
    prev.deviceToConnectionsMap === next.deviceToConnectionsMap &&
    prev.graphicsQuality === next.graphicsQuality &&
    prev.isDraggingInteractionDisabled === next.isDraggingInteractionDisabled &&
    prev.getLiveDeviceVlan === next.getLiveDeviceVlan &&
    prev.getIotMeasuredValue === next.getIotMeasuredValue &&
    prev.handlePortHover === next.handlePortHover &&
    prev.handlePortMouseLeave === next.handlePortMouseLeave &&
    prev.handlePortClick === next.handlePortClick &&
    prev.handleDeviceMouseDown === next.handleDeviceMouseDown &&
    prev.handleDevicePointerDown === next.handleDevicePointerDown &&
    prev.handleDeviceClick === next.handleDeviceClick &&
    prev.handleDeviceKeyDown === next.handleDeviceKeyDown &&
    prev.handleDeviceDoubleClick === next.handleDeviceDoubleClick &&
    prev.handleDeviceMouseLeave === next.handleDeviceMouseLeave &&
    prev.handleDeviceTouchStart === next.handleDeviceTouchStart &&
    prev.handleDeviceTouchMove === next.handleDeviceTouchMove &&
    prev.handleDeviceTouchEnd === next.handleDeviceTouchEnd &&
    prev.isDrawingConnection === next.isDrawingConnection &&
    prev.connectionStart === next.connectionStart &&
    prev._mousePosRef === next._mousePosRef &&
    !wifiContextChanged;
});
