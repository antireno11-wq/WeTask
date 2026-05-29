# WeTask — Review System Analysis

## Current State
- The `Review` model is simple: `bookingId`, `authorId`, `rating`, `punctuality`, `quality`, `communication`, `comment`.
- Attached strictly to a `bookingId` to ensure 1:1 mapping.

## Fraud Vectors
- The schema structure is sound, but the API must strictly validate that:
  1. The `authorId` is the `customerId` of the booking.
  2. The booking `status` is `COMPLETED`.
  3. A review doesn't already exist.

## Missing Features
- **Provider Responses**: Providers should be able to reply to negative reviews to defend themselves. (Model has `providerReply` which is good!).
- **Blind Reviews**: To ensure honesty, neither party should see the other's review until both have reviewed, or a time limit (e.g., 14 days) passes. This prevents retaliatory reviews.

## Recommendation
- Do not display the review immediately. Build a cron job or background task that publishes reviews after 14 days or when both parties submit.
