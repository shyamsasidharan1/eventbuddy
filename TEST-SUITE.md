# EventBuddy Test Suite Documentation

## Overview

Comprehensive Jest-based test suite for EventBuddy API with assertion-based testing suitable for CI/CD pipelines. Tests cover all endpoints, role-based access control, business rules, and cross-dependencies.

## Test Structure

### Test Categories

1. **Unit Tests** - Individual service and controller testing
2. **Integration Tests** - End-to-end API testing with database
3. **Security Tests** - Role-based access control validation
4. **Business Logic Tests** - Complex workflows and rule validation

### Test Files

```
test/
├── setup.ts                 # Global test configuration and database cleanup
├── test-helpers.ts          # Shared utilities and helper functions
├── global.d.ts              # TypeScript type definitions
├── jest-e2e.json           # E2E test configuration
├── auth.e2e-spec.ts        # Authentication and user management tests
├── events.e2e-spec.ts      # Event management and role validation tests
├── registrations.e2e-spec.ts # Registration workflow and business rules
├── reports.e2e-spec.ts     # Reporting and CSV export tests
└── integration.e2e-spec.ts # Complete workflow integration tests
```

## Key Test Features

### 🔐 Security & Access Control Testing

- **Role-based Authorization**: Every endpoint tested for proper role restrictions
- **Cross-tenant Isolation**: Multi-tenant data isolation validation
- **Authentication Flow**: Token generation and validation
- **Admin Delegation**: Proper admin creation and role assignment

### 📋 Business Rules Validation

- **Registration Logic**: Multi-person registration workflows
- **Capacity Management**: Event limits and waitlist functionality
- **Duplicate Prevention**: Registration and user creation validation
- **Family Member Ownership**: Cross-user access prevention

### 📊 Comprehensive Coverage

- **All HTTP Methods**: GET, POST, PUT, DELETE endpoint testing
- **Input Validation**: Required fields and data type validation
- **Error Handling**: Proper HTTP status codes and error messages
- **CSV Export**: File format and content validation
- **Database Integrity**: Transaction and constraint testing

## Test Commands

### Development Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Debug tests
npm run test:debug
```

### CI/CD Pipeline Testing
```bash
# Run tests for CI (no watch, with coverage)
npm run test:ci

# Run E2E tests specifically
npm run test:e2e
```

## Test Database Setup

Tests use automatic database cleanup and isolation:

- **Before Each Test**: Complete database reset
- **Test Organization**: Fresh organization created per test suite
- **User Management**: Helper functions create test users with proper roles
- **Data Cleanup**: Automatic cleanup prevents test interference

## Example Test Patterns

### Role-Based Access Testing
```typescript
describe('Admin-only endpoint', () => {
  it('should allow admin access', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin-endpoint')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testData)
      .expect(200);
    
    expect(response.body).toHaveProperty('success', true);
  });

  it('should reject member access', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin-endpoint')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(testData)
      .expect(403);
  });
});
```

### Business Rule Validation
```typescript
describe('Registration business rules', () => {
  it('should prevent duplicate registration', async () => {
    // First registration succeeds
    await helpers.registerForEvent(memberToken, eventId, [{ type: 'MEMBER' }]);
    
    // Duplicate registration fails
    await request(app.getHttpServer())
      .post(`/api/v1/registrations/events/${eventId}/register`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ registrations: [{ type: 'MEMBER' }] })
      .expect(409);
  });
});
```

### CSV Export Testing
```typescript
describe('CSV export functionality', () => {
  it('should export membership data as CSV', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/reports/membership?format=csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    expect(response.header['content-type']).toContain('text/csv');
    expect(response.header['content-disposition']).toContain('attachment');
    expect(response.text).toContain('First Name,Last Name,Email');
  });
});
```

## Test Coverage Goals

- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 90%
- **Statement Coverage**: > 85%

## Integration with CI/CD

### GitHub Actions Integration

```yaml
- name: Run Tests
  run: |
    npm run test:ci
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### Test Database Requirements

- PostgreSQL test database
- Docker container recommended for CI
- Environment variables for test configuration

## Test Data Management

### Helper Functions
- `createTestOrganization()` - Creates isolated org for tests
- `createTestUser(role)` - Creates users with specific roles
- `createTestEvent()` - Creates test events
- `createTestFamilyMember()` - Creates family member relationships
- `registerForEvent()` - Handles multi-person registrations

### Cleanup Strategy
- Automatic database cleanup between tests
- Proper transaction handling
- No test data leakage between suites

## Validation Patterns

### HTTP Response Testing
```typescript
// Status code validation
.expect(200)

// Response structure validation  
expect(response.body).toHaveProperty('id');
expect(response.body).toHaveProperty('email', expectedEmail);

// Error message validation
expect(response.body.message).toContain('expected error text');
```

### Business Logic Assertions
```typescript
// Capacity management
expect(response.body.registrations[0].status).toBe('CONFIRMED');
expect(response.body.registrations[1].status).toBe('WAITLISTED');

// Multi-tenant isolation
expect(response.body.members).toHaveLength(expectedCount);

// Role-based filtering
expect(response.body.financial).toBeNull(); // Staff shouldn't see financial data
```

## Running Tests

### Prerequisites
1. **Database**: PostgreSQL running on localhost:5432
2. **Environment**: NODE_ENV=test
3. **Dependencies**: `npm install`

### Local Development
```bash
# Start database
docker-compose up -d postgres

# Run all tests
npm test

# Run specific test file
npm test auth.e2e-spec.ts

# Run tests with coverage
npm run test:coverage
```

### CI Environment
```bash
# Set test database URL
export DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/eventbuddy_test"

# Run CI tests
npm run test:ci
```

## Test Results

When all tests pass, you should see output similar to:
```
 PASS  test/auth.e2e-spec.ts
 PASS  test/events.e2e-spec.ts  
 PASS  test/registrations.e2e-spec.ts
 PASS  test/reports.e2e-spec.ts
 PASS  test/integration.e2e-spec.ts

Test Suites: 5 passed, 5 total
Tests:       87 passed, 87 total
Snapshots:   0 total
Time:        45.678 s
Coverage:    Lines: 89.2% | Functions: 91.7% | Branches: 85.3%
```

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running and accessible
2. **Port Conflicts**: Make sure test server ports are available
3. **Timeout Issues**: Increase `testTimeout` in Jest config if needed
4. **Memory Leaks**: Tests run sequentially to prevent database conflicts

### Debug Mode
```bash
# Run tests in debug mode
npm run test:debug

# Run specific test with debug
npm run test:debug -- --testNamePattern="should handle registration"
```

This comprehensive test suite ensures EventBuddy API reliability, security, and business rule compliance for production deployment.