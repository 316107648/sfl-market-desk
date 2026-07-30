import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sunflower Market Pro",
  description: "Mercado, crafting y análisis de Coins para Sunflower Land",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
