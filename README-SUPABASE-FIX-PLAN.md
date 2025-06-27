# Supabase Fix Implementation Plan

## Overview

This document provides a comprehensive step-by-step plan to fix all Supabase connection issues and database schema mismatches in the Travel Agent application. The main issues identified include:

- **Schema Mismatches**: Code expects columns like `pace` and `dietary_preferences` that don't exist in the actual database
- **Connection Issues**: 400 Bad Request errors from Supabase API calls
- **Data Inconsistencies**: Multiple preference formats causing conversion errors
- **Service Conflicts**: Deleted services still being referenced in code

## Current Error Examples

```
POST https://xxx.supabase.co/rest/v1/user_preferences?on_conflict=user_id 400 (Bad Request)
Error: Could not find the 'pace' column of 'user_preferences' in the schema cache
Error: Could not find the 'dietary_preferences' column of 'user_preferences' in the schema cache
```

## Implementation Phases

### **Phase 1: Environment & Connection Setup**

#### Step 1: Verify Environment Variables
- [ ] Check `.env` file exists with correct Supabase credentials
- [ ] Verify `VITE_SUPABASE_URL` points to correct project
- [ ] Verify `VITE_SUPABASE_ANON_KEY` is valid and has correct permissions
- [ ] Test connection using Supabase dashboard
- [ ] Compare with `env.example` to ensure all required variables are set

**Files to check:**
- `.env`
- `env.example`

#### Step 2: Clean Up Supabase Client Configuration
- [ ] Review `src/lib/supabase.ts` singleton pattern
- [ ] Add connection error handling and retry logic
- [ ] Implement connection testing function
- [ ] Add debugging logs for connection issues

**Files to modify:**
- `src/lib/supabase.ts`

### **Phase 2: Database Schema Audit & Cleanup**

#### Step 3: Audit Current Database Schema
- [ ] Connect to Supabase dashboard → SQL Editor
- [ ] Run `\d user_preferences` to see actual table structure
- [ ] Export current schema using Supabase CLI or dashboard
- [ ] Compare actual columns vs. expected columns in code
- [ ] Document all missing columns causing errors

**Expected vs. Actual Column Audit:**
```sql
-- Run this query in Supabase to see current schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
ORDER BY ordinal_position;
```

#### Step 4: Backup Existing Data
- [ ] Export all `user_preferences` data
- [ ] Export all `itineraries` and related data
- [ ] Store backups in `backups/` directory with timestamp
- [ ] Test backup restoration process

**Backup commands:**
```sql
-- Export user_preferences
COPY (SELECT * FROM user_preferences) TO 'user_preferences_backup.csv' WITH CSV HEADER;

-- Export itineraries  
COPY (SELECT * FROM itineraries) TO 'itineraries_backup.csv' WITH CSV HEADER;
```

#### Step 5: Create Master Schema Migration
- [ ] Consolidate all schema requirements into single migration
- [ ] Ensure all columns from `USER_PREFERENCES_SCHEMA_MAPPING.md` are included
- [ ] Add proper constraints and defaults
- [ ] Include indexes for performance

**Required columns to add:**
- `pace TEXT DEFAULT 'moderate'`
- `dietary_preferences TEXT[] DEFAULT '{}'`  
- `activities TEXT[] DEFAULT '{}'`
- `dream_destinations TEXT`
- `preferences_json JSONB DEFAULT NULL`

### **Phase 3: Migration Strategy & Execution**

#### Step 6: Clean Up Conflicting Migrations
- [ ] Review all files in `supabase/migrations/`
- [ ] Check which migrations were actually applied vs. just created
- [ ] Identify conflicting or duplicate migrations
- [ ] Create migration execution plan

**Migration files to review:**
- `supabase/migrations/20240317_user_preferences.sql`
- `supabase/migrations/20240530_add_dream_destinations.sql`
- `supabase/migrations/20240601_update_user_preferences.sql`
- `supabase/migrations/20241201_fix_feedback_rls.sql`
- `supabase/migrations/20241201_fix_user_preferences_schema.sql`

#### Step 7: Apply Schema Fixes
- [ ] Create new comprehensive migration file
- [ ] Add all missing columns with proper types and defaults
- [ ] Update RLS policies if needed
- [ ] Add proper indexes for performance
- [ ] Test migration on development database first

**Migration template:**
```sql
-- Add missing columns with safe defaults
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS pace TEXT DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS dietary_preferences TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dream_destinations TEXT,
  ADD COLUMN IF NOT EXISTS preferences_json JSONB DEFAULT NULL;

-- Add constraints
ALTER TABLE public.user_preferences 
  ADD CONSTRAINT check_pace CHECK (pace IN ('slow', 'moderate', 'fast'));
```

#### Step 8: Data Migration & Conversion
- [ ] Convert existing data to new unified format
- [ ] Populate `preferences_json` field with structured data
- [ ] Handle budget format conversions (description → ID format)
- [ ] Migrate `dietary_restrictions` to `dietary_preferences` if exists
- [ ] Validate data integrity after migration

### **Phase 4: Service Layer Cleanup**

#### Step 9: Consolidate User Preferences Services
- [ ] Remove all references to deleted `userPreferencesService.ts`
- [ ] Update `unifiedUserPreferencesService.ts` to handle schema variations
- [ ] Add proper error handling for missing columns
- [ ] Implement fallback mechanisms for schema mismatches
- [ ] Add column existence checks before queries

**Files to update:**
- `src/services/unifiedUserPreferencesService.ts`
- Remove any imports of `userPreferencesService.ts`

#### Step 10: Update Context & Hooks
- [ ] Fix error handling in `UserPreferencesContext.tsx`
- [ ] Update `useUserPreferences.ts` hook for graceful error handling
- [ ] Add retry logic for temporary connection issues
- [ ] Implement optimistic updates with rollback capability
- [ ] Add loading states for better UX

**Files to update:**
- `src/contexts/UserPreferencesContext.tsx`
- `src/hooks/useUserPreferences.ts`

### **Phase 5: Code Compatibility Updates**

#### Step 11: Update Components for New Schema
- [ ] Fix `UserPreferencesManager.tsx` for new field structure
- [ ] Update `EnhancedItineraryCreator` for consistent field names
- [ ] Ensure Onboarding component saves all required fields
- [ ] Add validation for enum fields (pace, travel_group, etc.)
- [ ] Update TypeScript interfaces to match schema

**Files to update:**
- `src/components/TravelPlanner/UserPreferencesManager.tsx`
- `src/components/TravelPlanner/EnhancedItineraryCreator.tsx`
- Onboarding components

#### Step 12: Add Schema Validation
- [ ] Create TypeScript interfaces matching exact database schema
- [ ] Add runtime validation for user preferences data
- [ ] Implement client-side checks before database writes
- [ ] Add proper error messages for validation failures
- [ ] Create schema version compatibility layer

**New files to create:**
- `src/types/database.ts` - Database schema types
- `src/utils/schemaValidation.ts` - Validation utilities

### **Phase 6: Error Handling & Resilience**

#### Step 13: Implement Robust Error Handling
- [ ] Add specific error handling for schema mismatches
- [ ] Implement graceful degradation when columns are missing
- [ ] Add user-friendly error messages
- [ ] Create error recovery mechanisms
- [ ] Add error logging and reporting

#### Step 14: Add Database Health Checks
- [ ] Create database connection test function
- [ ] Add schema validation checks on app startup
- [ ] Implement automatic retry logic for transient errors
- [ ] Add structured logging for database operations
- [ ] Create health check endpoint

### **Phase 7: Testing & Validation**

#### Step 15: Test Database Operations
- [ ] Test user preferences save/load with all field combinations
- [ ] Verify migration worked correctly with existing data
- [ ] Test new user registration flow
- [ ] Validate RLS policies work correctly
- [ ] Test error scenarios and recovery

#### Step 16: Performance Optimization
- [ ] Review and optimize database queries
- [ ] Add proper indexing for frequently accessed columns
- [ ] Implement query result caching where appropriate
- [ ] Monitor query performance
- [ ] Add query performance logging

### **Phase 8: Documentation & Monitoring**

#### Step 17: Update Documentation
- [ ] Update schema documentation with actual implemented schema
- [ ] Document the unified service API
- [ ] Create troubleshooting guide for common issues
- [ ] Update environment setup instructions
- [ ] Document migration process

#### Step 18: Add Monitoring & Logging
- [ ] Implement structured logging for database operations
- [ ] Add performance monitoring for slow queries
- [ ] Create alerts for connection failures
- [ ] Add user-facing status indicators
- [ ] Set up error tracking

## Critical Files That Need Updates

### High Priority Files
```
supabase-schema-clean.sql                           - Master schema with all columns
src/services/unifiedUserPreferencesService.ts      - Error handling & schema compatibility
src/contexts/UserPreferencesContext.tsx            - Resilience improvements
src/lib/supabase.ts                                - Connection improvements
.env                                               - Environment configuration
```

### Medium Priority Files
```
src/components/TravelPlanner/UserPreferencesManager.tsx    - Schema compatibility
src/components/TravelPlanner/EnhancedItineraryCreator.tsx  - Field consistency
src/hooks/useUserPreferences.ts                           - Error handling
src/types/supabase.ts                                     - Type definitions
```

### New Files to Create
```
src/types/database.ts                              - Database schema types
src/utils/schemaValidation.ts                      - Validation utilities
src/utils/databaseHealthCheck.ts                   - Health check functions
backups/                                          - Data backup directory
```

## Implementation Priority

### 🔴 **Critical (Must Fix First)**
- Phase 1: Environment & Connection Setup
- Phase 2: Database Schema Audit & Cleanup  
- Phase 3: Migration Strategy & Execution

### 🟡 **High Priority (Fix Next)**
- Phase 4: Service Layer Cleanup
- Phase 5: Code Compatibility Updates

### 🟢 **Medium Priority (Improve Later)**
- Phase 6: Error Handling & Resilience
- Phase 7: Testing & Validation
- Phase 8: Documentation & Monitoring

## Common Issues & Solutions

### Issue: "Could not find the 'pace' column"
**Root Cause:** Database schema missing expected columns  
**Solution:** Apply Phase 3 migration to add missing columns

### Issue: "400 Bad Request from Supabase"
**Root Cause:** Schema mismatch between code expectations and actual database  
**Solution:** Complete schema audit (Phase 2) and apply fixes (Phase 3)

### Issue: "userPreferencesService is not defined"
**Root Cause:** Deleted service still referenced in code  
**Solution:** Update all imports to use `unifiedUserPreferencesService` (Phase 4)

## Pre-Implementation Checklist

- [ ] Backup all existing data
- [ ] Document current working features
- [ ] Set up development/staging environment for testing
- [ ] Ensure Supabase project access and permissions
- [ ] Review current user data to understand impact
- [ ] Plan rollback strategy in case of issues

## Success Criteria

- [ ] No more "column not found" errors in console
- [ ] User preferences save and load correctly
- [ ] All existing user data preserved and accessible
- [ ] No 400 Bad Request errors from Supabase
- [ ] App works for both new and existing users
- [ ] Performance is maintained or improved

## Notes

- Always test on development environment first
- Keep backups of data before major schema changes
- Monitor error logs closely during implementation
- Consider feature flags for gradual rollout
- Document any deviations from this plan

---

**Last Updated:** December 2024  
**Status:** Ready for Implementation  
**Estimated Time:** 2-3 days for critical phases, 1 week for complete implementation 