import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeTask MVP",
  description: "Marketplace de servicios a domicilio para Chile"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
