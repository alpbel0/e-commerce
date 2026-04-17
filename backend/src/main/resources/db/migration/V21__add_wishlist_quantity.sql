-- Add quantity column to wishlists table
ALTER TABLE wishlists ADD COLUMN quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0);
