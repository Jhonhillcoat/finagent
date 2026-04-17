import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinAdvisor — Tu asesor financiero personal",
  description: "Analizá tu salud financiera con inteligencia artificial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
