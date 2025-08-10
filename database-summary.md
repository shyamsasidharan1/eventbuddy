# EventBuddy Database Summary

## 🏗️ Entity Overview

| Entity | Purpose | Key Relationships |
|--------|---------|------------------|
| **Organization** | Multi-tenant root | 1→N to everything |
| **UserAccount** | Login credentials | 1→1 MemberProfile |
| **MemberProfile** | Member details | 1→N FamilyMember, N→M Event |
| **FamilyMember** | Non-login family | N→M Event (via Registration) |
| **Event** | Event management | 1→N Registration |
| **Registration** | Event attendance | Links Members/Family to Events |
| **AuditLog** | Security tracking | Records all actions |

## 🔄 Data Flow Examples

### **Member Registration Flow:**
```
1. UserAccount created → 2. MemberProfile linked → 3. FamilyMembers added
4. Event created by Admin → 5. Registration for Member+Family → 6. Check-in at event
```

### **Multi-Tenant Security:**
```
Query: Get all events
✅ SELECT * FROM event WHERE orgId = $currentOrg
❌ SELECT * FROM event (would see all orgs)
```

### **Registration Business Logic:**
```
Registration rules:
• MUST have eventId + orgId
• MUST have memberId OR familyMemberId (not both)
• UNIQUE per person per event
• Status: PENDING → CONFIRMED → CHECKED_IN
```

## 📊 Reporting Capabilities

The 5 database views provide:

1. **Event Statistics** - registrations, attendance, capacity
2. **Member Engagement** - who's active, attendance rates  
3. **Attendance Tracking** - real-time check-in status
4. **Capacity Planning** - utilization rates, waitlists
5. **Member Activity** - individual member metrics

## 🎯 Key Design Decisions

### **Why BigInt IDs?**
- Scale to millions of members/events
- Better performance on large datasets
- Future-proof for growth

### **Why JSON Fields?**
- **Organization.settings** - flexible org configuration
- **Event.customFields** - per-event registration fields  
- **Registration.customData** - responses to custom fields
- **MemberProfile.metadata** - flexible member data

### **Why Separate Member vs FamilyMember?**
- Members can login, family members cannot
- Different permission models
- Cleaner audit trails
- Flexible family structures

This architecture supports the full EventBuddy Phase 1 specification with room for future growth! 🚀