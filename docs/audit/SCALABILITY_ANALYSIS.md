# WeTask — Scalability Analysis

## Database Layer
- **Current Model**: Prisma over PostgreSQL. This scales beautifully vertically up to a very high limit.
- **Bottlenecks**: 
  - The `Booking` query in the checkout heavily relies on relational JOINs while also locking rows. Under high concurrency, row locking will cause slowdowns.
  - Spatial queries (finding providers near a customer) using PostGIS or bounding boxes are missing. Currently, it relies on basic text matching for communes. This will break if users want sub-commune granularity.

## Application Layer
- Next.js App Router on Serverless edge (Vercel) scales infinitely, but serverless functions have a maximum timeout limit (often 10s or 60s).
- Webhook endpoints must respond quickly to MercadoPago. If they do heavy database transactions and fail, MercadoPago will retry, potentially causing duplicate processing.

## Media Processing
- Serving high-quality profile and service photos is essential. Currently, it lacks an optimized image delivery pipeline.
- Must implement Next.js `<Image />` properly pointing to an edge-optimized CDN domain.
