# Review

Run linters, check for common issues, and summarize what might need attention.

1. Run lint (and typecheck if available) in the relevant packages (e.g. `backend-v2/`, `frontend-v2/`)
2. Review changes against the checklist in `.cursor/rules/code-review.mdc`
3. Summarize: approval state (Approved / Needs Changes / Rejected), issues found (file:line + severity), and optional suggestions

Output format:

```markdown
## Review Summary

**Approval**: ✅ Approved / ⚠️ Needs Changes / ❌ Rejected

### Issues Found

- [severity] file:line - description

### Suggestions

- optional improvement ideas
```
