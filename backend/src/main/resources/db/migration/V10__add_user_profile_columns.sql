-- Add profile columns to users table
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500);
