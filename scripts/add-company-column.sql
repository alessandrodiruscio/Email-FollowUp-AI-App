-- Add company column to recipients table if it doesn't already exist
ALTER TABLE recipients ADD COLUMN company VARCHAR(255) NULL AFTER name;
