import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { TelemetryConsent } from './telemetry-consent';

export const metadata: Metadata = {
  title: "Medário",
  description: "Encontre médicos com uma experiência clara, local e verificável.",
  applicationName: "Medário",
  icons: { icon: "/brand/medario-mark.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ea",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}<TelemetryConsent /></body>
    </html>
  );
}
