ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS return_update_note TEXT;

ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS order_items_return_status_check;

UPDATE order_items
SET return_status = CASE
    WHEN return_status IN ('APPROVED', 'COMPLETED') THEN 'RETURNED'
    ELSE return_status
END;

ALTER TABLE order_items
    ADD CONSTRAINT order_items_return_status_check
    CHECK (return_status IN ('NONE', 'REQUESTED', 'RETURNED', 'REJECTED'));
