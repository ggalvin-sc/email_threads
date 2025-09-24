# Email Thread Structure Design

## Threading Pattern

Complex email thread with multiple branches:

```
1. Original Email (A)
   ├── 2. Reply to A (B)
   │   ├── 4. Reply to B (D)
   │   │   ├── 7. Reply to D (G)
   │   │   └── 8. Forward of D to new recipients (H)
   │   └── 5. Forward of B (E)
   │       └── 9. Reply to forward E (I)
   ├── 3. Reply to A (C)
   │   ├── 6. Reply to C (F)
   │   │   └── 10. Reply to F with CC additions (J)
   │   └── 11. Forward of C to external team (K)
   └── 12. Late reply to original A (L)
       └── 13. Reply to L (M)
```

## Thread ID Strategy

- All emails share the same base thread identifier via References header
- Each email has unique Message-ID
- In-Reply-To links to immediate parent
- References header maintains full thread chain

## Data Fields Required

- message_id: Unique identifier for each email
- in_reply_to: Message-ID of direct parent (null for original)
- references: Space-separated list of all ancestor message IDs
- thread_id: Common identifier for the entire thread
- subject: Email subject (with Re: and Fwd: prefixes)
- from_email: Sender email address
- to_emails: Recipient email addresses (comma-separated)
- cc_emails: CC recipients (comma-separated, can be null)
- date_sent: ISO timestamp
- body: Email content
- email_type: original|reply|forward