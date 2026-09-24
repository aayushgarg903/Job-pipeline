// next/font (display: swap). Only Inter and Cormorant SC are preloaded (Design.md §2.2).
import { Cormorant_Garamond, Cormorant_SC, IBM_Plex_Mono, Inter, Noto_Sans_Devanagari, Tiro_Devanagari_Marathi } from "next/font/google";

export const display = Cormorant_SC({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-display", display: "swap", preload: true });
export const serif = Cormorant_Garamond({ weight: ["400", "500"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-serif", display: "swap", preload: false });
export const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap", preload: true });
export const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-mono", display: "swap", preload: false });
// Tiro Devanagari Marathi ships a single 400 weight.
export const deva = Tiro_Devanagari_Marathi({ weight: "400", subsets: ["devanagari"], variable: "--font-deva", display: "swap", preload: false });
export const devaSans = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva-sans", display: "swap", preload: false });

export const fontVariables = [display, serif, sans, mono, deva, devaSans].map((f) => f.variable).join(" ");
