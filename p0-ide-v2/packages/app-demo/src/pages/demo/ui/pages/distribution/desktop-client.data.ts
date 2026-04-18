// desktop-client.data.ts
// Static fixtures for DesktopClientPage. Split out so the component file stays under ~400 lines.

export type Platform = "macOS" | "Windows" | "Linux";
export type MacArch = "arm64" | "x64";
export type WinArch = "x64" | "arm64";
export type LinuxPkg = ".deb" | ".rpm" | "AppImage" | "snap" | "flatpak";

export const PLATFORMS: Platform[] = ["macOS", "Windows", "Linux"];
export const LINUX_PKGS: LinuxPkg[] = [".deb", ".rpm", "AppImage", "snap", "flatpak"];

export const VERSION = "0.12.4";
export const SHA_MAC_ARM = "a1b2c3d4e5f6071829304a5b6c7d8e9f0a1b2c3d4e5f6071829304a5b6c7d8e9";
export const SHA_MAC_X64 = "ff117a8e21d4b4c9a7e6b19c5d1a2f83b7c4e0a5d6e9f0b1c2d3e4f5a6b7c8d9";
export const SHA_WIN_X64 = "1c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e";
export const SHA_WIN_ARM = "aa11bb22cc33dd44ee55ff6677889900aabbccddeeff1122334455667788a9b0";
export const SHA_LINUX = "4d3c2b1a0f9e8d7c6b5a49382716054f3e2d1c0b9a887766554433221100ffee";

export const downloadsSeries = [
  0.28, 0.36, 0.4, 0.48, 0.44, 0.62, 0.78, 0.72, 0.84, 0.92, 0.88, 0.96, 1.0, 0.94,
];

export interface Release {
  date: string;
  version: string;
  badge?: "latest" | "beta";
  bullets: string[];
}

export const RELEASES: Release[] = [
  {
    date: "Apr 18, 2026",
    version: "0.12.4",
    badge: "latest",
    bullets: [
      "Canvas minimap ships · pan-and-zoom hotspots for recent violations.",
      "Agent memory now survives app restarts · no more re-introducing yourself.",
    ],
  },
  {
    date: "Apr 08, 2026",
    version: "0.12.3",
    bullets: [
      "SCIM provisioning GA · Okta, Azure AD, and Google Workspace.",
      "Policy DSL preview · typed predicates behind a feature flag.",
    ],
  },
  {
    date: "Mar 28, 2026",
    version: "0.12.2",
    bullets: [
      "Multi-file canvas · pan across a repo like a map.",
      "60 fps Code Universe · GPU tile cache with delta invalidation.",
    ],
  },
];

export interface MdmBullet {
  title: string;
  blurb: string;
}

export const MDM_BULLETS: MdmBullet[] = [
  {
    title: "MDM config · JAMF / Intune",
    blurb: "Pre-configure SSO, update channel, and allowed models. Policies push at login, not at first launch.",
  },
  {
    title: "Silent install flags",
    blurb: "`/quiet /norestart /channel=stable` on Windows · `--silent --accept-license` on deb/rpm builds.",
  },
  {
    title: "Offline bundle",
    blurb: "Air-gapped organizations can mirror releases from a signed S3 prefix. No telemetry to quanta.dev required.",
  },
];

export const MAC_REQS: [string, string][] = [
  ["Operating system", "macOS 13 Ventura or later"],
  ["CPU", "Apple Silicon (M-series) or Intel x86-64"],
  ["Memory", "4 GB RAM (8 GB recommended)"],
  ["Disk", "500 MB free"],
  ["Code Universe", "Metal-compatible GPU"],
  ["Network", "Optional · fully offline-capable"],
];

export const WIN_REQS: [string, string][] = [
  ["Operating system", "Windows 11 or Windows Server 2022"],
  ["CPU", "x86-64 (SSE4.2) or ARM64"],
  ["Memory", "4 GB RAM (8 GB recommended)"],
  ["Disk", "500 MB free"],
  ["Code Universe", "DirectX 12 GPU"],
  ["Defender", "Passes SmartScreen on first run"],
];

export const LINUX_REQS: [string, string][] = [
  ["Distro family", "Debian, Ubuntu, Fedora, RHEL, Arch"],
  ["CPU", "x86-64 or aarch64"],
  ["Memory", "4 GB RAM (8 GB recommended)"],
  ["Disk", "500 MB free"],
  ["Display", "Wayland or X11 · Vulkan for GPU canvas"],
  ["libc", "glibc 2.35+ · musl not supported"],
];
