import { describe, it, expect, beforeEach } from 'vitest';
import { getDeviceSnmpOids, snmpGet, snmpGetNext, snmpWalk, type SnmpOidEntry } from '../../../../src/lib/network/snmp';
import { SwitchState } from '../../../../src/lib/network/types';

describe('SNMP Engine', () => {
  let mockState: SwitchState;
  let deviceStates: Map<string, SwitchState>;

  beforeEach(() => {
    mockState = {
      hostname: 'Switch1',
      macAddress: '00:11:22:33:44:55',
      switchModel: { id: 'test-model', layer: 'L2', ports: 24, type: 'switchL2' } as unknown as SwitchState['switchModel'],
      switchLayer: 'L2',
      currentMode: 'user',
      ports: {
        'fa0/1': { id: 'fa0/1', status: 'connected', operStatus: 'up' } as unknown as SwitchState['ports'][string],
        'fa0/2': { id: 'fa0/2', status: 'notconnect', operStatus: 'down' } as unknown as SwitchState['ports'][string]
      },
      vlans: {},
      security: { enableSecretEncrypted: false, servicePasswordEncryption: false, users: [], consoleLine: {} as unknown as SwitchState['security']['consoleLine'], vtyLines: {} as unknown as SwitchState['security']['vtyLines'] },
      runningConfig: [],
      commandHistory: [],
      historyIndex: 0,
      version: { nosVersion: '15.2', modelName: 'Switch 2960', serialNumber: '123456', uptime: '10' },
      macAddressTable: [],
      arpCache: [],
      bootTime: Date.now() - 100000,
      ipRouting: false,
      snmpCommunities: {
        'public': 'RO',
        'private': 'RW'
      },
      snmpContact: 'admin@test.com',
      snmpLocation: 'Datacenter 1'
    } as unknown as SwitchState;
    deviceStates = new Map([['device1', mockState]]);
  });

  it('retrieves basic OIDs', () => {
    const oids = getDeviceSnmpOids('device1', deviceStates);

    const sysDescr = oids.find((o: SnmpOidEntry) => o.oid === '.1.3.6.1.2.1.1.1.0');
    expect(sysDescr).toBeDefined();
    expect(sysDescr?.value).toContain('Switch 2960');

    const sysName = oids.find((o: SnmpOidEntry) => o.oid === '.1.3.6.1.2.1.1.5.0');
    expect(sysName?.value).toBe('Switch1');

    const ifNumber = oids.find((o: SnmpOidEntry) => o.oid === '.1.3.6.1.2.1.2.1.0');
    expect(ifNumber?.value).toBe(2);

    const ifOperStatus1 = oids.find((o: SnmpOidEntry) => o.oid === '.1.3.6.1.2.1.2.2.1.8.1');
    expect(ifOperStatus1?.value).toBe(1); // up

    const ifOperStatus2 = oids.find((o: SnmpOidEntry) => o.oid === '.1.3.6.1.2.1.2.2.1.8.2');
    expect(ifOperStatus2?.value).toBe(2); // down
  });

  it('performs SNMP GET with community access control', () => {
    const sysNameOid = '.1.3.6.1.2.1.1.5.0';

    // Valid community
    const result = snmpGet('device1', sysNameOid, 'public', deviceStates);
    expect(result).toBeDefined();
    expect(result?.value).toBe('Switch1');

    // Invalid community
    const invalidResult = snmpGet('device1', sysNameOid, 'wrong', deviceStates);
    expect(invalidResult).toBeNull();
  });

  it('performs SNMP WALK', () => {
    // Walk over interfaces table
    const results = snmpWalk('device1', '.1.3.6.1.2.1.2.2.1.2', 'public', deviceStates);
    expect(results.length).toBe(2);
    expect(results[0].oid).toBe('.1.3.6.1.2.1.2.2.1.2.1');
    expect(results[0].value).toBe('fa0/1');
    expect(results[1].oid).toBe('.1.3.6.1.2.1.2.2.1.2.2');
    expect(results[1].value).toBe('fa0/2');
  });

  it('performs SNMP GETNEXT', () => {
    // Next OID after sysDescr
    const result = snmpGetNext('device1', '.1.3.6.1.2.1.1.1.0', 'public', deviceStates);
    expect(result).toBeDefined();
    expect(result?.oid).toBe('.1.3.6.1.2.1.1.3.0'); // sysUpTime is logically next here based on provided OIDs
  });
});
