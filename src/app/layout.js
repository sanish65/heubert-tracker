import { AppProvider } from "@/context/AppContext";
import "./globals.css";
import GoogleOneTap from "@/components/GoogleOneTap";

export const metadata = {
  title: "Heubert Tracker — Office Penalty System",
  description:
    "Track and manage office penalties including late-coming fines and missing standup form fines. View summaries and histories per employee.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body suppressHydrationWarning>
        <AppProvider>
          <GoogleOneTap />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
