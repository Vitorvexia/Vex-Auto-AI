12_DATABASE_STANDARDS.md
# THE VEX OPERATING SYSTEM

# Volume II — Engineering

# Book 12

# DATABASE STANDARDS

Version: 1.0

Status: Critical

Authority: Extremely High

Depends on:

08_ARCHITECTURE_PRINCIPLES.md

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

11_BACKEND_GUIDELINES.md

---

> "The database remembers every mistake the application forgets."

---

# PURPOSE

This document defines the mandatory standards for designing, evolving and operating every database used by VEX.

The database is the single source of truth.

Applications come and go.

Frameworks change.

Languages evolve.

The data remains.

Design it accordingly.

---

# FIRST PRINCIPLE

The database models the business.

Never the UI.

Never the API.

Never the current implementation.

Tables represent business entities.

Not screens.

---

# SOURCE OF TRUTH

Every business fact has exactly one source of truth.

Examples

Lead owner

Conversation status

Vehicle cost

Sale value

Store configuration

Never duplicate ownership.

Derived values should be computed.

Not persisted.

Unless justified.

---

# ENTITY DESIGN

Every entity must define:

Identity

Purpose

Owner

Lifecycle

Relationships

Constraints

Auditability

Deletion strategy

If one of these is undefined,

the entity is incomplete.

---

# PRIMARY KEYS

Use UUIDs.

Never sequential IDs for business entities.

Benefits:

Safer exposure

Distributed generation

Merge friendly

Harder enumeration

Consistency across services

---

# FOREIGN KEYS

Every relationship must be explicit.

Never rely on application logic alone.

The database must enforce integrity.

If an entity cannot exist without another,

the relationship must exist in the schema.

---

# CONSTRAINTS

Business invariants belong in the database whenever possible.

Examples

UNIQUE

CHECK

FOREIGN KEY

NOT NULL

EXCLUDE

The application validates.

The database guarantees.

---

# NULLABILITY

NULL means "unknown".

It does not mean:

False

Zero

Empty

Not applicable

Avoid nullable columns unless they represent a real business state.

---

# ENUMS

Prefer controlled values.

States should be finite.

Bad

status TEXT

Good

CHECK (...)

ENUM

Reference table

Undefined states become production bugs.

---

# NORMALIZATION

Normalize until duplication disappears.

Denormalize only when measurements justify it.

Never denormalize because it feels faster.

Measure first.

---

# INDEXES

Every index exists for a reason.

Document:

Query served

Expected selectivity

Maintenance cost

Unused indexes are technical debt.

Missing indexes are performance debt.

---

# QUERY DESIGN

Queries should be:

Predictable

Deterministic

Indexed

Tenant-safe

Never rely on implicit ordering.

Always define ORDER BY.

---

# TRANSACTIONS

Use transactions whenever multiple writes represent one business action.

Examples

Close sale

Assign conversation

Transfer ownership

Inventory update

Partial commits are unacceptable.

---

# CONCURRENCY

Assume concurrent writes.

Use:

Transactions

Row locks

Optimistic locking

Conflict detection

Race conditions are design failures.

---

# SOFT DELETE

Soft delete only when recovery or audit is required.

Otherwise,

delete permanently.

Soft delete is not free.

It increases complexity forever.

---

# AUDITABILITY

Important business entities require history.

Record:

Who

When

Previous value

New value

Reason

Audit data must never be mutable.

---

# MIGRATIONS

Every schema change happens through migrations.

Never edit production manually.

Every migration must be:

Deterministic

Repeatable

Reversible when possible

Reviewed

Tested

---

# BACKWARD COMPATIBILITY

Migrations should not break running deployments.

Preferred strategy:

Expand

Migrate

Contract

Never:

Break

Deploy

Hope

---

# DATA MIGRATION

Schema migration and data migration are different concerns.

Large data changes should be incremental.

Never lock production unnecessarily.

---

# MULTI-TENANCY

Tenant isolation is enforced in the database.

Prefer Row Level Security.

Every query assumes isolation.

Never trust application filtering.

---

# ROW LEVEL SECURITY

Every business table should answer:

Who can read?

Who can write?

Who can update?

Who can delete?

Default:

Deny.

Grant explicitly.

---

# PERFORMANCE

Optimize the database,

not only queries.

Measure:

Latency

Index usage

Table growth

Connection count

Lock contention

Slow queries

Performance without observability is guessing.

---

# PAGINATION

Never paginate using OFFSET on large datasets.

Prefer cursor pagination.

Stable ordering.

Predictable performance.

---

# BULK OPERATIONS

Batch writes whenever possible.

Reduce round trips.

Respect transaction boundaries.

Avoid N+1 writes.

---

# EVENTS

Business events should be derived from committed state.

Never publish events before successful commit.

Database first.

Events second.

---

# RETENTION

Every table must define:

Retention policy

Archive strategy

Deletion policy

Legal requirements

Storage is not infinite.

---

# BACKUPS

Backups are mandatory.

Recovery must be tested.

An untested backup is equivalent to no backup.

---

# OBSERVABILITY

Monitor:

Migration failures

Deadlocks

Slow queries

Replication lag

Connection pool

Disk usage

Vacuum health

Index efficiency

The database must explain its own health.

---

# SECURITY

Encrypt secrets.

Never store plaintext credentials.

Hash passwords.

Restrict privileges.

Rotate credentials.

Use least privilege everywhere.

---

# REVIEW CHECKLIST

Before merging:

□ Correct entities.

□ Correct relationships.

□ Constraints defined.

□ Indexes reviewed.

□ RLS reviewed.

□ Migration created.

□ Rollback considered.

□ Performance evaluated.

□ Audit requirements satisfied.

□ Multi-tenant preserved.

---

# THINGS WE NEVER DO

❌ Manual production edits.

❌ Missing foreign keys.

❌ Missing constraints.

❌ Implicit ordering.

❌ Trust application validation only.

❌ Duplicate business ownership.

❌ Skip migrations.

❌ Store secrets in plaintext.

❌ Ignore RLS.

---

# REAL WORLD REFERENCES

Stripe

Business invariants live inside the database.

GitHub

Schema evolution is migration-driven.

Supabase

RLS is the primary security boundary.

Amazon

Large migrations are incremental and observable.

---

# CTO PRINCIPLE

Applications can be rewritten.

Databases become history.

Treat every schema decision as permanent.

---

# IF YOU REMEMBER ONLY THREE THINGS

1.

The database protects the business.

2.

Every constraint prevents future bugs.

3.

Good schemas outlive technologies.

---

# RELATED DOCUMENTS

09_SYSTEM_DESIGN.md

10_CODING_STANDARD.md

11_BACKEND_GUIDELINES.md

13_FRONTEND_GUIDELINES.md

15_TESTING_STANDARD.md

ADR-003_DATABASE_PHILOSOPHY.md

---

End of Book 12.