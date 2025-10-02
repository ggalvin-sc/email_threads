# Rating Panel Comparison

## Current Email Navigator Rating Panel

```
┌─────────────────────────────────────────────┐
│  RATING PANEL (Right Sidebar)              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ Thread Rating ────────────────────┐    │
│  │                                     │    │
│  │  [Hot]  [Review Complete]           │    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐ │    │
│  │  │ Thread note (optional)        │ │    │
│  │  └───────────────────────────────┘ │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─ Message Rating ───────────────────┐    │
│  │                                     │    │
│  │  [Relevant]  [Irrelevant]           │    │
│  │  [Privileged]  [Confidential]       │    │
│  │  [Responsive]                       │    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐ │    │
│  │  │ Note (required for some       │ │    │
│  │  │ ratings)                      │ │    │
│  │  └───────────────────────────────┘ │    │
│  │                                     │    │
│  │  [Save & Next]  [Reset]             │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─ Keyboard Shortcuts ──────────────┐    │
│  │                                     │    │
│  │  Relevant .................... 1    │    │
│  │  Irrelevant .................. 2    │    │
│  │  Privileged .................. 3    │    │
│  │  Confidential ................ 4    │    │
│  │  Responsive .................. 5    │    │
│  │  Save & Next ........... Ctrl+S    │    │
│  │  Navigate .................. ↑/↓   │    │
│  │  Search ..................... /    │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

## Casedoxx Right Sidebar Structure

```
┌─────────────────────────────────────────────┐
│  RIGHT SIDEBAR                              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ Priority ──────────────────────────┐   │
│  │  ▼                                   │   │
│  │                                      │   │
│  │  [Low]  [Medium]  [High]             │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ────────────────────────────────────────   │
│                                             │
│  ┌─ Internal Info ─────────────────────┐   │
│  │  ▼                                   │   │
│  │                                      │   │
│  │  Internal Description: [_________]   │   │
│  │  Internal Date: [__________]         │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ────────────────────────────────────────   │
│                                             │
│  ┌─ Categories ────────────────────────┐   │
│  │  Categories (3)            [Add +]   │   │
│  │  ▼                                   │   │
│  │                                      │   │
│  │  ◉ Legal - Contract Review    ✕     │   │
│  │  ◉ HR - Performance Review    ✕     │   │
│  │  ◉ Finance - Budget           ✕     │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ────────────────────────────────────────   │
│                                             │
│  ┌─ Notes ─────────────────────────────┐   │
│  │  ▼                                   │   │
│  │                                      │   │
│  │  ┌────────────────────────────────┐ │   │
│  │  │ Document notes...              │ │   │
│  │  │                                │ │   │
│  │  │                                │ │   │
│  │  └────────────────────────────────┘ │   │
│  │                                      │   │
│  │  [Save]                              │   │
│  └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## Key Differences

### Email Navigator (Current)
- **Focus**: Email-specific legal review
- **Rating Types**: Thread-level and Message-level ratings
- **Options**: Hot, Review Complete, Relevant, Irrelevant, Privileged, Confidential, Responsive
- **Features**: Keyboard shortcuts, Save & Next workflow
- **Style**: Button-based, action-oriented

### Casedoxx Webapp
- **Focus**: Document management
- **Components**: Priority, Internal Info, Categories, Notes
- **Priority Levels**: Low, Medium, High (simple 3-level system)
- **Features**: Collapsible panels (p-panel), category chips, AI-driven categorization
- **Style**: Panel-based, information-oriented

## Design System - Casedoxx Colors

### Priority/Rating Colors
```css
/* Low Priority / Cold / Relevant */
--success-300: #4BBB70
--success-100: #ECF9F3
--success-text: #0D853F

/* Medium Priority / Warm */
--warning-300: #FDBE2A
--warning-100: #FEF1E1
--warning-text: #A85400

/* High Priority / Hot */
--error-300: #EA2E29
--error-100: #FCE7E7
--error-text: #9F0906

/* Primary Brand Color */
--primary: #1C846F (teal/green)
--primary-bright: #01A01C (bright green used in email navigator)

/* Borders and Backgrounds */
--border-active: #5DD7B0 (teal)
--gray-300: #D4D6DB
--gray-100: #F6F8FA
```

### Typography
- **Font Family**: Inter
- **Font Weight**: 600 (semi-bold) for active states
- **Font Size**: 14px for labels

## Questions for Implementation

1. **What elements do you want to keep from your current rating panel?**
   - Thread Rating section?
   - Message Rating section?
   - Keyboard shortcuts?
   - Save & Next workflow?

2. **What elements from casedoxx do you want to incorporate?**
   - Collapsible panel design?
   - Priority levels (Low/Medium/High)?
   - Categories system?
   - Internal Info fields?

3. **Should we:**
   - A) Replace your current rating panel with casedoxx's simpler priority system?
   - B) Keep your current rating system but style it like casedoxx (collapsible panels, same colors)?
   - C) Hybrid approach - add casedoxx priority levels but keep email-specific ratings?
   - D) Add casedoxx categories and notes sections below your current rating panel?
