ALTER TABLE follow_up_steps ADD COLUMN delay_value INTEGER;
UPDATE follow_up_steps SET delay_value = delay_days WHERE delay_value IS NULL;
ALTER TABLE follow_up_steps ALTER COLUMN delay_value SET NOT NULL;
ALTER TABLE follow_up_steps ADD COLUMN delay_unit VARCHAR(10) DEFAULT 'days';
ALTER TABLE follow_up_steps DROP COLUMN delay_days;
