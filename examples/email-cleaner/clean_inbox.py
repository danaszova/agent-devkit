#!/usr/bin/env python3
"""
Gmail Inbox Cleaner
Moves promotions, ads, solicitations, and spam out of the inbox.
Uses only Python standard library (imaplib, email).

Environment variables required:
  GMAIL_USER=your.email@gmail.com
  GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

To create a Gmail App Password:
  1. Enable 2-Step Verification: https://myaccount.google.com/security
  2. Go to "App passwords"
  3. Select "Mail" + your device
  4. Copy the 16-character password (includes spaces)
"""

import os
import sys
import imaplib
import email
from email.header import decode_header

GMAIL_IMAP_SERVER = "imap.gmail.com"
GMAIL_IMAP_PORT = 993

# Keywords that strongly indicate promotional / solicitation emails
PROMOTIONAL_KEYWORDS = [
    "unsubscribe", "sale", "discount", "offer", "deal", "promo",
    "coupon", "free shipping", "limited time", "act now", "order now",
    "buy now", "click here", "shop now", "special offer", "clearance",
    "exclusive", "save now", "flash sale", "bundle", "promotion",
    "advertisement", "sponsored", "affiliate", "referral", "cashback",
    "reward points", "loyalty program", "newsletter", "digest",
    "update from", "weekly", "monthly", "daily deals"
]

# Sender patterns that are almost always promotional
PROMO_SENDER_PATTERNS = [
    "noreply@", "no-reply@", "marketing@", "newsletter@",
    "promotions@", "deals@", "offers@", "sales@", "info@",
    "notifications@", "updates@", "alerts@", "digest@",
    "mail@", "team@", "hello@"
]


def decode_header_str(s):
    """Decode MIME encoded-words and bytes into a plain string."""
    if not s:
        return ""
    decoded = decode_header(s)
    result = ""
    for part, charset in decoded:
        if isinstance(part, bytes):
            result += part.decode(charset or "utf-8", errors="ignore")
        else:
            result += part
    return result


def connect():
    """Connect to Gmail IMAP using app password."""
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")

    if not user or not password:
        print("ERROR: Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables")
        print("Create an app password at: https://myaccount.google.com/apppasswords")
        sys.exit(1)

    print(f"Connecting to {GMAIL_IMAP_SERVER} as {user} ...")
    mail = imaplib.IMAP4_SSL(GMAIL_IMAP_SERVER, GMAIL_IMAP_PORT)
    mail.login(user, password)
    print("Connected.\n")
    return mail


def is_promotional(subject, from_addr):
    """Check if an email is promotional based on subject and sender."""
    subject_lower = (subject or "").lower()
    from_lower = (from_addr or "").lower()

    # Check promotional keywords in subject
    for keyword in PROMOTIONAL_KEYWORDS:
        if keyword in subject_lower:
            return True, f"keyword '{keyword}' in subject"

    # Check sender patterns
    for pattern in PROMO_SENDER_PATTERNS:
        if pattern in from_lower:
            return True, f"sender pattern '{pattern}'"

    return False, None


def clean_inbox(mail):
    """Main cleanup routine. Returns a report list."""
    report = []
    total_moved = 0

    # ── 1. Move Gmail 'category:promotions' emails to trash ──
    mail.select("inbox")
    _, promo_data = mail.search(None, 'X-GM-RAW "category:promotions"')
    promo_ids = [eid for eid in promo_data[0].split() if eid]

    for eid in promo_ids:
        try:
            mail.store(eid, '+X-GM-LABELS', '\\Trash')
            total_moved += 1
        except Exception as e:
            report.append(f"  Failed to move promotion {eid.decode()}: {e}")

    report.append(f"Moved {len(promo_ids)} 'Promotions' category emails to trash")

    # ── 2. Scan unread inbox for promotional keywords / sender patterns ──
    _, unread_data = mail.search(None, "UNSEEN")
    unread_ids = [eid for eid in unread_data[0].split() if eid]

    promo_unread_moved = 0
    for eid in unread_ids:
        try:
            _, msg_data = mail.fetch(eid, "(RFC822)")
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = decode_header_str(msg.get("Subject", ""))
            from_addr = decode_header_str(msg.get("From", ""))

            is_promo, reason = is_promotional(subject, from_addr)
            if is_promo:
                mail.store(eid, '+X-GM-LABELS', '\\Trash')
                promo_unread_moved += 1
                report.append(f"  Trash: [{subject[:60]}] from {from_addr[:40]} ({reason})")
        except Exception as e:
            report.append(f"  Error processing unread {eid.decode()}: {e}")

    report.append(f"Moved {promo_unread_moved} promotional unread emails to trash")
    total_moved += promo_unread_moved

    # ── 3. Scan read emails older than 7 days for solicitation patterns ──
    _, old_data = mail.search(None, "SEEN OLDER 7d")
    old_ids = [eid for eid in old_data[0].split() if eid][:50]  # limit to 50

    old_moved = 0
    for eid in old_ids:
        try:
            _, msg_data = mail.fetch(eid, "(RFC822)")
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = decode_header_str(msg.get("Subject", ""))
            from_addr = decode_header_str(msg.get("From", ""))

            is_promo, reason = is_promotional(subject, from_addr)
            if is_promo:
                mail.store(eid, '+X-GM-LABELS', '\\Trash')
                old_moved += 1
        except Exception:
            pass

    report.append(f"Moved {old_moved} old solicitation emails to trash")
    total_moved += old_moved

    # ── 4. Permanently delete everything in Spam ──
    mail.select("[Gmail]/Spam")
    _, spam_data = mail.search(None, "ALL")
    spam_ids = [eid for eid in spam_data[0].split() if eid]

    for eid in spam_ids:
        try:
            mail.store(eid, '+FLAGS', '\\Deleted')
        except Exception:
            pass

    mail.expunge()
    report.append(f"Permanently deleted {len(spam_ids)} spam emails")

    mail.close()
    mail.logout()

    report.append(f"\n=== SUMMARY ===")
    report.append(f"Total emails removed from inbox: {total_moved}")
    report.append(f"Spam permanently deleted: {len(spam_ids)}")
    return report


if __name__ == "__main__":
    print("=== Gmail Inbox Cleaner ===\n")
    try:
        mail = connect()
        results = clean_inbox(mail)
        for line in results:
            print(line)
        print("\nDone.")
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        sys.exit(1)
