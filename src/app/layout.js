import { Space_Grotesk, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import { DialogProvider } from "@/context/DialogContext";
import "./globals.css";
import GoogleOneTap from "@/components/GoogleOneTap";
import MotionProvider from "@/components/MotionProvider";
import AmbientAurora from "@/components/AmbientAurora";
import DialogHost from "@/components/DialogHost";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const body = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata = {
  title: "Heubert Tracker — Office Penalty System",
  description:
    "Track and manage office penalties including late-coming fines and missing standup form fines. View summaries and histories per employee.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
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
