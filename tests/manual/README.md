# Manual QA Test Plans

Browser-based test plans for features that need visual/interaction verification beyond what unit tests cover.

## For contributors

Each `.test-plan.md` file describes a test scenario with step-by-step instructions. You can run them manually in a browser, or use the Claude Code `/qa` skill to automate them via Playwright.

### Writing a test plan

Use this structure:

```markdown
# Plan title

> One-line summary of what this tests

## Prerequisites
- What needs to be running (e.g., `npm run dev`)
- Starting state (e.g., "no existing test accounts")

## Accounts
- **account-name**: description (e.g., "alice: org owner")

## Steps

### 1. Step title
- **As**: account-name
- **Action**: what to do
- **Expect**: what should happen

### 2. Next step
...
```

### Running with Claude Code

```
/qa                     # run all test plans
/qa invitations         # run plans matching "invitations"
```
