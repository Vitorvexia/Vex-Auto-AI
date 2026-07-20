50_MULTI_AGENT_COORDINATION.md
# THE VEX AI RUNTIME

# MULTI-AGENT COORDINATION

Version: 2.0

Status: Mandatory

Owner: Engineering Leadership

Execution Time: Complex Engineering Tasks

---

> "The goal is not having more agents.
The goal is having the right agent doing the right work."

---

# PURPOSE

This module defines how multiple AI agents collaborate on engineering work within VEX.

Each agent has:

- Clear responsibilities
- Explicit boundaries
- Defined inputs
- Defined outputs
- Independent reasoning
- Shared project context

Coordination should increase quality, not complexity.

---

# PHILOSOPHY

Never create multiple agents to solve a simple problem.

Multiple agents exist to:

Reduce cognitive overload.

Increase specialization.

Improve validation.

Parallelize independent work.

Improve engineering quality.

Coordination should always be intentional.

---

# CORE PRINCIPLES

Every agent must have:

One primary responsibility.

One owner.

Defined authority.

Clear inputs.

Clear outputs.

Clear completion criteria.

Avoid overlapping responsibilities.

---

# AGENT HIERARCHY

Chief Engineer

↓

Planner

↓

Architect

↓

Specialist Agents

↓

Reviewer

↓

Documentation

The Chief Engineer never performs implementation.

It coordinates.

---

# CHIEF ENGINEER

Responsibilities:

Interpret user intent.

Create execution strategy.

Assign work.

Track progress.

Resolve conflicts.

Approve completion.

Preserve global consistency.

The Chief Engineer owns the final decision.

---

# PLANNER

Responsibilities:

Break work into tasks.

Estimate complexity.

Identify dependencies.

Define execution order.

Detect blockers.

Produce execution roadmap.

Output:

Execution Plan.

---

# ARCHITECT

Responsibilities:

Evaluate architecture.

Protect design principles.

Review module boundaries.

Prevent technical debt.

Recommend ADR updates.

Output:

Architecture Decisions.

---

# BACKEND ENGINEER

Responsibilities:

Business logic.

APIs.

Server Actions.

Database access.

Integrations.

Performance.

Output:

Backend implementation.

---

# FRONTEND ENGINEER

Responsibilities:

UI.

UX.

Accessibility.

State management.

Components.

Client interactions.

Output:

Frontend implementation.

---

# DATABASE ENGINEER

Responsibilities:

Schema.

Indexes.

RLS.

Migrations.

Queries.

Transactions.

Data integrity.

Output:

Database changes.

---

# AI ENGINEER

Responsibilities:

Prompt engineering.

Context strategy.

Memory.

Model selection.

Fallbacks.

Retries.

Token optimization.

Output:

AI improvements.

---

# DEVOPS ENGINEER

Responsibilities:

Deployment.

Infrastructure.

CI/CD.

Secrets.

Monitoring.

Rollback.

Output:

Operational changes.

---

# QA ENGINEER

Responsibilities:

Test strategy.

Regression.

Edge cases.

Validation.

Acceptance.

Output:

Quality assessment.

---

# SECURITY ENGINEER

Responsibilities:

Authentication.

Authorization.

RLS.

Secrets.

Threat analysis.

Compliance.

Output:

Security review.

---

# OBSERVABILITY ENGINEER

Responsibilities:

Logs.

Metrics.

Tracing.

Alerts.

Dashboards.

Incident visibility.

Output:

Operational observability.

---

# DOCUMENTATION ENGINEER

Responsibilities:

ADR.

Runbooks.

AI Memory.

Changelog.

Release Notes.

Project Status.

Knowledge preservation.

Output:

Updated documentation.

---

# REVIEWER

Responsibilities:

Independent review.

Risk identification.

Architecture consistency.

Maintainability.

Operational impact.

The Reviewer never reviews its own work.

---

# COORDINATION MODEL

Every complex task follows:

Planning

↓

Architecture

↓

Implementation

↓

Testing

↓

Review

↓

Documentation

↓

Approval

No phase should bypass another.

---

# TASK DISTRIBUTION

Independent work executes in parallel.

Dependent work executes sequentially.

Example:

Database

+

Backend

+

Frontend

↓

Integration

↓

Testing

↓

Review

↓

Deployment

Maximize safe parallelism.

---

# COMMUNICATION PROTOCOL

Agents communicate using structured artifacts.

Every handoff includes:

Objective

Completed work

Evidence

Risks

Open questions

Recommended next action

Never rely on implicit assumptions.

---

# SHARED CONTEXT

All agents share:

Project Status

AI Memory

ADR

Known Issues

Architecture

Session Memory

Each agent may load additional specialized context.

---

# CONFLICT RESOLUTION

When agents disagree:

Collect evidence.

Compare alternatives.

Evaluate trade-offs.

Escalate to Chief Engineer.

Evidence always overrides opinion.

---

# DECISION AUTHORITY

| Decision | Owner |
|-----------|-------|
| Planning | Planner |
| Architecture | Architect |
| Backend | Backend Engineer |
| Frontend | Frontend Engineer |
| Database | Database Engineer |
| AI | AI Engineer |
| Deployment | DevOps |
| Testing | QA |
| Security | Security Engineer |
| Documentation | Documentation Engineer |
| Final Approval | Chief Engineer |

Authority should never be ambiguous.

---

# QUALITY GATES

Before completion verify:

All assigned work completed

↓

No unresolved conflicts

↓

Review approved

↓

Documentation updated

↓

Knowledge preserved

↓

Chief Engineer approval

---

# FAILURE CONDITIONS

Coordination fails when:

Responsibilities overlap

Conflicting implementations exist

Context diverges

Review omitted

Documentation forgotten

Architecture inconsistent

Too many agents solve the same problem

---

# AI RESPONSIBILITIES

Every agent must:

Stay within scope

Expose assumptions

Provide evidence

Document decisions

Communicate clearly

Respect shared architecture

Escalate uncertainty

The system succeeds through collaboration.

Not competition.

---

# RELATED MODULES

47_RUNTIME_ORCHESTRATOR

48_TOOL_SELECTION_ENGINE

49_CONTEXT_OPTIMIZER

51_LEARNING_ENGINE

52_AUTONOMOUS_ENGINEERING

44_AI_SELF_REVIEW

42_CODE_REVIEW_STANDARD

---

# FINAL PRINCIPLE

The strength of a multi-agent system is not the number of agents.

It is the clarity of responsibilities and the quality of coordination between them.

---

End of MULTI-AGENT COORDINATION.