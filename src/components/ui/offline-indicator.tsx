import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
 DropdownMenuSeparator,
 DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

interface OfflineIndicatorProps {
 isOnline: boolean;
 isDatabaseAvailable: boolean;
 onSyncData?: () => void;
}

export function OfflineIndicator({ 
 isOnline, 
 isDatabaseAvailable, 
 onSyncData 
}: OfflineIndicatorProps) {
 const { isAvailable, storageInfo, getAllProjects, clearAll } = useOfflineStorage();
 const [projectCount, setProjectCount] = useState(0);

 useEffect(() => {
 if (isAvailable) {
 setProjectCount(getAllProjects().length);
 }
 }, [isAvailable, getAllProjects]);

 const getStatusColor = () => {
 if (isOnline && isDatabaseAvailable) return 'text-green-500';
 if (isOnline && !isDatabaseAvailable) return 'text-amber-500';
 return 'text-rose-500';
 };

 const getStatusIcon = () => {
 if (isOnline && isDatabaseAvailable) return <Database className="w-4 h-4" />;
 if (isOnline && !isDatabaseAvailable) return <Wifi className="w-4 h-4" />;
 return <WifiOff className="w-4 h-4" />;
 };

 const getStatusText = () => {
 if (isOnline && isDatabaseAvailable) return 'Online';
 if (isOnline && !isDatabaseAvailable) return 'Offline Mode';
 return 'Offline';
 };

 const formatBytes = (bytes: number) => {
 if (bytes === 0) return '0 Bytes';
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
 };

 return (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="ghost"
 size="sm"
 className={`h-8 px-2 gap-2 ${getStatusColor()}`}
 >
 {getStatusIcon()}
 <span className="text-xs font-medium hidden sm:inline">
 {getStatusText()}
 </span>
 </Button>
 </DropdownMenuTrigger>
 
 <DropdownMenuContent align="end" className="w-64">
 <DropdownMenuLabel className="flex items-center gap-2">
 {getStatusIcon()}
 Connection Status
 </DropdownMenuLabel>
 
 <DropdownMenuSeparator />
 
 {/* Connection Status */}
 <div className="px-2 py-1.5 space-y-1">
 <div className="flex items-center justify-between text-xs">
 <span>Internet</span>
 <span className={isOnline ? 'text-green-500' : 'text-rose-500'}>
 {isOnline ? 'Connected' : 'Disconnected'}
 </span>
 </div>
 <div className="flex items-center justify-between text-xs">
 <span>Database</span>
 <span className={isDatabaseAvailable ? 'text-green-500' : 'text-amber-500'}>
 {isDatabaseAvailable ? 'Available' : 'Offline'}
 </span>
 </div>
 <div className="flex items-center justify-between text-xs">
 <span>Local Storage</span>
 <span className={isAvailable ? 'text-green-500' : 'text-rose-500'}>
 {isAvailable ? 'Available' : 'Unavailable'}
 </span>
 </div>
 </div>

 <DropdownMenuSeparator />

 {/* Offline Storage Info */}
 {isAvailable && (
 <div className="px-2 py-1.5 space-y-1">
 <div className="flex items-center justify-between text-xs">
 <span>Saved Projects</span>
 <span>{projectCount}</span>
 </div>
 <div className="flex items-center justify-between text-xs">
 <span>Storage Used</span>
 <span>{formatBytes(storageInfo.used)}</span>
 </div>
 <div className="flex items-center justify-between text-xs">
 <span>Available</span>
 <span>{formatBytes(storageInfo.available)}</span>
 </div>
 </div>
 )}

 {/* Actions */}
 {(isOnline && !isDatabaseAvailable) && onSyncData && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={onSyncData} className="text-xs">
 <Database className="w-4 h-4 mr-2" />
 Sync Data When Available
 </DropdownMenuItem>
 </>
 )}

 {isAvailable && projectCount > 0 && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem 
 onClick={clearAll} 
 className="text-xs text-rose-500 focus:text-rose-500"
 >
 <AlertTriangle className="w-4 h-4 mr-2" />
 Clear All Offline Data
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 );
}
