'use client';

import { DEVICE_ICON_PATHS } from './networkTopology.constants';
import type { DeviceType } from './networkTopology.types';

export interface DeviceIconProps {
 type: DeviceType;
 className?: string;
}

const strokeProps = {
 strokeLinecap: 'round' as const,
 strokeLinejoin: 'round' as const,
 strokeWidth: 1.5,
};

export function DeviceIcon({ type, className }: DeviceIconProps) {
 const svgClassName = className ?? 'w-5 h-5';

 if (type === 'router') {
 return (
 <svg className={svgClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <circle
 cx={DEVICE_ICON_PATHS.router.circle.cx}
 cy={DEVICE_ICON_PATHS.router.circle.cy}
 r={DEVICE_ICON_PATHS.router.circle.r}
 {...strokeProps}
 />
 <path {...strokeProps} d={DEVICE_ICON_PATHS.router.paths} />
 </svg>
 );
 }

 const path = type === 'pc' ? DEVICE_ICON_PATHS.pc : DEVICE_ICON_PATHS.switch;

 return (
 <svg className={svgClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path {...strokeProps} d={path} />
 </svg>
 );
}
