export const meta = {
  name: 'lumina-frontend-qa',
  description: 'Frontend design and QA workflow using specialized agents for UX, accessibility, and component review',
  phases: [
    { title: 'Design System Audit' },
    { title: 'Component Review' },
    { title: 'UX Consistency Check' },
    { title: 'Accessibility & Responsive' },
  ],
}

// ============================================================
// PHASE 1: DESIGN SYSTEM AUDIT
// ============================================================
phase('Design System Audit')

const designAudit = await agent(
`Audit the Lumina design system implementation using frontend-design best practices.
Apply expert UI/UX evaluation standards for consistency, aesthetics, and usability.

Read:
- docs/03-design-guidelines/DESIGN.md (design system)
- docs/03-design-guidelines/EXPERIENCE.md (experience guidelines)
- docs/90-adrs/ADR-011-design-system-spotify-style.md

Check:
1. Typography scale is consistently defined (headings, body, caption)
2. Color palette follows the Spotify-inspired dark theme with Lumina accent colors
3. Spacing system uses a consistent scale (4px base unit)
4. Dark/light mode tokens are both defined
5. Component variants follow the design system (button sizes, input states)
6. The accent_hex from organizations config maps to theme tokens

Apply frontend-design evaluation criteria: visual hierarchy, cognitive load,
information architecture, and brand consistency.
// SKILL: frontend-design
`,
{ label: 'Design system audit', phase: 'Design System Audit', schema: { type: 'object', properties: {
  typography: { type: 'object' },
  colors: { type: 'object' },
  spacing: { type: 'object' },
  component_variants: { type: 'object' },
  compliance_score: { type: 'number' }
}}})

log(`Design compliance score: ${designAudit?.compliance_score ?? '?}/100`)

// ============================================================
// PHASE 2: COMPONENT REVIEW
// ============================================================
phase('Component Review')

// Ruflo core reviewer + impeccable for high-quality component analysis
await agent(
`Review all UI components for consistency with the design system using impeccable standards.
Evaluate every component for code quality, prop typing, theme usage, and design system adherence.

If code files exist in the project:
1. Check that every component file has proper prop types / TypeScript interfaces
2. Verify accessibility attributes (aria-label, role, tabIndex where needed)
3. Check that color variables use theme tokens, not hardcoded hex values
4. Verify button/icon sizing follows the spacing scale
5. Ensure form fields have proper validation states (default/active/error/disabled)
6. Check that navigation follows ADR-012 (expo-router v4) conventions

For any inconsistencies found, note the file path, line numbers, and expected fix.
Apply impeccable review: check for reuse opportunities, simplification, efficiency,
and polish. Flag bland designs that need boldness or loud designs that need quieting.
// SKILL: impeccable
`,
{ label: 'Component review', phase: 'Component Review', subagent_type: 'ruflo-core:reviewer' })

// ============================================================
// PHASE 3: UX CONSISTENCY CHECK
// ============================================================
phase('UX Consistency Check')

// ux-reviewer skill validates against design principles
await agent(
`Run UX consistency checks across all screens using ux-reviewer expertise.
Validate every interaction pattern against established UX principles and design guidelines.

Apply these UX rules from EXPERIENCE.md:
1. Navigation is always predictable (bottom nav for primary sections, stack for detail)
2. Loading states show skeleton screens, not spinners where possible
3. Error messages are actionable (not "something went wrong")
4. Empty states show CTA when data is expected but missing
5. Confirmation dialogs before destructive actions
6. Pull-to-refresh on list views
7. Long-press actions on list items
8. Haptic feedback on key interactions

Check if code implements these patterns. Report deviations with severity level.
Validate against ux-reviewer criteria: interaction design, feedback patterns,
error handling, and user mental model alignment.
// SKILL: ux-reviewer
`,
{ label: 'UX consistency', phase: 'UX Consistency Check', subagent_type: 'superpowers:verification-before-completion' })

// ============================================================
// PHASE 4: ACCESSIBILITY & RESPONSIVE
// ============================================================
phase('Accessibility & Responsive')

// TDD specialist tests edge cases including accessibility boundary conditions
await agent(
`Check accessibility and responsive design compliance using systematic testing methods.
Test every edge case and boundary condition thoroughly.

Read:
- docs/90-adrs/ADR-011-design-system-spotify-style.md
- docs/07-frontend-guide/Frontend-Implementation-Guide.md

Verify:
1. Minimum touch target size: 44x44pt (iOS) / 48x48dp (Android)
2. Contrast ratio meets WCAG AA (4.5:1 for text, 3:1 for large text)
3. Dynamic type / font scaling supported
4. VoiceOver / TalkBack labels on interactive elements
5. No content loss at 320px width (iPhone SE) — test this boundary condition
6. Tablet layout handled via responsive breakpoints — test tablet boundaries
7. Safe area insets respected on all screens

Systematically test edge cases: what happens at exactly 44px? What about dark mode contrast?
What about landscape orientation? Use TDD discipline: define expected behavior first, then verify.
// SKILL: superpowers:test-driven-development
`,
{ label: 'A11y check', phase: 'Accessibility & Responsive', subagent_type: 'superpowers:test-driven-development' })
