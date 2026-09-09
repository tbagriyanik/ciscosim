import type { SwitchState } from '@/lib/network/types';

export type PacketProtocolType =
  | 'ARP'
  | 'DHCP'
  | 'DHCPV6'
  | 'STP'
  | 'OSPF'
  | 'EIGRP'
  | 'ICMP'
  | 'IP_SLA'
  | 'CDP'
  | 'LLDP'
  | 'PPPOE'
  | 'IPV4'
  | 'IPV6';

export interface ArpPayload {
  operation: 'request' | 'reply';
  senderIp: string;
  senderMac: string;
  targetIp: string;
  targetMac?: string;
}

export interface DhcpPayload {
  messageType: 'discover' | 'offer' | 'request' | 'ack' | 'release';
  clientMac: string;
  offeredIp?: string;
  subnetMask?: string;
  gateway?: string;
  dns?: string;
  leaseTime?: number;
  option82?: { agentCircuitId?: string; agentRemoteId?: string };
}

export interface StpPayload {
  protocolVersion: 'stp' | 'rstp' | 'mstp';
  rootId: string;
  rootPathCost: number;
  bridgeId: string;
  portId: string;
  messageAge: number;
  maxAge: number;
  helloTime: number;
  forwardDelay: number;
}

export interface OspfPayload {
  packetType: 'hello' | 'dbdesc' | 'lsreq' | 'lsupd' | 'lsack';
  routerId: string;
  areaId: string;
  neighbors?: string[];
  lsas?: Array<{ id: string; advRouter: string; type: string; sequence: number }>;
}

export interface EigrpPayload {
  opcode: 'hello' | 'update' | 'query' | 'reply' | 'ack';
  asNumber: number;
  kValues?: [number, number, number, number, number];
  bandwidth?: number;
  delay?: number;
  mtu?: number;
  reliability?: number;
  load?: number;
  routes?: Array<{ prefix: string; mask: string; nexthop: string; delay: number; bandwidth: number }>;
}

export interface IpSlaPayload {
  operationId: string;
  probeType: 'icmp-echo' | 'jitter';
  sequenceNumber: number;
  timestamp: number;
}

export interface NetworkPacketFrame {
  id: string;
  protocol: PacketProtocolType;
  timestamp: number;

  // Layer 1 Physical
  ingressDeviceId?: string;
  ingressPortId?: string;
  egressDeviceId?: string;
  egressPortId?: string;
  cableType?: string;

  // Layer 2 Ethernet Frame
  srcMac: string;
  dstMac: string;
  etherType: string;
  vlanId?: number;
  priority?: number;

  // Layer 3 IP Packet
  srcIp?: string;
  dstIp?: string;
  ttl?: number;
  ipProtocol?: number;

  // Layer 4 / Control Payloads
  arpPayload?: ArpPayload;
  dhcpPayload?: DhcpPayload;
  stpPayload?: StpPayload;
  ospfPayload?: OspfPayload;
  eigrpPayload?: EigrpPayload;
  ipSlaPayload?: IpSlaPayload;

  // Raw length & description info
  length: number;
  info: string;
}

export interface ProtocolNeighborChangeEvent {
  deviceId: string;
  protocol: 'OSPF' | 'EIGRP';
  neighbor: string;
  interfaceId: string;
  oldState: string;
  newState: string;
  asNumber?: number;
  level: 'info' | 'warning';
  message: string;
}

export interface AgingChangeEvent {
  deviceId: string;
  category: 'ARP' | 'MAC';
  level: 'info' | 'warning';
  message: string;
  detail?: string;
}

export interface PipelineExecutionResult {
  updatedStates: Map<string, SwitchState>;
  dispatchedPackets: Array<{
    connectionId: string;
    sourceIp: string;
    targetIp: string;
    protocol: string;
    length: number;
    info: string;
  }>;
  processedFrames: NetworkPacketFrame[];
  protocolEvents?: ProtocolNeighborChangeEvent[];
  agingEvents?: AgingChangeEvent[];
}

