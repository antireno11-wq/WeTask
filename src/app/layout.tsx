import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeTask Marketplace",
  description: "Marketplace de servicios al hogar por hora con reserva, pago, chat y paneles por rol",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/services/fabicon.jpeg", type: "image/jpeg" }],
    shortcut: [{ url: "/services/fabicon.jpeg", type: "image/jpeg" }],
    apple: [{ url: "/services/fabicon.jpeg", type: "image/jpeg" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WeTask"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <PwaRegister />
        <div className="app-shell">
          <div className="app-content">{children}</div>
          <div className="site-footer-wrap">
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
