import { Backgrounds } from "@/widgets/backgrounds";
import { Nav } from "@/widgets/nav";
import { Hero } from "@/widgets/hero";
import { PromptCard } from "@/features/prompt-card";
import { RepoModal } from "@/features/repo-modal";

export function App() {
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
