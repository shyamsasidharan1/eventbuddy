# EventBuddy - Phase 1 MVP1: Charity Member & Events Management

## Project Overview
EventBuddy is a **charity member and events management application** designed for single-tenant deployment (multi-tenant ready). Phase 1 (MVP1) focuses on user authentication, role-based access (Org Admin/Member/Event Staff), member & family management, event creation with registration, staff check-in capabilities, and comprehensive reporting with CSV export.

## Architecture
- **Platform**: Google Kubernetes Engine (GKE)
- **Language**: Node.js 18+ with TypeScript support
- **Framework**: Express.js → NestJS (API) + Next.js 14 (Frontend) 
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions and rate limiting
- **Container**: Docker with multi-stage builds
- **CI/CD**: GitHub Actions with security scanning
- **Registry**: Google Artifact Registry (us-central1-docker.pkg.dev)

## Project Structure
```
eventbuddy/
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma      # Multi-tenant database schema
│   ├── views.sql          # Reporting views
│   └── migrations/        # Database migrations
├── src/                   # Application source code
│   └── app.js            # Main Express application (Phase 0)
├── scripts/               # Database and deployment scripts
│   ├── init-db.sql       # Database initialization
│   └── seed.ts           # Sample data (future)
├── k8s/                   # Kubernetes manifests
│   ├── namespace.yaml    # EventBuddy namespace
│   ├── configmap.yaml    # Configuration
│   ├── deployment.yaml   # API deployment
│   └── service.yaml      # Service definition
├── .github/workflows/     # CI/CD pipelines
│   └── ci-cd.yml         # Complete pipeline (test/build/security/deploy)
├── docker-compose.yml     # Local development (PostgreSQL + Redis)
├── .env.example          # Environment configuration template
├── database-erd.md       # Database relationship diagrams
├── database-summary.md   # Entity overview and data flows
├── Dockerfile            # Container definition
└── package.json          # Dependencies with Prisma scripts
```

## Database Schema (Multi-Tenant Ready)

### Core Entities
- **Organization**: Root entity with optional webUrl (unique identifier)
- **UserAccount**: Authentication with email/password + role-based access
- **MemberProfile**: Member details linked to UserAccount (1:1)
- **FamilyMember**: Non-login family members linked to members (N:1)
- **Event**: Events with capacity management and waitlisting
- **Registration**: Event registrations for members OR family members
- **AuditLog**: Comprehensive activity tracking

### User Roles
- **ORG_ADMIN**: Full organization management, event creation, reporting
- **MEMBER**: Profile management, family management, event registration
- **EVENT_STAFF**: Event check-in assistance, limited reporting

### Key Features
- **Multi-tenant architecture**: Every table has `orgId` for perfect data isolation
- **Flexible family structure**: Family members can register for events without login
- **Event capacity management**: Hard limits with waitlist support
- **Registration business logic**: Either member OR family member per registration
- **Comprehensive audit trail**: All actions logged with payload details
- **Reporting views**: 5 optimized views for admin dashboard

## Development Guidelines

### Local Development Setup
1. **Prerequisites**: Node.js 18+, Docker, Prisma CLI
2. **Database Setup**:
   ```bash
   # Start local databases
   docker-compose up -d
   
   # Generate Prisma client
   npm run db:generate
   
   # Apply schema to database
   npm run db:push
   
   # (Optional) Open database studio
   npm run db:studio
   ```
3. **Application Setup**:
   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```
4. **Testing**: `npm test`
5. **Linting**: `npm run lint`

### Database Operations
- **Generate client**: `npm run db:generate`
- **Push schema changes**: `npm run db:push` 
- **Create migration**: `npm run db:migrate`
- **Reset database**: `npm run db:reset`
- **Database studio**: `npm run db:studio`
- **Seed data**: `npm run db:seed` (future)

### Docker Operations
- **Start services**: `docker-compose up -d`
- **Stop services**: `docker-compose down`
- **View logs**: `docker-compose logs -f`
- **Build for GKE**: `docker build --platform linux/amd64 -t eventbuddy:latest .`

**Important**: GKE uses AMD64 architecture. Use `--platform linux/amd64` when building on Apple Silicon.

### Database Connection
- **Local**: `postgresql://eventbuddy_user:eventbuddy_pass@localhost:5432/eventbuddy`
- **Production**: Cloud SQL with private IP connection
- **Redis**: `redis://localhost:6379`

## API Endpoints (Planned)

### Authentication
- `POST /auth/login` - Email/password login
- `POST /auth/register` - User registration with email verification  
- `POST /auth/logout` - Session invalidation
- `GET /auth/me` - Current user profile

### Member Management  
- `GET /members` - List organization members (Admin/Staff)
- `POST /members` - Create member profile
- `GET /members/:id` - Get member details
- `PUT /members/:id` - Update member profile
- `POST /members/:id/family` - Add family member
- `GET /members/:id/family` - List family members

### Event Management
- `GET /events` - List events (filtered by role)
- `POST /events` - Create event (Admin only)
- `GET /events/:id` - Event details
- `PUT /events/:id` - Update event (Admin only)
- `POST /events/:id/register` - Register for event
- `GET /events/:id/registrations` - Event registrations (Admin/Staff)

### Check-in System
- `POST /events/:id/checkin` - Mark attendance (Staff)
- `GET /events/:id/checkin` - Check-in status

### Reporting
- `GET /reports/events/registrations` - Registration reports
- `GET /reports/events/attendance` - Attendance reports  
- `GET /reports/members` - Membership reports
- `GET /reports/exports/registrations.csv` - CSV export

## Environment Configuration

### Required Variables
- **DATABASE_URL**: PostgreSQL connection string
- **REDIS_URL**: Redis connection string  
- **JWT_SECRET**: JWT signing key
- **NODE_ENV**: Environment (development/staging/production)
- **SENDGRID_API_KEY**: Email service API key
- **GCP_PROJECT_ID**: Google Cloud project ID

### Optional Variables  
- **LOG_LEVEL**: Winston log level (default: info)
- **BCRYPT_ROUNDS**: Password hashing rounds (default: 12)
- **RATE_LIMIT_MAX**: Request rate limit (default: 100/15min)

## Database Views (Reporting)

### Available Views
1. **vw_event_reg_summary**: Event registration statistics with status breakdown
2. **vw_membership**: Organization member and family counts
3. **vw_attendance**: Event attendance rates and check-in statistics
4. **vw_member_activity**: Individual member engagement metrics
5. **vw_event_capacity**: Event capacity utilization and availability

### Usage Example
```typescript
// Get membership statistics  
const memberStats = await prisma.$queryRaw`
  SELECT * FROM vw_membership WHERE "orgId" = ${orgId}
`

// Get event capacity info
const capacity = await prisma.$queryRaw`
  SELECT * FROM vw_event_capacity 
  WHERE "orgId" = ${orgId} AND event_date > NOW()
`
```

## Multi-Tenant Security

### Data Isolation
- **Every query** must filter by `orgId`
- **No cross-org data access** possible
- **Role-based permissions** within organization
- **Audit logging** for all admin actions

### Example Secure Query
```typescript
// ✅ Correct - includes orgId filter
const events = await prisma.event.findMany({
  where: { orgId: currentUser.orgId, isActive: true }
})

// ❌ Incorrect - would see all orgs (if allowed)
const events = await prisma.event.findMany({
  where: { isActive: true }
})
```

## CI/CD Pipeline

### Triggers
- **Push to main**: Deploy to production
- **Push to develop**: Deploy to staging  
- **Pull requests**: Run tests and build
- **Manual**: Security scans and reports

### Pipeline Stages
1. **Test**: ESLint, Jest unit tests, Prisma validation
2. **Build**: Docker image build and push to Artifact Registry
3. **Security**: Trivy vulnerability scanning with GCP authentication
4. **Deploy**: Rolling updates to GKE with health checks

### Required GitHub Secrets
- `GCP_PROJECT_ID`: `hypnotic-surger-468513-a0`
- `GCP_SA_KEY`: Service account JSON for authentication
- `GKE_CLUSTER_NAME`: Your GKE cluster name
- `GKE_ZONE`: Deployment zone (e.g., `us-central1-a`)

## Production Architecture (Future)

### GCP Services Integration
- **Cloud SQL**: Managed PostgreSQL with private IP
- **Memorystore**: Managed Redis for sessions
- **Secret Manager**: Secure credential storage
- **Cloud Storage**: File uploads and CSV exports
- **SendGrid**: Transactional email service
- **Identity Platform**: Optional managed authentication

### Kubernetes Configuration
- **Namespace**: `eventbuddy` with resource quotas
- **Deployments**: API and Web with autoscaling
- **Services**: Internal load balancing
- **Ingress**: SSL termination with Cloud Load Balancer
- **ConfigMaps**: Non-sensitive configuration
- **Secrets**: Database credentials via Secret Manager CSI

## Next Development Phases

### Phase 1 Completion Tasks
1. **NestJS API**: Complete REST endpoints implementation
2. **Next.js Frontend**: Admin console and member portal
3. **Authentication**: JWT or Identity Platform integration
4. **Email System**: Registration confirmations and notifications
5. **CSV Export**: Streaming reports for large datasets
6. **Testing Suite**: Unit, integration, and E2E tests

### Phase 2 Enhancements (Future)
- **Payment Integration**: Event fees and payment processing
- **QR Code Ticketing**: Digital tickets and mobile check-in
- **Advanced Reporting**: Analytics and engagement metrics
- **Mobile App**: React Native companion app
- **Notification System**: Push notifications and SMS

### Phase 3 Advanced Features (Future)
- **Competition Judging**: Scoring and ranking systems
- **Multi-tier Events**: Different ticket/access levels  
- **Public Registration**: Anonymous event registration
- **API Rate Limiting**: Advanced throttling and quotas
- **Audit Dashboard**: Security monitoring and compliance

## Troubleshooting

### Database Issues
- **Connection failures**: Check Docker containers with `docker-compose ps`
- **Schema sync**: Run `npm run db:push` to sync schema changes
- **Migration failures**: Use `npm run db:reset` to reset (development only)
- **View errors**: Check column names match Prisma camelCase format

### Development Issues
- **Prisma client outdated**: Run `npm run db:generate` after schema changes
- **Port conflicts**: Ensure ports 5432 (PostgreSQL) and 6379 (Redis) are available
- **Environment variables**: Copy `.env.example` to `.env` and configure

### Debugging Commands
```bash
# Database status
docker-compose ps

# View database logs  
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U eventbuddy_user -d eventbuddy

# Check tables and views
docker-compose exec postgres psql -U eventbuddy_user -d eventbuddy -c "\dt"
docker-compose exec postgres psql -U eventbuddy_user -d eventbuddy -c "\dv"
```

## Development Notes for Claude
- **Database-first development**: Schema changes require Prisma regeneration
- **Multi-tenant awareness**: Always include `orgId` in queries and data operations
- **Role-based security**: Check user roles before allowing operations
- **Audit everything**: Log all admin actions to audit_log table
- **Test with realistic data**: Use seed scripts for development data
- **Performance considerations**: Use database views for reporting queries
- **Update this document**: Keep current with new features and architectural changes

## Current Status: Phase 1 MVP1 Database Foundation Complete ✅
- ✅ Multi-tenant database schema implemented
- ✅ Local development environment with Docker
- ✅ Prisma ORM integration and client generation  
- ✅ Database views for reporting requirements
- ✅ CI/CD pipeline with security scanning
- ✅ Production-ready GKE deployment configuration
- 🔄 **Next**: NestJS API implementation or Next.js frontend development