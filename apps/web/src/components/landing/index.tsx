"use client";

import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import { Anton, Instrument_Serif } from "next/font/google";
import { useEffect } from "react";
import "@/styles/landing.css";
import { FAQ, FinalCta, Pricing } from "./closing";
import { Hero, MarqueeBand, StageIntro } from "./hero";
import { CompareTable, Money, OpenSource, Privacy } from "./proof";
import { Scenes } from "./scenes";
import { Footer, Grain, Nav, useGitHubData } from "./support";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-serif-accent",
});

export default function LandingPage() {
  const { stars } = useGitHubData();

  useEffect(() => {
    PolarEmbedCheckout.init();
  }, []);

  return (
    <div
      className={`${anton.variable} ${instrumentSerif.variable} dark landing-root min-h-screen overflow-x-hidden bg-[#050505] pb-20 font-sans text-white md:pb-0`}
    >
      <StageIntro />
      <Grain />
      <Nav stars={stars} />
      <main>
        <Hero />
        <MarqueeBand />
        <Scenes />
        <Money />
        <Privacy />
        <CompareTable />
        <OpenSource />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
