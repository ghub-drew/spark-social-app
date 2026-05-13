-- Add interests column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;

-- Update existing users to have empty interests array
UPDATE users SET interests = '[]'::jsonb WHERE interests IS NULL;
