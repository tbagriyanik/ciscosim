// Offline Storage Manager for Network Simulator
// Provides localStorage-based persistence when database is unavailable

export interface OfflineProject {
  id: string;
  name: string;
  description?: string;
  devices: any[];
  connections: any[];
  notes: any[];
  deviceStates: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineSettings {
  language: 'tr' | 'en';
  theme: 'dark' | 'light';
  autoSave: boolean;
  lastProject?: string;
}

class OfflineStorage {
  private readonly PROJECTS_KEY = 'netsim_projects';
  private readonly SETTINGS_KEY = 'netsim_settings';
  private readonly HISTORIES_KEY = 'netsim_histories';

  // Project Management
  saveProject(project: Omit<OfflineProject, 'createdAt' | 'updatedAt'>): void {
    try {
      const existingProject = this.getProject(project.id);
      const now = new Date().toISOString();
      
      const fullProject: OfflineProject = {
        ...project,
        createdAt: existingProject?.createdAt || now,
        updatedAt: now
      };

      const projects = this.getAllProjects();
      const index = projects.findIndex(p => p.id === project.id);
      
      if (index >= 0) {
        projects[index] = fullProject;
      } else {
        projects.push(fullProject);
      }

      localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(projects));
    } catch (error) {
      console.warn('Failed to save project to localStorage:', error);
    }
  }

  getProject(id: string): OfflineProject | null {
    try {
      const projects = this.getAllProjects();
      return projects.find(p => p.id === id) || null;
    } catch (error) {
      console.warn('Failed to get project from localStorage:', error);
      return null;
    }
  }

  getAllProjects(): OfflineProject[] {
    try {
      const data = localStorage.getItem(this.PROJECTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('Failed to get projects from localStorage:', error);
      return [];
    }
  }

  deleteProject(id: string): void {
    try {
      const projects = this.getAllProjects();
      const filtered = projects.filter(p => p.id !== id);
      localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.warn('Failed to delete project from localStorage:', error);
    }
  }

  // Settings Management
  saveSettings(settings: OfflineSettings): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
  }

  getSettings(): OfflineSettings {
    try {
      const data = localStorage.getItem(this.SETTINGS_KEY);
      return data ? JSON.parse(data) : {
        language: 'tr',
        theme: 'dark',
        autoSave: true
      };
    } catch (error) {
      console.warn('Failed to get settings from localStorage:', error);
      return {
        language: 'tr',
        theme: 'dark',
        autoSave: true
      };
    }
  }

  // PC Command Histories
  savePCHistory(deviceId: string, history: string[]): void {
    try {
      const histories = this.getAllPCHistories();
      histories[deviceId] = history;
      localStorage.setItem(this.HISTORIES_KEY, JSON.stringify(histories));
    } catch (error) {
      console.warn('Failed to save PC history to localStorage:', error);
    }
  }

  getPCHistory(deviceId: string): string[] {
    try {
      const histories = this.getAllPCHistories();
      return histories[deviceId] || [];
    } catch (error) {
      console.warn('Failed to get PC history from localStorage:', error);
      return [];
    }
  }

  getAllPCHistories(): Record<string, string[]> {
    try {
      const data = localStorage.getItem(this.HISTORIES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.warn('Failed to get PC histories from localStorage:', error);
      return {};
    }
  }

  // Utility Methods
  clearAll(): void {
    try {
      localStorage.removeItem(this.PROJECTS_KEY);
      localStorage.removeItem(this.SETTINGS_KEY);
      localStorage.removeItem(this.HISTORIES_KEY);
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  getStorageInfo(): { used: number; available: number; total: number } {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      // Rough estimate of localStorage limit (usually 5-10MB)
      const total = 5 * 1024 * 1024; // 5MB
      const available = total - used;
      
      return { used, available, total };
    } catch (error) {
      return { used: 0, available: 0, total: 0 };
    }
  }

  isAvailable(): boolean {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const offlineStorage = new OfflineStorage();
