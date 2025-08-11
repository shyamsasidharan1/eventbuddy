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
   
   # For development (with hot reload)
   npm run dev
   
   # For production/testing (with PM2)
   npm start
   ```
4. **Testing**: `npm test`
5. **Linting**: `npm run lint`

### Application Management
- **Start server**: `npm start` - Clean build and start with PM2 (production ready)
- **Stop server**: `npm stop` - Stop PM2 process
- **Development mode**: `npm run dev` - Hot reload for active development
- **Restart**: `npm restart` - Alias for `npm start`

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

## API Endpoints (✅ Implemented & Tested)

All endpoints are available at base URL: `http://localhost:3001/api/v1`

### System Health & Info
- `GET /` - API information and version
- `GET /health` - Health check endpoint
- `GET /ready` - Readiness check endpoint

### Authentication & User Management
- `POST /auth/login` - Email/password login with JWT token generation
- `POST /auth/register` - User registration with automatic member profile creation
- `GET /auth/me` - Get current authenticated user profile with member details
- `POST /auth/create-admin` - Create new admin/staff users (ORG_ADMIN only)
- `PUT /auth/users/:id/role` - Update user role (ORG_ADMIN only)
- `POST /auth/bootstrap-super-admin` - Bootstrap initial super admin (setup only)

### Member Management  
- `GET /members` - List organization members with pagination (ORG_ADMIN/EVENT_STAFF)
- `GET /members/stats` - Member statistics and analytics (ORG_ADMIN/EVENT_STAFF)
- `GET /members/:id` - Get member details with family members
- `PUT /members/:id` - Update member profile (own profile or admin)
- `DELETE /members/:id` - Deactivate member account (ORG_ADMIN only)

### Family Member Management
- `POST /members/:memberId/family` - Add family member to member account
- `GET /members/:memberId/family` - List all family members for a member
- `PUT /members/:memberId/family/:id` - Update family member details
- `DELETE /members/:memberId/family/:id` - Remove family member

### Event Management
- `GET /events` - List events with role-based filtering and pagination
- `POST /events` - Create new event (ORG_ADMIN only)
- `GET /events/stats` - Event statistics and metrics (ORG_ADMIN/EVENT_STAFF)
- `GET /events/:id` - Get detailed event information
- `GET /events/:id/capacity` - Get event capacity and availability status
- `PUT /events/:id` - Update event details (ORG_ADMIN only)
- `DELETE /events/:id` - Delete event (ORG_ADMIN only)

### Registration & Check-in System
- `POST /registrations/events/:eventId/register` - Register member and/or family members for event
- `GET /registrations/events/:eventId` - Get all registrations for an event (ORG_ADMIN/EVENT_STAFF)
- `GET /registrations/my-registrations` - Get current user's registrations across all events
- `PUT /registrations/:id` - Update registration status or details
- `POST /registrations/events/:eventId/checkin` - Check-in attendees at event (EVENT_STAFF/ORG_ADMIN)

### Reporting & Analytics
- `GET /reports/dashboard` - Comprehensive dashboard with all metrics summary
- `GET /reports/membership?format=json|csv` - Membership reports with category breakdown
- `GET /reports/registrations?format=json|csv` - Event registration reports and statistics  
- `GET /reports/attendance?format=json|csv` - Attendance tracking and rate analysis
- `GET /reports/financial?format=json|csv` - Financial reports and payment tracking (ORG_ADMIN only)

### Query Parameters & Features
- **Filtering**: Most endpoints support filtering by date ranges, categories, and status
- **CSV Export**: All report endpoints support `?format=csv` for CSV download
- **Pagination**: List endpoints support pagination with `page` and `limit` parameters
- **Role-based Access**: Endpoints automatically filter data based on user role and organization
- **Multi-tenant**: All data is automatically isolated by organization ID

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

## Current Status: CI/CD Pipeline Ready for Testing ✅

### 🎉 Backend API Complete
- ✅ **Multi-tenant database schema** implemented and optimized
- ✅ **Complete NestJS API** with 5 major modules (Auth, Members, Events, Registrations, Reports)
- ✅ **JWT Authentication** with role-based access control and admin delegation
- ✅ **Member & Family Management** with 7 membership categories and payment tracking
- ✅ **Event Management** with capacity limits, waitlists, and registration workflows
- ✅ **Multi-person Registration** system supporting members and family members
- ✅ **Comprehensive Reporting** with CSV export and dashboard analytics
- ✅ **Production Process Management** with unified PM2 start/stop mechanism
- ✅ **All endpoints tested** and verified working with proper authorization
- ✅ **76 Jest tests** with 100% pass rate for CI/CD integration

### 🏗️ CI/CD Infrastructure Complete
- ✅ **Multi-stage Docker build** with Node.js 20 and security hardening
- ✅ **GitHub Actions pipeline** with automated testing, building, and deployment
- ✅ **GKE cluster integration** with existing `eventbuddy-cluster` in `us-central1-a`
- ✅ **Staging environment** deployed with PostgreSQL and Redis in-cluster
- ✅ **Environment configuration** management with secrets and ConfigMaps
- ✅ **Database migration automation** in deployment process
- ✅ **Security scanning** with Trivy vulnerability detection
- ✅ **Health checks** and monitoring endpoints implemented

### 🎯 Staging Environment Status
- **GKE Cluster**: `eventbuddy-cluster` (2x e2-small nodes) - RUNNING
- **Namespace**: `eventbuddy-staging` - CREATED ✅
- **PostgreSQL**: Deployed and running (1/1 Ready) ✅
- **Redis**: Deployed and running (1/1 Ready) ✅
- **API Pods**: Awaiting Docker image from CI/CD pipeline ⏳
- **Services**: Load balancer configured and ready ✅

### 📊 Infrastructure Statistics
- **5 Kubernetes manifests** for staging deployment
- **3-tier architecture** (API + PostgreSQL + Redis) in GKE
- **Namespace isolation** for staging vs production
- **Secret management** with environment-specific configurations
- **Resource allocation** optimized for e2-small nodes
- **Complete deployment automation** via GitHub Actions

### 🚀 Next Steps: CI/CD Testing
1. **Trigger Pipeline**: Push to `develop` branch → GitHub Actions builds Docker image
2. **Validate Deployment**: API pods should start successfully with database connections
3. **Test Health Checks**: Verify `/health` endpoint responds through load balancer
4. **Production Setup**: Add Cloud SQL + Memorystore for production environment

### 🎯 Current Phase: CI/CD Pipeline Validation
The staging environment is **perfectly positioned** for end-to-end CI/CD testing:
- Infrastructure: Ready and deployed
- Databases: Running and waiting for API connections
- Pipeline: Configured for automated build and deployment
- Missing: Docker image (will be created by CI/CD pipeline)

**Ready to test complete automated deployment workflow!** 🚀

### 📋 Production Deployment Plan
**Phase 1: Staging Validation** (Current)
- ✅ GKE staging environment with in-cluster databases
- ⏳ CI/CD pipeline testing and validation
- ⏳ Health checks and API endpoint verification

**Phase 2: Production Infrastructure** (Next)
- Cloud SQL PostgreSQL instance (~$30/month)
- Memorystore Redis instance (~$25/month)  
- Production namespace with managed database connections
- Blue-green deployment strategy

**Phase 3: Frontend Development** (Future)
- Next.js 14 admin dashboard and member portal
- Tailwind CSS + ShadCN UI components
- TanStack Query for API integration
- Automated frontend deployment pipeline