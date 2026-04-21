import { getConnection } from '../artifacts/api-server/src/lib/db.js';

async function setupEmailEvents() {
  try {
    const db = await getConnection();
    console.log('Connected to database');

    // 1. Add messageId column to sent_emails if it doesn't exist
    console.log('Adding messageId column to sent_emails...');
    try {
      await db.execute(`
        ALTER TABLE sent_emails ADD COLUMN message_id VARCHAR(255)
      `);
      console.log('✓ messageId column added');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ messageId column already exists');
      } else {
        console.log('Column check:', e.message);
      }
    }

    // 2. Create email_events table if it doesn't exist
    console.log('Creating email_events table...');
    await db.execute(`
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
      )
    `);
    console.log('✓ email_events table created/verified');

    // 3. Create index on sent_emails.message_id
    console.log('Creating index on sent_emails.message_id...');
    try {
      await db.execute(
        'CREATE INDEX idx_sent_emails_message_id ON sent_emails(message_id)'
      );
      console.log('✓ Index created');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Index already exists');
      } else {
        console.log('Index check:', e.message);
      }
    }

    console.log('\n✅ Database setup complete!');

  } catch (error) {
    console.error('Error setting up database:', error.message);
    process.exit(1);
  }
}

setupEmailEvents();
