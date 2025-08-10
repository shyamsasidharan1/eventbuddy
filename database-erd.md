# EventBuddy Database Entity Relationship Diagram

## Visual Entity Relationships

```
┌─────────────────┐
│   Organization  │
│                 │
│ • id (PK)       │
│ • name          │
│ • webUrl (UQ)   │────┐
│ • settings      │    │
│ • isActive      │    │
│ • timestamps    │    │
└─────────────────┘    │
         │              │
         │ 1:N          │
         ▼              │
┌─────────────────┐    │
│   UserAccount   │    │
│                 │    │
│ • id (PK)       │    │
│ • orgId (FK)    │────┘
│ • email (UQ)    │
│ • passwordHash  │
│ • role          │
│ • emailVerified │
│ • isActive      │
│ • timestamps    │
└─────────────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐
│  MemberProfile  │
│                 │
│ • id (PK)       │
│ • orgId (FK)    │────┐
│ • userId (FK)   │    │
│ • firstName     │    │
│ • lastName      │    │
│ • phone         │    │
│ • address       │    │
│ • metadata      │    │
│ • isActive      │    │
│ • timestamps    │    │
└─────────────────┘    │
         │              │
         │ 1:N          │
         ▼              │
┌─────────────────┐    │
│  FamilyMember   │    │
│                 │    │
│ • id (PK)       │    │
│ • orgId (FK)    │────┘
│ • memberId (FK) │
│ • firstName     │
│ • lastName      │
│ • relationship  │
│ • dateOfBirth   │
│ • metadata      │
│ • isActive      │
│ • timestamps    │
└─────────────────┘
         │
         │
         ▼
┌─────────────────┐
│     Event       │
│                 │
│ • id (PK)       │
│ • orgId (FK)    │────┐
│ • title         │    │
│ • description   │    │
│ • capacity      │    │
│ • startsAt      │    │
│ • location      │    │
│ • customFields  │    │
│ • isActive      │    │
│ • timestamps    │    │
└─────────────────┘    │
         │              │
         │ 1:N          │
         ▼              │
┌─────────────────┐    │
│  Registration   │    │
│                 │    │
│ • id (PK)       │    │
│ • orgId (FK)    │────┘
│ • eventId (FK)  │
│ • memberId (FK) │ (OR)
│ • familyMemberId│ (OR)
│ • status        │
│ • checkedIn     │
│ • checkedInAt   │
│ • customData    │
│ • timestamps    │
└─────────────────┘
         │
         │ N:1
         ▼
┌─────────────────┐
│   AuditLog      │
│                 │
│ • id (PK)       │
│ • orgId (FK)    │────┐
│ • actorUserId   │    │
│ • action        │    │
│ • targetType    │    │
│ • targetId      │    │
│ • payload       │    │
│ • ipAddress     │    │
│ • timestamps    │    │
└─────────────────┘    │
                       │
                       │
        ┌──────────────┘
        │
        ▼
┌─────────────────┐
│ Multi-Tenant    │
│ Architecture    │
│                 │
│ Every table has │
│ orgId (FK) to   │
│ Organization    │
│                 │
│ Ensures data    │
│ isolation       │
└─────────────────┘
```

## Key Relationships Explained

### 1. **Organization Hub** 🏢
- **Central entity** - everything belongs to an organization
- **Multi-tenant ready** - `orgId` on every table
- **Unique webUrl** - optional but unique when present

### 2. **User → Member Pipeline** 👤
```
UserAccount (login) → MemberProfile (details) → FamilyMembers (family)
     1:1                      1:N
```

### 3. **Event Registration Flow** 📅
```
Event → Registration → (Member OR FamilyMember)
 1:N        N:1              Either/Or
```

### 4. **Registration Logic** ⚡
- **Either** `memberId` **OR** `familyMemberId` (not both)
- **Unique constraint** per person per event
- **Check-in tracking** with timestamps

### 5. **Audit Trail** 📝
- **Every action logged** with actor, target, payload
- **Cross-references** any entity via `targetType`/`targetId`
- **IP tracking** and user agent for security

## Database Views (Reporting Layer) 📊

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│vw_event_reg_    │    │  vw_membership  │    │ vw_attendance   │
│    summary      │    │                 │    │                 │
│                 │    │ • total_members │    │ • checked_in    │
│ • total_regs    │    │ • active_members│    │ • not_checked   │
│ • confirmed     │    │ • family_count  │    │ • attendance_%  │
│ • families      │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼──────────────┐
                    │     Admin Reports UI       │
                    │                            │
                    │ • Event Statistics         │
                    │ • Member Engagement        │
                    │ • Attendance Tracking      │
                    │ • CSV Export               │
                    └────────────────────────────┘
```

## Constraints & Rules 🔒

### **Unique Constraints:**
- `Organization.webUrl` (when present)
- `UserAccount.email` per organization  
- `Registration` per person per event

### **Business Rules:**
- Registration must have **either** member **or** family member
- Users can only belong to **one** organization
- Family members **cannot login** (no UserAccount)
- All entities **must** belong to an organization

### **Multi-Tenancy:**
- **Perfect isolation** - no cross-org data access
- **Scalable** - single database, multiple organizations
- **Secure** - orgId checked on every query