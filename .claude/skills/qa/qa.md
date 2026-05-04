---
name: qa
description: Run manual QA test plans from tests/manual/ using Playwright MCP browser automation. Invoke with /qa to run all plans, or /qa <filter> to run plans matching a keyword.
user_invocable: true
---

# Manual QA Runner

Run browser-based QA test plans defined in `tests/manual/*.test-plan.md`.

## How it works

1. **Find test plans** — Glob for `tests/manual/*.test-plan.md`. If args were provided, filter to plans whose filename contains the arg.
2. **Check prerequisites** — Verify `npm run dev` is running (check port 5173). If not, tell the user to start it.
3. **Execute each plan** — For each test plan file:
   - Read the plan
   - Parse the steps (each `### N.` heading is a step)
   - Use Playwright MCP tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_type`, `browser_take_screenshot`) to execute each step
   - After each step, take a screenshot and verify the **Expect** condition against what's visible on the page
   - Track pass/fail for each step
4. **Handle multi-account flows** — When a step says "As: <different-account>", sign out and sign in (or sign up) as that account. Use the email pattern `qa-<account>-<timestamp>@test.com` with password `QaTest123!` for fresh accounts.
5. **Report results** — After all steps, print a summary table of pass/fail per step.

## Rules

- **Always use `browser_snapshot`** to read the page state before interacting — never guess element refs.
- **Take a screenshot after each step** for visual evidence. Use filenames like `qa-step-01.png`.
- **Don't stop on first failure** — mark the step as failed and continue to the next step if possible.
- **Clean up** — Delete screenshots after the run. Don't commit them.
- **Fresh accounts every run** — Use a timestamp in the email to avoid collisions with previous runs.

## Example invocation

```
/qa                  → runs all test plans in tests/manual/
/qa invitations      → runs only plans matching "invitations"
```
