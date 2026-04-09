import { useAnalysisStatus } from "../model/useAnalysisStatus";

/** Interactive button to demo loading/error states */
export function AnalysisDemoToggle() {
  const { setItems, items, setConnection, connection } = useAnalysisStatus();

  const simulatePartialLoad = () => {
    setItems(
      items.map((i, idx) =>
        idx < 2 ? i : { ...i, state: idx === 3 ? "failed" as const : "loading" as const }
      )
    );
    // auto-resolve loading ones after 2s
    setTimeout(() => {
      setItems(
        items.map((i, idx) =>
          idx === 3 ? { ...i, state: "failed" as const } : { ...i, state: "done" as const }
        )
      );
    }, 2000);
  };

  const toggleConnection = () => {
    if (connection === "connected") {
      setConnection("reconnecting");
      setTimeout(() => { setConnection("connected"); }, 3000);
    }
  };

  return (
    <div className="analysis-demo">
      <button type="button" className="ide-btn" onClick={simulatePartialLoad}>
        Demo: partial load
      </button>
      <button type="button" className="ide-btn" onClick={toggleConnection}>
        Demo: reconnect
      </button>
    </div>
  );
}
