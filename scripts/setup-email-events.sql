-- Setup script for email open tracking
-- Run this against the u361584540_FollowUpGenie database

-- 1. Add messageId column to sent_emails if it doesn't exist
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);

-- 2. Create email_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sent_email_id INT NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  event_type ENUM('sent', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed') NOT NULL,
  timestamp DATETIME NOT NULL,
  metadata LONGTEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sent_email_id) REFERENCES sent_emails(id) ON DELETE CASCADE,
  INDEX idx_message_id (message_id),
  INDEX idx_event_type (event_type),
  INDEX idx_timestamp (timestamp)
);

-- 3. Create index on sent_emails.message_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sent_emails_message_id ON sent_emails(message_id);

-- Verify the setup
SELECT 'email_events table created/verified' as status;
SELECT COUNT(*) as email_events_count FROM email_events;
DESCRIBE sent_emails;
