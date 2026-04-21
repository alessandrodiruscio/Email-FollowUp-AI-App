-- Create email_events table for Resend webhook tracking
CREATE TABLE IF NOT EXISTS email_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  event_type ENUM('sent', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed') NOT NULL,
  timestamp DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_message_id (message_id),
  INDEX idx_event_type (event_type),
  INDEX idx_timestamp (timestamp)
);

-- Optional: Add company column to recipients if not already there
ALTER TABLE recipients ADD COLUMN company VARCHAR(255) NULL AFTER name;
