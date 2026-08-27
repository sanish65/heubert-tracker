import { AppProvider } from "@/context/AppContext";
import { DialogProvider } from "@/context/DialogContext";
import "./globals.css";
import GoogleOneTap from "@/components/GoogleOneTap";
import MotionProvider from "@/components/MotionProvider";
import AmbientAurora from "@/components/AmbientAurora";
import DialogHost from "@/components/DialogHost";

export const metadata = {
  title: "Heubert Tracker — Office Penalty System",
  description:
    "Track and manage office penalties including late-coming fines and missing standup form fines. View summaries and histories per employee.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body suppressHydrationWarning>
        <DialogProvider>
          <AppProvider>
            <MotionProvider>
              <AmbientAurora />
              <GoogleOneTap />
              <DialogHost />
              {children}
            </MotionProvider>
          </AppProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
