export function AuroraBlobs() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="blob blob-1 absolute left-[-10%] top-[-15%] h-[60%] w-[50%] animate-[float-a_32s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,var(--blob1-a,#c084fc)_0%,var(--blob1-b,#7c3aed)_40%,var(--blob1-c,#3b0764)_100%)] opacity-50 blur-[128px]" />
      <div className="blob blob-2 absolute right-[-8%] top-[5%] h-[55%] w-[45%] animate-[float-b_38s_ease-in-out_infinite_-9s] rounded-full bg-[radial-gradient(circle,var(--blob2-a,#38bdf8)_0%,var(--blob2-b,#6366f1)_45%,var(--blob2-c,#1e1b4b)_100%)] opacity-45 blur-[128px]" />
      <div className="blob blob-3 absolute bottom-[-5%] left-[20%] h-[50%] w-[40%] animate-[float-c_42s_ease-in-out_infinite_-16s] rounded-full bg-[radial-gradient(circle,var(--blob3-a,#a78bfa)_0%,var(--blob3-b,#4f46e5)_100%)] opacity-40 blur-[128px]" />
      <div className="blob blob-4 absolute bottom-[10%] right-[5%] h-[40%] w-[35%] animate-[float-d_44s_ease-in-out_infinite_-6s] rounded-full bg-[radial-gradient(circle,var(--blob4-a,#22d3ee)_0%,var(--blob4-b,#818cf8)_100%)] opacity-35 blur-[128px]" />
    </div>
  );
}
