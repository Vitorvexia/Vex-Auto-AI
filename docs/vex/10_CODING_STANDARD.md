10_CODING_STANDARD.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 10

# CODING STANDARD

Version: 1.0

Status: Critical

Authority: Extremely High

Depends on:

06_ENGINEERING_MINDSET.md

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

---

> "Code is written once and read thousands of times."

---

# PURPOSE

This document defines the mandatory coding standards for every line of code inside VEX.

The objective is consistency.

Every file should look like it was written by the same engineer.

Regardless of who actually wrote it.

Humans.

Claude.

GPT.

Future contributors.

The codebase must have one identity.

---

# THE PRIMARY RULE

Readable code is more valuable than clever code.

Always optimize for understanding.

Never optimize for ego.

---

# THE VEX CODE PRIORITIES

Correctness

↓

Reliability

↓

Maintainability

↓

Readability

↓

Performance

↓

Elegance

Never change this order.

---

# WRITE FOR THE NEXT ENGINEER

The next engineer might be:

You in six months.

Another developer.

Another AI.

A future CTO.

Code should explain itself.

---

# SELF-DOCUMENTING CODE

Good names eliminate comments.

Prefer:

calculateLeadPriority()

Instead of:

calc()

Variables should describe intent.

Bad

x

temp

obj

Good

leadPriority

conversationStatus

retryAttempt

vehicleCost

---

# FUNCTIONS

A function should have one responsibility.

If a function needs "and",

consider splitting it.

Good

validateLead()

persistConversation()

sendWhatsApp()

Bad

validatePersistAndSend()

---

# FUNCTION SIZE

Prefer small functions.

Ideal:

10–30 lines.

Acceptable:

50 lines.

Above 80 lines:

Refactor unless strongly justified.

---

# PARAMETERS

Prefer explicit parameters.

Avoid boolean ambiguity.

Bad

sendMessage(true)

Good

sendMessage({
  persist: true
})

Objects communicate intent.

---

# RETURN VALUES

Always return structured data.

Bad

return true

Good

return {
  success: true,
  conversationId,
  messageId
}

---

# ERROR HANDLING

Errors are business events.

Never ignore them.

Never swallow exceptions.

Every error should:

Be categorized.

Be logged.

Be actionable.

Contain context.

---

# MAGIC VALUES

Never hardcode unexplained values.

Bad

timeout = 5000

Good

const WHATSAPP_TIMEOUT_MS = 5000

---

# DUPLICATION

Duplicate knowledge.

Never duplicate logic.

If business rules exist twice,

they will diverge.

---

# COMMENTS

Explain WHY.

Never WHAT.

Bad

// Increment i

i++

Good

// Retry required because Meta may return temporary 429.

---

# FILE ORGANIZATION

Every file follows:

Imports

Constants

Types

Helpers

Main Logic

Exports

Predictability reduces cognitive load.

---

# IMPORTS

Prefer absolute imports.

Avoid deep relative paths.

Good

@/lib/logger

Bad

../../../../logger

---

# TYPESCRIPT

Never use any.

Prefer unknown over any.

Always define interfaces.

Enable strict mode.

Treat compiler warnings as defects.

---

# IMMUTABILITY

Prefer immutable data.

Avoid mutation.

Bad

lead.status = CLOSED

Good

return {
  ...lead,
  status: CLOSED
}

---

# SIDE EFFECTS

Separate pure logic from side effects.

Pure functions are easier to test.

Business logic should not directly call external APIs.

---

# ASYNC CODE

Await explicitly.

Never ignore promises.

Every async failure must be handled.

---

# NULL HANDLING

Never assume data exists.

Explicitly validate.

Undefined behavior becomes production incidents.

---

# CONFIGURATION

Never hardcode secrets.

Never hardcode URLs.

Never hardcode credentials.

Everything configurable belongs in environment variables or configuration.

---

# LOGGING

Every important operation logs:

Start

Success

Failure

Duration

Context

Logs should answer production questions without reproducing the issue.

---

# FEATURE FLAGS

Risky behavior should be configurable.

Avoid permanent forks in code.

---

# PERFORMANCE

Measure first.

Optimize second.

Guessing performance problems creates technical debt.

---

# SECURITY

Never trust user input.

Validate everything.

Escape outputs.

Sanitize logs.

Protect secrets.

Apply least privilege.

---

# TESTABILITY

Every important function should be testable in isolation.

If testing is difficult,

the design is probably wrong.

---

# REFACTORING

Refactor when:

Understanding decreases.

Duplication increases.

Testing becomes difficult.

Dependencies grow unnecessarily.

Never refactor only for aesthetics.

---

# AI GENERATED CODE

AI code is not trusted automatically.

Every generated code must be reviewed.

Questions:

Is it correct?

Is it maintainable?

Does it follow architecture?

Does it introduce hidden coupling?

Does it increase complexity?

AI accelerates writing.

Humans validate quality.

---

# CODE REVIEW CHECKLIST

Before merging:

□ Names are clear.

□ No duplicated business logic.

□ Errors handled.

□ Tests updated.

□ Logs adequate.

□ Security validated.

□ Performance acceptable.

□ Architecture respected.

□ Documentation updated if necessary.

---

# THINGS WE NEVER DO

❌ Use any.

❌ Ignore errors.

❌ Silence exceptions.

❌ Mix business logic with infrastructure.

❌ Hardcode secrets.

❌ Commit dead code.

❌ Leave TODOs without context.

❌ Optimize prematurely.

❌ Write clever code for impressing others.

---

# THE BOY SCOUT RULE

Leave the code cleaner than you found it.

Even a tiny improvement matters.

---

# CTO PRINCIPLE

A good codebase scales with traffic.

A great codebase scales with engineers.

Write code that survives years.

Not sprints.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

Readability beats cleverness.

2.

Every line should reduce complexity.

3.

Future engineers are your primary users.

---

# RELATED DOCUMENTS

09_SYSTEM_DESIGN.md

11_BACKEND_GUIDELINES.md

12_DATABASE_STANDARDS.md

13_FRONTEND_GUIDELINES.md

---

End of Book 10.