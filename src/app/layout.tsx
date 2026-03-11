import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeTask Marketplace",
  description: "Marketplace de servicios al hogar por hora con reserva, pago, chat y paneles por rol",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
