# Security Guidelines - OpenClaw Memory v0.4.2

This document outlines security considerations and best practices for OpenClaw Memory.

---

## 🔐 API Key Security

### Never Commit API Keys

**❌ DO NOT:**
- Commit `.env` file to git
- Hardcode API keys in source code
- Share `.env` file or API keys publicly
- Include API keys in screenshots or logs

**✅ DO:**
- Keep API keys in `.env` file (automatically git-ignored)
- Use `.env.example` as template (without real keys)
- Rotate API keys if accidentally exposed
- Use environment variables for sensitive data

### API Key Storage

```bash
# ✅ Correct: Store in .env file
GEMINI_API_KEY=your_actual_key_here

# ❌ Wrong: Hardcode in source
const API_KEY = 'AIzaSy...' // NEVER DO THIS
```

### If API Key is Exposed

1. **Immediately revoke** the exposed key:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Delete the compromised key

2. **Generate a new key:**
   - Create new API key
   - Update `.env` file with new key

3. **Review usage:**
   - Check Google Cloud Console for unexpected API calls
   - Report if you suspect abuse

---

## 📁 Data Privacy

### Personal Data in Memory System

OpenClaw Memory stores conversation data that may contain:
- User queries and responses
- Code snippets
- Project documentation
- Imported chat histories

### Data Storage Locations

```
C:\Users\Vlad\.openclaw\memory\
├── hippocampus/      # Short-term memory (conversations)
├── neocortex/        # Long-term memory (knowledge graph)
└── meta/             # Import history, logs
```

**All directories are git-ignored by default.**

### Data Protection Best Practices

1. **Do not commit data directories:**
   ```bash
   # Already in .gitignore:
   hippocampus/
   neocortex/
   meta/
   ```

2. **Sanitize before sharing:**
   - If sharing knowledge graph for debugging, remove personal data
   - Redact sensitive concepts/relationships
   - Use generic test data

3. **Regular backups:**
   ```bash
   # Backup to secure location
   cp -r neocortex ~/backups/neocortex-$(date +%Y%m%d)
   cp -r hippocampus ~/backups/hippocampus-$(date +%Y%m%d)
   ```

4. **Secure import files:**
   - Be cautious importing chat exports (may contain sensitive info)
   - Review imported data before consolidation
   - Delete import files after processing if they contain secrets

---

## 🌐 Dashboard Security

### Local Network Only

The dashboard is intended for **local use only**:

```javascript
// dashboard/server.js
app.listen(PORT, 'localhost', () => {  // Binds to localhost only
  console.log(`Server running at: http://localhost:${PORT}`);
});
```

**⚠️ WARNING:** Do not expose the dashboard to the internet without authentication.

### If You Need Remote Access

**Option 1: SSH Tunnel (Recommended)**
```bash
# From remote machine
ssh -L 3000:localhost:3000 user@your-server
# Then access http://localhost:3000 locally
```

**Option 2: VPN**
- Connect to VPN
- Access dashboard via private network

**Option 3: Add Authentication (Advanced)**
- Implement authentication middleware
- Use HTTPS with valid certificate
- Rate limiting and CORS protection

---

## 🔒 Input Validation

### Import File Validation

The system performs basic validation on imported files:

```javascript
// File size limit (50MB default)
limits: { fileSize: 50 * 1024 * 1024 }

// File type validation
const supportedFormats = ['.json', '.txt', '.md', '.csv', '.js', '.py', '.ts'];
```

### User Input Sanitization

**Queries:**
- User queries are sent to Gemini API for embedding
- No code execution based on user input
- XSS protection: dashboard sanitizes HTML output

**File Uploads:**
- Temporary files deleted after processing
- File extension validation
- Content parsing with error handling

---

## 🛡️ Dependency Security

### Regular Updates

```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Update dependencies
npm update
```

### Dependency Versions

Current dependencies (v0.4.2):
```json
{
  "axios": "^1.6.0",      # HTTP client
  "dotenv": "^16.6.1",    # Environment variables
  "express": "^4.18.2",   # Web server
  "multer": "^2.1.1",     # File uploads
  "vectra": "^0.14.0"     # Vector search
}
```

**Security considerations:**
- All dependencies are from npm official registry
- Regularly updated to latest stable versions
- No dependencies with known vulnerabilities

---

## 📝 Transaction Security

### ACID Guarantees

All knowledge graph modifications use transactions:

```javascript
await txManager.execute(async () => {
  // Modify graph
  // If error occurs, automatically rolls back
}, 'operation-name');
```

**Benefits:**
- Data integrity (no partial writes)
- Automatic backups before modifications
- Rollback on failure

### Backup Retention

- Last 10 transaction backups retained
- Stored in `hippocampus/backups/`
- Automatic cleanup of old backups

---

## 🚨 Security Checklist for Distribution

Before sharing or distributing OpenClaw Memory:

- [ ] Remove `.env` file or ensure it contains no real API keys
- [ ] Verify `.env.example` has placeholder values only
- [ ] Check no API keys hardcoded in source files
- [ ] Ensure data directories (hippocampus/, neocortex/) are empty or git-ignored
- [ ] Review import history for sensitive file paths
- [ ] Sanitize test data (no personal information)
- [ ] Run `npm audit` to check for vulnerabilities
- [ ] Update dependencies to latest secure versions
- [ ] Review README for any sensitive information
- [ ] Check git history doesn't contain secrets (if applicable)

---

## 🔍 Security Audit Commands

### Check for Exposed Secrets

```bash
# Search for potential API keys in code
grep -r "AIza" --include="*.js" --include="*.json" .

# Check .env is git-ignored
git check-ignore .env
# Should output: .env

# Check no secrets in git history
git log --all --full-history --source --pretty=format: -- .env | wc -l
# Should be 0
```

### Verify Data Directory Ignored

```bash
# Check data directories are ignored
git check-ignore hippocampus/ neocortex/ meta/
# Should output all three paths

# Verify no data files tracked
git ls-files | grep -E "(hippocampus|neocortex|meta)/"
# Should be empty
```

### Test Dashboard Security

```bash
# Verify dashboard only binds to localhost
netstat -an | grep ":3000"
# Should show 127.0.0.1:3000 or [::1]:3000, NOT 0.0.0.0:3000
```

---

## 📊 Threat Model

### Potential Security Risks

**Low Risk:**
- ✅ API key exposure via committed `.env` → **Mitigated:** .gitignore, documentation
- ✅ Personal data in knowledge graph → **Mitigated:** Data directories git-ignored
- ✅ XSS in dashboard → **Mitigated:** HTML sanitization, local-only access

**Medium Risk:**
- ⚠️ Unauthorized dashboard access on shared network → **Mitigation:** Bind to localhost only
- ⚠️ Malicious import files (XSS, code injection) → **Mitigation:** Input validation, no eval()

**Not in Scope:**
- ❌ DDoS protection (local-only tool)
- ❌ Multi-user authentication (single-user system)
- ❌ End-to-end encryption (local storage)

---

## 🐛 Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. **Email:** security@openclaw.dev
3. **Include:**
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will:
- Acknowledge within 48 hours
- Investigate and provide timeline
- Release patch in next version
- Credit reporter (if desired)

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Web application security risks
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices) - Node.js security
- [Google Cloud Security](https://cloud.google.com/security) - API security best practices

---

## ✅ Security Compliance

OpenClaw Memory follows:
- **Principle of Least Privilege** - Minimal permissions required
- **Defense in Depth** - Multiple layers of security (input validation, git-ignore, localhost-only)
- **Fail Secure** - Errors result in safe state (transaction rollback, no partial writes)
- **Security by Default** - Secure configuration out of the box (.gitignore, .env.example)

---

**OpenClaw Memory v0.4.2**
*Security Guidelines*
*Last updated: 12 апреля 2026*

---

## Version History

- **v0.4.2** (2026-04-12): Initial security documentation
  - Added .env.example template
  - Comprehensive .gitignore
  - Security audit checklist
  - Dashboard security guidelines
