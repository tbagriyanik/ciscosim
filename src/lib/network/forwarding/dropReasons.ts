/**
 * dropReasons.ts — Standardized Network Drop Reason Registry
 *
 * Defines canonical drop reason codes, human-readable descriptions,
 * categories (L1, L2, L3, ACL, Security, STP, Control Plane), and
 * helper functions for UI display and event logging.
 */

export type DropCategory = 'L1' | 'L2' | 'L3' | 'ACL' | 'SECURITY' | 'STP' | 'CONTROL_PLANE';

export enum DropReasonCode {
  // L1 Physical
  L1_PORT_SHUTDOWN = 'L1_PORT_SHUTDOWN',
  L1_LINK_DOWN = 'L1_LINK_DOWN',

  // L2 Data Link
  L2_PORT_SECURITY_VIOLATION = 'L2_PORT_SECURITY_VIOLATION',
  L2_STP_BLOCKED = 'L2_STP_BLOCKED',
  L2_VLAN_MISMATCH = 'L2_VLAN_MISMATCH',
  L2_VLAN_NOT_ALLOWED = 'L2_VLAN_NOT_ALLOWED',
  L2_UNKNOWN_MAC_NO_EGRESS = 'L2_UNKNOWN_MAC_NO_EGRESS',

  // L3 Network
  L3_NO_ROUTE = 'L3_NO_ROUTE',
  L3_TTL_EXCEEDED = 'L3_TTL_EXCEEDED',
  L3_ARP_UNRESOLVED = 'L3_ARP_UNRESOLVED',
  L3_MTU_EXCEEDED = 'L3_MTU_EXCEEDED',

  // Security / ACL / Snooping
  ACL_DENY_INGRESS = 'ACL_DENY_INGRESS',
  ACL_DENY_EGRESS = 'ACL_DENY_EGRESS',
  DHCP_SNOOPING_UNTRUSTED_SERVER = 'DHCP_SNOOPING_UNTRUSTED_SERVER',
  DAI_INVALID_ARP = 'DAI_INVALID_ARP',

  // System
  MAX_HOPS_EXCEEDED = 'MAX_HOPS_EXCEEDED',
  ROUTING_LOOP_DETECTED = 'ROUTING_LOOP_DETECTED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
}

export interface DropReasonDetail {
  code: DropReasonCode;
  category: DropCategory;
  title: string;
  description: string;
  suggestedFix?: string;
}

export const DROP_REASON_REGISTRY: Record<DropReasonCode, DropReasonDetail> = {
  [DropReasonCode.L1_PORT_SHUTDOWN]: {
    code: DropReasonCode.L1_PORT_SHUTDOWN,
    category: 'L1',
    title: 'Port Shutdown',
    description: 'Interface is administratively shut down',
    suggestedFix: 'Run "no shutdown" on the interface in CLI',
  },
  [DropReasonCode.L1_LINK_DOWN]: {
    code: DropReasonCode.L1_LINK_DOWN,
    category: 'L1',
    title: 'Link Down',
    description: 'Physical cable is disconnected or link is inactive',
    suggestedFix: 'Check cable connection between devices',
  },
  [DropReasonCode.L2_PORT_SECURITY_VIOLATION]: {
    code: DropReasonCode.L2_PORT_SECURITY_VIOLATION,
    category: 'SECURITY',
    title: 'Port Security Violation',
    description: 'Source MAC address is not allowed on port security configuration',
    suggestedFix: 'Verify allowed MAC addresses or clear port security sticky entries',
  },
  [DropReasonCode.L2_STP_BLOCKED]: {
    code: DropReasonCode.L2_STP_BLOCKED,
    category: 'STP',
    title: 'STP Port Blocked',
    description: 'Spanning Tree Protocol set port to Blocking/Discarding state to prevent loop',
    suggestedFix: 'Check physical loop or adjust STP bridge priorities',
  },
  [DropReasonCode.L2_VLAN_MISMATCH]: {
    code: DropReasonCode.L2_VLAN_MISMATCH,
    category: 'L2',
    title: 'VLAN Mismatch',
    description: 'Frame VLAN does not match ingress port access VLAN or native VLAN',
    suggestedFix: 'Configure matching access VLAN or native VLAN on connected interfaces',
  },
  [DropReasonCode.L2_VLAN_NOT_ALLOWED]: {
    code: DropReasonCode.L2_VLAN_NOT_ALLOWED,
    category: 'L2',
    title: 'VLAN Not Allowed on Trunk',
    description: 'Frame VLAN tag is missing from the switchport trunk allowed VLAN list',
    suggestedFix: 'Add VLAN to trunk: "switchport trunk allowed vlan add <vlan>"',
  },
  [DropReasonCode.L2_UNKNOWN_MAC_NO_EGRESS]: {
    code: DropReasonCode.L2_UNKNOWN_MAC_NO_EGRESS,
    category: 'L2',
    title: 'MAC Lookup Failed',
    description: 'No egress ports available for forwarding frame',
    suggestedFix: 'Ensure target MAC address is reachable and ports are up',
  },
  [DropReasonCode.L3_NO_ROUTE]: {
    code: DropReasonCode.L3_NO_ROUTE,
    category: 'L3',
    title: 'Destination Unreachable (No Route)',
    description: 'No matching entry in routing table for destination IP',
    suggestedFix: 'Add static route or configure dynamic routing (OSPF/EIGRP)',
  },
  [DropReasonCode.L3_TTL_EXCEEDED]: {
    code: DropReasonCode.L3_TTL_EXCEEDED,
    category: 'L3',
    title: 'Time to Live (TTL) Exceeded',
    description: 'Packet TTL reached 0 during transit (ICMP Time Exceeded sent)',
    suggestedFix: 'Check for routing loops between routers',
  },
  [DropReasonCode.L3_ARP_UNRESOLVED]: {
    code: DropReasonCode.L3_ARP_UNRESOLVED,
    category: 'L3',
    title: 'ARP Resolution Failed',
    description: 'Router could not resolve next-hop IP to MAC address via ARP',
    suggestedFix: 'Verify IP configuration and connectivity on target host',
  },
  [DropReasonCode.L3_MTU_EXCEEDED]: {
    code: DropReasonCode.L3_MTU_EXCEEDED,
    category: 'L3',
    title: 'MTU Exceeded',
    description: 'Packet size exceeds interface MTU and Don\'t Fragment (DF) is set',
    suggestedFix: 'Increase interface MTU or allow fragmentation',
  },
  [DropReasonCode.ACL_DENY_INGRESS]: {
    code: DropReasonCode.ACL_DENY_INGRESS,
    category: 'ACL',
    title: 'Inbound ACL Denied',
    description: 'Packet matched implicit or explicit deny rule in inbound access control list',
    suggestedFix: 'Review inbound ACL rules using "show access-lists"',
  },
  [DropReasonCode.ACL_DENY_EGRESS]: {
    code: DropReasonCode.ACL_DENY_EGRESS,
    category: 'ACL',
    title: 'Outbound ACL Denied',
    description: 'Packet matched implicit or explicit deny rule in outbound access control list',
    suggestedFix: 'Review outbound ACL rules using "show access-lists"',
  },
  [DropReasonCode.DHCP_SNOOPING_UNTRUSTED_SERVER]: {
    code: DropReasonCode.DHCP_SNOOPING_UNTRUSTED_SERVER,
    category: 'SECURITY',
    title: 'DHCP Snooping Untrusted Server Packet',
    description: 'DHCP OFFER/ACK packet intercepted on untrusted switch port',
    suggestedFix: 'Mark uplink/server port as trusted: "ip dhcp snooping trust"',
  },
  [DropReasonCode.DAI_INVALID_ARP]: {
    code: DropReasonCode.DAI_INVALID_ARP,
    category: 'SECURITY',
    title: 'Dynamic ARP Inspection Violation',
    description: 'ARP packet payload IP/MAC binding does not match DHCP snooping database',
    suggestedFix: 'Configure static ARP inspection binding or trust port',
  },
  [DropReasonCode.MAX_HOPS_EXCEEDED]: {
    code: DropReasonCode.MAX_HOPS_EXCEEDED,
    category: 'CONTROL_PLANE',
    title: 'Routing Loop / Max Hops Exceeded',
    description: 'Packet exceeded maximum hop count limit in simulation',
    suggestedFix: 'Check routing protocol metrics and static route next-hops for loops',
  },
  [DropReasonCode.ROUTING_LOOP_DETECTED]: {
    code: DropReasonCode.ROUTING_LOOP_DETECTED,
    category: 'CONTROL_PLANE',
    title: 'Routing Loop Detected',
    description: 'Packet revisited the same device/destination while routing, indicating a routing loop',
    suggestedFix: 'Remove conflicting static routes or fix redistribute rules that create circular next-hops',
  },
  [DropReasonCode.DEVICE_NOT_FOUND]: {
    code: DropReasonCode.DEVICE_NOT_FOUND,
    category: 'L1',
    title: 'Device Unavailable',
    description: 'Target device ID was not found in topology state',
    suggestedFix: 'Verify network topology connection links',
  },
};

export function getDropReasonDetail(code: DropReasonCode | string): DropReasonDetail {
  if (code in DROP_REASON_REGISTRY) {
    return DROP_REASON_REGISTRY[code as DropReasonCode];
  }
  return {
    code: DropReasonCode.L3_NO_ROUTE,
    category: 'L3',
    title: 'Packet Dropped',
    description: typeof code === 'string' ? code : 'Packet dropped by network device',
  };
}

export function formatDropReason(code: DropReasonCode | string, details?: string): string {
  const info = getDropReasonDetail(code);
  return details ? `[${info.category}] ${info.title}: ${details}` : `[${info.category}] ${info.title} — ${info.description}`;
}
