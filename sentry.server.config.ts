import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    environment: process.env.NODE_ENV ?? "development",
    enabled: process.env.NODE_ENV === "production",
    // No mandar datos sensibles al breadcrumb por accidente
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip request body de los errores — puede contener tokens / cards.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    }
  });
}
