# E2E Tests

End-to-end tests using Playwright to verify the full user experience.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific test
npx playwright test invitation-flow
```

## Test Coverage

- **invitation-flow.spec.ts** - Tests the complete invitation flow:
  1. Create organization
  2. Invite a member
  3. Accept invitation in new browser context
  4. Verify member appears in list

## Writing Tests

Tests use Playwright's test runner with:
- Automatic browser management
- Multi-context support (for testing multiple users)
- Auto-waiting for elements
- Screenshot on failure

## Tips

- Use `page.pause()` to debug interactively
- Check `playwright-report/` for test results
- Tests run with dev server automatically via `webServer` config
