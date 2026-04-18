import type { ComponentType, ReactNode } from "react";
import {
  LayoutGrid,
  LogIn,
  UserPlus,
  KeyRound,
  MailCheck,
  ShieldCheck,
  Building2,
  CreditCard,
  Receipt,
  Repeat,
  Sparkles,
  Users,
  UserCog,
  Workflow,
  BadgeCheck,
  User,
  Bell,
  BellRing,
  FileText,
  Lock,
  Activity,
  LifeBuoy,
  Gauge,
  ScrollText,
  KeySquare,
  Webhook,
  Rocket,
} from "lucide-react";

import { CatalogPage }             from "./pages/CatalogPage";
import { LoginPage }               from "./pages/auth/LoginPage";
import { SignupPage }              from "./pages/auth/SignupPage";
import { ForgotPasswordPage }      from "./pages/auth/ForgotPasswordPage";
import { VerifyEmailPage }         from "./pages/auth/VerifyEmailPage";
import { TwoFactorPage }           from "./pages/auth/TwoFactorPage";
import { SsoPage }                 from "./pages/auth/SsoPage";
import { PricingPage }             from "./pages/billing/PricingPage";
import { CheckoutPage }            from "./pages/billing/CheckoutPage";
import { SubscriptionPage }        from "./pages/billing/SubscriptionPage";
import { InvoicesPage }            from "./pages/billing/InvoicesPage";
import { UpgradePage }             from "./pages/billing/UpgradePage";
import { MembersPage }             from "./pages/team/MembersPage";
import { InvitesPage }             from "./pages/team/InvitesPage";
import { RolesPage }               from "./pages/team/RolesPage";
import { WorkspacesPage }          from "./pages/team/WorkspacesPage";
import { ProfilePage }             from "./pages/profile/ProfilePage";
import { AccountPreferencesPage }  from "./pages/profile/AccountPreferencesPage";
import { DangerZonePage }          from "./pages/profile/DangerZonePage";
import { OnboardingPage }          from "./pages/onboarding/OnboardingPage";
import { NotificationsInboxPage }  from "./pages/notifications/NotificationsInboxPage";
import { NotificationPrefsPage }   from "./pages/notifications/NotificationPrefsPage";
import { TermsPage }               from "./pages/legal/TermsPage";
import { PrivacyPage }             from "./pages/legal/PrivacyPage";
import { StatusPage }              from "./pages/legal/StatusPage";
import { HelpPage }                from "./pages/legal/HelpPage";
import { UsagePage }               from "./pages/admin/UsagePage";
import { AuditLogPage }            from "./pages/admin/AuditLogPage";
import { ApiKeysPage }             from "./pages/admin/ApiKeysPage";
import { WebhooksPage }            from "./pages/admin/WebhooksPage";

const ICON_SIZE = 15;
const ICON_STROKE = 1.5;

const icon = (Cmp: ComponentType<{ size?: number; strokeWidth?: number }>): ReactNode =>
  <Cmp size={ICON_SIZE} strokeWidth={ICON_STROKE} />;

export type CategoryId =
  | "catalog"
  | "auth"
  | "billing"
  | "team"
  | "profile"
  | "onboarding"
  | "notifications"
  | "legal"
  | "admin";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  blurb: string;
  icon: ReactNode;
  accent: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: "catalog",       label: "All demos",      blurb: "Pick any surface to try — every mockup at a glance.",     icon: icon(LayoutGrid),    accent: "#0a0a0a" },
  { id: "auth",          label: "Authentication", blurb: "Sign in, sign up, password reset, verification, 2FA, SSO.", icon: icon(Lock),         accent: "#4f46e5" },
  { id: "billing",       label: "Billing",        blurb: "Pricing, checkout, subscription, invoices, upgrade CTAs.",  icon: icon(CreditCard),   accent: "#0d99ff" },
  { id: "team",          label: "Team",           blurb: "Workspaces, members, invites, roles, permissions.",         icon: icon(Users),        accent: "#22a06b" },
  { id: "profile",       label: "Profile",        blurb: "Account info, preferences, delete account flow.",           icon: icon(User),         accent: "#7e4ed6" },
  { id: "onboarding",    label: "Onboarding",     blurb: "First-run checklist, sample repo tour, activation.",        icon: icon(Rocket),       accent: "#e09321" },
  { id: "notifications", label: "Notifications",  blurb: "In-app inbox & per-channel notification preferences.",      icon: icon(Bell),         accent: "#e5484d" },
  { id: "legal",         label: "Legal & help",   blurb: "Terms, privacy, status page, contextual help center.",      icon: icon(FileText),     accent: "#3d3d3d" },
  { id: "admin",         label: "Admin",          blurb: "Usage, audit log, API keys, webhooks, org controls.",       icon: icon(Gauge),        accent: "#0a0a0a" },
];

export interface DemoPageMeta {
  id: string;
  category: CategoryId;
  label: string;
  blurb: string;
  icon: ReactNode;
  chrome: "full" | "app";
  Component: ComponentType;
}

const meta = (
  id: string,
  category: CategoryId,
  label: string,
  blurb: string,
  iconCmp: ComponentType<{ size?: number; strokeWidth?: number }>,
  chrome: "full" | "app",
  Component: ComponentType,
): DemoPageMeta => ({
  id,
  category,
  label,
  blurb,
  icon: icon(iconCmp),
  chrome,
  Component,
});

export const DEMO_PAGES: readonly DemoPageMeta[] = [
  meta("catalog",            "catalog",       "All demos",           "Jump into any mockup surface.",                       LayoutGrid,  "app",  CatalogPage),

  meta("auth.login",         "auth",          "Log in",              "Email + password with SSO side rail.",                LogIn,       "full", LoginPage),
  meta("auth.signup",        "auth",          "Sign up",             "Create account with password strength meter.",         UserPlus,    "full", SignupPage),
  meta("auth.forgot",        "auth",          "Forgot password",     "Request a reset link by email.",                      KeyRound,    "full", ForgotPasswordPage),
  meta("auth.verify",        "auth",          "Verify email",        "Six-digit code entry confirmation screen.",           MailCheck,   "full", VerifyEmailPage),
  meta("auth.2fa",           "auth",          "Two-factor auth",     "TOTP / backup code challenge screen.",                ShieldCheck, "full", TwoFactorPage),
  meta("auth.sso",           "auth",          "SSO login",           "SAML / OIDC organization sign-in.",                   Building2,   "full", SsoPage),

  meta("billing.pricing",    "billing",       "Pricing",             "Three-tier plan comparison with billing toggle.",     CreditCard,  "full", PricingPage),
  meta("billing.checkout",   "billing",       "Checkout",            "Card details, order summary, coupon code.",           Receipt,     "full", CheckoutPage),
  meta("billing.subscription","billing",      "Subscription",        "Current plan, renewal date, cancel / upgrade.",       Repeat,      "app",  SubscriptionPage),
  meta("billing.invoices",   "billing",       "Invoices",            "Invoice history with PDF downloads.",                 Receipt,     "app",  InvoicesPage),
  meta("billing.upgrade",    "billing",       "Upgrade CTA",         "Mid-app paywall prompt modal.",                       Sparkles,    "app",  UpgradePage),

  meta("team.members",       "team",          "Members",             "List of team members with roles and status.",         Users,       "app",  MembersPage),
  meta("team.invites",       "team",          "Invitations",         "Pending invites with resend / revoke.",               UserPlus,    "app",  InvitesPage),
  meta("team.roles",         "team",          "Roles & permissions", "Matrix of roles vs capabilities.",                    UserCog,     "app",  RolesPage),
  meta("team.workspaces",    "team",          "Workspaces",          "Switch or create organization workspaces.",           Workflow,    "app",  WorkspacesPage),

  meta("profile.info",       "profile",       "Personal info",       "Name, email, avatar, timezone, language.",            User,        "app",  ProfilePage),
  meta("profile.preferences","profile",       "Preferences",         "Theme, density, shortcuts, accessibility.",           BadgeCheck,  "app",  AccountPreferencesPage),
  meta("profile.danger",     "profile",       "Danger zone",         "Export data, delete account confirmation.",           ShieldCheck, "app",  DangerZonePage),

  meta("onboarding.checklist","onboarding",   "Getting started",     "First-run onboarding checklist with progress.",       Rocket,      "app",  OnboardingPage),

  meta("notifications.inbox","notifications", "Inbox",               "In-app notification center feed.",                    Bell,        "app",  NotificationsInboxPage),
  meta("notifications.prefs","notifications", "Notification prefs",  "Per-event channel toggles (email / in-app / slack).", BellRing,    "app",  NotificationPrefsPage),

  meta("legal.terms",        "legal",         "Terms of Service",    "Long-form terms document.",                           FileText,    "app",  TermsPage),
  meta("legal.privacy",      "legal",         "Privacy Policy",      "Data handling and retention policy.",                 Lock,        "app",  PrivacyPage),
  meta("legal.status",       "legal",         "Status page",         "Uptime + incident timeline by component.",            Activity,    "app",  StatusPage),
  meta("legal.help",         "legal",         "Help & support",      "Knowledge base home + contact options.",              LifeBuoy,    "app",  HelpPage),

  meta("admin.usage",        "admin",         "Usage dashboard",     "Tokens, analysis minutes, seats — by week.",          Gauge,       "app",  UsagePage),
  meta("admin.audit",        "admin",         "Audit log",           "Who did what, when, from where.",                     ScrollText,  "app",  AuditLogPage),
  meta("admin.keys",         "admin",         "API keys",            "Create & rotate programmatic access tokens.",         KeySquare,   "app",  ApiKeysPage),
  meta("admin.webhooks",     "admin",         "Webhooks",            "Outbound event delivery endpoints.",                  Webhook,     "app",  WebhooksPage),
];

export const findPage = (id: string): DemoPageMeta =>
  DEMO_PAGES.find((p) => p.id === id) ?? DEMO_PAGES[0]!;

export const pagesByCategory = (cat: CategoryId): DemoPageMeta[] =>
  DEMO_PAGES.filter((p) => p.category === cat);
