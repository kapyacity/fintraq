# DECISIONS.md — Architecture Decision Records

> **Purpose**: Log significant technical decisions and their rationale.

---

## Decisions

### [DECISION-001] Client-Side Only Offline-First Architecture
**Date**: 2026-11-23
**Status**: Accepted

#### Context
Users require complete privacy for personal financial data without ongoing cloud hosting costs or vulnerability to central database breaches.

#### Decision
All state is stored solely in the client browser's `localStorage` (`fintraq_v1`) with zero central backend server.

#### Rationale
Guarantees absolute privacy, instant response times, and uninterrupted offline access.

#### Consequences
Data loss can occur if browser storage is cleared without backup; mitigated by persistent storage API prompt and JSON import/export.

---

### [DECISION-002] P2P WebRTC Sync with PeerJS
**Date**: 2026-11-23
**Status**: Accepted

#### Context
Users desire cross-device synchronization (e.g., between phone and laptop) without sending data to an application database.

#### Decision
Utilize direct peer-to-peer WebRTC data channels brokered by ephemeral STUN/signaling with a 6-digit session code and Last-Write-Wins (LWW) conflict resolution.

#### Rationale
Enables encrypted direct data transfer directly between user devices.

---

## Phase 1 Decisions

**Date:** 2026-11-23

### Scope
- Full baseline coverage: 50/30/20 math, loan/EMI auto-logging, monthly rollover, and P2P LWW sync merge.

### Approach
- Chose: Built-in Node test runner (`node:test` + `node:assert`) with zero npm dependencies.
- Reason: Zero overhead, instantaneous execution via `node --test`, native in modern Node.js environments without requiring package manager bloat.

### Constraints
- Pure logic functions tested without requiring DOM or browser globals (or with minimal in-memory shims).

---

## Phase 2 Decisions: Dynamic Inflow & Dedicated Funds

**Date:** 2026-11-23

### Scope
- Cumulative split inflow logging without forcing a fixed monthly salary.
- Dedicated Funds cards (Emergency, Trips, Sinking Funds) with targets, current balance, deposit/withdraw actions, and visual progress.

### Approach
- **Dynamic Inflow**: If no static job base is set, the month starts at ₹0 total inflow. Each logged inflow increments the monthly cumulative income and instantly recalculates the 50/30/20 category allocations without blocking prompt cards.
- **Dedicated Funds**: Model in `state.funds = [{ id, name, target, balance, icon, color, createdAt, history: [...] }]`. Integrated with local storage, P2P sync, and JSON backup.

---

*Last updated: 2026-11-23*
