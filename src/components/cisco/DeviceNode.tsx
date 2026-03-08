import React, { memo } from 'react';
import { CanvasDevice } from './NetworkTopology';

interface DeviceNodeProps {
  device: CanvasDevice;
  isSelected: boolean;
  isDragging: boolean;
  isDark: boolean;
  isActive?: boolean;
  onMouseDown: (e: any, deviceId: string) => void;
  onClick: (e: any, device: CanvasDevice) => void;
  onDoubleClick: (device: CanvasDevice) => void;
  onContextMenu: (e: any, deviceId: string) => void;
  onTouchStart: (e: any, deviceId: string) => void;
  onTouchMove: (e: any) => void;
  onTouchEnd: (e: any) => void;
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
      onTouchStart={(e) => onTouchStart(e, device.id)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ cursor: 'move', touchAction: 'none' }}
    >
      {renderDeviceContent(device, isDragging)}
    </g>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.device.x === nextProps.device.x &&
    prevProps.device.y === nextProps.device.y &&
    prevProps.device.name === nextProps.device.name &&
    prevProps.device.status === nextProps.device.status &&
    prevProps.device.ip === nextProps.device.ip &&
    JSON.stringify(prevProps.device.ports) === JSON.stringify(nextProps.device.ports) &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isDark === nextProps.isDark
  );
});
