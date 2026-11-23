# ROADMAP.md — Project Roadmap

> **Current Phase**: Phase 2
> **Milestone**: v1.0 Baseline & Hardening

## Must-Haves (from SPEC)
- [x] Functional 50/30/20 budget allocations with subcategory drill-downs
- [x] Multi-stream income tracking with dynamic salary rebalancing
- [x] Loan/EMI schedule tracking with automatic payment logging into Needs
- [x] Offline PWA capability with Service Worker caching
- [x] Local JSON backup/restore and multi-device P2P WebRTC sync
- [x] Automated test suite validating budgeting math and loan amortization
- [x] Cumulative inflow logging without mandatory fixed salary prompt
- [x] Dedicated Emergency and Goal Funds (Trips, Emergency) with deposit/withdraw actions
- [ ] Codebase cleanup removing redundant library duplicates

## Phases

### Phase 1: Test & Baseline Verification
**Status**: 🟢 Completed
**Objective**: Build an automated test suite verifying core business logic (50/30/20 splits, rounding correction, EMI auto-logging, rollover, and sync LWW merge) without external runtime overhead.
**Requirements**: REQ-09

### Phase 2: Dynamic Inflows & Dedicated Goal/Emergency Funds
**Status**: 🟢 Completed
**Objective**: Implement cumulative split inflow logging (real-time 50/30/20 budget expansion without fixed salary requirement) and dedicated Target Funds (Emergency, Trips, Sinking Funds) with visual progress and deposit/withdraw actions.
**Requirements**: REQ-12, REQ-13

### Phase 3: Codebase Hygiene & Bundle Optimization
**Status**: ⬜ Not Started
**Objective**: Eliminate redundant files (e.g. standalone `peerjs.min.js` vs inlined copy), streamline Service Worker precache manifest, and establish clear code separation seams.
**Requirements**: REQ-11

### Phase 4: Modular Architecture Refactoring
**Status**: ⬜ Not Started
**Objective**: Decouple the 1,950-line `index.html` into structured CSS, HTML views, and ES modules (data-model, sync, ui, charts, storage) with zero bundle regression.
**Requirements**: REQ-10
