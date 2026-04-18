import type { ComponentType } from "react";
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
  Plug,
  Boxes,
  Laptop,
  Network,
  Download,
  SearchX,
  ServerCrash,
  Clock,
  LayoutDashboard,
  Bolt,
  Radio,
  Gift,
  Building,
  BellOff,
  Play,
  Keyboard,
  Map,
  Timer,
  ShieldAlert,
  Archive,
  Handshake,
  FileDigit,
} from "lucide-react";

import { CatalogPage }             from "../pages/CatalogPage";
import { LoginPage }               from "../pages/auth/LoginPage";
import { SignupPage }              from "../pages/auth/SignupPage";
import { ForgotPasswordPage }      from "../pages/auth/ForgotPasswordPage";
import { VerifyEmailPage }         from "../pages/auth/VerifyEmailPage";
import { TwoFactorPage }           from "../pages/auth/TwoFactorPage";
import { SsoPage }                 from "../pages/auth/SsoPage";
import { PricingPage }             from "../pages/billing/PricingPage";
import { CheckoutPage }            from "../pages/billing/CheckoutPage";
import { SubscriptionPage }        from "../pages/billing/SubscriptionPage";
import { InvoicesPage }            from "../pages/billing/InvoicesPage";
import { UpgradePage }             from "../pages/billing/UpgradePage";
import { UsageAlertsPage }         from "../pages/billing/UsageAlertsPage";
import { MembersPage }             from "../pages/team/MembersPage";
import { InvitesPage }             from "../pages/team/InvitesPage";
import { RolesPage }               from "../pages/team/RolesPage";
import { WorkspacesPage }          from "../pages/team/WorkspacesPage";
import { ProfilePage }             from "../pages/profile/ProfilePage";
import { AccountPreferencesPage }  from "../pages/profile/AccountPreferencesPage";
import { DangerZonePage }          from "../pages/profile/DangerZonePage";
import { ReferralsPage }           from "../pages/profile/ReferralsPage";
import { OnboardingPage }          from "../pages/onboarding/OnboardingPage";
import { NotificationsInboxPage }  from "../pages/notifications/NotificationsInboxPage";
import { NotificationPrefsPage }   from "../pages/notifications/NotificationPrefsPage";
import { TermsPage }               from "../pages/legal/TermsPage";
import { PrivacyPage }             from "../pages/legal/PrivacyPage";
import { StatusPage }              from "../pages/legal/StatusPage";
import { HelpPage }                from "../pages/legal/HelpPage";
import { UsagePage }               from "../pages/admin/UsagePage";
import { AuditLogPage }            from "../pages/admin/AuditLogPage";
import { ApiKeysPage }             from "../pages/admin/ApiKeysPage";
import { WebhooksPage }            from "../pages/admin/WebhooksPage";
import { OrgSettingsPage }         from "../pages/admin/OrgSettingsPage";
import { EngineApiPage }           from "../pages/admin/EngineApiPage";
import { MarketplacePage }         from "../pages/integrations/MarketplacePage";
import { ConnectedAppsPage }       from "../pages/integrations/ConnectedAppsPage";
import { ActiveSessionsPage }      from "../pages/security/ActiveSessionsPage";
import { IpAllowlistPage }         from "../pages/security/IpAllowlistPage";
import { DataExportPage }          from "../pages/security/DataExportPage";
import { NotFoundPage }            from "../pages/states/NotFoundPage";
import { ServerErrorPage }         from "../pages/states/ServerErrorPage";
import { SessionExpiredPage }      from "../pages/states/SessionExpiredPage";
import { EmptyDashboardPage }      from "../pages/states/EmptyDashboardPage";
import { ChangelogPage }           from "../pages/updates/ChangelogPage";
import { RoadmapPage }             from "../pages/updates/RoadmapPage";
import { TrialBannerPage }         from "../pages/states/TrialBannerPage";
import { InvoiceDetailPage }       from "../pages/billing/InvoiceDetailPage";
import { WebhookCatalogPage }      from "../pages/developers/WebhookCatalogPage";
import { ApiExplorerPage }         from "../pages/developers/ApiExplorerPage";
import { KeyboardShortcutsPage }   from "../pages/developers/KeyboardShortcutsPage";
import { ContactSalesPage }        from "../pages/legal/ContactSalesPage";
import { SecurityDisclosurePage }  from "../pages/security/SecurityDisclosurePage";
import { DataRetentionPage }       from "../pages/security/DataRetentionPage";

import { iconOf } from "./icon";
import type { CategoryId, DemoChrome, DemoPageMeta } from "./types";

const meta = (
  id: string,
  category: CategoryId,
  label: string,
  blurb: string,
  iconCmp: ComponentType<{ size?: number; strokeWidth?: number }>,
  chrome: DemoChrome,
  Component: ComponentType,
): DemoPageMeta => ({
  id,
  category,
  label,
  blurb,
  icon: iconOf(iconCmp),
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
  meta("billing.alerts",     "billing",       "Usage alerts",        "Budget caps and overage alert thresholds.",           BellOff,     "app",  UsageAlertsPage),
  meta("billing.invoice",    "billing",       "Invoice detail",      "Document-style drill-down for a single paid invoice.", FileDigit,  "app",  InvoiceDetailPage),

  meta("team.members",       "team",          "Members",             "List of team members with roles and status.",         Users,       "app",  MembersPage),
  meta("team.invites",       "team",          "Invitations",         "Pending invites with resend / revoke.",               UserPlus,    "app",  InvitesPage),
  meta("team.roles",         "team",          "Roles & permissions", "Matrix of roles vs capabilities.",                    UserCog,     "app",  RolesPage),
  meta("team.workspaces",    "team",          "Workspaces",          "Switch or create organization workspaces.",           Workflow,    "app",  WorkspacesPage),

  meta("profile.info",       "profile",       "Personal info",       "Name, email, avatar, timezone, language.",            User,        "app",  ProfilePage),
  meta("profile.preferences","profile",       "Preferences",         "Theme, density, shortcuts, accessibility.",           BadgeCheck,  "app",  AccountPreferencesPage),
  meta("profile.referrals",  "profile",       "Referrals & credits", "Invite friends, earn Quanta credits.",                Gift,        "app",  ReferralsPage),
  meta("profile.danger",     "profile",       "Danger zone",         "Export data, delete account confirmation.",           ShieldCheck, "app",  DangerZonePage),

  meta("onboarding.checklist","onboarding",   "Getting started",     "First-run onboarding checklist with progress.",       Rocket,      "app",  OnboardingPage),

  meta("notifications.inbox","notifications", "Inbox",               "In-app notification center feed.",                    Bell,        "app",  NotificationsInboxPage),
  meta("notifications.prefs","notifications", "Notification prefs",  "Per-event channel toggles (email / in-app / slack).", BellRing,    "app",  NotificationPrefsPage),

  meta("integrations.marketplace","integrations", "Marketplace",     "Connect GitHub, Slack, Jira, CI providers, and more.", Boxes,      "app",  MarketplacePage),
  meta("integrations.connected","integrations", "Connected apps",    "OAuth applications authorized to access the workspace.", Plug,    "app",  ConnectedAppsPage),

  meta("developers.webhooks","developers",   "Webhook event catalog","Every event we emit with sample payloads and copy-curl.", Webhook,   "app",  WebhookCatalogPage),
  meta("developers.api",     "developers",   "API explorer",        "Stripe-style three-pane interactive API reference.",   Play,        "app",  ApiExplorerPage),
  meta("developers.shortcuts","developers",  "Keyboard shortcuts",  "Full cheatsheet with macOS/Windows toggle and search.", Keyboard,   "app",  KeyboardShortcutsPage),

  meta("security.sessions",  "security",      "Active sessions",     "Devices currently signed in to your account.",        Laptop,      "app",  ActiveSessionsPage),
  meta("security.ip",        "security",      "IP allowlist",        "Restrict workspace access to known network ranges.",  Network,     "app",  IpAllowlistPage),
  meta("security.export",    "security",      "Data export",         "Machine-readable workspace archive (GDPR).",          Download,    "app",  DataExportPage),
  meta("security.retention", "security",      "Data retention",      "Per-category retention schedules with segmented controls.", Archive, "app",  DataRetentionPage),
  meta("security.disclosure","security",      "Responsible disclosure","Bounty tiers, scope, process, and hall of fame.",    ShieldAlert, "app",  SecurityDisclosurePage),

  meta("states.404",         "states",        "404 Not Found",       "Page-not-found full-screen template.",                 SearchX,     "full", NotFoundPage),
  meta("states.500",         "states",        "500 Server Error",    "Server error full-screen with incident ID.",          ServerCrash, "full", ServerErrorPage),
  meta("states.expired",     "states",        "Session expired",     "Re-authentication prompt after timeout.",             Clock,       "full", SessionExpiredPage),
  meta("states.empty",       "states",        "Empty dashboard",     "First-run empty state with setup checklist.",         LayoutDashboard, "app", EmptyDashboardPage),
  meta("states.trial-banner","states",        "Trial banner variants","Healthy / warn / expired banner in a mock app chrome.", Timer,     "app",  TrialBannerPage),

  meta("updates.changelog",  "updates",       "Changelog",           "Release notes feed with entry tags.",                 Radio,       "app",  ChangelogPage),
  meta("updates.roadmap",    "updates",       "Public roadmap",      "Kanban of upcoming work with upvotes and comments.",  Map,         "app",  RoadmapPage),

  meta("legal.terms",        "legal",         "Terms of Service",    "Long-form terms document.",                           FileText,    "app",  TermsPage),
  meta("legal.privacy",      "legal",         "Privacy Policy",      "Data handling and retention policy.",                 Lock,        "app",  PrivacyPage),
  meta("legal.status",       "legal",         "Status page",         "Uptime + incident timeline by component.",            Activity,    "app",  StatusPage),
  meta("legal.help",         "legal",         "Help & support",      "Knowledge base home + contact options.",              LifeBuoy,    "app",  HelpPage),
  meta("legal.contact",      "legal",         "Contact sales",       "Enterprise inquiry form with testimonial + trust rail.", Handshake, "app",  ContactSalesPage),

  meta("admin.usage",        "admin",         "Usage dashboard",     "Tokens, analysis minutes, seats — by week.",          Gauge,       "app",  UsagePage),
  meta("admin.engine-api",   "admin",         "Engine API traffic",  "External engine calls (MCP, CLI, REST, IDE, CI) with p50/p95/error rates.", Bolt, "app", EngineApiPage),
  meta("admin.audit",        "admin",         "Audit log",           "Who did what, when, from where.",                     ScrollText,  "app",  AuditLogPage),
  meta("admin.keys",         "admin",         "API keys",            "Create & rotate programmatic access tokens.",         KeySquare,   "app",  ApiKeysPage),
  meta("admin.webhooks",     "admin",         "Webhooks",            "Outbound event delivery endpoints.",                  Webhook,     "app",  WebhooksPage),
  meta("admin.org",          "admin",         "Organization settings","Identity, discoverability, defaults, and delete org.",Building,   "app",  OrgSettingsPage),
];
