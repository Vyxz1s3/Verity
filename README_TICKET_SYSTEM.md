# 🎫 Verity Ticket System

A comprehensive, production-ready Discord ticket system for your server. Manage support requests efficiently with automatic channel creation, staff assignment, and detailed logging.

## Features

✨ **Core Features:**
- 🎫 One-click ticket creation via modal
- 📋 Automatic ticket channel creation
- 👤 User permission management
- 🔐 Secure channel isolation
- 📊 Comprehensive dashboard
- 🎯 Staff assignment & claiming
- 📝 Internal notes system
- 🔴 Priority levels (Low, Normal, High, Urgent)
- 📜 Transcript generation
- 📈 Audit logging
- 💾 Full PostgreSQL integration
- 🏷️ Customizable categories
- ⚙️ Per-server configuration

## Installation

### 1. Run Database Migration

```bash
npm run migrate
```

This creates all necessary tables:
- `tickets` - Main ticket data
- `ticket_messages` - Message logging
- `ticket_settings` - Server configuration
- `ticket_categories` - Custom categories
- `ticket_notes` - Staff notes
- `ticket_audit_log` - Action logging

### 2. Load Commands

Copy these files to your commands directory:
- `src/commands/tickets/ticket.js` - User ticket commands
- `src/commands/admin/ticketsetup.js` - Setup commands
- `src/commands/admin/ticketadmin.js` - Admin dashboard
- `src/models/Ticket.js` - Database model
- `src/events/ticketInteractions.js` - Event handlers

### 3. Register Event Handlers

Add the `ticketInteractions.js` event handler to your bot's event loader.

## Setup Instructions

### Step 1: Initialize Ticket System

```
/ticketsetup create-channels
```

This automatically creates:
- 🎫 Support Tickets (category)
- 📋 ticket-logs (channel)
- 🎟️ create-ticket (panel channel)

### Step 2: Configure Settings

```
/ticketsetup configure ticket-category: [Category] log-channel: [Channel] support-role: [Role] max-tickets: [Number]
```

**Options:**
- `ticket-category` - Where ticket channels are created
- `log-channel` - Where ticket actions are logged
- `support-role` - Role for support staff
- `max-tickets` - Max open tickets per user (default: 5)

### Step 3: Create Ticket Panel (Optional)

```
/ticketsetup panel channel: [Channel]
```

Creates a dedicated ticket creation panel in any channel.

## User Commands

### Create a Ticket

```
/ticket open [category]
```

Opens a modal where users can:
- Enter ticket subject
- Describe their issue in detail
- Select category (optional)

A private channel is automatically created!

### View Your Tickets

```
/ticket list
```

Shows all your open tickets with status information.

### Close Your Ticket

```
/ticket close ticket_id: [ID] [reason]
```

Close your own ticket (or admin closes others).

### View Ticket Details

```
/ticket view ticket_id: [ID]
```

See full ticket information including assigned staff and status.

### System Status

```
/ticket status
```

View overall ticket system statistics.

## Staff Commands

### Dashboard

```
/ticketadmin dashboard
```

View real-time statistics:
- Total tickets
- Open tickets
- Closed tickets
- Unassigned tickets
- Assignment rate
- Recent unassigned tickets

### Claim a Ticket

```
/ticket claim ticket_id: [ID]
```

Staff can claim unassigned tickets to work on them.

### Assign Ticket

```
/ticketadmin assign ticket_id: [ID] staff_member: [User]
```

Assign a ticket to a specific staff member.

### Add Internal Notes

```
/ticketadmin notes ticket_id: [ID] note: [Text]
```

Add private notes (visible to staff only) for ticket context.

### Set Priority

```
/ticketadmin priority ticket_id: [ID] priority: [low|normal|high|urgent]
```

Set ticket priority level. Affects channel appearance and urgency.

### Search Tickets

```
/ticketadmin search query: [Text]
```

Search by:
- Ticket ID
- User ID
- Ticket subject
- Status

### Generate Transcript

```
/ticketadmin transcript ticket_id: [ID]
```

Export full ticket conversation as `.txt` file.

## Ticket Lifecycle

```
1. User opens ticket via /ticket open
   ↓
2. Private channel created automatically
   ↓
3. Staff see notification in logs
   ↓
4. Staff claims ticket via button or /ticket claim
   ↓
5. Staff and user communicate in channel
   ↓
6. Staff adds notes and sets priority
   ↓
7. Issue resolved → /ticket close
   ↓
8. Channel deleted automatically
   ↓
9. Transcript available if needed
```

## Database Schema

### tickets
```sql
ticket_id (VARCHAR) - Unique ID like TKT-1234
guild_id - Server ID
user_id - Ticket opener
channel_id - Discord channel
category - Ticket category
status - open/closed
assigned_to - Staff member ID
created_at - Creation timestamp
closed_at - Closure timestamp
subject - Ticket title
description - Ticket details
priority - low/normal/high/urgent
is_archived - Archive flag
```

### ticket_messages
```sql
ticket_id - Reference to ticket
author_id - Message sender
message_content - Full message text
created_at - Timestamp
```

### ticket_settings
```sql
guild_id - Server ID
category_channel_id - Ticket category
log_channel_id - Log channel
support_role_id - Staff role
ticket_prefix - ID prefix (default: TKT)
max_open_per_user - Limit per user
auto_close_days - Auto-close after X days
enable_priority - Show priority level
enable_categories - Enable categories
```

## Workflow Example

### For Users:
1. Click "Create Ticket" button
2. Fill in problem details
3. Wait for staff response
4. Discuss in private channel
5. Staff resolves issue
6. Ticket auto-closes

### For Admins:
1. Setup ticket system: `/ticketsetup create-channels`
2. Configure channels: `/ticketsetup configure`
3. View dashboard: `/ticketadmin dashboard`
4. Assign tickets: `/ticketadmin assign`
5. Track resolution: `/ticketadmin notes`
6. Archive transcripts: `/ticketadmin transcript`

## Permissions

**User Tickets:**
- Can open tickets
- Can see own ticket channel
- Can close own ticket

**Staff:**
- Can claim tickets
- Can assign tickets
- Can add notes
- Can see all tickets
- Can close any ticket
- Can generate transcripts

**Admin:**
- Full ticket system access
- Can configure settings
- Can setup channels
- Can manage all tickets

## Customization

### Add Custom Categories

```
/ticketsetup addcategory name: [Name] description: [Description] emoji: [Emoji]
```

Example:
```
/ticketsetup addcategory name: "Bug Report" description: "Report bugs and issues" emoji: "🐛"
/ticketsetup addcategory name: "Feature Request" description: "Suggest new features" emoji: "💡"
/ticketsetup addcategory name: "Account Support" description: "Account-related issues" emoji: "👤"
```

### Ticket ID Format

By default, tickets use format: `TKT-1234`

To customize, update the `ticket_prefix` in database:

```sql
UPDATE ticket_settings SET ticket_prefix = 'SUPPORT' WHERE guild_id = '...';
```

### Auto-Close Settings

Configure tickets to auto-close after N days:

```sql
UPDATE ticket_settings SET auto_close_days = 7 WHERE guild_id = '...';
```

## Troubleshooting

### Ticket not appearing in logs?
- Check log channel is configured: `/ticketsetup configure log-channel: [Channel]`
- Verify bot has permissions to send messages

### Can't see ticket channel?
- Check that bot has proper permissions in category
- Verify user ID matches ticket owner

### Staff can't claim tickets?
- Ensure staff role is configured: `/ticketsetup configure support-role: [Role]`
- Check bot permissions in ticket channels

### Messages not logging?
- Verify `ticket_messages` table exists
- Check database connection

## Database Queries

### Get all open tickets
```sql
SELECT * FROM tickets WHERE status = 'open' AND guild_id = '...' ORDER BY created_at DESC;
```

### Get unassigned tickets
```sql
SELECT * FROM tickets WHERE status = 'open' AND assigned_to IS NULL AND guild_id = '...';
```

### Get staff performance
```sql
SELECT assigned_to, COUNT(*) as closed_count FROM tickets WHERE status = 'closed' AND guild_id = '...' GROUP BY assigned_to;
```

### Generate report
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed
FROM tickets WHERE guild_id = '...' GROUP BY DATE(created_at);
```

## Performance Tips

1. **Index optimization** - Database already has proper indexes
2. **Archive old tickets** - Set `is_archived = true` for tickets > 30 days old
3. **Clean logs** - Periodically delete old `ticket_messages` entries
4. **Batch operations** - Use admin panel for bulk ticket actions

## Support

For issues or feature requests, check:
- Discord.js documentation: https://discord.js.org
- PostgreSQL documentation: https://www.postgresql.org/docs
