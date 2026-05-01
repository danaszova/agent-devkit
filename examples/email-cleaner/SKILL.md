---
name: inbox-cleaner
version: 1.0.0
description: |
  Daily Gmail inbox cleaner. Removes promotions, ads, solicitations,
  and permanently deletes spam. Uses IMAP with Gmail App Passwords.
allowed-tools:
  - Bash
---

# Inbox Cleaner

## Purpose
Keep your Gmail inbox clean by automatically removing:
- Emails in the "Promotions" category
- Unread emails with promotional keywords or sender patterns
- Old (7+ days) solicitation emails
- All emails in the Spam folder (permanent delete)

## Configuration
Set these environment variables before running:
```bash
export GMAIL_USER="your.email@gmail.com"
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
```

**How to get an App Password:**
1. Go to https://myaccount.google.com/security
2. Make sure 2-Step Verification is ON
3. Search for "App passwords"
4. Select app = "Mail", device = your computer name
5. Copy the 16-character password (it will have spaces)

## Execution
Run the cleanup script directly:
```bash
python3 /home/node/.openclaw/workspace/skills/inbox-cleaner/clean_inbox.py
```

## Daily Automation
This skill is designed to run once per day via OpenClaw's cron scheduler.
A typical cron schedule is `0 9 * * *` (every day at 9:00 AM).

## Safety Notes
- The script only MOVES emails to trash (does not permanently delete except Spam)
- Gmail keeps trash for 30 days, so you can recover if needed
- Spam is permanently deleted immediately
- Always use an App Password, never your main Gmail password
