import "./globals.css";
import { BIKEPICK_META } from "@/lib/meta";

export const metadata = {
  title: "bikepick.in — Compare & Buy Bikes",
  description: BIKEPICK_META.description,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
