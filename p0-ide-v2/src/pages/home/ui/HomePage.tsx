import { HomePicker } from "@/widgets/home-picker";

interface HomePageProps {
  onPick: (choice: "repo" | "agent" | "pr", label: string) => void;
}

export function HomePage({ onPick }: HomePageProps) {
  return <HomePicker onPick={onPick} />;
}
