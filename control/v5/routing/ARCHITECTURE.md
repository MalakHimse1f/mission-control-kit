# Architecture

System design patterns, technical decisions, and data flow architecture for v5 features.

## Purpose

This document prescribes the technical foundation for v5 feature builds. All features must follow the MVVM pattern, and this document ensures consistency across Model, View, and ViewModel layers. Architecture subagents use this to generate architecture diagrams and system design specs.

## MVVM Layering

All feature builds must follow MVVM (Model-View-ViewModel):

- **Model** — Data layer. Types, API contracts, persistence, validation.
- **View** — UI layer. Renders state, dispatches user actions. No business logic.
- **ViewModel** — Business logic and state management. Transforms models for views, handles user actions, manages side effects.

### Key Rules

- Views never import Models directly. ViewModels are the bridge.
- State flow: View → ViewModel (actions) → Model (mutations) → ViewModel (derived state) → View (render)
- File naming conventions: `{feature}.model.ts`, `{feature}.view.tsx`, `{feature}.viewmodel.ts`
- Build specs must name which layer a task targets (Model, View, or ViewModel)
- Spec reviewer checks for MVVM boundary violations before approval

## TODO

- [ ] Document data flow diagrams for MVVM interaction
- [ ] Define stack.json schema for tech stack decisions
- [ ] Add architecture diagram primitives and examples
- [ ] Specify API contract patterns and types
- [ ] Document persistence layer patterns (local state, server sync, offline handling)
- [ ] Include examples of ViewModel state management
