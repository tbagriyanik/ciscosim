# 💻 Network CLI Commands Reference

The simulator supports **400+ commands** across multiple configuration modes.

## Keyboard Shortcuts

### General Navigation
| Shortcut | Action |
|----------|--------|
| `Ctrl+A` | Select all devices |
| `Escape` | Cancel current operation / Close modal |
| `Tab` | Auto-complete command in CLI |
| `Arrow Up/Down` | Navigate command history in CLI |
| `Enter` | Execute command / Confirm action |
| `Delete` | Delete selected items |
| `F5` | Refresh network topology |

### Canvas Navigation
| Shortcut | Action |
|----------|--------|
| `Left-click + Drag` | Pan canvas |
| `Middle-click + Drag` | Rectangle selection |
| `Right-click` | Open context menu |
| `Home` | Reset topology view (zoom 1.0, center) |
| `End` | Focus last element |
| `Page Up` / `Page Down` | Scroll canvas vertically |
| `Mouse Wheel` | Zoom in/out |
| `Ctrl + Drag Device` | Snap device to grid (16px grid) |

### Device Operations
| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Copy configuration |
| `Ctrl+V` | Paste configuration |
| `Ctrl+X` | Cut configuration |
| `Ctrl+S` | Save configuration |
| `Ctrl+L` | Clear terminal |
| `Double-click Device` | Open device configuration panel |

### Window & Panel Gestures
| Shortcut / Gesture | Action |
|--------------------|--------|
| `Alt+M` | Toggle Minimap (Harita) display |
| `Alt+L` | Toggle Network Event Log (Ağ Olay Günlüğü) panel |
| `Alt+F` | Zoom to fit all topology devices (Fit View) |
| `Shift+Tab` | Open Task Switcher (Pencere Deştirici) modal |
| `Ctrl+M` | Minimize active device window |
| `Side-by-Side` | Arrange open device windows side-by-side (Split View) |
| `Tabbed View` | Switch open device windows to tabbed layout mode |
| `Double-click Header` | Toggle collapse / minimize window (PC Window, Router Panel, Packet Analysis, Refresh Report) |
| `Click Terminal Output / History` | Focus command line input field |
| `Tab` | Command auto-completion / suggestion completion |

## Command Overview

### Desktop Computer & Device Commands
| Command | Description |
|---------|-------------|
| `ipconfig [/all] [/release] [/renew]` | IP configuration and DHCP lease management |
| `ping [-n count] [-l size] [-w timeout] [-a] [-t] [-4\|-6] <host>` | Test connectivity to host |
| `tracert [-d] [-h max_hops] [-w timeout] [-4\|-6] <host>` | Trace route to destination |
| `netstat [-a] [-n] [-o] [-p tcp\|udp] [-r] [-s] [-e]` | Display network statistics / connections |
| `nslookup [-type=A\|AAAA\|CNAME\|MX\|NS\|PTR\|TXT] <domain\|ip> [server]` | Query DNS for domain mapping |
| `ftp <host>` | Connect to an FTP server |
| `telnet <host> [port]` | Connect via Telnet |
| `ssh -l <username> <host>` | Connect via SSH |
| `curl` / `wget <url>` | View web page content |
| `http://<printer-ip>` | Access Network Printer Web Server (LPD/IPP Spooler, Print Jobs, Toner Status) |
| `http://203.0.113.1` | Access Cloud / Public WAN Internet Gateway Search |
| `arp [-a] [-g] [-v] [-d [*]] [-s <ip> <mac>]` | Display/manage ARP table |
| `nbtstat [-n] [-c] [-r] [-R] [-RR] [-S] [-s] [-a name] [-A ip] [-L name]` | NetBIOS status / statistics |
| `hostname` | Display computer name |
| `dir` | List directory contents |
| `type <file>` | Display text file contents |
| `copy <src> <dest>` | Copy file to another location |
| `move <src> <dest>` | Move file or directory |
| `ren <old> <new>` | Rename file or directory |
| `ver` | Display OS version |
| `cls` | Clear the screen |
| `help` / `?` | Display command help |

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
| `traceroute <host>` | Trace route to destination |
| `telnet <host> [port]` | Connect to remote device via Telnet |
| `ssh -l <username> <host>` | Connect via SSH (with username) |
| `write memory` | Save running configuration to NVRAM |
| `copy running-config startup-config` | Save configuration |
| `copy running-config flash:[:filename]` | Save configuration to flash |
| `copy running-config tftp:` | Upload config to TFTP server |
| `copy flash:[:filename] startup-config` | Restore configuration from flash |
| `copy flash:[:filename] running-config` | Merge flash config into running config |
| `copy startup-config running-config` | Merge startup config into running config |
| `copy tftp: running-config` | Download and merge config from TFTP |
| `copy tftp: flash:` | Download file from TFTP to flash |
| `erase startup-config` | Erase startup configuration |
| `erase nvram:` | Erase NVRAM filesystem |
| `delete flash:vlan.dat` | Delete VLAN database file |
| `delete nvram:` | Delete NVRAM contents |
| `reload` | Reload the device |
| `clock set <hh:mm:ss> <day> <month> <year>` | Set system clock |
| `more <filename>` | Display contents of a file or configuration (`running-config`, `startup-config`, `vlan.dat`) |
| `setup` | ⚠️ Stub - Enter initial setup dialog |
| `test <type>` | ⚠️ Stub - Run diagnostics |
| `configure replace <url>` | ⚠️ Stub - Replace running config with file |
| `disconnect` | ⚠️ Stub - Disconnect network connection |
| `resume <n>` | ⚠️ Stub - Resume a suspended session |
| `suspend` | ⚠️ Stub - Suspend current Telnet/SSH session (Ctrl+Shift+6 then X) |
| `debug <type>` | Enable debugging (requires argument, e.g., `debug ip packet`) |
| `no debug <type>` | Disable specific debugging |
| `no debug all` | Disable all debugging |
| `undebug all` | Disable all debugging |
| `undebug` | Disable all debugging (alias) |
| `terminal length <n>` | Set terminal page length |
| `terminal width <n>` | Set terminal width |
| `terminal monitor` | Enable terminal monitoring |
| `terminal no monitor` | ⚠️ Stub - Disable terminal monitoring |
| `clear arp-cache` | Clear ARP cache |
| `clear mac address-table` | Clear MAC address table |
| `clear counters` | Clear interface counters |
| `clear line <n>` | Clear a terminal line session |
| `clear interface <name>` | Clear interface counters and state |
| `do <command>` | Execute privileged command from config mode |
| `help` | Display help system information |
| `show access-lists` | Display all access lists |

### Global Configuration Commands
| Command | Description |
|---------|-------------|
| `hostname <name>` | Set device hostname |
| `no hostname` | Reset hostname to default (Switch) |
| `vlan <id>` | Create/enter VLAN configuration |
| `no vlan <id>` | Delete VLAN |
| `name <name>` | Set VLAN name (in vlan mode) |
| `no name` | Remove VLAN name (in vlan mode only) |
| `state <active\|suspend>` | Set VLAN state |
| `interface <name>` | Enter interface configuration |
| `interface range <range>` | Configure interface range |
| `no interface vlan <id>` | Delete VLAN interface |
| `ip routing` | Enable IP routing (L3 switches) |
| `no ip routing` | Disable IP routing |
| `ip default-gateway <ip>` | Set default gateway |
| `no ip default-gateway` | Remove default gateway |
| `ip domain-name <name>` | Set domain name |
| `no ip domain-name` | Remove domain name |
| `ip domain-lookup` | Enable DNS lookup |
| `no ip domain-lookup` | Disable DNS lookup |
| `ip host <name> <ip>` | Add static hostname-to-IP mapping |
| `no ip host <name>` | Remove static host mapping |
| `ip http server` | Enable HTTP server |
| `no ip http server` | Disable HTTP server |
| `ip ssh version {1\|2}` | Set SSH version |
| `ip ssh time-out <seconds>` | Set SSH timeout |
| `no ip ssh time-out` | Remove SSH timeout |
| `ip dhcp snooping` | Enable DHCP snooping |
| `ip dhcp snooping vlan <ids>` | Enable DHCP snooping on VLANs |
| `ip dhcp snooping information option` | Enable DHCP Option 82 insertion |
| `no ip dhcp snooping information option` | Disable DHCP Option 82 insertion |
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
| `spanning-tree vlan <id> priority <val>` | Set VLAN STP priority |
| `spanning-tree vlan <id> root` | Set VLAN STP root |
| `spanning-tree portfast default` | Enable PortFast globally |
| `spanning-tree bpduguard enable` | Enable BPDU Guard |
| `spanning-tree bpduguard disable` | Disable BPDU Guard |
| `spanning-tree bpduguard` | ⚠️ Stub - Command deprecated |
| `no spanning-tree` | Disable spanning-tree |
| `username <name> [privilege <lvl>] [password\|secret] <pass>` | Create user |
| `no username <name>` | Remove user |
| `aaa new-model` | Enable AAA (Authentication, Authorization, Accounting) |
| `no aaa new-model` | Disable AAA |
| `radius-server host <ip> key <key>` | Configure RADIUS server host and shared key |
| `no radius-server host <ip>` | Remove RADIUS server host |
| `tacacs-server host <ip> key <key>` | Configure TACACS+ server host and shared key |
| `no tacacs-server host <ip>` | Remove TACACS+ server host |
| `cdp run` | Enable CDP globally |
| `no cdp run` | Disable CDP |
| `cdp timer <sec>` | Set CDP update interval in seconds |
| `cdp holdtime <sec>` | Set CDP hold time in seconds |
| `mls qos` | Enable MLS QoS |
| `no mls qos` | Disable MLS QoS |
| `router rip` | Enable RIP routing |
| `router ospf [<id>]` | Enable OSPF routing |
| `no router rip` | Disable RIP |
| `no router ospf` | Disable OSPF |
| `ip dhcp pool <name>` | Create DHCP pool / enter dhcp-config mode |
| `no ip dhcp pool <name>` | Remove DHCP pool |
| `ip dhcp excluded-address <low> [<high>]` | Exclude addresses from DHCP |
| `no ip dhcp excluded-address <low> [<high>]` | Remove excluded address range |
| `ntp server <ip>` | Configure NTP server |
| `clock timezone <name> <offset>` | Set timezone |
| `ip name-server <ip>` | Configure DNS server |
| `system mtu <size>` | Set system MTU |
| `errdisable recovery` | Configure errdisable recovery (all causes) |
| `errdisable recovery cause <cause>` | Configure errdisable recovery per cause |
| `ipv6 unicast-routing` | Enable IPv6 routing |
| `no ipv6 unicast-routing` | Disable IPv6 routing |
| `ipv6 dhcp pool <name>` | Create IPv6 DHCP pool / enter dhcp-config mode |
| `no ipv6 dhcp pool <name>` | Remove IPv6 DHCP pool |
| `ipv6 router rip <name>` | Enable RIPng routing process |
| `ipv6 router ospf <id>` | Enable OSPFv3 routing process |
| `no ipv6 router rip <name>` | Disable RIPng |
| `no ipv6 router ospf <id>` | Disable OSPFv3 |
| `crypto key generate rsa` | Generate RSA keys for SSH |
| `ip ssh authentication-retries <n>` | Set SSH retry limit |
| `snmp-server community <str> {RO\|RW}` | Store an SNMP community and access mode |
| `snmp-server contact <text>` | Set SNMP contact information |
| `snmp-server location <text>` | Set SNMP location information |
| `archive` | ⚠️ Stub - Enter archive config mode |
| `alias <mode> <name> <cmd>` | Create command alias |
| `no alias <name>` | Remove command alias |
| `macro name <name>` | ⚠️ Stub - Define command macro |
| `sdm prefer <template>` | Set SDM template |
| `ip arp inspection vlan <id>` | Enable Dynamic ARP Inspection (DAI) on VLAN |
| `logging host <ip>` | Configure Syslog server host IP address |
| `logging trap <level>` | Set Syslog logging severity level |
| `ip sla <id>` | Create IP SLA monitoring operation |
| `ip sla <id> icmp-echo <target> [frequency <seconds>]` | Configure synthetic ICMP echo probe |
| `ip sla <id> jitter <target> [frequency <seconds>]` | Configure synthetic jitter probe |
| `spanning-tree mode mst` | Set Spanning Tree mode to Multiple Spanning Tree (MST) |
| `spanning-tree mst configuration` | Enter MST configuration mode |
| `spanning-tree mst <instance-id> priority <val>` | Set MST instance bridge priority (in config mode) |
| `lldp tlv-select {all|network-policy|location|power}` | Select LLDP-MED TLVs |
| `dot1x system-auth-control` | Enable 802.1X system authentication |
| `crypto isakmp policy <priority>` | Configure IKE Phase 1 policy |
| `crypto ipsec transform-set <name> <encryption> <auth>` | Configure IPsec Phase 2 transform set |
| `default interface <name>` | Reset interface configuration while preserving identity |
| `mac access-list extended <name>` | ⚠️ Stub - Create named MAC access list |
| `access-list <id> <action> <condition>` | Create numbered ACL (1-99 standard, 100-199 extended) |
| `ip access-list {standard|extended} <name>` | Create named ACL |
| `no access-list <id>` | Remove numbered ACL |
| `ip nat inside source {static <local> <global> | list <acl> {pool <name> | interface <intf>} [overload]}` | Configure NAT |
| `ip nat pool <name> <start> <end> {netmask <mask} | prefix-length <len>}` | Define NAT pool |
| `no ip nat ...` | Remove NAT configuration |
| `ip route <network> <mask> <next-hop>` | Add static IPv4 route |
| `no ip route <network> <mask> [next-hop]` | Remove static IPv4 route (next-hop optional if single route) |
| `ipv6 route <prefix>/<len> <next-hop>` | Add static IPv6 route |
| `no ipv6 route <prefix>/<len> [next-hop]` | Remove static IPv6 route |
| `class-map [match-all\|match-any] <name>` | Create QoS class map |
| `policy-map <name>` | Create QoS policy map |
| `service-policy {input|output} <name>` | Apply an MQC policy to an interface |
| WFQ / LLQ / CBWFQ | Simulate queue scheduling and packet drops under bandwidth saturation |
| `template <name>` | ⚠️ Stub - Enter template configuration mode |
| `access-list <id> <action> <condition>` | Create numbered ACL (1-99 standard, 100-199 extended) |
| `ip access-list {standard|extended} <name>` | Create named ACL |
| `no access-list <id>` | Remove numbered ACL |
| `ip nat inside source {static <local> <global> | list <acl> {pool <name> | interface <intf>} [overload]}` | Configure NAT |
| `ip nat pool <name> <start> <end> {netmask <mask} | prefix-length <len>}` | Define NAT pool |
| `no ip nat ...` | Remove NAT configuration |
| `ip route <network> <mask> <next-hop>` | Add static IPv4 route |
| `no ip route <network> <mask> [next-hop]` | Remove static IPv4 route (next-hop optional if single route) |
| `ipv6 router eigrp <as>` | Enable IPv6 EIGRP routing process |
| `ip prefix-list <name> [seq <n>] {permit|deny} <prefix> [ge <ge>] [le <le>]` | Configure IP prefix list rule |
| `ipv6 prefix-list <name> [seq <n>] {permit|deny} <prefix> [ge <ge>] [le <le>]` | Configure IPv6 prefix list rule |
| `route-map <name> {permit|deny} [<seq>]` | Create/edit Route-Map policy |
| `ip flow-export destination <ip> <port>` | Configure NetFlow export destination IP and UDP port |
| `ip flow-export version {5|9}` | Set NetFlow export version |
| `spanning-tree loopguard default` | Enable global STP Loop Guard |

### Interface Configuration Commands

#### Interface Properties

| Command | Description |
|---------|-------------|
| `shutdown` | Administratively disable interface |
| `no shutdown` | Enable interface |
| `speed {10|100|1000|10000|auto}` | Set interface speed |
| `duplex {half|full|auto}` | Set duplex mode |
| `description <text>` | Set interface description |
| `no description` | Clear description |
| `mtu <size>` | Set interface MTU |
| `keepalive` | Enable keepalive |
| `no keepalive` | Disable keepalive |
| `carrier-delay <ms>` | ⚠️ Stub - Set carrier delay |
| `load-interval <sec>` | ⚠️ Stub - Set load statistics interval |

#### Switching Configuration

| Command | Description |
|---------|-------------|
| `switchport mode access` | Set access mode |
| `switchport mode trunk` | Set trunk mode |
| `switchport mode dynamic auto` | Set DTP dynamic auto mode |
| `switchport mode dynamic desirable` | Set DTP dynamic desirable mode |
| `switchport mode dot1q-tunnel` | Set dot1q tunnel mode |
| `switchport access vlan <vlan-id>` | Assign access VLAN |
| `switchport trunk native vlan <vlan-id>` | Set trunk native VLAN |
| `switchport trunk allowed vlan <vlan-list>` | Set allowed VLAN list (e.g. `10,20` or `10-20,30`) |
| `switchport trunk allowed vlan all` | Allow all VLANs on trunk |
| `switchport trunk allowed vlan add <vlan-list>` | Add VLANs to trunk allowed list |
| `switchport trunk allowed vlan remove <vlan-list>` | Remove VLANs from trunk allowed list |
| `switchport trunk allowed vlan except <vlan-list>` | Allow all VLANs except specified |
| `no switchport trunk allowed vlan` | Reset trunk allowed VLANs to default (all) |
| `no switchport mode` | Reset switchport mode |
| `no switchport` | Convert to routed port (L3) |
| `spanning-tree portfast` | Enable PortFast |
| `spanning-tree portfast default` | Enable PortFast globally |
| `spanning-tree bpduguard enable` | Enable BPDU Guard |
| `spanning-tree bpduguard disable` | Disable BPDU Guard |
| `spanning-tree cost <cost>` | Set STP cost |
| `spanning-tree priority <prio>` | Set STP priority |
| `no spanning-tree` | Disable spanning-tree |
| `spanning-tree vlan <id> priority <val>` | Set VLAN STP priority |
| `spanning-tree vlan <id> root` | Set VLAN STP root |

#### Port Security

| Command | Description |
|---------|-------------|
| `switchport port-security` | Enable port security |
| `switchport port-security maximum <n>` | Set max MAC addresses |
| `switchport port-security violation {protect|restrict|shutdown}` | Set violation action |
| `switchport port-security mac-address sticky [mac]` | Enable sticky MAC / configure sticky MAC address |
| `switchport port-security mac-address <mac>` | Configure static MAC address |
| `switchport port-security aging time <min>` | Set aging time in minutes |
| `switchport port-security aging type {absolute|inactivity}` | Set aging type (absolute or inactivity) |
| `no switchport port-security` | Disable port security |

#### Blocking and Isolation

| Command | Description |
|---------|-------------|
| `switchport block {unicast|multicast}` | Enable unknown unicast or multicast traffic blocking |
| `no switchport block {unicast|multicast}` | Disable traffic blocking |
| `switchport protected` | Enable protected port (PVLAN edge isolation) |
| `no switchport protected` | Disable protected port isolation |

### Wireless (WiFi) Commands

> **Note**: These commands are only valid on Wireless LAN Controllers (WLC) or autonomous Access Points (AP). They are NOT supported on switches.

| Command | Description | Device Type |
|---------|-------------|-------------|
| `dot11 ssid <name>` | Create/enter dot11 SSID config | WLC/AP |
| `wlan <name> <id> <ssid>` | Create WLAN profile | WLC only |
| `wlan shutdown` | Disable WLAN | WLC only |
| `no wlan <id>` | Delete WLAN profile | WLC only |
| `no wlan shutdown` | Enable WLAN (undo shutdown) | WLC only |
| `ap name <name>` | Configure AP name | WLC only |
| `ap auth-mac <mac>` | Add MAC auth filter for AP join | WLC only |
| `ap rf-channel <num>` | Set AP RF channel | WLC only |
| `ap dot11 5-ghz <cmd>` | Configure 5 GHz radio on AP | WLC only |

| `authentication open` | Set open authentication (in ssid-config) | WLC/AP |
| `authentication shared` | Set shared key auth (in ssid-config) | WLC/AP |
| `authentication key-management wpa version <2|3>` | Set WPA key management (in ssid-config) | WLC/AP |
| `wpa-psk ascii <key>` | Set WPA pre-shared key | WLC/AP |
| `mbssid` | Enable MBSSID (in ssid-config) | WLC/AP |
| `no mbssid` | Disable MBSSID (in ssid-config) | WLC/AP |
| `guest-mode` | Enable guest mode (in ssid-config) | WLC/AP |
| `no guest-mode` | Disable guest mode (in ssid-config) | WLC/AP |
| `ssid <name>` | Set SSID name (in dot11-config) | WLC/AP |
| `no ssid <name>` | Remove SSID (in dot11-config) | WLC/AP |
| `station-role root` | Set AP to root mode | WLC/AP |
| `channel <num>` | Set RF channel (in dot11-config) | WLC/AP |
| `no channel` | Reset to auto channel selection | WLC/AP |
| `speed <rate>` | Set basic data rate (in dot11-config) | WLC/AP |
| `power local <val>` | Set local power level (in dot11-config) | WLC/AP |
| `power client <val>` | Set client power level (in dot11-config) | WLC/AP |
| `world-mode dot11d {1|-1}` | Enable 802.11d world mode (in dot11-config) | WLC/AP |
| `security wpa psk set-key ascii 0 <password>` | Set WPA PSK key (dot11-config) | WLC/AP |
| `no security wpa psk` | Remove WPA PSK key | WLC/AP |
| `encryption mode ciphers {tkip|aes|tkip aes}` | Set encryption cipher (dot11-config) | WLC/AP |
| `mac-filter` | Enable MAC filter (dot11-config) | WLC/AP |
| `interface dot11radio <n>` | Enter dot11 radio interface config | WLC/AP |
| `dot11 channel <num>` | Enter dot11-config and set RF channel (global config) | WLC/AP |
| `dot11 power {local | client} <val>` | Enter dot11-config and set power level (global config) | WLC/AP |
| `dot11 station-role {root | repeater | client}` | Enter dot11-config and set station role (global config) | WLC/AP |
| `dot11 mac-filter` | Enter dot11-config and enable MAC filter (global config) | WLC/AP |
| `show wlan summary` | Display WLAN summary | WLC only |
| `show wlan <id>` | Display specific WLAN details | WLC only |
| `show dot11 associations` | Display wireless client associations | WLC/AP |
| `show dot11 statistics` | Display dot11 radio statistics | WLC/AP |
| `show ap summary` | Display AP summary | WLC only |
| `show ap config {ap-name | all}` | Display AP configuration details | WLC only |
| `show ap join statistics {ap-name | all}` | Display AP join statistics | WLC only |

### Line Configuration Commands

| Command | Description |
|---------|-------------|
| `line console <n>` | Enter console line config |
| `line aux <n>` | Enter auxiliary line config |
| `line vty <start> <end>` | Enter VTY line config |
| `password <password>` | Set line password |
| `no password` | Remove line password |
| `login` | Enable password checking |
| `no login` | Disable password checking |
| `transport input {ssh|telnet|all|none}` | Set allowed protocols |
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
| `transport preferred {ssh|telnet|none}` | Set preferred protocol |
| `privilege level <0-15>` | Set privilege level |
| `session-limit <n>` | Set max sessions |
| `access-class <n> {in|out}` | Apply ACL to line |
| `lockable` | Enable line locking |

### Serial / WAN Interface Commands

> **Note**: These commands are valid on serial interfaces (e.g., `Serial0/0/0`, `Serial0/1/0`). DCE/DTE detection is automatic based on the cable connection.

| Command | Description |
|---------|-------------|
| `encapsulation hdlc` | Set HDLC encapsulation (default) |
| `encapsulation ppp` | Set PPP encapsulation |
| `no encapsulation` | Reset to default encapsulation |
| `clock rate <bps>` | Set clock rate on DCE interface |
| `no clock rate` | Remove clock rate setting |
| `ppp authentication {chap|pap}` | Enable PPP authentication |
| `no ppp authentication` | Disable PPP authentication |
| `ppp pap sent-username <name> password <pass>` | Set PPP credentials |
| `bandwidth <kbps>` | Set serial bandwidth |

### Router Configuration Commands (RIP/OSPF)

| Command | Description |
|---------|-------------|
| `router rip` | Enable RIP routing |
| `router ospf [<id>]` | Enable OSPF routing |
| `no router rip` | Disable RIP |
| `no router ospf` | Disable OSPF |
| `network <ip> [wildcard] area <id>` | Add network to OSPF area |
| `no network <ip> [wildcard] area <id>` | Remove network from OSPF |
| `network <ip>` | Add RIP network |
| `no network <ip>` | Remove RIP network |
| `neighbor <ip> remote-as <asn>` | Configure BGP neighbor |
| `no neighbor <ip> [remote-as]` | Remove BGP neighbor |
| `router-id <ip>` | Set router ID |
| `no router-id` | Reset router ID to default |
| `passive-interface <intf>` | Set passive interface |
| `no passive-interface <intf>` | Enable routing updates on interface |
| `default-information {originate|always}` | Control default route |
| `area <id> range <ip> <mask>` | Summarize routes at area boundary |
| `area <id> stub` | Configure area as stub |
| `area <id> nssa` | Configure area as NSSA |
| `redistribute <protocol> [<process-id>] [metric <val>] [subnets]` | Redistribute routes from another protocol (ospf, rip, eigrp, bgp, static, connected) into the active routing process |
| `no redistribute <protocol> [<process-id>]` | Remove a redistribution rule |

### Router Configuration Commands (EIGRP)

| Command | Description |
|---------|-------------|
| `router eigrp <as>` | Enable EIGRP routing process |
| `no router eigrp <as>` | Disable EIGRP routing process |
| `network <ip> [wildcard]` | Advertise network via EIGRP |
| `no network <ip> [wildcard]` | Remove EIGRP network |
| `eigrp router-id <ip>` | Set EIGRP router ID |
| `no eigrp router-id` | Reset EIGRP router ID |
| `auto-summary` | Enable automatic network summarization |
| `no auto-summary` | Disable automatic network summarization |
| `passive-interface <intf>` | Suppress routing updates |
| `no passive-interface <intf>` | Enable routing updates |

### Router Configuration Commands (BGP)

| Command | Description |
|---------|-------------|
| `router bgp <as>` | Enable BGP routing process |
| `no router bgp <as>` | Disable BGP routing process |
| `bgp router-id <ip>` | Set BGP router ID |
| `network <ip> mask <mask>` | Advertise network via BGP |
| `no network <ip> mask <mask>` | Remove BGP network |
| `neighbor <ip> remote-as <asn>` | Configure BGP neighbor |
| `no neighbor <ip>` | Remove BGP neighbor |

### MST Configuration Submode Commands (`config-mst` mode)

> **Note**: Entered via `spanning-tree mst configuration` (from global config). These commands define the MST region (name, revision) and map VLANs to MST instances.

| Command | Description |
|---------|-------------|
| `name <region-name>` | Set MST region name |
| `revision <n>` | Set MST configuration revision number |
| `instance <id> vlan <vlan-list>` | Map VLAN(s) to an MST instance (e.g. `instance 1 vlan 10-20`) |
| `no instance <id>` | Remove an MST instance mapping |
| `show pending` | Display pending (uncommitted) MST configuration |

### IPv6 Routing (RIPng / OSPFv3)

| Command | Description |
|---------|-------------|
| `ipv6 router rip <name>` | Enter RIPng config mode (optional; for router-specific settings) |
| `ipv6 router ospf <id>` | Enter OSPFv3 config mode (optional; for router-specific settings) |
| `no ipv6 router rip <name>` | Disable RIPng |
| `no ipv6 router ospf <id>` | Disable OSPFv3 |

### IPv6 DHCP Pool Configuration Commands (`ipv6-dhcp-config` mode)

| Command | Description |
|---------|-------------|
| `address prefix <prefix>` | Set IPv6 address prefix for clients |
| `no address prefix <prefix>` | Remove address prefix |
| `dns-server <ipv6>` | Set DNS server for clients |
| `domain-name <name>` | Set domain name for clients |

### Firewall Configuration Commands

> **Note**: These commands are valid on **Firewall devices only**. They are not available on standard routers or switches.

| Command | Description |
|---------|-------------|
| `access-group <acl> in interface <nameif>` | Apply access-list to interface |
| `no access-group <acl> in interface <nameif>` | Remove access-list from interface |
| `object network <name>` | Create/enter network object |
| `no object network <name>` | Remove network object |
| `host <ip>` | Set host IP (inside object network) |
| `subnet <ip> <mask>` | Set subnet (inside object network) |
| `nat (src,dst) static <ip>` | Static NAT translation |
| `nat (src,dst) source dynamic <pool> <target>` | Dynamic NAT translation |
| `route <ifname> <network> <mask> <gateway> [distance]` | Add static route |
| `no route <ifname> <network> <mask> [gateway]` | Remove static route |
| `timeout <proto> <hh:mm:ss>` | Set connection timeout |
| `passwd <password>` | Set enable password |
| `http server enable` | Enable HTTP management server |
| `no http server enable` | Disable HTTP server |
| `ssh <ip> <mask> <ifname>` | Allow SSH from subnet |
| `no ssh <ip> <mask> <ifname>` | Remove SSH access |
| `telnet <ip> <mask> <ifname>` | Allow Telnet from subnet |
| `no telnet <ip> <mask> <ifname>` | Remove Telnet access |
| `logging enable` | Enable logging |
| `no logging enable` | Disable logging |
| `security-level <0-100>` | Set interface security level |
| `nameif <name>` | Set interface name |
| `no nameif` | Remove interface name |
| `same-security-traffic permit inter-interface` | Permit traffic between same-security interfaces |
| `no same-security-traffic permit inter-interface` | Deny same-security traffic |

### DHCP Pool Configuration Commands (`dhcp-config` mode)

| Command | Description |
|---------|-------------|
| `network <address> <mask>` | Set pool network and subnet mask |
| `default-router <ip>` | Set default gateway for clients |
| `no default-router` | Remove default gateway |
| `dns-server <ip>` | Set DNS server for clients |
| `no dns-server` | Remove DNS server |
| `lease {days|infinite}` | Set lease duration (or `infinite`) |
| `domain-name <name>` | Set domain name for clients |
| `no domain-name` | Remove domain name |

#### QoS Configuration

| Command | Description |
|---------|-------------|
| `mls qos trust {cos|dscp}` | Set QoS trust state |
| `mls qos cos <val>` | Set default CoS value |
| `storm-control {broadcast|multicast|unicast} level <%>` | Set storm control |

#### IP Configuration

| Command | Description |
|---------|-------------|
| `ip address <ip> <mask>` | Assign IP address with subnet mask |
| `no ip address` | Remove IP address |
| `ipv6 address <ip>/<prefix>` | Assign IPv6 address |
| `ip default-gateway <ip>` | Set default gateway |
| `no ip default-gateway` | Remove default gateway |
| `ip helper-address <ip>` | Set DHCP relay |
| `no ip helper-address` | Remove DHCP relay |
| `ip verify source` | Enable IP Source Guard |

#### NAT Configuration

| Command | Description |
|---------|-------------|
| `ip nat {inside | outside}` | Set interface NAT side |
| `no ip nat {inside | outside}` | Remove NAT side |
| `standby <group> ip <virtual-ip>` | Configure HSRP virtual IP |
| `standby <group> priority <prio>` | Set HSRP priority |
| `standby <group> preempt` | Enable HSRP preemption |
| `no standby <group> ...` | Remove HSRP configuration |

#### Encapsulation Configuration

| Command | Description |
|---------|-------------|
| `encapsulation hdlc` | Set HDLC encapsulation (default) |
| `encapsulation ppp` | Set PPP encapsulation |
| `encapsulation dot1q <vlan>` | Set 802.1Q encapsulation on subinterface |
| `no encapsulation` | Reset to default encapsulation |

#### Serial Configuration

| Command | Description |
|---------|-------------|
| `cdp enable` | Enable CDP on interface |
| `no cdp enable` | Disable CDP on interface |
| `channel-group <n> mode {on|active|passive}` | Configure EtherChannel |
| `no channel-group` | Remove from channel |
| `ppp authentication pap` | Enable PPP authentication |
| `ppp authentication chap` | Enable PPP authentication |
| `no ppp authentication` | Disable PPP authentication |
| `ppp pap sent-username <name> password <pass>` | Set PPP credentials |
| `ip directed-broadcast` | Enable directed broadcast |
| `no ip directed-broadcast` | Disable directed broadcast |
| `ip proxy-arp` | Enable proxy ARP |
| `no ip proxy-arp` | Disable proxy ARP |

#### Quality of Service

| Command | Description |
|---------|-------------|
| `mls qos trust {cos|dscp}` | Set QoS trust state |
| `mls qos cos <val>` | Set default CoS value |
| `storm-control {broadcast|multicast|unicast} level <%>` | Set storm control |

#### Management Commands

| Command | Description |
|---------|-------------|
| `clear arp-cache` | Clear ARP cache |
| `clear mac address-table` | Clear MAC address table |
| `clear counters` | Clear interface counters |
| `clear line <n>` | ⚠️ Stub - Clear a terminal line |
| `clear interface <name>` | ⚠️ Stub - Clear interface counters |
| `debug` / `no debug` | Interface debugging |
| `undebug all` | ⚠️ Stub - Disable all debugging |
| `undebug` | ⚠️ Stub - Disable all debugging (alias) |
| `monitor session <n>` | ⚠️ Stub - Configure SPAN/RSPAN |
| `no monitor session` | ⚠️ Stub - Remove monitoring |
| `no udld` | Disable UDLD on interface |

#### Additional Interface Commands

| Command | Description |
|---------|-------------|
| `ip access-group <id> {in|out}` | Apply IPv4 ACL to interface |
| `ip dhcp snooping trust` | Set interface as trusted for DHCP |
| `ip arp inspection trust` | Set interface as trusted for DAI |
| `channel-protocol {lacp|pagp}` | ⚠️ Stub - Set EtherChannel protocol |
| `priority-queue out` | Enable and store interface priority-queue configuration (traffic scheduling is sim-only) |
| `queue-set <n>` | Store interface QoS queue-set configuration (traffic scheduling is sim-only) |
| `tx-queue <n>` | Store interface transmit-queue configuration (traffic scheduling is sim-only) |
| `power inline {auto|static}` | ⚠️ Stub - Configure PoE |
| `power inline consumption <watt>` | ⚠️ Stub - Set PoE power limit |
| `keepalive` | Enable keepalive |
| `no keepalive` | Disable keepalive |
| `carrier-delay <ms>` | ⚠️ Stub - Set carrier delay |
| `load-interval <sec>` | ⚠️ Stub - Set statistics interval |
| `ip arp inspection limit <pps>` | Store interface ARP inspection rate limit |
| `ipv6 rip <name> enable` | Enable RIPng on interface |
| `ipv6 ospf <id> area <area>` | Enable OSPFv3 on interface |
| `ipv6 dhcp server <pool-name>` | Enable IPv6 DHCP server on interface |
| `ip helper-address <ip>` | Set DHCP relay |
| `no ip helper-address` | Remove DHCP relay |
| `ip verify source` | Enable IP Source Guard |
| `ip directed-broadcast` | Enable directed broadcast |
| `ip proxy-arp` | Enable proxy ARP |
| `ip dhcp snooping trust` | Set interface as trusted for DHCP |
| `ip arp inspection trust` | Set interface as trusted for DAI |
| `ip dhcp excluded-address <ip>` | Exclude addresses from DHCP |
| `ip dhcp excluded-address <low> [<high>]` | Remove excluded address range |

### Show Commands
| Command | Description |
|---------|-------------|
| `show` | Requires additional keywords (use `show ?`) |
| `show running-config` | Display running configuration |
| `show running-config interface <name>` | Display running config for specific interface |
| `show startup-config` | Display startup configuration |
| `show version` | Display version information |
| `show interfaces` | Display all interfaces |
| `show interfaces trunk` | Display trunk interface information |
| `show interface <name>` | Display specific interface |
| `show ip interface brief` | Display IP interface summary (single-line IP and status overview) |
| `show ip interface` | Display detailed IP interface information (MTU, ACL, NAT, BGP rules, and other L3 features) |
| `show ip protocols` | Display routing protocol configuration |
| `show ip ssh` | Display SSH configuration and status |
| `show ip source binding` | Display IP source guard bindings |
| `show ip verify source` | Display IP source guard verification |
| `show vlan [brief]` | Display VLAN information |
| `show mac address-table` | Display MAC address table |
| `show mac address-table static` | Display static MAC address entries |
| `show cdp neighbors` | Display CDP neighbors |
| `show ip route` | Display IPv4 routing table |
| `show ipv6 route` | Display IPv6 routing table |
| `show ipv6 interface brief` | Display IPv6 interface summary |
| `show clock` | Display system clock |
| `show flash` | Display flash contents |
| `show boot` | Display boot information |
| `show spanning-tree` | Display STP information |
| `show spanning-tree interface <name>` | Display STP information for specific interface |
| `show port-security` | Display port security status |
| `show wireless` | Display wireless status | WLC only |
| `show ssh` | Display SSH status |
| `show hosts` | Display static hostname-to-IP mappings |
| `show sessions` | Display active sessions |
| `show controllers` | Display interface controller status |
| `show redundancy` | Display redundancy/HSRP status |
| `show banner motd` | Display MOTD banner |
| `show class-map` | Display QoS class maps |
| `show policy-map` | Display QoS policy maps |
| `show policy-map interface <name>` | Display policy-map applied to specific interface |
| `show qos interface <name>` | Display QoS interface configuration and statistics |
| `show queuing interface <name>` | Display interface queuing statistics |
| `show ipv6 dhcp pool` | Display IPv6 DHCP pools |
| `show ip eigrp neighbors [<type>]` | Display EIGRP neighbor table |
| `show ip bgp summary` | Display BGP summary (dynamic `Established` / `Idle` neighbor state) |
| `show ip bgp` | Display BGP routing table |
| `show ipv6 rip` | Display IPv6 RIP (RIPng) processes |
| `show ipv6 ospf` | Display OSPFv3 processes |
| `show ip ospf neighbor` | Display OSPF neighbors |
| `show ip ospf interface` | Display OSPF interface status |
| `show debugging` | Display debugging status |
| `do show <command>` | Execute show command from config mode |
| `show ip dhcp snooping` | Display DHCP snooping |
| `show ip dhcp pool` | Display DHCP pool configuration |
| `show ip dhcp binding` | Display DHCP bindings |
| `show nameif` | Display interface names and security levels (Firewall) |
| `show ip access-group` | Display ACL applied to interfaces (Firewall) |
| `show interfaces status` | Display interface status |
| `show cdp` | Display CDP information |
| `show vtp status` | Display VTP status |
| `show vtp password` | Display VTP password |
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
| `show processes` | Display CPU processes |
| `show memory` | Display memory usage |
| `show sdm prefer` | Display SDM template |
| `show system mtu` | Display MTU settings |
| `show ntp status` | Display NTP status |
| `show ntp associations` | Display NTP associations |
| `show logging` | Display logging (syslog) configuration and trap severity level |
| `show snmp` | Display SNMP info |
| `show archive` | Display archive status |
| `show alias` | Display command aliases |
| `show diagnostic` | Display diagnostic results |
| `show lldp` | Display LLDP neighbors |
| `show authentication` | Display auth sessions |
| `show ip nat translations` | Display active NAT/PAT translations formatted with `Pro`, `Inside global:port`, `Inside local:port`, `Outside local:port`, `Outside global:port` columns |
| `show ip nat statistics` | Display NAT statistics |
| `show ip ospf` | Display OSPF information and ABR status |
| `show standby [brief]` | Display HSRP status |
| `show glbp [brief]` | Display GLBP status and AVG election |
| `show ip cache flow` | Display NetFlow active flow cache table |
| `show ip flow export` | Display NetFlow export parameters |
| `show route-map` | Display route-map policies and rules |
| `show ip prefix-list` | Display IPv4 prefix lists |
| `show ipv6 prefix-list` | Display IPv6 prefix lists |
| `show ipv6 eigrp neighbors` | Display IPv6 EIGRP neighbors |
| `show ipv6 eigrp topology` | Display IPv6 EIGRP topology table |

### Advanced Network Protocols (v3.9.0)

| Command | Mode | Description |
|---------|------|-------------|
| `ipv6 router eigrp <as-number>` | Config | Enable EIGRP for IPv6 routing process |
| `eigrp router-id <ip-address>` | Router Config | Set EIGRP IPv6 router ID |
| `ipv6 eigrp <as-number>` | Interface | Enable EIGRP for IPv6 on interface |
| `ip prefix-list <name> [seq <n>] {permit\|deny} <prefix> [ge <ge>] [le <le>]` | Config | Define IPv4 prefix-list filter |
| `ipv6 prefix-list <name> [seq <n>] {permit\|deny} <prefix> [ge <ge>] [le <le>]` | Config | Define IPv6 prefix-list filter |
| `route-map <name> {permit\|deny} [<seq>]` | Config | Create route-map entry and enter route-map configuration mode |
| `match ip address prefix-list <name>` | Route-Map | Match IPv4 prefix-list in route-map |
| `match ipv6 address prefix-list <name>` | Route-Map | Match IPv6 prefix-list in route-map |
| `match interface <interface>` | Route-Map | Match interface in route-map |
| `set metric <value>` | Route-Map | Set metric attribute in route-map |
| `set ip next-hop <ip>` | Route-Map | Set IPv4 next-hop in route-map |
| `set ipv6 next-hop <ipv6>` | Route-Map | Set IPv6 next-hop in route-map |
| `set local-preference <value>` | Route-Map | Set BGP local preference in route-map |
| `glbp <group> ip <ip-address>` | Interface | Configure GLBP virtual gateway IP address |
| `glbp <group> priority <priority>` | Interface | Set GLBP AVG election priority (1-255) |
| `glbp <group> preempt` | Interface | Enable GLBP AVG preemption |
| `glbp <group> weighting <weight>` | Interface | Set GLBP weighting value |
| `spanning-tree loopguard default` | Config | Enable STP Loop Guard globally on all non-designated ports |
| `spanning-tree guard loop` | Interface | Enable STP Loop Guard on specific interface |
| `ip flow-export destination <ip> <port>` | Config | Set NetFlow export collector IP and UDP port |
| `ip flow-export version <5\|9>` | Config | Set NetFlow export protocol version (5 or 9) |
| `ip flow ingress` / `ip flow egress` | Interface | Enable NetFlow traffic monitoring on interface |

## Command Modes
- **User Mode** (`>`) - Basic monitoring commands
- **Privileged Mode** (`#`) - All show/debug commands
- **Config Mode** `(config)#` - Global configuration
- **Interface Mode** `(config-if)#` - Interface configuration (Ethernet, Serial, VLAN)
- **Line Mode** `(config-line)#` - Line configuration (console, VTY)
- **VLAN Mode** `(config-vlan)#` - VLAN configuration
- **Router Config Mode** `(config-router)#` - Routing protocol config (OSPF, RIP, EIGRP, BGP)
- **MST Config Mode** `(config-mst)#` - MST region configuration (name, revision, instance) — entered via `spanning-tree mst configuration`
- **DHCP Pool Mode** `(dhcp-config)#` - DHCP pool configuration
- **SSID Config Mode** `(config-ssid)#` - SSID security parameters (authentication, guest-mode, mbssid)
- **Dot11 Config Mode** `(config-dot11)#` - Wireless radio/dot11 interface configuration (channel, speed, power, station-role)
- **Standard ACL Mode** `(config-std-nacl)#` - Named standard access-list rules
- **Extended ACL Mode** `(config-ext-nacl)#` - Named extended access-list rules

### ACL Configuration Commands (std/ext-nacl mode)
| Command | Description |
|---------|-------------|
| `permit <condition>` | Add a permit rule |
| `deny <condition>` | Add a deny rule |
| `no permit <condition>` | Remove a permit rule |
| `no deny <condition>` | Remove a deny rule |
| `exit` | Return to global configuration mode |

## Network Terminology / Ağ Terimleri

| Term | Türkçe açıklama | Simulator example |
|------|------------------|-------------------|
| **Default gateway** | Yerel ağ dışındaki hedeflere giden ilk yönlendirici | `ip default-gateway 192.168.1.1` |
| **Broadcast domain** | Broadcast paketlerinin ulaştığı mantıksal alan; VLAN ile ayrılır | `vlan 10` |
| **Access port** | Tek bir access VLAN taşıyan uç cihaz portu | `switchport mode access` |
| **Trunk port** | Birden fazla VLAN’ı 802.1Q etiketiyle taşıyan port | `switchport mode trunk` |
| **Native VLAN** | Trunk üzerinde etiketsiz taşınan VLAN | `switchport trunk native vlan 99` |
| **Next hop** | Paketi hedef ağa yaklaştıran sonraki router adresi | `ip route 10.10.0.0 255.255.0.0 192.168.1.2` |
| **Metric** | Yönlendirme yollarını karşılaştıran protokol maliyeti | OSPF/EIGRP route output |
| **Convergence** | Ağ değişikliğinden sonra router’ların ortak topoloji bilgisine ulaşması | `show ip ospf neighbor` |
| **FHRP** | HSRP/VRRP gibi yedekli ilk atlama/ağ geçidi protokolleri | `standby 1 ip 192.168.1.1` |
| **DHCP relay** | DHCP broadcast paketini başka IP ağındaki sunucuya iletme | `ip helper-address 192.168.10.10` |
| **DHCP snooping** | Güvenilmeyen portlardan gelen sahte DHCP Offer/ACK mesajlarını engelleme | `ip dhcp snooping` |
| **ARP inspection / DAI** | ARP mesajlarını güvenilir IP–MAC bağlamalarına göre doğrulama | `ip arp inspection vlan 10` |
| **NAT / PAT** | IP adresi ve port çevirisi; birçok hostu tek genel IP üzerinden taşıyabilir | `show ip nat translations` |
| **Latency** | Paketin kaynak ile hedef arasındaki gecikme süresi | `show ip sla statistics` |
| **Jitter** | Ardışık paket gecikmelerindeki değişim; ses/video için önemlidir | `ip sla 1 jitter 192.0.2.1` |
| **Packet loss** | Gönderilip hedefe ulaşmayan paket oranı | IP SLA statistics output |
| **QoS queue** | Çıkış kapasitesi yetmediğinde paketlerin beklediği kuyruk | `service-policy output QOS` |
| **LLQ / CBWFQ / WFQ** | Sırasıyla düşük gecikmeli öncelik, sınıf tabanlı ağırlıklı ve ağırlıklı adil kuyruklama | QoS scheduler simulation |
| **LLDP / LLDP-MED** | Komşu cihaz/port ve medya uç noktası bilgisi keşfi | `show lldp neighbors detail` |
| **802.1X / EAPOL** | Port tabanlı erişim kontrolü ve Ethernet üzerindeki kimlik doğrulama çerçeveleri | `dot1x system-auth-control` |
| **RADIUS / AAA** | Merkezi kimlik doğrulama, yetkilendirme ve hesaplama altyapısı | `radius-server host <ip> key <key>` |
| **IPsec / ESP / IKE** | IP katmanında güvenlik; ESP veri korur, IKE anahtar ve SA görüşür | IPsec module concepts |
| **Overlay / underlay** | Overlay mantıksal sanal ağ, underlay onu taşıyan fiziksel/IP altyapıdır | SDN/DNA Center concepts |
| **SDN** | Kontrol düzlemini yazılımla merkezileştiren ağ yaklaşımı | Controller concepts |
| **YANG / NETCONF / RESTCONF** | Ağ verisini modelleme ve API üzerinden yapılandırma araçları | Automation concepts |

### IP SLA quick example

```text
Switch(config)# ip sla 1 icmp-echo 192.0.2.1 frequency 10
Switch(config)# ip sla schedule 1 life forever start now
Switch# show ip sla statistics
```

The simulator reports sent, received, lost, minimum/average/maximum RTT, and jitter values for synthetic probes.

## Features
- **Tab Completion**: Auto-complete commands with TAB
- **Command History**: Up/Arrow keys for previous commands
- **Context Help**: Use `?` for command help
- **Error Checking**: Detailed error messages for invalid commands
