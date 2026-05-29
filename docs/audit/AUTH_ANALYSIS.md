# WeTask — Auth Analysis

## Current Architecture
- Authentication is handled via a custom JWT stored in an HTTP-only cookie (`wetask_session`).
- The logic resides in `src/lib/auth.ts` using custom signing/verifying mechanisms (`src/lib/security.ts`).
- Schema supports `EMAIL`, `GOOGLE`, `APPLE` providers, but the backend implementation relies purely on the custom JWT.

## Flaws & Risks
### 1. Security 
- Custom authentication in Next.js is historically dangerous due to edge cases in token invalidation and CSRF protections.
- There is no obvious session revocation mechanism. If a token is stolen, the user remains authenticated until expiration.

### 2. Maintenance Burden
- Password resets, email verification, and OAuth integrations require thousands of lines of boilerplate code which diverts focus from core marketplace features.

### 3. Missing Features
- No MFA (Multi-Factor Authentication).
- No bot-protection on login/registration forms.

## Execution Recommendation
- **Migrate to Supabase Auth or Clerk**. 
- Supabase Auth integrates seamlessly with Prisma (via RLS or direct DB mapping) and offloads all security, OAuth, and email verification burdens.
- Clerk provides a superior Drop-In UI but is slightly harder to sync perfectly with a custom Prisma schema without robust webhooks. Supabase is the recommended path for WeTask.
