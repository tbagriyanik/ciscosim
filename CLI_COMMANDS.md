# 💻 Network CLI Commands Reference

The simulator supports **100+ commands** across multiple configuration modes.

## Command Overview

### System & Session Commands (User/Privileged Mode)
| Command | Description | Mode |
|---------|-------------|------|
| `enable` | Enter privileged EXEC mode | User |
| `disable` | Return to user EXEC mode | Privileged |
| `configure terminal` | Enter global configuration mode | Privileged |
| `exit` | Exit current mode/session | All |
| `end` | Return to privileged mode from any sub-mode | All |
| `help` | Display help system information | All |

### Privileged EXEC Commands
| Command | Description |
|---------|-------------|
| `ping <host> [size] [count]` | Test connectivity to host with ICMP |
| `traceroute <host>` | Trace route to destination (Unix style) |
| `tracert <host>` | Trace route to destination (Win style) |
| `telnet <host> [port]` | Connect to remote device via Telnet |
| `ssh [-l username] <host>` | Connect via SSH |
| `write memory` | Save running configuration to NVRAM |
| `copy running-config startup-config` | Save configuration |
| `copy running-config flash:[:filename]` | Save configuration to flash |
| `copy flash:[:filename] startup-config` | Restore configuration from flash |
| `erase startup-config` | Erase startup configuration |
| `erase nvram` | Erase NVRAM filesystem |
| `delete flash:vlan.dat` | Delete VLAN database file |
| `reload` | Reload the device |
| `ip route <network> <mask> <next-hop>` | Add static route |
| `no ip route <network> <mask> <next-hop>` | Remove static route |
| `debug <type>` | Enable debugging |
| `undebug all` | Disable all debugging |
| `undebug` | Disable all debugging (alias) |
| `terminal [length\|width\|monitor]` | Set terminal parameters |
| `terminal no monitor` | Disable terminal monitoring |
| `clear arp-cache` | Clear ARP cache |
| `clear mac address-table` | Clear MAC address table |
| `clear counters` | Clear interface counters |
| `do <command>` | Execute privileged command from config mode |
| `help` | Display help system information |

### Global Configuration Commands
| Command | Description |
|---------|-------------|
| `hostname <name>` | Set device hostname |
| `vlan <id>` | Create/enter VLAN configuration |
| `no vlan <id>` | Delete VLAN |
| `name <name>` | Set VLAN name (in vlan mode) |
| `state <active\|suspend>` | Set VLAN state |
| `interface <name>` | Enter interface configuration |
| `interface range <range>` | Configure interface range |
| `no interface vlan <id>` | Delete VLAN interface |
| `ip routing` | Enable IP routing (L3 switches) |
| `no ip routing` | Disable IP routing |
| `ip default-gateway <ip>` | Set default gateway |
| `no ip default-gateway` | Remove default gateway |
| `ip domain-name <name>` | Set domain name |
| `no ip domain lookup` | Disable DNS lookup |
| `ip http server` | Enable HTTP server |
| `no ip http server` | Disable HTTP server |
| `ip ssh version {1\|2}` | Set SSH version |
| `ip ssh time-out <seconds>` | Set SSH timeout |
| `no ip ssh time-out` | Remove SSH timeout |
| `ip dhcp snooping` | Enable DHCP snooping |
| `ip dhcp snooping vlan <list>` | Enable DHCP snooping on VLANs |
| `no ip dhcp snooping` | Disable DHCP snooping |
| `ip arp inspection` | Enable ARP inspection |
| `service password-encryption` | Encrypt passwords |
| `no service password-encryption` | Disable password encryption |
| `enable secret <password>` | Set enable secret |
| `no enable secret` | Remove enable secret |
| `enable password <password>` | Set enable password |
| `no enable password` | Remove enable password |
| `banner motd #<message>#` | Set MOTD banner |
| `banner login #<message>#` | Set login banner |
| `banner exec #<message>#` | Set exec banner |
| `no banner motd` | Remove MOTD banner |
| `no banner login` | Remove login banner |
| `no banner exec` | Remove exec banner |
| `vtp mode {server\|client\|transparent}` | Set VTP mode |
| `vtp domain <name>` | Set VTP domain |
| `vtp password <password>` | Set VTP password |
| `spanning-tree mode {pvst\|rapid-pvst\|mst}` | Set STP mode |
| `no spanning-tree` | Disable spanning-tree |
| `spanning-tree vlan <id> priority <val>` | Set VLAN STP priority |
| `spanning-tree vlan <id> root` | Set VLAN STP root |
| `spanning-tree portfast default` | Enable PortFast globally |
| `username <name> [privilege <lvl>] [password\|secret] <pass>` | Create user |
| `no username <name>` | Remove user |
| `cdp run` | Enable CDP globally |
| `no cdp run` | Disable CDP |
| `mls qos` | Enable MLS QoS |
| `no mls qos` | Disable MLS QoS |
| `router rip` | Enable RIP routing |
| `router ospf [<id>]` | Enable OSPF routing |
| `no router rip` | Disable RIP |
| `no router ospf` | Disable OSPF |
| `ip dhcp pool <name>` | Create DHCP pool / enter dhcp-config mode |
| `no ip dhcp pool <name>` | Remove DHCP pool |
| `ip dhcp excluded-address <low> [<high>]` | Exclude addresses from DHCP |
| `ntp server <ip>` | Configure NTP server |
| `clock timezone <name> <offset>` | Set timezone |
| `ip name-server <ip>` | Configure DNS server |
| `system mtu <size>` | Set system MTU |
| `errdisable recovery` | Configure errdisable recovery |
| `ipv6 unicast-routing` | Enable IPv6 routing |
| `crypto key generate rsa` | Generate RSA keys for SSH |
| `ip ssh authentication-retries <n>` | Set SSH retry limit |
| `snmp-server community <str> {RO\|RW}` | Set SNMP community |
| `snmp-server contact <text>` | Set SNMP contact |
| `snmp-server location <text>` | Set SNMP location |
| `archive` | Enter archive config mode |
| `alias <mode> <name> <cmd>` | Create command alias |
| `macro name <name>` | Define command macro |
| `sdm prefer <template>` | Set SDM template |
| `ip arp inspection vlan <id>` | Enable DAI on VLAN |

### Interface Configuration Commands
| Command | Description |
|---------|-------------|
| `shutdown` | Administratively disable interface |
| `no shutdown` | Enable interface |
| `speed {10\|100\|1000\|auto}` | Set interface speed |
| `duplex {half\|full\|auto}` | Set duplex mode |
| `description <text>` | Set interface description |
| `no description` | Clear description |
| `switchport mode access` | Set access mode |
| `switchport mode trunk` | Set trunk mode |
| `switchport mode dynamic auto` | Set DTP dynamic auto mode |
| `switchport mode dynamic desirable` | Set DTP dynamic desirable mode |
| `switchport mode dot1q-tunnel` | Set dot1q tunnel mode |
| `no switchport mode` | Reset switchport mode |
| `switchport access vlan <id>` | Assign VLAN |
| `no switchport access vlan` | Remove VLAN assignment |
| `switchport trunk native vlan <id>` | Set native VLAN |
| `switchport trunk allowed vlan <list>` | Set allowed VLANs |
| `switchport nonegotiate` | Disable DTP |
| `switchport voice vlan <id>` | Set voice VLAN |
| `switchport port-security` | Enable port security |
| `switchport port-security maximum <n>` | Set max MAC addresses |
| `switchport port-security violation {protect\|restrict\|shutdown}` | Set violation action |
| `switchport port-security mac-address sticky` | Enable sticky MAC |
| `no switchport port-security` | Disable port security |
| `no switchport` | Convert to routed port (L3) |
| `spanning-tree portfast` | Enable PortFast |
| `spanning-tree bpduguard enable` | Enable BPDU Guard |
| `spanning-tree bpduguard disable` | Disable BPDU Guard |
| `spanning-tree cost <cost>` | Set STP cost |
| `spanning-tree priority <prio>` | Set STP priority |
| `no spanning-tree` | Disable spanning-tree on interface |
| `ip address <ip> <mask>` | Assign IP address |
| `ip address <ip>/<prefix>` | Assign IP with CIDR notation |
| `no ip address` | Remove IP address |
| `ip default-gateway <ip>` | Set default gateway (interface) |
| `no ip default-gateway` | Remove default gateway (interface) |
| `ip helper-address <ip>` | Set DHCP relay |
| `no ip helper-address` | Remove DHCP relay |
| `cdp enable` | Enable CDP on interface |
| `no cdp enable` | Disable CDP on interface |
| `channel-group <n> mode {on\|active\|passive}` | Configure EtherChannel |
| `no channel-group` | Remove from channel |
| `access-list <acl>` | Apply access list |
| `no access-list` | Remove access list |
| `debug` / `no debug` | Interface debugging |
| `monitor session <n>` | Configure SPAN/RSPAN |
| `no monitor session` | Remove monitoring |
| `no udld` | Disable UDLD on interface |
| `no ip proxy-arp` | Disable proxy ARP |
| `no keepalive` | Disable keepalive |
| `no name` | Remove interface name (VLAN) |
| `ipv6 address <ip>/<prefix>` | Assign IPv6 address |
| `ip verify source` | Enable IP Source Guard |
| `ip dhcp snooping trust` | Set interface as trusted for DHCP |
| `ip arp inspection trust` | Set interface as trusted for DAI |
| `storm-control {broadcast\|multicast\|unicast} level <%>` | Set storm control |
| `power inline {auto\|static\|never}` | Configure PoE |
| `bandwidth <kbps>` | Set interface bandwidth |
| `delay <tens-of-ms>` | Set interface delay |
| `carrier-delay <ms>` | Set carrier delay |
| `load-interval <sec>` | Set load statistics interval |
| `mls qos trust {cos\|dscp}` | Set QoS trust state |
| `mls qos cos <val>` | Set default CoS value |

### Wireless (WiFi) Commands
| Command | Description |
|---------|-------------|
| `ssid <name>` | Set wireless network name |
| `encryption {open\|wpa\|wpa2\|wpa3}` | Set security type |
| `wifi-password <password>` | Set wireless password |
| `wifi-channel {2.4ghz\|5ghz}` | Set wireless band |
| `wifi-mode {ap\|client\|disabled}` | Set wireless mode |

### Line Configuration Commands
| Command | Description |
|---------|-------------|
| `line console <n>` | Enter console line config |
| `line vty <start> <end>` | Enter VTY line config |
| `password <password>` | Set line password |
| `no password` | Remove line password |
| `login` | Enable password checking |
| `no login` | Disable password checking |
| `transport input {ssh\|telnet\|all\|none}` | Set allowed protocols |
| `no transport input` | Reset transport input |
| `logging synchronous` | Enable sync logging |
| `no logging synchronous` | Disable sync logging |
| `exec-timeout <min> [sec]` | Set exec timeout |
| `no exec-timeout` | Reset exec timeout |
| `history size <n>` | Set history buffer size |
| `no history` | Disable command history |
| `exec` / `no exec` | Enable/disable EXEC |
| `autocommand <cmd>` | Set auto-command |
| `no autocommand` | Remove auto-command |
| `privilege level <0-15>` | Set privilege level |
| `transport output {ssh\|telnet\|all\|none}` | Set outbound protocols |
| `transport preferred {ssh\|telnet\|none}` | Set preferred protocol |
| `session-limit <n>` | Set max sessions |
| `access-class <n> {in\|out}` | Apply ACL to line |
| `lockable` | Enable line locking |

### Router Configuration Commands (RIP/OSPF)
| Command | Description |
|---------|-------------|
| `network <ip> [wildcard] area <id>` | Add network to routing |
| `network <ip>` | Add RIP network |
| `router-id <ip>` | Set router ID |
| `passive-interface <intf>` | Set passive interface |
| `default-information {originate\|always}` | Control default route |

### DHCP Pool Configuration Commands (`dhcp-config` mode)
| Command | Description |
|---------|-------------|
| `network <address> <mask>` | Set pool network and subnet mask |
| `default-router <ip>` | Set default gateway for clients |
| `dns-server <ip>` | Set DNS server for clients |
| `lease <days> [hours] [minutes]` | Set lease duration (or `infinite`) |
| `domain-name <name>` | Set domain name for clients |

### Show Commands
| Command | Description |
|---------|-------------|
| `show` | Display summary information |
| `show running-config` | Display running configuration |
| `show startup-config` | Display startup configuration |
| `show version` | Display version information |
| `show interfaces` | Display all interfaces |
| `show interfaces trunk` | Display trunk interface information |
| `show interface <name>` | Display specific interface |
| `show ip interface brief` | Display IP interface summary |
| `show ip interface` | Display IP interface summary (alias) |
| `show vlan [brief]` | Display VLAN information |
| `show mac address-table` | Display MAC address table |
| `show cdp neighbors` | Display CDP neighbors |
| `show ip route` | Display routing table |
| `show ipv6 interface brief` | Display IPv6 interface summary |
| `show clock` | Display system clock |
| `show flash` | Display flash contents |
| `show boot` | Display boot information |
| `show spanning-tree` | Display STP information |
| `show port-security` | Display port security status |
| `show wireless` | Display wireless status |
| `show ssh` | Display SSH status |
| `do show <command>` | Execute show command from config mode |
| `show ip dhcp snooping` | Display DHCP snooping |
| `show ip dhcp pool` | Display DHCP pool configuration |
| `show ip dhcp binding` | Display DHCP bindings |
| `show interfaces status` | Display interface status |
| `show cdp` | Display CDP information |
| `show vtp status` | Display VTP status |
| `show vtp` | Display VTP status (alias) |
| `show etherchannel` | Display EtherChannel |
| `show arp` / `show ip arp` | Display ARP table |
| `show mls qos` | Display QoS status |
| `show ip arp inspection` | Display ARP inspection |
| `show access-lists` | Display access lists |
| `show mac access-lists` | Display MAC access lists |
| `show history` | Display command history |
| `show users` | Display logged in users |
| `show environment` | Display hardware status |
| `show inventory` | Display hardware inventory |
| `show errdisable recovery` | Display errdisable status |
| `show errdisable detect` | Display errdisable detection |
| `show storm-control` | Display storm control |
| `show udld` | Display UDLD status |
| `show monitor` | Display SPAN sessions |
| `show debug` | Display debug status |
| `show processes` | Display CPU processes |
| `show memory` | Display memory usage |
| `show sdm prefer` | Display SDM template |
| `show system mtu` | Display MTU settings |
| `show ntp status` | Display NTP status |
| `show snmp` | Display SNMP info |
| `show archive` | Display archive status |
| `show alias` | Display command aliases |
| `show diagnostic` | Display diagnostic results |
| `show lldp` | Display LLDP neighbors |
| `show authentication` | Display auth sessions |

## Command Modes
- **User Mode** (`>`) - Basic monitoring commands
- **Privileged Mode** (`#`) - All show/debug commands
- **Config Mode** `(config)#` - Global configuration
- **Interface Mode** `(config-if)#` - Interface configuration
- **Line Mode** `(config-line)#` - Line configuration
- **VLAN Mode** `(config-vlan)#` - VLAN configuration
- **Router Config Mode** `(config-router)#` - Routing protocol config
- **DHCP Pool Mode** `(dhcp-config)#` - DHCP pool configuration

## Features
- **Tab Completion**: Auto-complete commands with TAB
- **Command History**: Up/Arrow keys for previous commands
- **Context Help**: Use `?` for command help
- **Error Checking**: Detailed error messages for invalid commands
