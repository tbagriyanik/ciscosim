# DNS and HTTP Service Usage Guide

## 🌐 DNS (Domain Name System) Service

DNS service is used to resolve domain names to IP addresses.

### Enabling DNS Service

1. Open the PC Panel and navigate to the **DNS** tab
2. Enable DNS service using the toggle switch
3. Add DNS records:
   - **Domain**: Enter domain name (e.g., `example.com`)
   - **Address**: Enter IP address (e.g., `192.168.1.10`)
   - Click **Add Record** button

### DNS Record Example

```
Domain: a10.com
Address: 192.168.1.10

Domain: www.a10.com
Address: a10.com
```

### Using DNS

You can use the following commands in the terminal:

```bash
# Resolve domain name with DNS
nslookup example.com

# Access web server via HTTP (with domain name)
http webserver.local

# Ping command (with domain name)
ping example.com
```

### DNS Requirements

- DNS server IP must be configured in PC's DNS settings
- Physical connectivity to DNS server must exist
- At least one record must exist on DNS server

---

## 🌍 HTTP (Hypertext Transfer Protocol) Service

HTTP service is used to serve simple web content.

### Enabling HTTP Service

1. Open the PC Panel and navigate to the **Services** tab
2. Enable HTTP service using the toggle switch in the **HTTP** section
3. Enter the content to display in **HTTP Content** field

### HTML Tags

You can use the following HTML tags in HTTP content:

- `<b>text</b>` - **Bold text**
- `<i>text</i>` - *Italic text*

### Security

The system sanitizes all HTML content to prevent XSS attacks:
- Only `<b>` and `<i>` tags are allowed
- All other HTML tags are stripped
- JavaScript code execution is prevented

### HTTP Content Examples

#### Example 1: Basic Text
```
Hello World!
```

#### Example 2: Formatted Text
```
<b>Welcome!</b> This is an <i>example</i> HTTP page.
```

#### Example 3: Title and Description
```
<b style="font-size: 20px;">Main Title</b>
<i>This is a subtitle</i>
```

### Accessing HTTP Service

To access HTTP service from terminal:

```bash
# Access by IP address
http 192.168.1.100

# Access by domain name (DNS required)
http example.com
```

---

## 🔧 Troubleshooting

### DNS Resolution Fails

1. Ensure DNS server is enabled
2. Check connectivity to DNS server
3. Verify DNS record is properly configured
4. Check PC's DNS setting is correct

### HTTP Page Not Displaying

1. Verify HTTP service is enabled
2. Check target device is reachable
3. Verify gateway and subnet settings
4. If using DNS, ensure DNS resolution is working

---

## 📋 Example Scenario

### Scenario: Web Server and DNS

1. Configure **PC-1** as web server:
   - IP: `192.168.1.100`
   - HTTP Service: Enabled
   - HTTP Content: `<b>Welcome!</b> This is a <i>test</i> page.`

2. Configure **PC-2** as DNS server:
   - IP: `192.168.1.10`
   - DNS Service: Enabled
   - DNS Record: `a10.com → 192.168.1.10`
   - DNS Record (CNAME-like): `www.a10.com → a10.com`

3. Access from **PC-3**:
   - Set DNS to `192.168.1.10`
   - Run commands: `http www.a10.com` and `nslookup www.a10.com` in terminal

Result: `www.a10.com` resolves to `a10.com`, then to an IP address, and the web page opens.

---

## ⚠️ Security Notes

- HTTP content is automatically sanitized
- Only `<b>` and `<i>` tags are safe
- Script tags and event handlers are blocked
- External resource links are not supported
