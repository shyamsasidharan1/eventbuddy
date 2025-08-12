-- EventBuddy Reporting Views
-- These views support the reporting requirements from the spec
-- Note: Using Prisma camelCase column names in quotes

-- Event Registration Summary View
-- Provides aggregate data for event registrations
CREATE OR REPLACE VIEW vw_event_reg_summary AS
SELECT 
  r."orgId",
  r."eventId",
  e.title AS event_title,
  e."startsAt" AS event_date,
  COUNT(*) AS total_regs,
  COUNT(DISTINCT r."memberId") AS unique_members,
  COUNT(DISTINCT r."familyMemberId") FILTER (WHERE r."familyMemberId" IS NOT NULL) AS families,
  COUNT(*) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed_regs,
  COUNT(*) FILTER (WHERE r.status = 'PENDING') AS pending_regs,
  COUNT(*) FILTER (WHERE r.status = 'WAITLISTED') AS waitlisted_regs,
  COUNT(*) FILTER (WHERE r.status = 'CANCELLED') AS cancelled_regs,
  COUNT(*) FILTER (WHERE r."checkedIn" = true) AS checked_in_count,
  COUNT(*) FILTER (WHERE r."checkedIn" = false AND r.status = 'CONFIRMED') AS not_checked_in_count
FROM registration r
JOIN event e ON r."eventId" = e.id
GROUP BY r."orgId", r."eventId", e.title, e."startsAt";

-- Membership Summary View  
-- Provides member and family counts per organization
CREATE OR REPLACE VIEW vw_membership AS
SELECT 
  m."orgId",
  COUNT(*) AS total_members,
  COUNT(*) FILTER (WHERE m."isActive" = true) AS active_members,
  COUNT(*) FILTER (WHERE m."isActive" = false) AS inactive_members,
  (
    SELECT COUNT(*) 
    FROM family_member f 
    WHERE f."orgId" = m."orgId" AND f."isActive" = true
  ) AS active_family_members,
  (
    SELECT COUNT(*) 
    FROM family_member f 
    WHERE f."orgId" = m."orgId"
  ) AS total_family_members
FROM member_profile m
GROUP BY m."orgId";

-- Event Attendance View
-- Provides check-in statistics per event
CREATE OR REPLACE VIEW vw_attendance AS
SELECT
  r."orgId",
  r."eventId",
  e.title AS event_title,
  e."startsAt" AS event_date,
  COUNT(*) FILTER (WHERE r."checkedIn" = true) AS checked_in,
  COUNT(*) FILTER (WHERE r."checkedIn" = false AND r.status = 'CONFIRMED') AS not_checked_in,
  COUNT(*) FILTER (WHERE r.status = 'CONFIRMED') AS total_confirmed,
  ROUND(
    COUNT(*) FILTER (WHERE r."checkedIn" = true) * 100.0 / 
    NULLIF(COUNT(*) FILTER (WHERE r.status = 'CONFIRMED'), 0), 
    2
  ) AS attendance_rate
FROM registration r
JOIN event e ON r."eventId" = e.id
WHERE r.status = 'CONFIRMED'
GROUP BY r."orgId", r."eventId", e.title, e."startsAt";

-- Member Activity View
-- Shows member engagement metrics
CREATE OR REPLACE VIEW vw_member_activity AS
SELECT 
  mp."orgId",
  mp.id AS member_id,
  mp."firstName",
  mp."lastName",
  mp."createdAt" AS member_since,
  COUNT(r.id) AS total_registrations,
  COUNT(r.id) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed_registrations,
  COUNT(r.id) FILTER (WHERE r."checkedIn" = true) AS attended_events,
  MAX(r."registeredAt") AS last_registration_date,
  MAX(r."checkedInAt") AS last_attendance_date
FROM member_profile mp
LEFT JOIN registration r ON mp.id = r."memberId"
WHERE mp."isActive" = true
GROUP BY mp."orgId", mp.id, mp."firstName", mp."lastName", mp."createdAt";

-- Event Capacity View
-- Shows event capacity utilization
CREATE OR REPLACE VIEW vw_event_capacity AS
SELECT 
  e."orgId",
  e.id AS event_id,
  e.title AS event_title,
  e."startsAt" AS event_date,
  e.capacity AS max_capacity,
  COUNT(r.id) AS total_registrations,
  COUNT(r.id) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed_count,
  e.capacity - COUNT(r.id) FILTER (WHERE r.status = 'CONFIRMED') AS available_spots,
  ROUND(
    COUNT(r.id) FILTER (WHERE r.status = 'CONFIRMED') * 100.0 / e.capacity, 
    2
  ) AS capacity_utilization
FROM event e
LEFT JOIN registration r ON e.id = r."eventId"
WHERE e."isActive" = true
GROUP BY e."orgId", e.id, e.title, e."startsAt", e.capacity;

-- Comments for documentation
COMMENT ON VIEW vw_event_reg_summary IS 'Event registration summary for admin reporting';
COMMENT ON VIEW vw_membership IS 'Organization membership statistics';
COMMENT ON VIEW vw_attendance IS 'Event attendance rates and check-in statistics'; 
COMMENT ON VIEW vw_member_activity IS 'Individual member engagement metrics';
COMMENT ON VIEW vw_event_capacity IS 'Event capacity utilization statistics';