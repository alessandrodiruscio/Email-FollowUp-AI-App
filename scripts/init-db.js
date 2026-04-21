#!/usr/bin/env node

import { db } from '@workspace/db';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

async function setupDatabase() {
  try {
    console.log('Setting up email tracking tables...');

    // Run raw SQL to set up tables
    // 1. Add messageId column to sent_emails
    console.log('Adding messageId column to sent_emails...');
    try {
      await db.execute(
        'ALTER TABLE sent_emails ADD COLUMN message_id VARCHAR(255)'
      );
      console.log('✓ messageId column added');
    } catch (e) {
      if (e.message.includes('ER_DUP_FIELDNAME') || e.message.includes('Duplicate column')) {
        console.log('✓ messageId column already exists');
      } else {
        console.warn('Note:', e.message);
      }
    }

    // 2. Create email_events table
    console.log('Creating email_events table...');
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS email_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sent_email_id INT NOT NULL,
          message_id VARCHAR(255) NOT NULL,
          event_type ENUM('sent', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed') NOT NULL,
          timestamp DATETIME NOT NULL,
          metadata LONGTEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sent_email_id) REFERENCES sent_emails(id) ON DELETE CASCADE,
          INDEX idx_message_id (message_id),
          INDEX idx_event_type (event_type),
          INDEX idx_timestamp (timestamp)
        )
      `);
      console.log('✓ email_events table created');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ email_events table already exists');
      } else {
        throw e;
      }
    }

    // 3. Create index on sent_emails.message_id
    console.log('Creating index on sent_emails.message_id...');
    try {
      await db.execute(
        'CREATE INDEX idx_sent_emails_message_id ON sent_emails(message_id)'
      );
      console.log('✓ Index created');
    } catch (e) {
      if (e.message.includes('ER_DUP_KEYNAME') || e.message.includes('already exists')) {
        console.log('✓ Index already exists');
      } else {
        console.warn('Note:', e.message);
      }
    }

    console.log('\n✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setupDatabase();
