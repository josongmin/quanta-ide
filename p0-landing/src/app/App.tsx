import { useEffect, useState } from "react";
import { Backgrounds } from "@/widgets/backgrounds";
import { Nav } from "@/widgets/nav";
import { Hero } from "@/widgets/hero";
import { PromptCard } from "@/features/prompt-card";
import { RepoModal } from "@/features/repo-modal";
import { IdePage } from "./ide";

function isIdeRoute(): boolean {
  return window.location.hash === "#/ide";
}

export function App() {
  const [route, setRoute] = useState<"landing" | "ide">(isIdeRoute() ? "ide" : "landing");

  useEffect(() => {
    const onHash = () => {
      setRoute(isIdeRoute() ? "ide" : "landing");
    };
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener("hashchange", onHash); };
  }, []);

  if (route === "ide") {
    return (
      <IdePage
        onExit={() => {
          window.location.hash = "";
          setRoute("landing");
        }}
      />
    );
  }

  return (
    <>
      <Backgrounds />
      <div className="page">
        <Nav />
        <Hero />
        <PromptCard />
        <RepoModal />
      </div>
    </>
  );
}
