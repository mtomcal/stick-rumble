# Playwright Visual Testing - System Dependencies

## Issue: Missing System Libraries

Visual regression tests require system-level dependencies that cannot be installed without sudo access.

### Error Encountered
```
error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file: No such file or directory
```

### Required Installation

To run visual regression tests, system dependencies must be installed:

```bash
# Option 1: Install Playwright system dependencies (requires sudo)
npx playwright install-deps chromium

# Option 2: Manual installation on Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0
```

## Baseline Screenshot Generation

Once system dependencies are installed:

```bash
# Generate baseline screenshots
npm run test:visual:update

# Verify baselines were created
ls -la tests/screenshots/baseline/

# Run visual regression tests
npm run test:visual
```

## CI/CD Setup

For CI environments (GitHub Actions, GitLab CI, etc.):

```yaml
# Example GitHub Actions step
- name: Install Playwright system dependencies
  run: npx playwright install-deps chromium

- name: Generate baseline screenshots (first run)
  run: npm run test:visual:update

- name: Run visual regression tests
  run: npm run test:visual

- name: Upload diff images on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Development Workflow

1. **First-time setup**: Install system dependencies (requires sudo)
2. **Generate baselines**: Run `npm run test:visual:update` to create initial screenshots
3. **Commit baselines**: Add `tests/screenshots/baseline/` to git
4. **Make UI changes**: Modify UI components as needed
5. **Verify visuals**: Run `npm run test:visual` to detect regressions
6. **Update if intentional**: Run `npm run test:visual:update` if visual changes are expected

## Current Status

- ✅ Playwright installed (`@playwright/test` npm package)
- ✅ Chromium browser downloaded
- ❌ System dependencies not installed (requires sudo)
- ❌ Baseline screenshots not generated (blocked by missing dependencies)

## Next Steps

**For local development:**
1. Run `npx playwright install-deps chromium` (requires sudo password)
2. Run `npm run test:visual:update` to generate baselines
3. Commit the baseline screenshots to the repository

**For CI:**
1. Add Playwright dependency installation to CI pipeline
2. Generate baselines on first CI run (or commit manually)
3. Configure artifact upload for diff images on test failures

## Alternative: Docker-based Testing

If sudo access is restricted, visual tests can run in Docker:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Generate baselines
RUN npm run test:visual:update

# Run tests
CMD ["npm", "run", "test:visual"]
```

Run with:
```bash
docker build -t stick-rumble-visual-tests .
docker run stick-rumble-visual-tests
```
