import { Backgrounds } from "@/widgets/backgrounds/ui/Backgrounds";
import { Nav } from "@/widgets/nav/ui/Nav";
import { Hero } from "@/widgets/hero/ui/Hero";
import { PromptCard } from "@/features/prompt-card/ui/PromptCard";
import { RepoModal } from "@/features/repo-modal/ui/RepoModal";

export function App() {
  return (
    <div className="page">
      <Backgrounds />
      <Nav />
      <Hero />
      <PromptCard />
      <RepoModal />
    </div>
  );
}
