import React, { memo } from 'react';
import { CanvasDevice } from './networkTopology.types';

interface DeviceNodeProps {
  device: CanvasDevice;
  isSelected: boolean;
  isDragging: boolean;
  isDark: boolean;
  isActive?: boolean;
  onMouseDown: (e: React.MouseEvent<SVGGElement>, deviceId: string) => void;
  onClick: (e: React.MouseEvent<SVGGElement>, device: CanvasDevice) => void;
  onDoubleClick: (device: CanvasDevice) => void;
  onContextMenu: (e: React.MouseEvent<SVGGElement>, deviceId: string) => void;
  onMouseEnter?: (e: React.MouseEvent<SVGGElement>, deviceId: string) => void;
  onMouseLeave?: (e: React.MouseEvent<SVGGElement>, deviceId: string) => void;
  onTouchStart: (e: React.TouchEvent<SVGGElement>, deviceId: string) => void;
  onTouchMove: (e: React.TouchEvent<SVGGElement>) => void;
  onTouchEnd: (e: React.TouchEvent<SVGGElement>) => void;
  renderDeviceContent: (device: CanvasDevice, isDragging: boolean) => React.ReactNode;
}

export const DeviceNode = memo(function DeviceNode({
  device,
  isSelected,
  isDragging,
  isDark,
  isActive,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  renderDeviceContent
}: DeviceNodeProps) {
  return (
    <g
      onMouseDown={(e) => onMouseDown(e, device.id)}
      onClick={(e) => onClick(e, device)}
      onDoubleClick={() => onDoubleClick(device)}
      onContextMenu={(e) => onContextMenu(e, device.id)}
      onMouseEnter={(e) => onMouseEnter?.(e, device.id)}
      onMouseLeave={(e) => onMouseLeave?.(e, device.id)}
      onTouchStart={(e) => onTouchStart(e, device.id)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ cursor: 'move', touchAction: 'none' }}
    >
      {renderDeviceContent(device, isDragging)}
    </g>
  );
}, (prevProps, nextProps) => {
  // Cihaz konumu, adı, durumu, IP değişmişse re-render et
  if (
    prevProps.device.x !== nextProps.device.x ||
    prevProps.device.y !== nextProps.device.y ||
    prevProps.device.name !== nextProps.device.name ||
    prevProps.device.status !== nextProps.device.status ||
    prevProps.device.ip !== nextProps.device.ip
  ) {
    return false; // Re-render et
  }

  // Port sayısı değişmişse re-render et
  if (prevProps.device.ports.length !== nextProps.device.ports.length) {
    return false; // Re-render et
  }

  // Port durumu veya shutdown state değişmişse re-render et
  for (let i = 0; i < prevProps.device.ports.length; i++) {
    if (
      prevProps.device.ports[i].status !== nextProps.device.ports[i].status ||
      prevProps.device.ports[i].shutdown !== nextProps.device.ports[i].shutdown
    ) {
      return false; // Re-render et
    }
  }

  // UI state değişmişse re-render et
  if (
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isActive !== nextProps.isActive ||
    prevProps.isDragging !== nextProps.isDragging ||
    prevProps.isDark !== nextProps.isDark
  ) {
    return false; // Re-render et
  }

  // Hiçbir şey değişmemişse re-render etme
  return true;
});
