# ROADMAP.md — Project Roadmap

> **Current Phase**: Phase 1
> **Milestone**: v1.0 Baseline & Hardening

## Must-Haves (from SPEC)
- [x] Functional 50/30/20 budget allocations with subcategory drill-downs
- [x] Multi-stream income tracking with dynamic salary rebalancing
- [x] Loan/EMI schedule tracking with automatic payment logging into Needs
- [x] Offline PWA capability with Service Worker caching
- [x] Local JSON backup/restore and multi-device P2P WebRTC sync
- [x] Automated test suite validating budgeting math and loan amortization
- [ ] Codebase cleanup removing redundant library duplicates

## Phases

### Phase 1: Test & Baseline Verification
**Status**: 🟢 Completed
**Objective**: Build an automated test suite verifying core business logic (50/30/20 splits, rounding correction, EMI auto-logging, rollover, and sync LWW merge) without external runtime overhead.
**Requirements**: REQ-09

### Phase 2: Codebase Hygiene & Bundle Optimization
**Status**: ⬜ Not Started
**Objective**: Eliminate redundant files (e.g. standalone `peerjs.min.js` vs inlined copy), streamline Service Worker precache manifest, and establish clear code separation seams.
**Requirements**: REQ-11

### Phase 3: Modular Architecture Refactoring
**Status**: ⬜ Not Started
**Objective**: Decouple the 1,950-line `index.html` into structured CSS, HTML views, and ES modules (data-model, sync, ui, charts, storage) with zero bundle regression.
**Requirements**: REQ-10

### Phase 4: Feature Enhancements & Polish
**Status**: ⬜ Not Started
**Objective**: Advanced insights, recurring non-loan subscription tracking, and enhanced WebRTC connection diagnostics.
**Requirements**: REQ-01, REQ-07
