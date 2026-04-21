# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Email Follow-up Manager — a full-stack web app to send outreach emails and automate follow-up sequences.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: MySQL (Hostinger hosted) + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS
- **Rich text editor**: TipTap (ProseMirror-based) — `RichTextEditor` component supports `minHeight` prop
- **AI**: OpenAI via Replit AI Integrations (env vars: AI_INTEGRATIONS_OPENAI_BASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY)
- **Email sending**: Resend (env var: RESEND_API_KEY)
- **Environment variables**: DATABASE_URL loaded from workspace root `.env` file via dotenv

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── email-followup/     # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

- **Dashboard**: Stats (active campaigns, reply rate, pending follow-ups, recipients), recent activity feed
- **Campaigns**: Create/manage campaigns with initial email and up to N follow-up steps
- **Rich text editor**: Format email bodies with bold, italic, bullet lists, numbered lists, and text alignment (left/center/right) in create/edit campaign and follow-up dialogs
- **AI generation**: POST /api/ai/generate-email and /api/ai/generate-followup (OpenAI via Replit AI Integrations)
- **Sending**: POST /api/campaigns/:id/send sends initial emails via Resend
- **Campaign completion**: Campaigns automatically marked as "completed" when all emails (initial + follow-ups) have been sent to all recipients. Status displayed in campaign list and detail views with colored badges.
- **Follow-up scheduler**: Background job runs every 60s, sends due follow-ups automatically
- **Reply tracking**: Mark recipients as replied to cancel pending follow-ups
- **Test email**: POST /api/campaigns/:id/test-email sends preview email to verify formatting before sending to recipients
- **Pause/Resume**: Campaigns can be paused/resumed mid-sequence to stop automatic follow-up sending
- **Edit initial email**: Edit initial campaign email directly from the Sequence tab
- **Dynamic variables**: Email subjects and bodies support template variables that are substituted when emails are sent:
  - `{{original_subject}}` — subject of the initial campaign email (in follow-ups only)
  - `{{name}}` — recipient's name
  - `{{email}}` — recipient's email address
  - Variables can be inserted via the "Variable" dropdown button inline with formatting toolbar in all email editors

## Database Schema

- `campaigns` — name, subject, body, fromEmail, fromName, status (draft/active/completed)
- `recipients` — campaignId, email, name, replied, initialSentAt, repliedAt
- `follow_up_steps` — campaignId, stepNumber, delayDays, subject, body
- `sent_emails` — recipientId, followUpStepId, subject, body, sentAt, status, stepNumber
- `reasons` — name, color, templateSubject, templateBody, templateFromName, templateFromEmail, templateIncludeFooter
- `reason_follow_up_templates` — reasonId (FK), stepNumber, delayValue, delayUnit, subject, body, includeFooter

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- `emitDeclarationOnly` — we only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to MySQL database (requires DATABASE_URL env var and network access)

## Database Setup & Configuration

### Hostinger MySQL Database (✅ Migration Complete)
The application is fully migrated to Hostinger-hosted MySQL database.

**Current Configuration:**
- Host: `srv861.hstgr.io`
- Port: 3306
- Database: `u361584540_FollowUpGenie`
- User: `u361584540_alessandro`
- Connection pooling: 10 connections via mysql2/promise
- Schema: 8 tables (campaigns, recipients, follow_up_steps, sent_emails, reasons, reason_follow_up_templates, conversations, messages)

**Environment Variable Loading:**
- Database URL is loaded from `.env` file in workspace root via `dotenv` in both:
  - `artifacts/api-server/src/index.ts` with dynamic imports to ensure dotenv loads before database modules
  - `lib/db/drizzle.config.ts` (for schema migration commands)
- .env file format: `DATABASE_URL=mysql://username:password@host:port/database`

**Schema Deployment:**
To push schema changes to the database:
```bash
pnpm --filter @workspace/db run push
```

**Network Access:**
- The Replit environment IP (34.139.25.56) is whitelisted in Hostinger's database access rules
- Connection is fully functional and tested with all API endpoints

### Migration Details
Successfully migrated from PostgreSQL to MySQL by:
1. Converting all schema files from `pgTable` to `mysqlTable` 
2. Updating column types: `serial` → `int().autoincrement()`, `timestamp` → `datetime`
3. Fixing datetime defaults using `sql`CURRENT_TIMESTAMP`` for MySQL compatibility
4. Parsing DATABASE_URL explicitly in connection configuration for Hostinger
5. Using dynamic imports in API server to ensure environment variables are loaded before database initialization

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes: campaigns.ts, ai.ts, dashboard.ts, health.ts.

### `artifacts/email-followup` (`@workspace/email-followup`)

React + Vite frontend. Pages: Dashboard, Campaigns, CampaignDetail, CreateCampaign, Settings.
- **RichTextEditor** component: TipTap-based editor with `minHeight` prop, **sticky formatting toolbar** that stays visible while scrolling, `showVariableHelper` prop to enable inline dynamic variable insertion via dropdown menu (bold, italic, lists, alignment, and variable insertion)
- **EmailPreview** component: Renders HTML email content via `dangerouslySetInnerHTML`
- **ReasonTemplateDialog** component: Dialog to configure initial email template + follow-up sequence per reason, with VariableHelper showing available dynamic variables
- **VariableHelper** component: Shows available dynamic variables (`{{original_subject}}`, `{{name}}`, `{{email}}`) with quick-insert and copy buttons
- **Reasons-as-Templates**: Each campaign reason has an optional email template (subject, body, from name/email, footer) and a follow-up sequence template. Selecting a reason during campaign creation auto-populates the form and creates follow-up steps automatically.
- **API client**: Manually extended (don't overwrite) with `useSendTestEmail`, `useUpdateReason`, `useCreateReasonFollowUpTemplate`, `useUpdateReasonFollowUpTemplate`, `useDeleteReasonFollowUpTemplate`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with MySQL (Hostinger). Tables: campaigns, recipients, follow_up_steps, sent_emails, reasons, reason_follow_up_templates, sent_emails.

**Database Configuration:**
- Connection string: `DATABASE_URL` environment variable in workspace root `.env` file
- Format: `mysql://username:password@host:port/database?ssl=true` (URL-encoded special characters in password)
- Connection pool: mysql2/promise with 10 connection limit
- Schema push: `pnpm --filter @workspace/db run push` (requires DATABASE_URL and network access to MySQL server)

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

## Dynamic Variables & Substitution

Email subjects and bodies can include dynamic variables that are replaced when emails are sent. Variables are:

- `{{original_subject}}` — Subject of the original campaign email (follow-ups only)
- `{{name}}` — Recipient's name
- `{{email}}` — Recipient's email address

**Examples:**
- Subject: `Re: {{original_subject}}` → becomes `Re: Collaboration on the Challenge App`
- Subject: `Hi {{name}}, following up...` → becomes `Hi John, following up...`
- Body: `Check this out: {{original_subject}}` → becomes `Check this out: Collaboration on the Challenge App`
- Body: `Dear {{name}}, thanks for your email at {{email}}` → becomes `Dear John, thanks for your email at john@example.com`

**Implementation:**
- Frontend: 
  - `VariableHelper` component shows available variables with quick-insert buttons (subject fields)
  - RichTextEditor includes inline "Variable" dropdown button in sticky toolbar for easy insertion into body text
  - Variables work in both subject and body fields
- Backend: `substituteVariables()` utility in `artifacts/api-server/src/lib/variableSubstitution.ts`
- Applied to: Initial campaigns, follow-up steps, and test emails
- Substitution happens at send time in the scheduler and test email endpoint

**UI Features:**
- **Sticky Toolbar**: The formatting toolbar (bold, italic, lists, alignment, variables) stays visible at the top of the editor while scrolling long email bodies
- **Inline Variable Insertion**: Click the "+ Variable" button in the toolbar to see a dropdown menu and insert any variable directly into your email
- **Works Everywhere**: Variables supported in all email editors (campaign creation, follow-up steps, reason templates)
