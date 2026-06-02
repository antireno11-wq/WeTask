# WeTask — Tech Debt Analysis

## 1. Fat API Routes
- Checkout and Webhook routes are massive files containing too much business logic.
- **Debt**: Mixing HTTP request parsing, validation, core business logic, and database transactions in one file makes testing almost impossible.
- **Fix**: Move business logic into a `services/` layer (e.g., `BookingService.createBooking()`).

## 2. Hardcoded Scopes
- `CleaningOnboarding` schema has hardcoded fields for every single service type (`cleaningScope`, `petScope`, `makeupScope`).
- **Debt**: Adding a new vertical (e.g., "Plumbers") requires a Prisma schema migration, downtime, and deployment.
- **Fix**: Convert scope configuration into a flexible JSONB structure or an EAV (Entity-Attribute-Value) pattern, while defining strict TypeScript interfaces in the application layer.

## 3. Custom Authentication
- **Debt**: As mentioned in Auth Analysis, custom JWTs are a massive tech debt sink. As the platform grows, you will need to build password reset, email verifications, MFA, session management, and OAuth integrations from scratch.
- **Fix**: Offload to Supabase Auth.
