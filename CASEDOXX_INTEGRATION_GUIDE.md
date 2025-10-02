# Casedoxx Integration Guide

## Overview

The Email Thread Navigator now uses the **casedoxx webapp right sidebar structure** for document review and rating. This document explains how the components connect and what's needed for full integration with the casedoxx backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Email Thread Navigator (React SPA)                             │
│                                                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Thread Panel   │  │ Message View │  │ Casedoxx Sidebar   │  │
│  │ (Email Tree)   │  │ (Content)    │  │ (Rating/Review)    │  │
│  │                │  │              │  │                    │  │
│  │ - Timeline viz │  │ - Email body │  │ ✓ Priority         │  │
│  │ - Search       │  │ - Headers    │  │ ✓ Deposition Party │  │
│  │ - Filtering    │  │ - Metadata   │  │ ✓ Internal Info    │  │
│  │                │  │              │  │ ✓ Categories       │  │
│  │                │  │              │  │ ✓ Notes            │  │
│  └────────────────┘  └──────────────┘  └────────────────────┘  │
│                                                │                │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                                 ▼
                    ┌────────────────────────────────────────┐
                    │  Casedoxx Backend API (Future)         │
                    │                                        │
                    │  /api/v1/cases/{caseId}/documents/     │
                    │    ├─ /{docId}/priority       (PUT)   │
                    │    ├─ /{docId}/custom-fields  (PUT)   │
                    │    ├─ /{docId}/internal-info  (PUT)   │
                    │    ├─ /{docId}/categories     (POST)  │
                    │    └─ /{docId}/notes          (POST)  │
                    └────────────────────────────────────────┘
```

## Component Mapping

### Source Components (Casedoxx Webapp)

Located in: `casedoxx_webapp/src/app/features/work/view/`

| Casedoxx Component | Location | Purpose |
|-------------------|----------|---------|
| **right-sidebar.component** | `view/file-sidebars/right-sidebar/` | Main container for document review sidebar |
| **priority.component** | `view/priority/` | Low/Medium/High priority selection |
| **categories.component** | `view/categorize/categories/` | Document categorization with chips |
| **internal-info.component** | `view/internal-info/` | Internal description and date fields |
| **notes.component** | `view/notes-panel/` | Document notes with save functionality |

### Target Component (Email Navigator)

Located in: `email_thread_navigator_original.html`

**Component**: `RatingPanel` (lines ~2350-2550)
- Replaces old Thread Rating / Message Rating system
- Implements all casedoxx sidebar panels
- Uses casedoxx color scheme and styling
- Ready for API integration (currently local state only)

## Data Structure

### Priority Levels

```javascript
const CASEDOXX_SCHEMA = {
    priorityLevels: [
        { 
            value: 1,           // Database value
            label: "Low",       // Display label
            color: "#4BBB70",   // Border color (--success-300)
            bgColor: "#ECF9F3", // Background (--success-100)
            textColor: "#0D853F"
        },
        { 
            value: 2, 
            label: "Medium", 
            color: "#FDBE2A",   // --warning-300
            bgColor: "#FEF1E1", // --warning-100
            textColor: "#A85400" 
        },
        { 
            value: 3, 
            label: "High", 
            color: "#EA2E29",   // --error-300
            bgColor: "#FCE7E7", // --error-100
            textColor: "#9F0906" 
        }
    ]
};
```

**API Integration Point**:
```javascript
// PUT /api/v1/cases/{caseId}/documents/{documentId}/priority
{
    "priority": 2  // 1=Low, 2=Medium, 3=High
}
```

### Deposition Party

```javascript
depositionParties: [
    { value: "plaintiff", label: "Plaintiff" },
    { value: "defendant", label: "Defendant" },
    { value: "third_party", label: "Third Party" },
    { value: "expert_witness", label: "Expert Witness" },
    { value: "not_applicable", label: "N/A" }
]
```

**API Integration Point**:
```javascript
// PUT /api/v1/cases/{caseId}/documents/{documentId}/custom-fields
{
    "depositionParty": "plaintiff"
}
```

**Note**: Deposition party is a custom field for legal discovery tracking. In casedoxx, this would be stored in the custom fields table.

### Internal Info

```javascript
// State
{
    internalDescription: "Email thread regarding merger discussions",
    internalDate: "2024-01-15"
}
```

**API Integration Point**:
```javascript
// PUT /api/v1/cases/{caseId}/documents/{documentId}/internal-info
{
    "internalName": "Email thread regarding merger discussions",
    "internalDate": "2024-01-15"
}
```

### Categories

```javascript
// Available categories (hierarchical)
availableCategories: [
    { id: "cat_legal", label: "Legal", parent: null },
    { id: "cat_legal_contract", label: "Contract Review", parent: "cat_legal" },
    { id: "cat_legal_discovery", label: "Discovery", parent: "cat_legal" },
    // ... more categories
]

// Selected categories for document
categories: [
    {
        id: "cat_legal_contract",
        label: "Contract Review",
        parent: {
            id: "cat_legal",
            label: "Legal"
        }
    }
]
```

**API Integration Point**:
```javascript
// POST /api/v1/cases/{caseId}/documents/{documentId}/categories
{
    "categoryIds": ["cat_legal_contract", "cat_hr_performance"]
}
```

### Notes

```javascript
// State
{
    notes: "This email contains privileged attorney-client communication..."
}
```

**API Integration Point**:
```javascript
// POST /api/v1/cases/{caseId}/documents/{documentId}/notes
{
    "content": "This email contains privileged attorney-client communication..."
}
```

## API Integration Steps

### 1. Add API Service Layer

Create `src/services/casedoxxApi.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_CASEDOXX_API || 'http://localhost:8080/api/v1';

class CasedoxxApiService {
    constructor(caseId) {
        this.caseId = caseId;
    }

    // Priority
    async updatePriority(documentId, priority) {
        const response = await fetch(
            `${API_BASE_URL}/cases/${this.caseId}/documents/${documentId}/priority`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority })
            }
        );
        return response.json();
    }

    // Deposition Party
    async updateDepositionParty(documentId, depositionParty) {
        const response = await fetch(
            `${API_BASE_URL}/cases/${this.caseId}/documents/${documentId}/custom-fields`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ depositionParty })
            }
        );
        return response.json();
    }

    // Internal Info
    async updateInternalInfo(documentId, internalName, internalDate) {
        const response = await fetch(
            `${API_BASE_URL}/cases/${this.caseId}/documents/${documentId}/internal-info`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ internalName, internalDate })
            }
        );
        return response.json();
    }

    // Categories
    async updateCategories(documentId, categoryIds) {
        const response = await fetch(
            `${API_BASE_URL}/cases/${this.caseId}/documents/${documentId}/categories`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryIds })
            }
        );
        return response.json();
    }

    // Notes
    async createNote(documentId, content) {
        const response = await fetch(
            `${API_BASE_URL}/cases/${this.caseId}/documents/${documentId}/notes`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            }
        );
        return response.json();
    }

    // Fetch document data
    async getDocument(documentId) {
        const response = await fetch(
            `${API_BASE_URL}/cases/${this.caseId}/documents/${documentId}`,
            { method: 'GET' }
        );
        return response.json();
    }
}

export default CasedoxxApiService;
```

### 2. Update RatingPanel Component

In `email_thread_navigator_original.html`, replace the mock API comments with actual calls:

```javascript
// Current (mock):
const handlePriorityChange = (value) => {
    setPriority(value);
    // INTEGRATION: API call
    // await fetch(...);
};

// Updated (real):
const handlePriorityChange = async (value) => {
    setPriority(value);
    try {
        await casedoxxApi.updatePriority(selectedMessage.messageId, value);
        console.log('Priority saved to casedoxx');
    } catch (error) {
        console.error('Failed to save priority:', error);
        alert('Failed to save priority. Please try again.');
        setPriority(priority); // Revert on error
    }
};
```

### 3. Add Case ID Configuration

Add case ID to the App component initialization:

```javascript
function App() {
    const CASE_ID = 'CASE-2024-001'; // Get from URL or config
    const casedoxxApi = new CasedoxxApiService(CASE_ID);
    
    // Pass casedoxxApi to RatingPanel
    // ...
}
```

### 4. Environment Variables

Create `.env` file:

```bash
# Casedoxx API Configuration
REACT_APP_CASEDOXX_API=https://api.casedoxx.com/api/v1
REACT_APP_CASE_ID=CASE-2024-001

# Authentication (if needed)
REACT_APP_CASEDOXX_API_KEY=your-api-key-here
```

## Styling Reference

### Color Palette

From `casedoxx_webapp/src/app/features/work/view/priority/priority.component.scss`:

```scss
/* Success (Low Priority / Relevant) */
--success-300: #4BBB70;
--success-100: #ECF9F3;
--success-text: #0D853F;

/* Warning (Medium Priority) */
--warning-300: #FDBE2A;
--warning-100: #FEF1E1;
--warning-text: #A85400;

/* Error (High Priority / Hot) */
--error-300: #EA2E29;
--error-100: #FCE7E7;
--error-text: #9F0906;

/* Primary Brand */
--primary: #1C846F;
--primary-bright: #01A01C;

/* Borders */
--border-active: #5DD7B0;
--gray-300: #D4D6DB;
--gray-100: #F6F8FA;
```

### Typography

```scss
font-family: Inter, sans-serif;
font-size: 14px;
font-weight: 600; // Semi-bold for active states
line-height: 22px;
```

### Component Patterns

**Collapsible Panel**:
```jsx
<div className="casedoxx-panel">
    <div className="casedoxx-panel-header" onClick={toggleExpanded}>
        <div className="casedoxx-panel-title">
            <i className="pi pi-icon"></i>
            Title
        </div>
        <i className={`pi pi-chevron-down casedoxx-panel-toggle ${expanded ? 'expanded' : ''}`}></i>
    </div>
    {expanded && (
        <div className="casedoxx-panel-content">
            {/* Content */}
        </div>
    )}
</div>
```

**Priority Buttons**:
```jsx
<div className="priority-container">
    <button className={`priority-button ${active ? 'active low' : ''}`}>
        Low
    </button>
    <button className={`priority-button ${active ? 'active medium' : ''}`}>
        Medium
    </button>
    <button className={`priority-button ${active ? 'active high' : ''}`}>
        High
    </button>
</div>
```

**Category Chips**:
```jsx
<div className="category-chip">
    <span>Legal - Contract Review</span>
    <button className="remove-btn" onClick={removeCategory}>✕</button>
</div>
```

## Testing Checklist

### Before Integration

- [x] Priority selection working (Low/Medium/High)
- [x] Deposition party dropdown populated
- [x] Internal info fields (description, date)
- [x] Categories can be added (mock data)
- [x] Categories can be removed
- [x] Notes can be edited
- [x] All panels can collapse/expand
- [x] Styling matches casedoxx design system
- [x] Integration status indicator visible

### After Integration

- [ ] Priority saves to casedoxx API
- [ ] Deposition party saves to casedoxx API
- [ ] Internal info saves to casedoxx API
- [ ] Categories sync with casedoxx API
- [ ] Notes save to casedoxx API
- [ ] Document data loads from casedoxx API
- [ ] Error handling for API failures
- [ ] Loading indicators during API calls
- [ ] Optimistic updates with rollback on error
- [ ] Authentication token handling

## Migration Notes

### Data Migration

When connecting to casedoxx, existing email thread ratings need to be mapped:

**Old Rating System**:
- Thread Rating: Hot, Review Complete
- Message Rating: Relevant, Irrelevant, Privileged, Confidential, Responsive

**New Priority System**:
- Priority: Low (1), Medium (2), High (3)

**Suggested Mapping**:
```javascript
// Old → New
"hot" → Priority: 3 (High)
"review_complete" → Priority: 1 (Low)
"privileged" → Priority: 3 (High) + Category: "Legal - Privileged"
"confidential" → Priority: 3 (High) + Category: "Confidential"
"relevant" → Priority: 2 (Medium)
"irrelevant" → Priority: 1 (Low)
"responsive" → Priority: 2 (Medium) + Category: "Responsive"
```

### Backward Compatibility

The old rating data structure is still stored in local state but no longer displayed in the UI. To maintain backward compatibility:

1. Keep the old rating fields in message data
2. Add migration function to convert old → new format
3. Store both formats during transition period

## Future Enhancements

1. **AI-Driven Categorization**
   - From `categories.component.html`: Support for AI-assigned categories
   - Display sparkles icon ✨ for AI suggestions
   - Banner notification for AI-driven categories

2. **Batch Operations**
   - Select multiple emails
   - Apply priority/categories in bulk
   - "Mark Selected as Duplicates" feature

3. **Real-time Collaboration**
   - WebSocket integration for multi-user review
   - Show who's viewing/editing
   - Conflict resolution

4. **Audit Trail**
   - Track all changes to priority/categories/notes
   - Show change history
   - Undo/redo functionality

## Support

For questions about:
- **Email Navigator**: See `README.md` and `PROGRAM_LAYOUT.md`
- **Casedoxx Integration**: See this document
- **UI Comparison**: See `RATING_PANEL_COMPARISON.md`
- **Casedoxx Webapp**: Check `casedoxx_webapp/` source code

## Version History

- **v2.0.0** (2025-10-01): Replaced rating panel with casedoxx right sidebar
- **v1.0.0** (2025-09-XX): Initial email thread navigator with rating system
