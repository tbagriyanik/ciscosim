 
import { describe, it, expect } from 'vitest';
import type { CanvasConnection, CanvasDevice } from '@/components/network/networkTopology.types';
import type { SwitchState } from '@/lib/network/types';
import {
  getNextIncompleteStep,
  getCompletedStepsCount,
  getProgressPercentage,
  generateGuidedIntegrityHash,
  verifyGuidedIntegrity,
  checkStepCompletion,
  getGuidedProjects,
  addDeviceGuidedSteps,
  pcCmdGuidedSteps,
  cliBasicsGuidedSteps,
  basicSwitchGuidedSteps,
  basicLanGuidedSteps,
  vlanGuidedSteps,
  routerDhcpGuidedSteps,
  staticRoutingGuidedSteps,
  portSecurityGuidedSteps,
  ripRoutingGuidedSteps,
  servicesGuidedSteps,
  cliGuidedLessons,
  type GuidedStep,
  type GuidedProject,
} from '@/lib/network/guidedMode';

describe('guidedMode', () => {
  describe('getNextIncompleteStep', () => {
    it('should return the first incomplete step', () => {
      const steps = [
        { id: 'step-1', completed: true },
        { id: 'step-2', completed: false },
        { id: 'step-3', completed: false },
      ];

      const result = getNextIncompleteStep(steps as GuidedStep[]);
      expect(result?.id).toBe('step-2');
    });

    it('should return null when all steps completed', () => {
      const steps = [
        { id: 'step-1', completed: true },
        { id: 'step-2', completed: true },
      ];

      const result = getNextIncompleteStep(steps as GuidedStep[]);
      expect(result).toBeNull();
    });

    it('should return null for empty steps array', () => {
      expect(getNextIncompleteStep([])).toBeNull();
    });
  });

  describe('getCompletedStepsCount', () => {
    it('should count completed steps', () => {
      const steps = [
        { id: 'step-1', completed: true },
        { id: 'step-2', completed: false },
        { id: 'step-3', completed: true },
      ];

      expect(getCompletedStepsCount(steps as GuidedStep[])).toBe(2);
    });

    it('should return 0 for no completed steps', () => {
      const steps = [
        { id: 'step-1', completed: false },
        { id: 'step-2', completed: false },
      ];

      expect(getCompletedStepsCount(steps as GuidedStep[])).toBe(0);
    });
  });

  describe('getProgressPercentage', () => {
    it('should calculate correct percentage', () => {
      const steps = [
        { id: 'step-1', completed: true },
        { id: 'step-2', completed: true },
        { id: 'step-3', completed: false },
        { id: 'step-4', completed: false },
      ];

      expect(getProgressPercentage(steps as GuidedStep[])).toBe(50);
    });

    it('should return 0 for empty steps', () => {
      expect(getProgressPercentage([])).toBe(0);
    });

    it('should return 100 when all completed', () => {
      const steps = [
        { id: 'step-1', completed: true },
        { id: 'step-2', completed: true },
      ];

      expect(getProgressPercentage(steps as GuidedStep[])).toBe(100);
    });
  });

  describe('generateGuidedIntegrityHash & verifyGuidedIntegrity', () => {
    it('should generate a consistent hash for the same project', () => {
      const project = {
        id: 'test-project',
        estimatedTimeMinutes: 30,
        steps: [
          { id: 'step-1', points: 10, completed: false, completedAt: null },
          { id: 'step-2', points: 20, completed: true, completedAt: new Date('2024-01-01') },
        ],
        startedAt: null,
        totalPoints: 30,
        integrityHash: undefined,
      };

      const hash1 = generateGuidedIntegrityHash(project as unknown as GuidedProject);
      const hash2 = generateGuidedIntegrityHash(project as unknown as GuidedProject);

      expect(hash1).toBe(hash2);
    });

    it('should verify integrity when hash matches', () => {
      const project: Partial<GuidedProject> & { id: string; steps: GuidedStep[]; integrityHash?: string } = {
        id: 'test-project',
        estimatedTimeMinutes: 30,
        steps: [
          { id: 'step-1', points: 10, completed: false, completedAt: undefined } as unknown as GuidedStep,
        ],
        startedAt: undefined,
        totalPoints: 10,
        integrityHash: undefined,
      };

      const hash = generateGuidedIntegrityHash(project as GuidedProject);
      project.integrityHash = hash;

      expect(verifyGuidedIntegrity(project as GuidedProject)).toBe(true);
    });

    it('should fail verification when data is tampered', () => {
      const original: Partial<GuidedProject> & { id: string; steps: GuidedStep[]; integrityHash?: string } = {
        id: 'test-project',
        estimatedTimeMinutes: 30,
        steps: [{ id: 'step-1', points: 10, completed: false, completedAt: undefined } as unknown as GuidedStep],
        startedAt: undefined,
        totalPoints: 10,
      };

      const hash = generateGuidedIntegrityHash(original as GuidedProject);
      const tampered: Partial<GuidedProject> & { id: string; steps: GuidedStep[]; integrityHash?: string } = { ...original, estimatedTimeMinutes: 999 };
      tampered.integrityHash = hash;

      expect(verifyGuidedIntegrity(tampered as GuidedProject)).toBe(false);
    });

    it('should fail verification when no integrityHash set', () => {
      const project = {
        id: 'test-project',
        estimatedTimeMinutes: 30,
        steps: [],
        startedAt: null,
        totalPoints: 0,
      };

      expect(verifyGuidedIntegrity(project as unknown as GuidedProject)).toBe(false);
    });
  });
  describe('checkStepCompletion', () => {
    const createStep = (overrides: Partial<GuidedStep> = {}): GuidedStep => ({
      id: 'test-step',
      order: 1,
      title: { tr: 'Test', en: 'Test' },
      description: { tr: 'Test', en: 'Test' },
      hint: { tr: 'Test', en: 'Test' },
      checkType: 'manual',
      completed: false,
      ...overrides,
    });

     describe('deviceAccess', () => {
      it('should return true when device type matches', () => {
        const step = createStep({ checkType: 'deviceAccess', checkParams: { deviceType: 'router' } });
        expect(checkStepCompletion(step, { deviceAccessed: 'router' })).toBe(true);
      });

      it('should return false when device type does not match', () => {
        const step = createStep({ checkType: 'deviceAccess', checkParams: { deviceType: 'router' } });
        expect(checkStepCompletion(step, { deviceAccessed: 'switch' })).toBe(false);
      });

      it('should return false when deviceAccessed is null', () => {
        const step = createStep({ checkType: 'deviceAccess', checkParams: { deviceType: 'router' } });
        expect(checkStepCompletion(step, { deviceAccessed: null })).toBe(false);
      });

      it('should verify targetDeviceId when specified', () => {
        const step = createStep({
          checkType: 'deviceAccess',
          checkParams: { deviceType: 'router', targetDeviceId: 'router-1' },
        });
        expect(checkStepCompletion(step, { deviceAccessed: 'router', deviceAccessedId: 'router-1' })).toBe(true);
        expect(checkStepCompletion(step, { deviceAccessed: 'router', deviceAccessedId: 'router-2' })).toBe(false);
      });
    });

    describe('command', () => {
      it('should return true when command matches pattern', () => {
        const step = createStep({
          checkType: 'command',
          checkParams: { commandPattern: 'enable' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'enable' })).toBe(true);
      });

      it('should handle pipe-separated patterns', () => {
        const step = createStep({
          checkType: 'command',
          checkParams: { commandPattern: 'show running-config|show run' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'show running-config' })).toBe(true);
        expect(checkStepCompletion(step, { lastCommand: 'show run' })).toBe(true);
      });

      it('should return false when command does not match', () => {
        const step = createStep({
          checkType: 'command',
          checkParams: { commandPattern: 'enable' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'disable' })).toBe(false);
      });

      it('should verify targetDeviceId when specified', () => {
        const step = createStep({
          checkType: 'command',
          checkParams: { commandPattern: 'configure terminal', targetDeviceId: 'switch-1' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'configure terminal', deviceAccessedId: 'switch-1' })).toBe(true);
        expect(checkStepCompletion(step, { lastCommand: 'configure terminal', deviceAccessedId: 'switch-2' })).toBe(false);
      });

      it('should be case insensitive', () => {
        const step = createStep({
          checkType: 'command',
          checkParams: { commandPattern: 'ENABLE' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'enable' })).toBe(true);
      });
    });

    describe('connection', () => {
      const makeConn = (overrides: Partial<CanvasConnection> = {}): CanvasConnection => ({
        id: 'conn-1',
        sourceDeviceId: 'pc-1',
        sourcePort: 'eth0',
        targetDeviceId: 'switch-1',
        targetPort: 'fa0/1',
        cableType: 'straight',
        active: true,
        ...overrides,
      });

      it('should return true when any active connection exists (no params)', () => {
        const step = createStep({ checkType: 'connection' });
        expect(checkStepCompletion(step, {
          topologyConnections: [makeConn()],
          topologyDevices: [],
        })).toBe(true);
      });

      it('should return false when no connections exist', () => {
        const step = createStep({ checkType: 'connection' });
        expect(checkStepCompletion(step, {
          topologyConnections: [],
          topologyDevices: [],
        })).toBe(false);
      });

      it('should verify specific connection', () => {
        const step = createStep({
          checkType: 'connection',
          checkParams: {
            sourceDevice: 'pc-1',
            sourcePort: 'eth0',
            targetDevice: 'switch-1',
            targetPort: 'fa0/1',
            cableType: 'straight',
          },
        });
        expect(checkStepCompletion(step, {
          topologyConnections: [makeConn()],
          topologyDevices: [],
        })).toBe(true);
      });

      it('should return false when cable type does not match', () => {
        const step = createStep({
          checkType: 'connection',
          checkParams: {
            sourceDevice: 'pc-1',
            targetDevice: 'switch-1',
            cableType: 'crossover',
          },
        });
        expect(checkStepCompletion(step, {
          topologyConnections: [makeConn({ cableType: 'straight' })],
          topologyDevices: [],
        })).toBe(false);
      });

      it('should return false for inactive connections', () => {
        const step = createStep({ checkType: 'connection' });
        expect(checkStepCompletion(step, {
          topologyConnections: [makeConn({ active: false })],
          topologyDevices: [],
        })).toBe(false);
      });

      it('should validate multiple required connections', () => {
        const step = createStep({
          checkType: 'connection',
          checkParams: {
            connections: [
              { sourceDevice: 'pc-1', sourcePort: 'eth0', targetDevice: 'switch-1', targetPort: 'fa0/1' },
              { sourceDevice: 'pc-2', sourcePort: 'eth0', targetDevice: 'switch-1', targetPort: 'fa0/2' },
            ],
          },
        });
        const conns = [
          makeConn({ id: 'c1', sourceDeviceId: 'pc-1', sourcePort: 'eth0', targetDeviceId: 'switch-1', targetPort: 'fa0/1' }),
          makeConn({ id: 'c2', sourceDeviceId: 'pc-2', sourcePort: 'eth0', targetDeviceId: 'switch-1', targetPort: 'fa0/2' }),
        ];
        expect(checkStepCompletion(step, { topologyConnections: conns, topologyDevices: [] })).toBe(true);
      });
    });

    describe('config', () => {
      it('should check device-level properties', () => {
        const deviceState = {
          hostname: 'SW-Lab',
          domainName: 'lab.local',
          sshVersion: 2,
          vtpMode: 'client',
          mlsQosEnabled: true,
          ipRouting: true
        };

        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'hostname', configValue: 'SW-Lab' } }), { deviceState: deviceState as unknown as SwitchState })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'domainName', configValue: 'lab.local' } }), { deviceState: deviceState as unknown as SwitchState })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'sshVersion', configValue: 2 } }), { deviceState: deviceState as unknown as SwitchState })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'vtpMode', configValue: 'client' } }), { deviceState: deviceState as unknown as SwitchState })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'mlsQosEnabled', configValue: true } }), { deviceState: deviceState as unknown as SwitchState })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'ipRouting', configValue: true } }), { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check interface IP configuration', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'interfaces.gi0/0.ipAddress', configValue: '192.168.1.1' },
        });
        const deviceState = { ports: { 'gi0/0': { ipAddress: '192.168.1.1' } } };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check interface shutdown state', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'interfaces.gi0/0.shutdown', configValue: false },
        });
        const deviceState = { ports: { 'gi0/0': { shutdown: false } } };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check VLAN assignment', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'interfaces.fa0/1.vlan', configValue: 10 },
        });
        const deviceState = { ports: { 'fa0/1': { accessVlan: 10 } } };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check VLAN existence', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'vlans.10', configValue: { name: 'Engineering' } },
        });
        const deviceState = { vlans: { 10: { name: 'Engineering' } } };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check static routes', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'staticRoutes', configValue: { destination: '192.168.2.0/24' } },
        });
        const deviceState = { staticRoutes: [{ destination: '192.168.2.0/24', nextHop: '10.0.0.1' }] };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check DHCP pool configuration', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'dhcpPools.LAN', configValue: { network: '192.168.1.0', mask: '255.255.255.0' } },
        });
        const deviceState = { dhcpPools: { LAN: { network: '192.168.1.0', mask: '255.255.255.0' } } };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check routing protocol', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'routingProtocol', configValue: 'rip' },
        });
        const deviceState = { routingProtocol: 'rip' };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should check PC configuration properties', () => {
        const topologyDevices = [{
          id: 'pc-1',
          ip: '192.168.1.10',
          subnet: '255.255.255.0',
          gateway: '192.168.1.1',
          dns: '8.8.8.8'
        }];

        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'pc.pc-1.ip', configValue: '192.168.1.10' } }), { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'pc.pc-1.gateway', configValue: '192.168.1.1' } }), { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'pc.pc-1.dns', configValue: '8.8.8.8' } }), { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
      });

      it('should check IoT properties', () => {
        const topologyDevices = [{
          id: 'iot-1',
          wifi: { ssid: 'IoT-Network' },
          iot: { sensorType: 'temperature', value: 25 }
        }];

        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'iot.iot-1.ssid', configValue: 'IoT-Network' } }), { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'iot.iot-1.sensorType', configValue: 'temperature' } }), { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
        expect(checkStepCompletion(createStep({ checkType: 'config', checkParams: { configKey: 'iot.iot-1.value', configValue: 25 } }), { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
      });

      it('should check firewall IP', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'firewall.fw-1.ip', configValue: '10.0.0.1' },
        });
        const topologyDevices = [{ id: 'fw-1', ip: '10.0.0.1' }];
        expect(checkStepCompletion(step, { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
      });

      it('should check firewall IP in port states', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'firewall.fw-1.ip', configValue: '10.0.0.1' },
        });
        const deviceState = new Map<string, SwitchState>();
        deviceState.set('fw-1', { ports: { 'gi0/0': { ipAddress: '10.0.0.1' } } } as unknown as SwitchState);
        const topologyDevices = [{ id: 'fw-1', ip: '0.0.0.0' }];
        expect(checkStepCompletion(step, { deviceState: undefined, deviceStates: deviceState, topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
      });

      it('should return false for unknown config key', () => {
        const step = createStep({
          checkType: 'config',
          checkParams: { configKey: 'unknown.key', configValue: 'test' },
        });
        expect(checkStepCompletion(step, {})).toBe(false);
      });

      it('should return false when configKey is missing', () => {
        const step = createStep({ checkType: 'config', checkParams: {} });
        expect(checkStepCompletion(step, {})).toBe(false);
      });
    });

    describe('ping', () => {
      it('should return true when ping command matches target IP', () => {
        const step = createStep({
          checkType: 'ping',
          checkParams: { toIp: '192.168.1.1' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'ping 192.168.1.1', lastOutput: 'Reply from 192.168.1.1: bytes=32 time<1ms TTL=64' })).toBe(true);
      });

      it('should return false when ping command is for wrong IP', () => {
        const step = createStep({
          checkType: 'ping',
          checkParams: { toIp: '192.168.1.1' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'ping 10.0.0.1' })).toBe(false);
      });

      it('should verify fromDevice when specified', () => {
        const step = createStep({
          checkType: 'ping',
          checkParams: { toIp: '192.168.1.1', fromDevice: 'pc-1' },
        });
        expect(checkStepCompletion(step, { lastCommand: 'ping 192.168.1.1', deviceAccessedId: 'pc-1', lastOutput: 'Reply from 192.168.1.1: bytes=32 time<1ms TTL=64' })).toBe(true);
        expect(checkStepCompletion(step, { lastCommand: 'ping 192.168.1.1', deviceAccessedId: 'pc-2', lastOutput: 'Reply from 192.168.1.1: bytes=32 time<1ms TTL=64' })).toBe(false);
      });
    });

    describe('deviceCount', () => {
      it('should return true when enough devices exist', () => {
        const step = createStep({
          checkType: 'deviceCount',
          checkParams: { deviceType: 'pc', minCount: 2 },
        });
        const topologyDevices = [
          { id: 'pc-1', type: 'pc' },
          { id: 'pc-2', type: 'pc' },
        ];
        expect(checkStepCompletion(step, { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
      });

      it('should return false when not enough devices exist', () => {
        const step = createStep({
          checkType: 'deviceCount',
          checkParams: { deviceType: 'pc', minCount: 3 },
        });
        const topologyDevices = [
          { id: 'pc-1', type: 'pc' },
        ];
        expect(checkStepCompletion(step, { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(false);
      });

      it('should count switch types (switchL2, switchL3) as switch', () => {
        const step = createStep({
          checkType: 'deviceCount',
          checkParams: { deviceType: 'switch', minCount: 2 },
        });
        const topologyDevices = [
          { id: 'sw1', type: 'switchL2' },
          { id: 'sw2', type: 'switchL3' },
        ];
        expect(checkStepCompletion(step, { topologyDevices: topologyDevices as unknown as CanvasDevice[] })).toBe(true);
      });
    });

    describe('manual', () => {
      it('should always return true', () => {
        const step = createStep({ checkType: 'manual' });
        expect(checkStepCompletion(step, {})).toBe(true);
      });
    });

    describe('faultResolved', () => {
      it('should resolve when the underlying config matches', () => {
        const step = createStep({
          checkType: 'faultResolved',
          checkParams: {
            targetDeviceId: 'switch-1',
            configKey: 'hostname',
            configValue: 'SW-Lab',
          },
        });

        const deviceState = { hostname: 'SW-Lab' };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });

      it('should not require faultId to be present', () => {
        const step = createStep({
          checkType: 'faultResolved',
          checkParams: {
            targetDeviceId: 'switch-1',
            configKey: 'ipRouting',
            configValue: true,
          },
        });

        const deviceState = { ipRouting: true };
        expect(checkStepCompletion(step, { deviceState: deviceState as unknown as SwitchState })).toBe(true);
      });
    });

    describe('unknown checkType', () => {
      it('should return false', () => {
        const step = createStep({ checkType: 'invalidType' as unknown as GuidedStep['checkType'] });
        expect(checkStepCompletion(step, {})).toBe(false);
      });
    });
  });

  describe('getGuidedProjects', () => {
    it('should return projects with Turkish labels when language is tr', () => {
      const projects = getGuidedProjects('tr');

      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
      projects.forEach(p => {
        expect(p.isGuided).toBe(true);
        expect(Array.isArray(p.steps)).toBe(true);
        expect(typeof p.estimatedTimeMinutes).toBe('number');
        expect(['beginner', 'intermediate', 'advanced']).toContain(p.difficulty);
      });
    });

    it('should return projects with English labels when language is en', () => {
      const projects = getGuidedProjects('en');

      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
    });

    it('should have valid step data', () => {
      const projects = getGuidedProjects('en');

      for (const project of projects) {
        for (const step of project.steps) {
          expect(step.id).toBeDefined();
          expect(typeof step.order).toBe('number');
          expect(step.title).toHaveProperty('tr');
          expect(step.title).toHaveProperty('en');
          expect(step.description).toHaveProperty('tr');
          expect(step.description).toHaveProperty('en');
          expect(step.hint).toHaveProperty('tr');
          expect(step.hint).toHaveProperty('en');
          expect(['deviceAccess', 'command', 'config', 'connection', 'ping', 'manual', 'deviceCount']).toContain(step.checkType);
        }
      }
    });

    it('should have unique step IDs within each project', () => {
      const projects = getGuidedProjects('en');

      for (const project of projects) {
        const ids = project.steps.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });

  describe('static step arrays', () => {
    const stepArrays: Array<{ name: string; steps: GuidedStep[] }> = [
      { name: 'addDeviceGuidedSteps', steps: addDeviceGuidedSteps },
      { name: 'pcCmdGuidedSteps', steps: pcCmdGuidedSteps },
      { name: 'cliBasicsGuidedSteps', steps: cliBasicsGuidedSteps },
      { name: 'basicSwitchGuidedSteps', steps: basicSwitchGuidedSteps },
      { name: 'basicLanGuidedSteps', steps: basicLanGuidedSteps },
      { name: 'vlanGuidedSteps', steps: vlanGuidedSteps },
      { name: 'routerDhcpGuidedSteps', steps: routerDhcpGuidedSteps },
      { name: 'staticRoutingGuidedSteps', steps: staticRoutingGuidedSteps },
      { name: 'portSecurityGuidedSteps', steps: portSecurityGuidedSteps },
      { name: 'ripRoutingGuidedSteps', steps: ripRoutingGuidedSteps },
      { name: 'servicesGuidedSteps', steps: servicesGuidedSteps },
      { name: 'cliGuidedLessons', steps: cliGuidedLessons },
    ];

    stepArrays.forEach(({ name, steps }) => {
      it(`${name} should contain valid steps with sequential order`, () => {
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);

        steps.forEach((step: GuidedStep) => {
          expect(step.id).toBeDefined();
          expect(step.title).toHaveProperty('tr');
          expect(step.title).toHaveProperty('en');
          expect(step.description).toHaveProperty('tr');
          expect(step.description).toHaveProperty('en');
          expect(step.hint).toHaveProperty('tr');
          expect(step.hint).toHaveProperty('en');
          expect(typeof step.completed).toBe('boolean');
        });
      });
    });
  });
});
