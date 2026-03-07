'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SwitchState } from '@/lib/cisco/types';
import { Translations } from '@/contexts/LanguageContext';

interface TerminalProps {
  deviceId?: string;
  deviceName?: string;
  prompt: string;
  state: SwitchState;
  onCommand: (command: string) => Promise<void>;
  onClear?: () => void;
  output: TerminalOutput[];
  isLoading?: boolean;
  t: Translations;
  theme: string;
  language: 'tr' | 'en';
}

export interface TerminalOutput {
  id: string;
  type: 'command' | 'output' | 'error' | 'password-prompt' | 'help';
  content: string;
  prompt?: string;
}

const MAX_OUTPUT_LINES = 100;
const MAX_SUGGESTIONS = 5;
const MAX_HISTORY_BUTTONS = 8;

// Cisco tarzı komut ağacı - her mod için
const commandHelp: Record<string, Record<string, string[]>> = {
  user: {
    '': ['enable', 'exit', 'show', '?'],
    'e': ['enable', 'exit'],
    'en': ['enable'],
    'ex': ['exit'],
    's': ['show'],
    'sh': ['show'],
    'sho': ['show'],
    'show': ['version'],
  },
  privileged: {
    '': ['configure', 'disable', 'show', 'write', 'ping', 'telnet', 'reload', 'exit', '?'],
    'c': ['configure', 'clear'],
    'co': ['configure', 'copy'],
    'con': ['configure'],
    'conf': ['configure'],
    'confi': ['configure'],
    'config': ['configure'],
    'configu': ['configure'],
    'configur': ['configure'],
    'configure': ['terminal'],
    'configure t': ['terminal'],
    'configure te': ['terminal'],
    'configure ter': ['terminal'],
    'configure term': ['terminal'],
    'configure termi': ['terminal'],
    'configure termin': ['terminal'],
    'configure termina': ['terminal'],
    
    'd': ['disable'],
    'di': ['disable'],
    'dis': ['disable'],
    'disa': ['disable'],
    'disab': ['disable'],
    'disabl': ['disable'],
    
    's': ['show'],
    'sh': ['show'],
    'sho': ['show'],
    'show': ['running-config', 'interfaces', 'vlan', 'version', 'mac', 'cdp', 'ip', 'spanning-tree', 'port-security'],
    'show r': ['running-config'],
    'show ru': ['running-config'],
    'show run': ['running-config'],
    'show i': ['interfaces', 'ip'],
    'show in': ['interfaces'],
    'show int': ['interfaces'],
    'show inte': ['interfaces'],
    'show inter': ['interfaces'],
    'show interf': ['interfaces'],
    'show interfa': ['interfaces'],
    'show interfac': ['interfaces'],
    'show interface': ['interfaces'],
    'show v': ['vlan', 'version'],
    'show vl': ['vlan'],
    'show vla': ['vlan'],
    'show vlan': ['brief'],
    'show vlan b': ['brief'],
    'show vlan br': ['brief'],
    'show vlan bre': ['brief'],
    'show m': ['mac'],
    'show ma': ['mac'],
    'show mac': ['address-table'],
    'show mac a': ['address-table'],
    'show mac ad': ['address-table'],
    'show mac addr': ['address-table'],
    'show mac addre': ['address-table'],
    'show mac addres': ['address-table'],
    'show mac address': ['address-table'],
    'show mac address-': ['address-table'],
    'show mac address-t': ['address-table'],
    'show mac address-ta': ['address-table'],
    'show mac address-tab': ['address-table'],
    'show mac address-tabl': ['address-table'],
    'show c': ['cdp', 'clock'],
    'show cd': ['cdp'],
    'show cdp': ['neighbors'],
    'show cdp n': ['neighbors'],
    'show cdp ne': ['neighbors'],
    'show cdp nei': ['neighbors'],
    'show cdp neig': ['neighbors'],
    'show cdp neigh': ['neighbors'],
    'show cdp neigho': ['neighbors'],
    'show cdp neighb': ['neighbors'],
    'show cdp neighbor': ['neighbors'],
    'show ip': ['interface'],
    'show ip i': ['interface'],
    'show ip in': ['interface'],
    'show ip int': ['interface'],
    'show ip inte': ['interface'],
    'show ip inter': ['interface'],
    'show ip interf': ['interface'],
    'show ip interfa': ['interface'],
    'show ip interfac': ['interface'],
    'show ip interface': ['brief'],
    'show ip interface b': ['brief'],
    'show ip interface br': ['brief'],
    'show ip interface bre': ['brief'],
    'show spanning': ['tree'],
    'show spanning-': ['tree'],
    'show spanning-t': ['tree'],
    'show spanning-tr': ['tree'],
    'show spanning-tre': ['tree'],
    'show port': ['security'],
    'show port-': ['security'],
    'show port-s': ['security'],
    'show port-se': ['security'],
    'show port-sec': ['security'],
    'show port-secu': ['security'],
    'show port-secur': ['security'],
    'show port-securi': ['security'],
    'show port-securit': ['security'],
    
    'w': ['write'],
    'wr': ['write'],
    'wri': ['write'],
    'writ': ['write'],
    'write': ['memory'],
    'write m': ['memory'],
    'write me': ['memory'],
    'write mem': ['memory'],
    'write memo': ['memory'],
    'write memor': ['memory'],
    
    'p': ['ping'],
    'pi': ['ping'],
    'pin': ['ping'],
    
    't': ['telnet', 'traceroute'],
    'te': ['telnet'],
    'tel': ['telnet'],
    'teln': ['telnet'],
    'telne': ['telnet'],
    
    'r': ['reload'],
    're': ['reload'],
    'rel': ['reload'],
    'relo': ['reload'],
    'reloa': ['reload'],
    
    'e': ['exit'],
    'ex': ['exit'],
    
    'copy': ['running-config', 'startup-config'],
    'copy r': ['running-config'],
    'copy ru': ['running-config'],
    'copy run': ['running-config'],
    'copy runn': ['running-config'],
    'copy runni': ['running-config'],
    'copy runnin': ['running-config'],
    'copy running': ['running-config'],
    'copy running-': ['running-config'],
    'copy running-c': ['running-config'],
    'copy running-co': ['running-config'],
    'copy running-con': ['running-config'],
    'copy running-conf': ['running-config'],
    'copy running-confi': ['running-config'],
    'copy running-config': ['startup-config'],
    'copy running-config s': ['startup-config'],
    'copy running-config st': ['startup-config'],
    'copy running-config sta': ['startup-config'],
    'copy running-config star': ['startup-config'],
    'copy running-config start': ['startup-config'],
    'copy running-config startu': ['startup-config'],
    'copy running-config startup': ['startup-config'],
    'copy running-config startup-': ['startup-config'],
    'copy running-config startup-c': ['startup-config'],
    'copy running-config startup-co': ['startup-config'],
    'copy running-config startup-con': ['startup-config'],
    'copy running-config startup-conf': ['startup-config'],
    'copy running-config startup-confi': ['startup-config'],
    'copy running-config startup-config': [''],
    
    'erase': ['startup-config', 'nvram'],
    'erase s': ['startup-config'],
    'erase st': ['startup-config'],
    'erase sta': ['startup-config'],
    'erase star': ['startup-config'],
    'erase start': ['startup-config'],
    'erase startu': ['startup-config'],
    'erase startup': ['startup-config'],
    'erase startup-': ['startup-config'],
    'erase startup-c': ['startup-config'],
    'erase startup-co': ['startup-config'],
    'erase startup-con': ['startup-config'],
    'erase startup-conf': ['startup-config'],
    'erase startup-confi': ['startup-config'],
    'erase startup-config': [''],
    'erase n': ['nvram'],
    'erase nv': ['nvram'],
    'erase nvr': ['nvram'],
    'erase nvra': ['nvram'],
  },
  config: {
    '': ['hostname', 'interface', 'vlan', 'enable', 'service', 'username', 'line', 'banner', 'ip', 'no', 'spanning-tree', 'vtp', 'cdp', 'exit', 'end', 'do', '?'],
    'h': ['hostname'],
    'ho': ['hostname'],
    'hos': ['hostname'],
    'host': ['hostname'],
    'hostn': ['hostname'],
    'hostna': ['hostname'],
    'hostnam': ['hostname'],
    
    'i': ['interface', 'ip'],
    'in': ['interface'],
    'int': ['interface'],
    'inte': ['interface'],
    'inter': ['interface'],
    'interf': ['interface'],
    'interfa': ['interface'],
    'interfac': ['interface'],
    'interface': ['FastEthernet', 'GigabitEthernet', 'range'],
    'interface F': ['FastEthernet'],
    'interface Fa': ['FastEthernet'],
    'interface Fas': ['FastEthernet'],
    'interface Fast': ['FastEthernet'],
    'interface FastE': ['FastEthernet'],
    'interface FastEt': ['FastEthernet'],
    'interface FastEth': ['FastEthernet'],
    'interface FastEthe': ['FastEthernet'],
    'interface FastEther': ['FastEthernet'],
    'interface FastEthern': ['FastEthernet'],
    'interface FastEtherne': ['FastEthernet'],
    'interface FastEthernet': ['0/'],
    'interface FastEthernet0': ['0/'],
    'interface FastEthernet0/': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
    'interface G': ['GigabitEthernet'],
    'interface Gi': ['GigabitEthernet'],
    'interface Gig': ['GigabitEthernet'],
    'interface Giga': ['GigabitEthernet'],
    'interface Gigab': ['GigabitEthernet'],
    'interface Gigabi': ['GigabitEthernet'],
    'interface Gigabit': ['GigabitEthernet'],
    'interface GigabitE': ['GigabitEthernet'],
    'interface GigabitEt': ['GigabitEthernet'],
    'interface GigabitEth': ['GigabitEthernet'],
    'interface GigabitEthe': ['GigabitEthernet'],
    'interface GigabitEther': ['GigabitEthernet'],
    'interface GigabitEthern': ['GigabitEthernet'],
    'interface GigabitEtherne': ['GigabitEthernet'],
    'interface GigabitEthernet': ['0/'],
    'interface GigabitEthernet0': ['0/'],
    'interface GigabitEthernet0/': ['1', '2'],
    'interface r': ['range'],
    'interface ra': ['range'],
    'interface ran': ['range'],
    'interface rang': ['range'],
    'interface range': ['FastEthernet', 'GigabitEthernet'],
    'interface range F': ['FastEthernet'],
    'interface range Fa': ['FastEthernet'],
    'interface range Fas': ['FastEthernet'],
    'interface range Fast': ['FastEthernet'],
    'interface range FastE': ['FastEthernet'],
    'interface range FastEt': ['FastEthernet'],
    'interface range FastEth': ['FastEthernet'],
    'interface range FastEthe': ['FastEthernet'],
    'interface range FastEther': ['FastEthernet'],
    'interface range FastEthern': ['FastEthernet'],
    'interface range FastEtherne': ['FastEthernet'],
    'interface range FastEthernet': ['0/'],
    'interface range FastEthernet0': ['0/'],
    'interface range FastEthernet0/': ['1-24', '1-12', '1-6', '0-20'],
    'interface range G': ['GigabitEthernet'],
    'interface range Gi': ['GigabitEthernet'],
    'interface range Gig': ['GigabitEthernet'],
    'interface range Giga': ['GigabitEthernet'],
    'interface range Gigab': ['GigabitEthernet'],
    'interface range Gigabi': ['GigabitEthernet'],
    'interface range Gigabit': ['GigabitEthernet'],
    'interface range GigabitE': ['GigabitEthernet'],
    'interface range GigabitEt': ['GigabitEthernet'],
    'interface range GigabitEth': ['GigabitEthernet'],
    'interface range GigabitEthe': ['GigabitEthernet'],
    'interface range GigabitEther': ['GigabitEthernet'],
    'interface range GigabitEthern': ['GigabitEthernet'],
    'interface range GigabitEtherne': ['GigabitEthernet'],
    'interface range GigabitEthernet': ['0/'],
    'interface range GigabitEthernet0': ['0/'],
    'interface range GigabitEthernet0/': ['1-2'],
    
    'v': ['vlan'],
    'vl': ['vlan'],
    'vla': ['vlan'],
    'vlan': ['1', '10', '20', '30', '50', '100', '200'],
    
    'e': ['enable', 'end', 'exit'],
    'en': ['enable', 'end'],
    'ena': ['enable'],
    'enab': ['enable'],
    'enabl': ['enable'],
    'enable': ['secret', 'password'],
    'enable s': ['secret'],
    'enable se': ['secret'],
    'enable sec': ['secret'],
    'enable secr': ['secret'],
    'enable secre': ['secret'],
    'enable p': ['password'],
    'enable pa': ['password'],
    'enable pas': ['password'],
    'enable pass': ['password'],
    'enable passw': ['password'],
    'enable passwo': ['password'],
    'enable passwor': ['password'],
    
    'se': ['service'],
    'ser': ['service'],
    'serv': ['service'],
    'servi': ['service'],
    'servic': ['service'],
    'service': ['password-encryption'],
    'service p': ['password-encryption'],
    'service pa': ['password-encryption'],
    'service pas': ['password-encryption'],
    'service pass': ['password-encryption'],
    'service passw': ['password-encryption'],
    'service passwo': ['password-encryption'],
    'service passwor': ['password-encryption'],
    'service password': ['password-encryption'],
    'service password-': ['password-encryption'],
    'service password-e': ['password-encryption'],
    'service password-en': ['password-encryption'],
    'service password-enc': ['password-encryption'],
    'service password-encr': ['password-encryption'],
    'service password-encry': ['password-encryption'],
    'service password-encryp': ['password-encryption'],
    'service password-encrypt': ['password-encryption'],
    'service password-encrypti': ['password-encryption'],
    'service password-encryptio': ['password-encryption'],
    
    'u': ['username'],
    'us': ['username'],
    'use': ['username'],
    'user': ['username'],
    'usern': ['username'],
    'userna': ['username'],
    'usernam': ['username'],
    
    'l': ['line'],
    'li': ['line'],
    'lin': ['line'],
    'line': ['console', 'vty'],
    'line c': ['console'],
    'line co': ['console'],
    'line con': ['console'],
    'line cons': ['console'],
    'line conso': ['console'],
    'line consol': ['console'],
    'line console': ['0'],
    'line console 0': [''],
    'line v': ['vty'],
    'line vt': ['vty'],
    'line vty': ['0'],
    'line vty 0': ['4'],
    'line vty 0 4': [''],
    
    'b': ['banner'],
    'ba': ['banner'],
    'ban': ['banner'],
    'bann': ['banner'],
    'banne': ['banner'],
    'banner': ['motd', 'login'],
    'banner m': ['motd'],
    'banner mo': ['motd'],
    'banner mot': ['motd'],
    'banner motd': [''],
    
    'ip': ['default-gateway', 'domain-name', 'ssh'],
    'ip d': ['default-gateway', 'domain-name'],
    'ip de': ['default-gateway'],
    'ip def': ['default-gateway'],
    'ip defa': ['default-gateway'],
    'ip defau': ['default-gateway'],
    'ip defaul': ['default-gateway'],
    'ip default': ['default-gateway'],
    'ip default-': ['default-gateway'],
    'ip default-g': ['default-gateway'],
    'ip default-ga': ['default-gateway'],
    'ip default-gat': ['default-gateway'],
    'ip default-gate': ['default-gateway'],
    'ip default-gatew': ['default-gateway'],
    'ip default-gatewa': ['default-gateway'],
    'ip do': ['domain-name'],
    'ip dom': ['domain-name'],
    'ip doma': ['domain-name'],
    'ip domain': ['domain-name'],
    'ip domain-': ['domain-name'],
    'ip domain-n': ['domain-name'],
    'ip domain-na': ['domain-name'],
    'ip domain-nam': ['domain-name'],
    'ip ssh': ['version'],
    'ip ssh v': ['version'],
    'ip ssh ve': ['version'],
    'ip ssh ver': ['version'],
    'ip ssh vers': ['version'],
    'ip ssh versi': ['version'],
    'ip ssh versio': ['version'],
    
    'n': ['no'],
    'no': ['shutdown', 'vlan', 'cdp', 'service', 'spanning-tree'],
    
    'sp': ['spanning-tree'],
    'spa': ['spanning-tree'],
    'span': ['spanning-tree'],
    'spann': ['spanning-tree'],
    'spanni': ['spanning-tree'],
    'spannin': ['spanning-tree'],
    'spanning': ['spanning-tree'],
    'spanning-': ['spanning-tree'],
    'spanning-t': ['spanning-tree'],
    'spanning-tr': ['spanning-tree'],
    'spanning-tre': ['spanning-tree'],
    'spanning-tree': ['mode', 'portfast'],
    'spanning-tree m': ['mode'],
    'spanning-tree mo': ['mode'],
    'spanning-tree mod': ['mode'],
    'spanning-tree mode': ['pvst', 'rapid-pvst', 'mst'],
    
    'vt': ['vtp'],
    'vtp': ['mode', 'domain'],
    'vtp m': ['mode'],
    'vtp mo': ['mode'],
    'vtp mod': ['mode'],
    'vtp mode': ['server', 'client', 'transparent'],
    'vtp d': ['domain'],
    'vtp do': ['domain'],
    'vtp dom': ['domain'],
    'vtp doma': ['domain'],
    'vtp domain': [''],
    
    'cd': ['cdp'],
    'cdp': ['run'],
    'cdp r': ['run'],
    'cdp ru': ['run'],
    
    'ex': ['exit'],
    'exi': ['exit'],
    
    'end': [''],
    
    'do': ['show', 'write', 'ping'],
    'do s': ['show'],
    'do sh': ['show'],
    'do sho': ['show'],
    'do show': ['running-config', 'interfaces', 'vlan', 'version'],
    'do w': ['write'],
    'do wr': ['write'],
    'do wri': ['write'],
    'do writ': ['write'],
    'do write': ['memory'],
  },
  interface: {
    '': ['shutdown', 'no', 'speed', 'duplex', 'description', 'switchport', 'cdp', 'spanning-tree', 'channel-group', 'exit', 'end', 'do', '?'],
    's': ['shutdown', 'speed', 'spanning-tree'],
    'sh': ['shutdown'],
    'shu': ['shutdown'],
    'shut': ['shutdown'],
    'shutd': ['shutdown'],
    'shutdo': ['shutdown'],
    'shutdow': ['shutdown'],
    
    'sp': ['speed', 'spanning-tree'],
    'spe': ['speed'],
    'spee': ['speed'],
    'speed': ['10', '100', '1000', 'auto'],
    
    'd': ['duplex', 'description'],
    'du': ['duplex'],
    'dup': ['duplex'],
    'dupl': ['duplex'],
    'duple': ['duplex'],
    'duplex': ['half', 'full', 'auto'],
    
    'de': ['description'],
    'des': ['description'],
    'desc': ['description'],
    'descr': ['description'],
    'descri': ['description'],
    'descrip': ['description'],
    'descript': ['description'],
    'descripti': ['description'],
    'descriptio': ['description'],
    
    'n': ['no'],
    'no': ['shutdown', 'switchport', 'cdp', 'description', 'speed', 'duplex', 'spanning-tree'],
    'no s': ['shutdown', 'switchport', 'speed', 'spanning-tree'],
    'no sh': ['shutdown'],
    'no shu': ['shutdown'],
    'no shut': ['shutdown'],
    'no shutd': ['shutdown'],
    'no shutdo': ['shutdown'],
    'no shutdow': ['shutdown'],
    'no sw': ['switchport'],
    'no swi': ['switchport'],
    'no swit': ['switchport'],
    'no switc': ['switchport'],
    'no switch': ['switchport'],
    'no switchp': ['switchport'],
    'no switchpo': ['switchport'],
    'no switchpor': ['switchport'],
    'no switchport': ['mode', 'access', 'port-security'],
    'no switchport m': ['mode'],
    'no switchport mo': ['mode'],
    'no switchport mod': ['mode'],
    'no switchport mode': [''],
    'no switchport a': ['access'],
    'no switchport ac': ['access'],
    'no switchport acc': ['access'],
    'no switchport acce': ['access'],
    'no switchport acces': ['access'],
    'no switchport access': ['vlan'],
    'no switchport access v': ['vlan'],
    'no switchport access vl': ['vlan'],
    
    'sw': ['switchport'],
    'swi': ['switchport'],
    'swit': ['switchport'],
    'switc': ['switchport'],
    'switch': ['switchport'],
    'switchp': ['switchport'],
    'switchpo': ['switchport'],
    'switchpor': ['switchport'],
    'switchport': ['mode', 'access', 'trunk', 'port-security', 'voice', 'nonegotiate'],
    'switchport m': ['mode'],
    'switchport mo': ['mode'],
    'switchport mod': ['mode'],
    'switchport mode': ['access', 'trunk'],
    'switchport mode a': ['access'],
    'switchport mode ac': ['access'],
    'switchport mode acc': ['access'],
    'switchport mode acce': ['access'],
    'switchport mode acces': ['access'],
    'switchport mode t': ['trunk'],
    'switchport mode tr': ['trunk'],
    'switchport mode tru': ['trunk'],
    'switchport mode trun': ['trunk'],
    'switchport a': ['access'],
    'switchport ac': ['access'],
    'switchport acc': ['access'],
    'switchport acce': ['access'],
    'switchport acces': ['access'],
    'switchport access': ['vlan'],
    'switchport access v': ['vlan'],
    'switchport access vl': ['vlan'],
    'switchport access vlan': ['1', '10', '20', '30', '50', '100'],
    'switchport t': ['trunk'],
    'switchport tr': ['trunk'],
    'switchport tru': ['trunk'],
    'switchport trun': ['trunk'],
    'switchport trunk': ['allowed', 'native', 'encapsulation'],
    'switchport trunk a': ['allowed'],
    'switchport trunk al': ['allowed'],
    'switchport trunk all': ['allowed'],
    'switchport trunk allo': ['allowed'],
    'switchport trunk allow': ['allowed'],
    'switchport trunk allowe': ['allowed'],
    'switchport trunk allowed': ['vlan'],
    'switchport trunk allowed v': ['vlan'],
    'switchport trunk allowed vl': ['vlan'],
    'switchport trunk allowed vlan': ['all', 'add', 'remove', '1,2,10,20'],
    'switchport trunk n': ['native'],
    'switchport trunk na': ['native'],
    'switchport trunk nat': ['native'],
    'switchport trunk nati': ['native'],
    'switchport trunk nativ': ['native'],
    'switchport trunk native': ['vlan'],
    'switchport trunk native v': ['vlan'],
    'switchport trunk native vl': ['vlan'],
    'switchport trunk native vlan': ['1', '10', '20', '99'],
    'switchport p': ['port-security'],
    'switchport po': ['port-security'],
    'switchport por': ['port-security'],
    'switchport port': ['port-security'],
    'switchport port-': ['port-security'],
    'switchport port-s': ['port-security'],
    'switchport port-se': ['port-security'],
    'switchport port-sec': ['port-security'],
    'switchport port-secu': ['port-security'],
    'switchport port-secur': ['port-security'],
    'switchport port-securi': ['port-security'],
    'switchport port-securit': ['port-security'],
    'switchport port-security': ['maximum', 'violation', 'mac-address'],
    'switchport port-security m': ['maximum'],
    'switchport port-security ma': ['maximum'],
    'switchport port-security max': ['maximum'],
    'switchport port-security maxi': ['maximum'],
    'switchport port-security maxim': ['maximum'],
    'switchport port-security maximu': ['maximum'],
    'switchport port-security maximum': ['1', '2', '3', '5', '10'],
    'switchport port-security v': ['violation'],
    'switchport port-security vi': ['violation'],
    'switchport port-security vio': ['violation'],
    'switchport port-security viol': ['violation'],
    'switchport port-security viola': ['violation'],
    'switchport port-security violat': ['violation'],
    'switchport port-security violati': ['violation'],
    'switchport port-security violatio': ['violation'],
    'switchport port-security violation': ['protect', 'restrict', 'shutdown'],
    'switchport port-security mac': ['mac-address'],
    'switchport port-security mac-': ['mac-address'],
    'switchport port-security mac-a': ['mac-address'],
    'switchport port-security mac-ad': ['mac-address'],
    'switchport port-security mac-addr': ['mac-address'],
    'switchport port-security mac-addre': ['mac-address'],
    'switchport port-security mac-addres': ['mac-address'],
    'switchport port-security mac-address': ['sticky', '<MAC>'],
    'switchport port-security mac-address s': ['sticky'],
    'switchport port-security mac-address st': ['sticky'],
    'switchport port-security mac-address sti': ['sticky'],
    'switchport port-security mac-address stick': ['sticky'],
    'switchport port-security mac-address sticky': [''],
    'switchport v': ['voice'],
    'switchport vo': ['voice'],
    'switchport voi': ['voice'],
    'switchport voice': ['vlan'],
    'switchport voice v': ['vlan'],
    'switchport voice vl': ['vlan'],
    'switchport voice vlan': ['1', '10', '20', 'dot1p', 'none', 'untagged'],
    
    'cd': ['cdp'],
    'cdp': ['enable'],
    'cdp e': ['enable'],
    'cdp en': ['enable'],
    'cdp ena': ['enable'],
    'cdp enab': ['enable'],
    'cdp enabl': ['enable'],
    
    'spanning': ['spanning-tree'],
    'spanning-': ['spanning-tree'],
    'spanning-t': ['spanning-tree'],
    'spanning-tr': ['spanning-tree'],
    'spanning-tre': ['spanning-tree'],
    'spanning-tree': ['portfast', 'bpduguard', 'cost', 'priority'],
    'spanning-tree p': ['portfast'],
    'spanning-tree po': ['portfast'],
    'spanning-tree por': ['portfast'],
    'spanning-tree port': ['portfast'],
    'spanning-tree portf': ['portfast'],
    'spanning-tree portfa': ['portfast'],
    'spanning-tree portfas': ['portfast'],
    'spanning-tree portfast': [''],
    'spanning-tree b': ['bpduguard'],
    'spanning-tree bp': ['bpduguard'],
    'spanning-tree bpd': ['bpduguard'],
    'spanning-tree bpdu': ['bpduguard'],
    'spanning-tree bpdug': ['bpduguard'],
    'spanning-tree bpdugu': ['bpduguard'],
    'spanning-tree bpdugua': ['bpduguard'],
    'spanning-tree bpduguar': ['bpduguard'],
    'spanning-tree bpduguard': ['enable', 'disable'],
    'spanning-tree bpduguard e': ['enable'],
    'spanning-tree bpduguard en': ['enable'],
    'spanning-tree bpduguard ena': ['enable'],
    'spanning-tree bpduguard enab': ['enable'],
    'spanning-tree bpduguard enabl': ['enable'],
    
    'ch': ['channel-group'],
    'cha': ['channel-group'],
    'chan': ['channel-group'],
    'chann': ['channel-group'],
    'channe': ['channel-group'],
    'channel': ['channel-group'],
    'channel-': ['channel-group'],
    'channel-g': ['channel-group'],
    'channel-gr': ['channel-group'],
    'channel-gro': ['channel-group'],
    'channel-grou': ['channel-group'],
    'channel-group': ['1', '2'],
    'channel-group 1': ['mode'],
    'channel-group 1 m': ['mode'],
    'channel-group 1 mo': ['mode'],
    'channel-group 1 mod': ['mode'],
    'channel-group 1 mode': ['active', 'passive', 'on', 'desirable', 'auto'],
    
    'ex': ['exit'],
    'exi': ['exit'],
    
    'end': [''],
    
    'do': ['show', 'write', 'ping'],
    'do s': ['show'],
    'do sh': ['show'],
    'do sho': ['show'],
    'do show': ['running-config', 'interfaces', 'vlan'],
  },
  line: {
    '': ['password', 'login', 'transport', 'exec-timeout', 'logging', 'history', 'privilege', 'exit', 'end', 'do', '?'],
    'p': ['password'],
    'pa': ['password'],
    'pas': ['password'],
    'pass': ['password'],
    'passw': ['password'],
    'passwo': ['password'],
    'passwor': ['password'],
    
    'l': ['login', 'logging'],
    'lo': ['login', 'logging'],
    'log': ['login', 'logging'],
    'logi': ['login'],
    'login': ['', 'local'],
    'login l': ['local'],
    'login lo': ['local'],
    'login loc': ['local'],
    'login loca': ['local'],
    
    'logg': ['logging'],
    'loggi': ['logging'],
    'loggin': ['logging'],
    'logging': ['synchronous'],
    'logging s': ['synchronous'],
    'logging sy': ['synchronous'],
    'logging syn': ['synchronous'],
    'logging sync': ['synchronous'],
    'logging synch': ['synchronous'],
    'logging synchr': ['synchronous'],
    'logging synchro': ['synchronous'],
    'logging synchron': ['synchronous'],
    'logging synchrono': ['synchronous'],
    'logging synchronou': ['synchronous'],
    'logging synchronous': [''],
    
    't': ['transport'],
    'tr': ['transport'],
    'tra': ['transport'],
    'tran': ['transport'],
    'trans': ['transport'],
    'transp': ['transport'],
    'transpo': ['transport'],
    'transpor': ['transport'],
    'transport': ['input', 'output'],
    'transport i': ['input'],
    'transport in': ['input'],
    'transport inp': ['input'],
    'transport inpu': ['input'],
    'transport input': ['ssh', 'telnet', 'all', 'none'],
    'transport input s': ['ssh'],
    'transport input ss': ['ssh'],
    'transport input t': ['telnet'],
    'transport input te': ['telnet'],
    'transport input tel': ['telnet'],
    'transport input teln': ['telnet'],
    'transport input telne': ['telnet'],
    'transport input a': ['all'],
    'transport input al': ['all'],
    'transport input n': ['none'],
    'transport input no': ['none'],
    'transport input non': ['none'],
    
    'e': ['exec-timeout', 'exit', 'end'],
    'ex': ['exec-timeout', 'exit'],
    'exe': ['exec-timeout'],
    'exec': ['exec-timeout'],
    'exec-': ['exec-timeout'],
    'exec-t': ['exec-timeout'],
    'exec-ti': ['exec-timeout'],
    'exec-tim': ['exec-timeout'],
    'exec-time': ['exec-timeout'],
    'exec-timeo': ['exec-timeout'],
    'exec-timeou': ['exec-timeout'],
    'exec-timeout': ['<minutes>', '0'],
    
    'h': ['history'],
    'hi': ['history'],
    'his': ['history'],
    'hist': ['history'],
    'histo': ['history'],
    'histor': ['history'],
    'history': ['size'],
    'history s': ['size'],
    'history si': ['size'],
    'history siz': ['size'],
    
    'pr': ['privilege'],
    'pri': ['privilege'],
    'priv': ['privilege'],
    'prive': ['privilege'],
    'privl': ['privilege'],
    'privil': ['privilege'],
    'privile': ['privilege'],
    'privileg': ['privilege'],
    'privilege': ['level'],
    'privilege l': ['level'],
    'privilege le': ['level'],
    'privilege lev': ['level'],
    'privilege leve': ['level'],
    'privilege level': ['0', '1', '15'],
    
    'exit': [''],
    'end': [''],
    
    'do': ['show'],
    'do s': ['show'],
    'do sh': ['show'],
    'do sho': ['show'],
    'do show': ['running-config'],
  },
  vlan: {
    '': ['name', 'state', 'exit', 'end', '?'],
    'n': ['name'],
    'na': ['name'],
    'nam': ['name'],
    'name': [''],
    
    'st': ['state'],
    'sta': ['state'],
    'stat': ['state'],
    'state': ['active', 'suspend'],
    'state a': ['active'],
    'state ac': ['active'],
    'state act': ['active'],
    'state acti': ['active'],
    'state activ': ['active'],
    'state s': ['suspend'],
    'state su': ['suspend'],
    'state sus': ['suspend'],
    'state susp': ['suspend'],
    'state suspe': ['suspend'],
    'state suspen': ['suspend'],
    'state suspend': [''],
    
    'exit': [''],
    'end': [''],
  },
};

export function Terminal({ deviceId, deviceName, prompt, state, onCommand, onClear, output, isLoading, t, theme, language }: TerminalProps) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCompletionBar, setShowCompletionBar] = useState(true);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const isPasswordMode = state.awaitingPassword;
  const limitedOutput = output.slice(-MAX_OUTPUT_LINES);

  // Scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Get current mode for command help
  const getCurrentModeCommands = useCallback((): Record<string, string[]> => {
    return commandHelp[state.currentMode] || commandHelp.user;
  }, [state.currentMode]);

  // Get suggestions based on input
  const getSuggestions = useCallback((inputValue: string): string[] => {
    const modeCommands = getCurrentModeCommands();
    const lower = inputValue.toLowerCase().trim();
    
    // Direct match
    if (modeCommands[lower]) {
      return modeCommands[lower];
    }
    
    // Partial match - find commands starting with input
    const matches: string[] = [];
    for (const key of Object.keys(modeCommands)) {
      if (key.startsWith(lower) && key !== lower) {
        // Find the next part
        const remaining = key.substring(lower.length).trim();
        if (remaining) {
          const nextWord = remaining.split(' ')[0];
          if (nextWord && !matches.includes(nextWord)) {
            matches.push(nextWord);
          }
        }
      }
    }
    
    return matches;
  }, [getCurrentModeCommands]);

  // Get recent history for buttons
  const getRecentHistory = useCallback((): string[] => {
    return state.commandHistory.slice(-MAX_HISTORY_BUTTONS).reverse();
  }, [state.commandHistory]);

  // Format help output like real Cisco IOS
  const formatHelpOutput = useCallback((inputValue: string): string => {
    const suggestions = getSuggestions(inputValue);
    
    if (suggestions.length === 0) {
      return '% Ambiguous command:  "' + inputValue + '"';
    }
    
    // Format like Cisco IOS - list options
    const lines: string[] = [];
    
    // Add the prompt and current input
    lines.push(prompt + inputValue + '?');
    lines.push('');
    
    // List available commands
    suggestions.forEach(cmd => {
      if (cmd) {
        lines.push(`  ${cmd}`);
      }
    });
    
    lines.push('');
    lines.push(`<cr>`);
    lines.push('');
    
    return lines.join('\n');
  }, [getSuggestions, prompt]);

  // Handle command submission
  const handleSubmit = async (commandToSend?: string) => {
    const cmd = (commandToSend || input).trim();
    if (!cmd || isLoading) return;
    
    await onCommand(cmd);
    setInput('');
    setHistoryIndex(-1);
  };

  // Handle suggestion button click
  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion.startsWith('<') || suggestion === '') {
      // Parameter or empty - don't complete
      return;
    }
    
    // Check if input ends with space
    if (input.endsWith(' ')) {
      setInput(input + suggestion + ' ');
    } else {
      // Find last word boundary
      const parts = input.split(' ');
      parts[parts.length - 1] = suggestion;
      setInput(parts.join(' ') + ' ');
    }
    
    inputRef.current?.focus();
  };

  // Handle history button click
  const handleHistoryClick = (cmd: string) => {
    setInput(cmd);
    inputRef.current?.focus();
  };

  // Handle TAB completion
  const applyTabCompletion = () => {
    const suggestions = getSuggestions(input);
    
    if (suggestions.length === 1) {
      // Single match - complete it
      const suggestion = suggestions[0];
      if (suggestion.startsWith('<') || suggestion === '') {
        // Parameter or empty - don't complete
        return;
      }
      
      // Check if input ends with space
      if (input.endsWith(' ')) {
        setInput(input + suggestion);
      } else {
        // Find last word boundary
        const parts = input.split(' ');
        parts[parts.length - 1] = suggestion;
        setInput(parts.join(' '));
      }
    } else if (suggestions.length > 1) {
      // Multiple matches - show all like Cisco IOS
      // Send ? command to show options
      const helpCmd = input + '?';
      onCommand(helpCmd);
    }
  };

  // Handle key down
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isPasswordMode) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleSubmit();
        break;
      case 'Tab':
        e.preventDefault();
        applyTabCompletion();
        break;
      case '?':
        // Cisco style: show help inline
        e.preventDefault();
        // Send ? to show help
        const helpCmd = input + '?';
        onCommand(helpCmd);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (state.commandHistory.length > 0) {
          const newIndex = historyIndex < state.commandHistory.length - 1 
            ? historyIndex + 1 
            : historyIndex;
          setHistoryIndex(newIndex);
          const historyCmd = state.commandHistory[state.commandHistory.length - 1 - newIndex] || '';
          setInput(historyCmd);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(state.commandHistory[state.commandHistory.length - 1 - newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput('');
        }
        break;
      case 'Escape':
        setInput('');
        break;
    }
  };

  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const isDark = theme === 'dark';
  const currentSuggestions = getSuggestions(input).slice(0, MAX_SUGGESTIONS);
  const recentHistory = getRecentHistory();

  return (
    <Card className={`h-full flex flex-col overflow-hidden border-0 shadow-2xl transition-all duration-500 ${isDark ? 'bg-slate-900/50' : 'bg-white/80'} backdrop-blur-xl`}>
      <CardHeader className={`pb-3 pt-4 px-5 flex-shrink-0 border-b ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-blue-50/50 border-blue-100'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className={`text-base flex items-center gap-3 font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <div className={`p-2 rounded-xl ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-100 text-cyan-600 shadow-sm'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="leading-tight">{t.cliTerminal}</span>
              <div className="flex items-center gap-2 mt-0.5">
                {deviceName && (
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-cyan-400' : 'bg-blue-100 text-blue-600'}`}>
                    {deviceName}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700/50 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                  {state.version.modelName}
                </span>
              </div>
            </div>
          </CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700/50 text-slate-300' : 'bg-white/80 border-slate-200 text-slate-600 shadow-sm'}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {t.mode}: {state.currentMode.toUpperCase()}
              </span>
            </div>
            {onClear && (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const text = output.map(o => o.content).join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                  title={language === 'tr' ? 'Çıktıyı Kopyala' : 'Copy Output'}
                  className={`p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center border ${
                    isDark 
                      ? 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 hover:border-cyan-500/30' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-cyan-600 hover:bg-slate-50 hover:border-cyan-200 shadow-sm'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-1 4h.01M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className={`px-4 py-2 rounded-xl transition-all duration-300 font-bold text-xs flex items-center gap-2 border ${
                    isDark 
                      ? 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 hover:border-rose-500/30' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-slate-50 hover:border-rose-200 shadow-sm'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>{t.clearTerminalBtn}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent 
        className="flex-1 overflow-hidden p-0 cursor-text flex flex-col relative"
        onClick={handleTerminalClick}
      >
        {/* Modern Terminal View */}
        <div
          ref={terminalRef}
          className={`flex-1 overflow-y-auto p-6 font-mono text-sm scroll-smooth custom-scrollbar ${
            isDark ? 'bg-slate-950/80' : 'bg-slate-50/50'
          }`}
          style={{ minHeight: '300px' }}
        >
          {/* Welcome message */}
          <div className={`mb-6 p-4 rounded-2xl border transition-all duration-500 ${
            isDark 
              ? 'bg-slate-900/40 border-slate-800/50 text-slate-300' 
              : 'bg-white/80 border-slate-200/50 text-slate-600 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-cyan-600'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{t.simulatorTitle}</span>
            </div>
            <div className="text-sm font-bold opacity-90 leading-relaxed">
              Cisco Catalyst Operating System Software<br />
              <span className={`text-cyan-500`}>{`Release IOS ${state.version.iosVersion}`}</span><br />
              (c) 1986-2024 Cisco Systems, Inc.
            </div>
          </div>
          
          {/* Output history */}
          <div className="space-y-1.5">
            {limitedOutput.map((item) => (
              <div key={item.id} className="group transition-all duration-300">
                {item.type === 'command' && (
                  <div className="flex flex-wrap">
                    <span className="text-cyan-400 font-bold whitespace-nowrap">{item.prompt}</span>
                    <span className={`${isDark ? 'text-white' : 'text-slate-900'} ml-1`}>{item.content}</span>
                  </div>
                )}
                {item.type === 'output' && (
                  <pre className={`${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-pre-wrap leading-relaxed`}>{item.content}</pre>
                )}
                {item.type === 'error' && (
                  <pre className="text-rose-500 whitespace-pre-wrap font-bold bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10 mb-1">{item.content}</pre>
                )}
                {item.type === 'help' && (
                  <pre className="text-emerald-500 whitespace-pre-wrap font-medium">{item.content}</pre>
                )}
                {item.type === 'password-prompt' && (
                  <pre className={`${isDark ? 'text-white' : 'text-slate-900'} whitespace-pre-wrap font-bold`}>{item.content}</pre>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-center gap-2 text-cyan-500 animate-pulse mt-4">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                <span className="text-xs font-black uppercase tracking-widest">{t.processing}</span>
              </div>
            )}
            
            {/* Command input line */}
            <div className="flex items-center min-h-[40px] group mt-2">
              {!isPasswordMode && (
                <span className="text-cyan-500 font-bold flex-shrink-0 animate-fade-in mr-1.5">{prompt}</span>
              )}
              <div className="relative flex-1">
                {/* Ghost text layer - shows completion suggestion */}
                {!isPasswordMode && currentSuggestions.length > 0 && input.length > 0 && (
                  <div 
                    className="absolute inset-0 flex items-center pointer-events-none font-mono text-sm overflow-hidden"
                    aria-hidden="true"
                  >
                    <span className="text-transparent">{input}</span>
                    <span className={`${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
                      {currentSuggestions[0].startsWith(input.split(' ').pop() || '') 
                        ? currentSuggestions[0].slice(input.split(' ').pop()?.length || 0)
                        : ''}
                    </span>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type={isPasswordMode ? 'password' : 'text'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`bg-transparent ${isDark ? 'text-white' : 'text-slate-900'} outline-none w-full font-mono py-2 text-sm caret-cyan-500 selection:bg-cyan-500/30`}
                  disabled={isLoading}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ fontSize: 'inherit' }}
                />
                {/* Blinking cursor indicator when focused */}
                {!input && !isPasswordMode && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] cursor-blink pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity" />
                )}
              </div>
              {/* Keyboard shortcuts hint */}
              <div className="hidden sm:flex items-center gap-1.5 ml-4 opacity-40 group-focus-within:opacity-100 transition-opacity duration-500">
                <kbd className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'}`}>TAB</kbd>
                <span className="text-[9px] font-black uppercase tracking-widest">{language === 'tr' ? 'tamamla' : 'complete'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Bar - Mobile Friendly */}
        {showCompletionBar && !isPasswordMode && (
          <div className={`border-t px-4 py-3 transition-all duration-500 ${
            isDark ? 'bg-slate-900/60 border-slate-800/50' : 'bg-slate-50/80 border-slate-200/50'
          }`}>
            {/* Suggestions Row */}
            {currentSuggestions.length > 0 && input.length > 0 && (
              <div className="mb-3">
                <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {language === 'tr' ? 'Hızlı Komutlar' : 'Quick Commands'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSuggestionClick(suggestion);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all duration-300 border ${
                        isDark 
                          ? 'bg-slate-800/80 border-slate-700/50 text-cyan-400 hover:bg-slate-700 hover:border-cyan-500/30 hover:scale-105 active:scale-95' 
                          : 'bg-white border-slate-200 text-cyan-600 hover:bg-slate-50 hover:border-cyan-500/30 hover:scale-105 active:scale-95 shadow-sm'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* History Row */}
            {recentHistory.length > 0 && (
              <div>
                <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t.commandHistory}
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentHistory.map((cmd, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHistoryClick(cmd);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[10px] transition-all duration-300 border ${
                        isDark 
                          ? 'bg-slate-900/50 border-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:scale-105 active:scale-95' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:scale-105 active:scale-95 shadow-sm'
                      }`}
                    >
                      {cmd.length > 24 ? cmd.substring(0, 24) + '...' : cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Close completions button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCompletionBar(false);
              }}
              className={`mt-4 w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                isDark ? 'bg-slate-800/50 text-slate-600 hover:text-slate-400' : 'bg-slate-200/50 text-slate-400 hover:text-slate-600'
              }`}
            >
              {language === 'tr' ? 'Paneli Gizle' : 'Hide Panel'}
            </button>
          </div>
        )}
        
        {/* Show button when hidden */}
        {!showCompletionBar && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCompletionBar(true);
            }}
            className={`w-full border-t px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              isDark 
                ? 'bg-slate-900 border-slate-800 text-slate-600 hover:text-cyan-500 hover:bg-slate-800/50' 
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-cyan-600 hover:bg-white'
            }`}
          >
            <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {language === 'tr' ? 'Yardımcı Paneli Göster' : 'Show Helper Panel'}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
