import {
  LayoutGrid,
  Lock,
  CreditCard,
  Users,
  User,
  Rocket,
  Bell,
  Plug,
  Shield,
  SearchX,
  Radio,
  FileText,
  Gauge,
} from "lucide-react";

import { iconOf } from "./icon";
import type { CategoryMeta } from "./types";

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: "catalog",       label: "All demos",      blurb: "Pick any surface to try — every mockup at a glance.",     icon: iconOf(LayoutGrid),    accent: "#0a0a0a" },
  { id: "auth",          label: "Authentication", blurb: "Sign in, sign up, password reset, verification, 2FA, SSO.", icon: iconOf(Lock),         accent: "#4f46e5" },
  { id: "billing",       label: "Billing",        blurb: "Pricing, checkout, subscription, invoices, upgrade CTAs.",  icon: iconOf(CreditCard),   accent: "#0d99ff" },
  { id: "team",          label: "Team",           blurb: "Workspaces, members, invites, roles, permissions.",         icon: iconOf(Users),        accent: "#22a06b" },
  { id: "profile",       label: "Profile",        blurb: "Account info, preferences, referrals, delete account.",     icon: iconOf(User),         accent: "#7e4ed6" },
  { id: "onboarding",    label: "Onboarding",     blurb: "First-run checklist, sample repo tour, activation.",        icon: iconOf(Rocket),       accent: "#e09321" },
  { id: "notifications", label: "Notifications",  blurb: "In-app inbox & per-channel notification preferences.",      icon: iconOf(Bell),         accent: "#e5484d" },
  { id: "integrations",  label: "Integrations",   blurb: "Marketplace of connected services and authorized OAuth apps.", icon: iconOf(Plug),     accent: "#14b8a6" },
  { id: "security",      label: "Security",       blurb: "Active sessions, IP allowlist, data export.",               icon: iconOf(Shield),       accent: "#0f766e" },
  { id: "states",        label: "States & errors",blurb: "404, 500, session expired, empty dashboard.",                icon: iconOf(SearchX),      accent: "#64748b" },
  { id: "updates",       label: "Updates",        blurb: "Changelog and release notes.",                              icon: iconOf(Radio),        accent: "#8b5cf6" },
  { id: "legal",         label: "Legal & help",   blurb: "Terms, privacy, status page, contextual help center.",      icon: iconOf(FileText),     accent: "#3d3d3d" },
  { id: "admin",         label: "Admin",          blurb: "Usage, engine traffic, audit, API keys, webhooks, org.",    icon: iconOf(Gauge),        accent: "#0a0a0a" },
];
