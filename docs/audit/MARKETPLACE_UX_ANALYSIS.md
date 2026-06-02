# WeTask — Marketplace UX Analysis

## The "Wow" Factor Requirements
A successful marketplace like Airbnb or Webel survives on trust. Trust is built entirely through UX in the first 5 seconds.

### 1. Service Cards & Photography
- **Current Risk**: If providers upload low-quality, poorly lit, or unstructured photos, the marketplace looks cheap.
- **Solution**: WeTask must enforce aspect ratios, offer photo guidelines during onboarding, and ideally apply automated enhancements (or fallback to high-quality category stock photos).

### 2. Provider Profiles (Trust UI)
- **Elements Needed**: Verified badges, background check indicators, clear rating aggregations, and total jobs completed.
- **Current State**: The `ProfessionalProfile` schema supports these fields, but the frontend implementation must aggressively highlight them. "Identity Verified" is the highest converting badge.

### 3. Frictionless Discovery
- **Current Risk**: Asking for an address *before* showing any services creates massive drop-off.
- **Solution**: Use Geo-IP to estimate the commune, show available providers immediately, and only ask for exact address at Checkout.

### 4. Booking Clarity
- **Current Risk**: Price breakdowns (hourly rate vs platform fee vs materials) can confuse users.
- **Solution**: The checkout page must have an Airbnb-style sticky receipt that updates in real-time as the user selects extras or changes hours.
