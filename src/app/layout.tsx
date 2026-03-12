import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeTask Marketplace",
  description: "Marketplace de servicios al hogar por hora con reserva, pago, chat y paneles por rol",
  icons: {
    icon: [{ url: "/services/fabicon.jpeg", type: "image/jpeg" }],
    shortcut: [{ url: "/services/fabicon.jpeg", type: "image/jpeg" }],
    apple: [{ url: "/services/fabicon.jpeg", type: "image/jpeg" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
