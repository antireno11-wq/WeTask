# WeTask — Security Analysis

## 1. Authentication Vulnerabilities
- Using a custom JWT implementation (`wetask_session`) without robust infrastructure for token revocation, short-lived access tokens, and long-lived refresh tokens.
- No rate limiting on login/registration endpoints, leaving them open to credential stuffing.

## 2. API Security (Insecure Direct Object Reference - IDOR)
- Many operations rely on extracting `userId` from the JWT. We must audit all POST/PUT/DELETE routes to ensure that `req.body.id` cannot be spoofed.
- Example: If an API updates a booking, it MUST verify the booking belongs to the `userId` in the JWT token.

## 3. Data Privacy (PII)
- The platform stores massive amounts of PII: National IDs (RUT), addresses, full names, phone numbers, and potentially banking details.
- Currently stored in plain text in the database.
- **Critical Fix**: Sensitive fields (especially banking details and ID numbers) must be encrypted at rest within the DB layer.

## 4. File Uploads
- If ID documents and selfies are uploaded to a public bucket, anyone with the URL can view them.
- **Critical Fix**: All KYC documents must go to a private S3 bucket. Access must be granted via short-lived signed URLs only to authorized Admins.
