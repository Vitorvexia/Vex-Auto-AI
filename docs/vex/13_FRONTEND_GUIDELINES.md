13_FRONTEND_GUIDELINES.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 13

# FRONTEND GUIDELINES

Version: 1.0

Status: Critical

Authority: Extremely High

Depends on:

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

11_BACKEND_GUIDELINES.md

12_DATABASE_STANDARDS.md

---

> "The frontend is not where business logic lives.
It is where business value becomes visible."

---

# PURPOSE

This document defines how every frontend inside VEX must be designed, implemented and evolved.

The frontend exists to communicate information.

Not to own it.

Not to protect it.

Not to decide business rules.

Its purpose is clarity.

---

# THE RESPONSIBILITIES OF THE FRONTEND

The frontend owns:

Presentation

Interaction

Feedback

Accessibility

Navigation

State visualization

Performance perception

It does NOT own:

Business rules

Authorization

Permissions

Financial calculations

Security decisions

Persistence logic

Those belong to the backend.

---

# FIRST PRINCIPLE

The frontend should always tell the truth.

Never fake successful operations.

Never hide failures.

Never assume data.

The UI reflects reality.

It never invents it.

---

# USER EXPERIENCE

Every screen must answer instantly:

Where am I?

What can I do?

What just happened?

What happens next?

Confused users indicate poor design.

---

# DESIGN PHILOSOPHY

Minimal.

Predictable.

Fast.

Professional.

Reduce cognitive load.

Every visual element must have a reason.

If it doesn't,

remove it.

---

# COMPONENTS

Components represent reusable concepts.

Examples

LeadCard

ConversationPanel

VehicleSelector

StatusBadge

MetricsCard

Never create components only because code is repeated.

Create them because concepts repeat.

---

# COMPOSITION

Prefer composition over inheritance.

Small components.

Clear responsibilities.

Reusable building blocks.

---

# STATE MANAGEMENT

Use the smallest possible state.

Local state first.

Server state second.

Global state only when necessary.

Every new global state increases complexity.

---

# SERVER STATE

Server is the source of truth.

Frontend caches.

Frontend never becomes the owner.

Always assume server data may change.

---

# LOADING STATES

Every asynchronous operation must communicate progress.

Loading

Empty

Success

Error

Retry

Never leave users wondering.

---

# OPTIMISTIC UI

Only use optimistic updates when:

Rollback is safe.

Conflicts are acceptable.

Failure is recoverable.

Otherwise,

wait for confirmation.

---

# ERROR UX

Errors should explain:

What happened.

What the user can do.

Whether data is safe.

Never expose stack traces.

Never expose technical details.

---

# FORMS

Forms validate early.

Backend validates finally.

Frontend validation improves UX.

Backend validation guarantees correctness.

---

# NAVIGATION

Navigation must be predictable.

Never surprise users.

Every important action should be reversible whenever possible.

---

# RESPONSIVENESS

Every screen must function on:

Desktop

Tablet

Mobile

Design mobile intentionally.

Do not shrink desktop layouts.

---

# ACCESSIBILITY

Every feature should support:

Keyboard navigation

Screen readers

Focus indicators

Color contrast

Semantic HTML

Accessibility is quality.

Not an optional enhancement.

---

# PERFORMANCE

Measure:

Largest Contentful Paint

Interaction latency

Hydration cost

Bundle size

Rendering frequency

Optimize only after measuring.

---

# RENDERING

Avoid unnecessary renders.

Prefer memoization only when profiling justifies it.

Do not optimize blindly.

Complexity is expensive.

---

# NEXT.JS

Prefer:

Server Components

Server Actions

Streaming

Suspense

Cache invalidation

Client Components only when interaction requires them.

---

# DATA FETCHING

Fetch near where data is used.

Avoid unnecessary waterfalls.

Avoid duplicate requests.

Prefer server-side fetching whenever possible.

---

# UI FEEDBACK

Every user action deserves feedback.

Buttons

Progress

Success

Failure

Confirmation

Silence creates uncertainty.

---

# DESIGN SYSTEM

Every interface uses the same:

Typography

Spacing

Colors

Icons

Animations

Borders

Radius

Components

One product.

One visual language.

---

# ANIMATIONS

Animations communicate.

Never decorate.

Use animation to explain:

Transitions

Loading

Completion

Hierarchy

Keep them subtle.

---

# EMPTY STATES

Every empty screen should educate.

Explain:

Why nothing is shown.

How to change it.

What happens next.

Never display blank pages.

---

# TABLES

Tables must support:

Sorting

Filtering

Searching

Pagination

Responsive behavior

Selection

Bulk actions

Without sacrificing readability.

---

# DASHBOARDS

Dashboards answer questions.

Never display numbers without context.

Metrics require:

Definition

Time period

Comparison

Trend

Actionability

---

# FRONTEND SECURITY

Never trust browser state.

Never expose secrets.

Never expose internal IDs unnecessarily.

Never store sensitive tokens insecurely.

Treat the browser as hostile.

---

# OBSERVABILITY

Frontend errors should be measurable.

Track:

Crashes

Slow screens

Failed requests

User interactions

Abandoned flows

Visibility enables improvement.

---

# COMMON ANTI-PATTERNS

❌ Business logic inside React components.

❌ Massive components (>300 lines).

❌ Multiple sources of truth.

❌ Silent loading.

❌ Infinite spinners.

❌ Hardcoded colors.

❌ Inconsistent spacing.

❌ Client-side authorization.

❌ Direct database assumptions.

❌ Copying components instead of reusing them.

---

# REVIEW CHECKLIST

Before merge:

□ UX consistent.

□ Loading states complete.

□ Error states implemented.

□ Accessibility verified.

□ Responsive layout tested.

□ Design System respected.

□ No business logic in UI.

□ Server remains source of truth.

□ Performance acceptable.

□ Components reusable.

---

# CTO PRINCIPLE

The frontend should make complex systems feel simple.

Users should never experience the complexity behind the product.

That is our responsibility.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

The frontend communicates.

The backend decides.

2.

Consistency beats creativity.

3.

Users judge products by experience,

not architecture.

---

# RELATED DOCUMENTS

10_CODING_STANDARD.md

11_BACKEND_GUIDELINES.md

12_DATABASE_STANDARDS.md

14_AI_ENGINEERING.md

15_TESTING_STANDARD.md

DESIGN_SYSTEM.md

---

End of Book 13.