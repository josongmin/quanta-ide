import { Nav } from "@/widgets/nav/ui/Nav";
import { Hero } from "@/widgets/hero/ui/Hero";
import { AuroraBlobs } from "@/widgets/backgrounds/ui/AuroraBlobs";
import { DotCanvas } from "@/widgets/backgrounds/ui/DotCanvas";
import { PointerGlow } from "@/widgets/backgrounds/ui/PointerGlow";
import { PromptCard } from "@/features/prompt-card/ui/PromptCard";
import { RepoModal } from "@/features/repo-modal/ui/RepoModal";

export default function LandingPage() {
  return (
    <>
      {/* backgrounds */}
      <AuroraBlobs />
      <DotCanvas />
      <PointerGlow />

      {/* page content */}
      <Nav />
      <Hero />
      <PromptCard />

      {/* modals */}
      <RepoModal />
    </>
  );
}
