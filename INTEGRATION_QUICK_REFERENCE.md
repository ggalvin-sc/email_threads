# Casedoxx Integration Quick Reference

## 🎯 What Was Changed

✅ **Replaced** old rating panel (Thread Rating + Message Rating)  
✅ **Implemented** casedoxx right sidebar with 5 panels:
  - Priority (Low/Medium/High)
  - Deposition Party (legal discovery field)
  - Internal Info (description + date)
  - Categories (hierarchical chips)
  - Notes (document annotations)

## 🔌 API Endpoints (Ready to Connect)

All commented in `RatingPanel` component. Just uncomment and test:

```javascript
PUT    /api/v1/cases/{caseId}/documents/{docId}/priority          // Priority: 1|2|3
PUT    /api/v1/cases/{caseId}/documents/{docId}/custom-fields     // Deposition party
PUT    /api/v1/cases/{caseId}/documents/{docId}/internal-info     // Description + date
POST   /api/v1/cases/{caseId}/documents/{docId}/categories        // Category IDs array
POST   /api/v1/cases/{caseId}/documents/{docId}/notes             // Note content
```

## 📦 Data Structures

### Priority
```json
{ "priority": 2 }  // 1=Low, 2=Medium, 3=High
```

### Deposition Party
```json
{ "depositionParty": "plaintiff" }  // plaintiff|defendant|third_party|expert_witness|not_applicable
```

### Internal Info
```json
{
  "internalName": "Email thread regarding merger",
  "internalDate": "2024-01-15"
}
```

### Categories
```json
{ "categoryIds": ["cat_legal_contract", "cat_hr_performance"] }
```

### Notes
```json
{ "content": "Attorney-client privileged communication..." }
```

## 🎨 Design System

### Colors (Casedoxx Brand)
```css
Low Priority:    #4BBB70 (green)
Medium Priority: #FDBE2A (amber)
High Priority:   #EA2E29 (red)
Primary Brand:   #1C846F (teal)
```

### Typography
- Font: **Inter**
- Size: **14px**
- Weight: **600** (semi-bold for active states)

## 🚀 Quick Integration Steps

1. **Add API base URL** to environment:
   ```bash
   REACT_APP_CASEDOXX_API=https://api.casedoxx.com/api/v1
   ```

2. **Uncomment API calls** in `RatingPanel` component (lines ~2400-2500)

3. **Add error handling**:
   ```javascript
   try {
     await api.updatePriority(docId, value);
   } catch (error) {
     alert('Failed to save. Please try again.');
     revertValue(); // Rollback optimistic update
   }
   ```

4. **Test each panel** with real casedoxx backend

## 📝 Files Modified

- `email_thread_navigator_original.html` - Main component file
  - Replaced `DEFAULT_RATING_SCHEMA` → `CASEDOXX_SCHEMA` (line ~1318)
  - Replaced `RatingPanel` component (lines ~2350-2550)
  - Updated CSS for casedoxx styling (lines ~538-750)

## 🔍 Where to Find Things

### In This Repo
- **Integration Guide**: `CASEDOXX_INTEGRATION_GUIDE.md` (full documentation)
- **Comparison Doc**: `RATING_PANEL_COMPARISON.md` (old vs new UI)
- **Main App**: `email_thread_navigator_original.html` (single-page app)

### In Casedoxx Repo
- **Right Sidebar**: `src/app/features/work/view/view/file-sidebars/right-sidebar/`
- **Priority Component**: `src/app/features/work/view/priority/`
- **Categories Component**: `src/app/features/work/view/categorize/categories/`
- **Notes Component**: `src/app/features/work/view/notes-panel/`

## ⚠️ Important Notes

1. **Deposition Party** is NEW - doesn't exist in original casedoxx
   - Added specifically for legal discovery tracking
   - Stores in custom fields table
   - 5 options: Plaintiff, Defendant, Third Party, Expert Witness, N/A

2. **Categories are hierarchical**:
   ```
   Legal
   ├─ Contract Review
   ├─ Discovery
   └─ Privileged
   ```

3. **All panels are collapsible** - click header to expand/collapse

4. **Integration status indicator** at bottom of sidebar shows connection status

## 🧪 Testing

### Before Integration (Current State)
- [x] All panels render correctly
- [x] Priority buttons change color when clicked
- [x] Deposition party dropdown works
- [x] Categories can be added/removed
- [x] Notes can be edited
- [x] Collapsible panels work
- [x] Styling matches casedoxx design

### After Integration (To Do)
- [ ] Data persists to casedoxx backend
- [ ] Data loads from casedoxx on message selection
- [ ] Error messages show on API failure
- [ ] Optimistic updates with rollback
- [ ] Loading indicators during saves

## 🐛 Common Issues

**Issue**: "Address already in use" when starting server  
**Fix**: `pkill -f "python3 -m http.server 8001"` then restart

**Issue**: Changes don't persist  
**Fix**: API integration not complete - currently local state only

**Issue**: Categories don't load  
**Fix**: Mock data only - connect to casedoxx categories API

**Issue**: Styling looks wrong  
**Fix**: Check that Inter font is loading, verify CSS classes

## 📞 Need Help?

- Check `CASEDOXX_INTEGRATION_GUIDE.md` for detailed docs
- Review casedoxx source code in `casedoxx_webapp/src/app/features/work/view/`
- Test in browser: `http://localhost:8001/email_thread_navigator_original.html`

## 🎯 Next Steps

1. Set up casedoxx API connection (base URL + auth)
2. Implement API service layer (see integration guide)
3. Replace mock data with real API calls
4. Add loading states and error handling
5. Test with real casedoxx backend
6. Deploy integrated version

---

**Version**: 2.0.0  
**Last Updated**: 2025-10-01  
**Status**: ✅ Ready for API integration
