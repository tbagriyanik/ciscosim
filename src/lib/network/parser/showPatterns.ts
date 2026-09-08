// Show komutlari
import type { CommandPattern } from './commandPatterns.types';

export const showPatterns: Record<string, CommandPattern> = {
  // Show komutları
  'show': {
    pattern: /^show\s*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show running-config': {
    pattern: /^show(\s+running-config|\s+run|\s+running)(?:\s+interface\s+(\S+))?(\s+\|\s+(include|section|begin|exclude)\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 5
  },
  'show startup-config': {
    pattern: /^show\s+startup-config$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show network health': {
    pattern: /^show\s+(network\s+health|health)$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show interfaces status': {
    pattern: /^show\s+interfaces?\s+status$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show interface trunk': {
    pattern: /^show\s+interface\s+trunk$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show interfaces trunk': {
    pattern: /^show\s+interfaces?\s+trunk$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show interfaces': {
    pattern: /^show(\s+interfaces?|\s+int)(\s+(status|description|counter|\S+))?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show interface': {
    pattern: /^show\s+interface\s+(.+)$/i,
    modes: ['user', 'privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'show vlan brief': {
    pattern: /^show(\s+vlan|\s+vl)\s*(brief|br)?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show vlan': {
    pattern: /^show\s+vlan(\s+(id|name)\s+(.+))?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 3
  },
  'show version': {
    pattern: /^show(\s+version|\s+ver)$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show logging': {
    pattern: /^show\s+logging$/i,
    modes: ['user', 'privileged', 'config'],
    minArgs: 0,
    maxArgs: 0
  },
  'show mac address-table': {
    pattern: /^show\s+mac(?:\s*(?:address-table|address|addr))?(\s+(.+)?)?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show cdp neighbors': {
    pattern: /^show\s+cdp\s+(neighbors?|nei|ne)(\s+(detail|det))?$/i,
    modes: ['user', 'privileged', 'config', 'interface', 'config-if-range', 'line', 'vlan', 'dhcp-config', 'router-config'],
    minArgs: 0,
    maxArgs: 2
  },
  'show cdp': {
    pattern: /^show\s+cdp(\s+(interface|interfaces|entry)\s*(.+)?)?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ip interface brief': {
    pattern: /^show\s+ip\s+(?:int(?:erfaces?)?)\s+(brief|br)$/i,
    modes: ['user', 'privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'show ip interface': {
    pattern: /^show\s+ip\s+interface(?:\s+(\S+))?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip route': {
    pattern: /^show\s+ip\s+route(?:\s+(ospf|rip|static|connected))?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip sla statistics': {
    pattern: /^show\s+ip\s+sla\s+statistics$/i,
    modes: ['user', 'privileged'], minArgs: 0, maxArgs: 0
  },
  'show ipv6 interface brief': {
    pattern: /^show\s+ipv6\s+interface\s+brief$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ipv6 neighbors': {
    pattern: /^show\s+ipv6\s+neighbor(s)?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show spanning-tree': {
    pattern: /^show\s+spanning-tree(\s+(vlan|interface|detail|summary)\s*(.+)?)?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show port-security': {
    pattern: /^show\s+port-security(\s+(interface)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ssh': {
    pattern: /^show\s+ssh(\s+(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip ssh': {
    pattern: /^show\s+ip\s+ssh$/i,
    modes: ['privileged'],
    minArgs: 2,
    maxArgs: 2
  },
  'show etherchannel': {
    pattern: /^show\s+etherchannel(\s+(summary|detail|port|load-balance)\s*(.+)?)?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show vtp status': {
    pattern: /^show\s+vtp\s+(status|password|counters)$/i,
    modes: ['privileged'],
    minArgs: 1,
    maxArgs: 1
  },
  'show errdisable recovery': {
    pattern: /^show\s+errdisable\s+recovery$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show errdisable detect': {
    pattern: /^show\s+errdisable\s+detect$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show mac address-table static': {
    pattern: /^show\s+mac\s+address-table\s+static$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show authentication': {
    pattern: /^show\s+authentication(\s+(sessions|status)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show clock': {
    pattern: /^show\s+clock(\s+detail)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show flash': {
    pattern: /^show\s+flash(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show boot': {
    pattern: /^show\s+boot$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show environment': {
    pattern: /^show\s+environment(\s+(all|power|temperature|fan))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show inventory': {
    pattern: /^show\s+inventory(\s+(raw))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show users': {
    pattern: /^show\s+users(\s+(wide))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show sessions': {
    pattern: /^show\s+sessions?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show processes': {
    pattern: /^show\s+processes(\s+(cpu|memory))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show memory': {
    pattern: /^show\s+memory(\s+(statistics|summary))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show wireless': {
    pattern: /^show\s+wireless$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show wlan summary': {
    pattern: /^show\s+wlan\s+summary$/i,
    modes: ['privileged'],
    minArgs: 2,
    maxArgs: 2
  },
  'show ap summary': {
    pattern: /^show\s+ap\s+summary$/i,
    modes: ['privileged'],
    minArgs: 2,
    maxArgs: 2
  },
  'show debugging': {
    pattern: /^show\s+debugging$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ntp associations': {
    pattern: /^show\s+ntp\s+associations(\s+(detail))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ntp status': {
    pattern: /^show\s+ntp\s+status$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ntp': {
    pattern: /^show\s+ntp(\s+(associations|status|source))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show snmp': {
    pattern: /^show\s+snmp(\s+(community|contact|location|host|user|group))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show arp': {
    pattern: /^show\s+arp(\s+(.+))?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip arp': {
    pattern: /^show\s+ip\s+arp(\s+(.+))?$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip dhcp snooping': {
    pattern: /^show\s+ip\s+dhcp\s+snooping(\s+(binding|database|statistics))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip source binding': {
    pattern: /^show\s+ip\s+source\s+binding(\s+(vlan\s+\d+|interface\s+\S+|\S+))?\s*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ip verify source': {
    pattern: /^show\s+ip\s+verify\s+source(\s+(interface\s+\S+|\S+))?\s*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ip dhcp pool': {
    pattern: /^show\s+ip\s+dhcp\s+pool(\s+(\S+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip dhcp binding': {
    pattern: /^show\s+ip\s+dhcp\s+binding(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show ip arp inspection': {
    pattern: /^show\s+ip\s+arp\s+inspection(\s+(vlan|interface|statistics)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show monitor': {
    pattern: /^show\s+monitor(\s+(session)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show policy-map interface': {
    pattern: /^show\s+policy-map\s+interface(?:\s+(\S+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show policy-map': {
    pattern: /^show\s+policy-map(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show class-map': {
    pattern: /^show\s+class-map(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show access-lists': {
    pattern: /^show\s+access-lists?(\s+(\S+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show mac access-lists': {
    pattern: /^show\s+mac\s+access-lists?(\s+(\S+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show system mtu': {
    pattern: /^show\s+system\s+mtu$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show sdm prefer': {
    pattern: /^show\s+sdm\s+prefer$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show controllers': {
    pattern: /^show\s+controllers(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show diagnostic': {
    pattern: /^show\s+diagnostic(\s+(result|content|status|schedule)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show udld': {
    pattern: /^show\s+udld(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show lldp': {
    pattern: /^show\s+lldp(\s+(neighbors|entry|interface|traffic)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show mls qos': {
    pattern: /^show\s+mls\s+qos(\s+(interface|maps|queueing)\s*(.+)?)?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show storm-control': {
    pattern: /^show\s+storm-control(\s+(.+))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show banner motd': {
    pattern: /^show\s+banner\s+motd$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show alias': {
    pattern: /^show\s+alias$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show history': {
    pattern: /^show\s+history$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show redundancy': {
    pattern: /^show\s+redundancy(\s+(states|clients|history))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 1
  },
  'show archive': {
    pattern: /^show\s+archive(\s+(config\s+differences|status))?$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show privilege': {
    pattern: /^show\s+(privilege|privileges)$/i,
    modes: ['user', 'privileged'],
    minArgs: 0,
    maxArgs: 0
  },
  'show ip prefix-list': {
    pattern: /^show\s+ip\s+prefix-list.*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ipv6 prefix-list': {
    pattern: /^show\s+ipv6\s+prefix-list.*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show route-map': {
    pattern: /^show\s+route-map.*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ipv6 eigrp neighbors': {
    pattern: /^show\s+ipv6\s+eigrp\s+(neighbors|topology)$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show glbp': {
    pattern: /^show\s+glbp.*$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ip flow export': {
    pattern: /^show\s+ip\s+flow\s+export$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
  'show ip cache flow': {
    pattern: /^show\s+ip\s+cache\s+flow$/i,
    modes: ['privileged'],
    minArgs: 0,
    maxArgs: 2
  },
};
