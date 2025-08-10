-- Initialize EventBuddy Database
-- This script runs when PostgreSQL container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create database views after Prisma migrations
-- Note: These will be created in separate migration files, not here
-- This is just documentation of what views will be created

-- Database is ready for Prisma migrations
SELECT 'EventBuddy database initialized' AS status;