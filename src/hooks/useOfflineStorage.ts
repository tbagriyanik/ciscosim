import { useState, useEffect, useCallback } from 'react';
import { offlineStorage, OfflineProject, OfflineSettings } from '@/lib/storage/offlineStorage';

export function useOfflineStorage() {
 const [isAvailable, setIsAvailable] = useState(false);
 const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0, total: 0 });

 useEffect(() => {
 // Check if localStorage is available
 const available = offlineStorage.isAvailable();
 setIsAvailable(available);

 if (available) {
 // Update storage info periodically
 const updateInfo = () => {
 setStorageInfo(offlineStorage.getStorageInfo());
 };

 updateInfo();
 const interval = setInterval(updateInfo, 5000); // Update every 5 seconds

 return () => clearInterval(interval);
 }
 }, []);

 // Project operations
 const saveProject = useCallback((project: Omit<OfflineProject, 'createdAt' | 'updatedAt'>) => {
 if (!isAvailable) return false;
 try {
 offlineStorage.saveProject(project);
 return true;
 } catch (error) {
 console.error('Failed to save project offline:', error);
 return false;
 }
 }, [isAvailable]);

 const getProject = useCallback((id: string) => {
 if (!isAvailable) return null;
 return offlineStorage.getProject(id);
 }, [isAvailable]);

 const getAllProjects = useCallback(() => {
 if (!isAvailable) return [];
 return offlineStorage.getAllProjects();
 }, [isAvailable]);

 const deleteProject = useCallback((id: string) => {
 if (!isAvailable) return false;
 try {
 offlineStorage.deleteProject(id);
 return true;
 } catch (error) {
 console.error('Failed to delete project offline:', error);
 return false;
 }
 }, [isAvailable]);

 // Settings operations
 const saveSettings = useCallback((settings: OfflineSettings) => {
 if (!isAvailable) return false;
 try {
 offlineStorage.saveSettings(settings);
 return true;
 } catch (error) {
 console.error('Failed to save settings offline:', error);
 return false;
 }
 }, [isAvailable]);

 const getSettings = useCallback(() => {
 if (!isAvailable) {
 return { language: 'tr' as const, theme: 'dark' as const, autoSave: true };
 }
 return offlineStorage.getSettings();
 }, [isAvailable]);

 // PC History operations
 const savePCHistory = useCallback((deviceId: string, history: string[]) => {
 if (!isAvailable) return false;
 try {
 offlineStorage.savePCHistory(deviceId, history);
 return true;
 } catch (error) {
 console.error('Failed to save PC history offline:', error);
 return false;
 }
 }, [isAvailable]);

 const getPCHistory = useCallback((deviceId: string) => {
 if (!isAvailable) return [];
 return offlineStorage.getPCHistory(deviceId);
 }, [isAvailable]);

 // Utility operations
 const clearAll = useCallback(() => {
 if (!isAvailable) return false;
 try {
 offlineStorage.clearAll();
 return true;
 } catch (error) {
 console.error('Failed to clear offline storage:', error);
 return false;
 }
 }, [isAvailable]);

 return {
 // Status
 isAvailable,
 storageInfo,
 
 // Projects
 saveProject,
 getProject,
 getAllProjects,
 deleteProject,
 
 // Settings
 saveSettings,
 getSettings,
 
 // PC Histories
 savePCHistory,
 getPCHistory,
 
 // Utilities
 clearAll,
 };
}
