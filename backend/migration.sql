-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Update Clients Table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Update Content Items Table
-- Note: If these columns already exist with different names, you might need to rename them manually.
-- This script assumes the structure from backend/schema.sql

DO $$ 
BEGIN
    -- Rename name to title if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'name') THEN
        ALTER TABLE content_items RENAME COLUMN name TO title;
    END IF;

    -- Rename scheduled_date to scheduled_datetime and change type
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'scheduled_date') THEN
        ALTER TABLE content_items ALTER COLUMN scheduled_date TYPE TIMESTAMP WITH TIME ZONE USING scheduled_date::TIMESTAMP WITH TIME ZONE;
        ALTER TABLE content_items RENAME COLUMN scheduled_date TO scheduled_datetime;
    END IF;
END $$;

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE content_items ALTER COLUMN status SET DEFAULT 'CONTENT APPROVED';

-- 3. Verify Status Log Structure (Matches schema.sql already)
-- Table status_logs already has item_id, old_status, new_status, changed_at.
