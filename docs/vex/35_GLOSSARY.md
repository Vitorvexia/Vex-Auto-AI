35_GLOSSARY.md
# THE VEX OPERATING SYSTEM

# GLOSSARY

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: YYYY-MM-DD

---

> "Shared vocabulary creates shared understanding."

---

# PURPOSE

This document defines the official terminology used throughout the VEX platform.

Its objective is eliminating ambiguity.

Every important technical or business term should have exactly one meaning.

Humans and AI assistants must use the same vocabulary.

---

# PHILOSOPHY

Words influence software design.

When terminology is inconsistent:

Requirements become unclear.

Documentation conflicts.

Code becomes confusing.

Architecture drifts.

A shared language produces a shared architecture.

---

# HOW TO USE THIS DOCUMENT

Before introducing a new term:

Search this glossary.

If the concept already exists,

reuse the existing terminology.

Avoid creating synonyms.

One concept.

One official name.

---

# BUSINESS TERMS

## Lead

A potential customer interacting with a dealership.

A Lead may originate from WhatsApp, website, marketplace, or manual creation.

---

## Store

A dealership using the VEX platform.

Represents one tenant in the system.

---

## Tenant

A logical isolation boundary.

Each Store is an independent tenant.

No tenant may access another tenant's data.

---

## Vehicle

A motorcycle or automobile offered for sale.

May be active, reserved, sold or archived.

---

## Opportunity

A potential sales process associated with a Lead.

---

## Conversation

A chronological communication history between a Lead and the Store.

Usually occurs through WhatsApp.

---

## Message

A single communication unit within a Conversation.

Can be inbound or outbound.

---

## Pipeline

The lifecycle of a Lead.

Represents business progression rather than technical implementation.

---

## Follow-up

A scheduled or automated contact intended to move the Lead forward.

---

## Handoff

Transfer of responsibility from AI to a human operator.

May also occur in the opposite direction.

---

## Score

A numerical representation of Lead quality or conversion probability.

---

## Conversion

A Lead successfully becomes a customer.

---

# AI TERMS

## AI Assistant

The intelligent system responsible for assisting dealership operations.

---

## Context

The information provided to the AI before generating a response.

---

## Memory

Persistent organizational knowledge used by AI.

Distinct from conversation history.

---

## Prompt

Structured instructions controlling AI behavior.

---

## Guardrail

Rules preventing unsafe or undesirable AI behavior.

---

## Tool

An external capability invoked by the AI.

Examples include database access, messaging, and scheduling.

---

## Hallucination

An incorrect statement presented as factual by the AI.

Must be minimized through validation and context.

---

# ENGINEERING TERMS

## ADR

Architecture Decision Record.

Documents significant architectural decisions.

---

## Runbook

Operational procedure for recurring tasks or incidents.

---

## RFC

Request for Comments.

A proposal discussed before implementation.

---

## Technical Debt

The future cost created by choosing a faster but less optimal solution today.

---

## Deployment

The act of releasing a new version to an environment.

---

## Rollback

Returning a deployment to a previous stable state.

---

## Migration

A controlled database schema change.

---

## Feature Flag

A mechanism for enabling or disabling functionality without deploying new code.

---

# SECURITY TERMS

## RLS

Row Level Security.

Database mechanism ensuring tenant isolation.

---

## Least Privilege

Grant only the minimum permissions required.

---

## Secret

Sensitive credential that must never be exposed.

---

## Authentication

Verification of identity.

---

## Authorization

Verification of permissions.

---

# OBSERVABILITY TERMS

## Log

A structured record of an event.

---

## Metric

A numerical measurement observed over time.

---

## Trace

A record of a request's complete execution path.

---

## Alert

An automated notification triggered by defined conditions.

---

## Incident

An event causing degraded service or system failure.

---

## SLO

Service Level Objective.

Target reliability goal.

---

## SLI

Service Level Indicator.

Measured value supporting an SLO.

---

## Error Budget

The allowable amount of unreliability before engineering priorities shift.

---

# PRODUCT TERMS

## MVP

Minimum Viable Product.

The smallest version capable of validating business value.

---

## Roadmap

Prioritized sequence of future initiatives.

---

## Backlog

Ordered list of validated work.

Not an idea repository.

---

## Feature

A customer-facing capability providing business value.

---

## Epic

A large body of work divided into smaller features.

---

# DOCUMENTATION TERMS

## Living Document

Continuously updated documentation.

---

## Standard

A mandatory engineering rule.

---

## Guideline

A recommended practice.

---

## Checklist

A sequence of verification steps.

---

## Knowledge Base

The complete collection of engineering documentation.

---

# NAMING CONVENTIONS

Use singular nouns whenever possible.

Prefer explicit names.

Avoid abbreviations unless standardized.

Examples:

Lead

Conversation

Vehicle

Store

Message

Avoid:

Conv

Veh

Msg

Usr

Consistency improves readability.

---

# RESERVED TERMS

The following names should never be redefined elsewhere:

Lead

Store

Tenant

Conversation

Message

Pipeline

Follow-up

Score

Memory

Runbook

ADR

Deployment

Migration

Incident

Feature Flag

Changing these meanings requires updating this glossary first.

---

# ADDING NEW TERMS

Every new official term must include:

Definition.

Category.

Purpose.

Related concepts.

Preferred usage.

Avoid duplicate meanings.

---

# AI GUIDANCE

Before generating documentation or code:

Use terminology exactly as defined here.

Do not invent synonyms.

Do not redefine existing concepts.

Consistency is more valuable than creativity.

---

# RELATED DOCUMENTS

24_KNOWLEDGE_MANAGEMENT.md

26_INDEX.md

27_PROJECT_STATUS.md

28_BACKLOG.md

34_AI_MEMORY.md

---

# FINAL PRINCIPLE

Clear language produces clear software.

Every engineer and every AI should speak the same language.

---

End of GLOSSARY.