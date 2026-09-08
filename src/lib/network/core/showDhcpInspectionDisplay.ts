import type { CommandContext } from './commandTypes';
import type { SwitchState, CommandResult, DhcpSnoopingBinding } from '../types';

function getDhcpSnoopingBindingsList(state: SwitchState): DhcpSnoopingBinding[] {
  const map = new Map<string, DhcpSnoopingBinding>();

  (state.dhcpSnoopingBindings || []).forEach(b => {
    const key = (b.macAddress || b.ipAddress || Math.random().toString()).toLowerCase();
    map.set(key, b);
  });

  Object.keys(state.ports || {}).forEach(portName => {
    const pLower = portName.toLowerCase();
    if (pLower.startsWith('console') || pLower.startsWith('line') || pLower.startsWith('aux') || pLower.startsWith('vty')) return;
    const port = state.ports[portName];
    if (port && port.ipAddress && port.macAddress) {
      const key = port.macAddress.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          macAddress: port.macAddress,
          ipAddress: port.ipAddress,
          leaseTime: 86400,
          type: 'dynamic',
          vlan: port.vlan || 1,
          portId: portName
        });
      }
    }
  });

  return Array.from(map.values());
}

export function cmdShowIpDhcpSnooping(state: SwitchState, input: string, _ctx: CommandContext): CommandResult {
  const enabled = state.dhcpSnoopingEnabled ?? false;
  const vlans: string[] = state.dhcpSnoopingVlans ?? [];
  const bindings = getDhcpSnoopingBindingsList(state);

  // Subcommand: show ip dhcp snooping binding
  if (/\bbinding\b/i.test(input)) {
    let output = '\nMacAddress          IpAddress        Lease(sec)  Type    VLAN  Interface\n';
    output += '------------------- ---------------- ----------- ------- ----- ---------------\n';
    if (bindings.length === 0) {
      output += 'Total number of bindings: 0\n';
    } else {
      bindings.forEach(b => {
        const mac = (b.macAddress || '').padEnd(19);
        const ip = (b.ipAddress || '').padEnd(16);
        const lease = (b.leaseTime !== undefined ? String(b.leaseTime) : '86400').padEnd(11);
        const type = (b.type || 'dynamic').padEnd(7);
        const vlan = String(b.vlan ?? '1').padEnd(5);
        const port = b.portId || '-';
        output += `${mac}${ip}${lease}${type}${vlan}${port}\n`;
      });
      output += `Total number of bindings: ${bindings.length}\n`;
    }
    output += '!\n';
    return { success: true, output };
  }

  let output = '\nDHCP snooping is ' + (enabled ? 'enabled' : 'disabled') + '\n';
  output += 'DHCP snooping is configured on following VLANs:\n';
  output += vlans.length > 0 ? vlans.join(',') + '\n' : 'none\n';
  const dhcpSnoopingInfo = state.dhcpSnooping as { informationOption?: boolean } | undefined;
  const infoOpt = state.dhcpOption82 !== undefined ? state.dhcpOption82 : (dhcpSnoopingInfo?.informationOption !== false);
  output += '\nInsertion of option 82 is ' + (infoOpt ? 'enabled' : 'disabled') + '\n';
  output += '\nInterface           Trusted   Rate limit (pps)\n';
  output += '------------------ -------- -----------------\n';

  Object.keys(state.ports || {}).forEach(portName => {
    const pLower = portName.toLowerCase();
    if (pLower.startsWith('console') || pLower.startsWith('line') || pLower.startsWith('aux') || pLower.startsWith('vty')) return;
    const port = state.ports[portName];
    const trusted = port?.dhcpSnoopingTrust ? 'yes' : 'no';
    const rateLimit = port?.dhcpSnoopingLimitRate !== undefined ? String(port.dhcpSnoopingLimitRate) : 'unlimited';
    output += `${portName.padEnd(18)}${trusted.padEnd(9)}${rateLimit}\n`;
  });

  output += `\nNumber of DHCP snooping bindings: ${bindings.length}\n`;
  output += '!\n';
  return { success: true, output };
}

export function cmdShowIpArpInspection(_state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  return { success: true, output: '\nSource Mac Validation      : Disabled\nDestination Mac Validation : Disabled\nIP Address Validation      : Disabled\n\n Vlan     Configuration    Operation   ACL Match          Static ACL\n------   -------------    ---------   ---------          ----------\n' };
}

export function cmdShowIpDhcpPool(state: SwitchState, _input: string, _ctx: CommandContext): CommandResult {
  const pools = state.dhcpPools || {};
  const poolNames = Object.keys(pools);
  if (poolNames.length === 0) {
    return { success: true, output: '\n% No DHCP pools configured\n' };
  }
  let output = '\n';
  poolNames.forEach(name => {
    const p = pools[name];
    output += `Pool ${name} :\n`;
    output += ` Utilization mark (high/low)    : 100 / 0\n`;
    output += ` Subnet size (first/next)        : 0 / 0\n`;
    output += ` Total addresses                 : 254\n`;
    output += ` Leased addresses                : 0\n`;
    if (p.network && p.subnetMask) {
      output += ` Subnet                          : ${p.network}/${p.subnetMask}\n`;
    }
  });
  return { success: true, output };
}
