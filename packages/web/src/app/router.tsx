import { lazy, Suspense, useLayoutEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { PublicShell } from "@/components/layout/public-shell";
import { PageSkeleton } from "@/components/feedback/query-state";
import { GuestOnly, RequireAuth, RequireRole } from "@/features/auth/guards";
import { AppProviders } from "@/app/providers";

const HomePage = lazy(() => import("@/pages/public/home-page"));
const AuctionDiscoveryPage = lazy(() => import("@/pages/AuctionDiscoveryPage"));
const AuctionDetailPage = lazy(
  () => import("@/pages/public/auction-detail-page"),
);
const ReportPublicPage = lazy(
  () => import("@/pages/public/report-public-page"),
);
const LoginPage = lazy(() => import("@/pages/auth/login-page"));
const RegisterPage = lazy(() => import("@/pages/auth/register-page"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/forgot-password-page"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/reset-password-page"));
const VerificationReviewPage = lazy(() => import("@/pages/app/verification-review-page"));
const DashboardPage = lazy(() => import("@/pages/app/dashboard-page"));
const WorkspaceAuctionsPage = lazy(
  () => import("@/pages/app/workspace-auctions-page"),
);
const AuctionFormPage = lazy(() => import("@/pages/app/auction-form-page"));
const WorkspaceAuctionDetailPage = lazy(
  () => import("@/pages/app/workspace-auction-detail-page"),
);
const KycPage = lazy(() => import("@/pages/app/kyc-page"));
const DepositsPage = lazy(() => import("@/pages/app/deposits-page"));
const DocumentsPage = lazy(() => import("@/pages/app/documents-page"));
const NotificationsPage = lazy(() => import("@/pages/app/notifications-page"));
const DisputesPage = lazy(() => import("@/pages/app/disputes-page"));
const ReportsPage = lazy(() => import("@/pages/app/reports-page"));
const AuditPage = lazy(() => import("@/pages/app/audit-page"));
const AiPage = lazy(() => import("@/pages/app/ai-page"));
const AiAssistantPage = lazy(() => import("@/pages/app/ai-assistant-page"));
const TelegramPage = lazy(() => import("@/pages/app/telegram-page"));
const AutofetchPage = lazy(() => import("@/pages/app/autofetch-page"));
const OrganizationsPage = lazy(() => import("@/pages/app/organizations-page"));
const CategoriesPage = lazy(() => import("@/pages/app/categories-page"));
const ProfilePage = lazy(() => import("@/pages/app/profile-page"));
const NotFoundPage = lazy(() => import("@/pages/not-found-page"));

function Fallback() {
  return (
    <div className="page-container py-10">
      <PageSkeleton />
    </div>
  );
}

function RootProviders() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("product-theme", pathname !== "/");
    return () => root.classList.remove("product-theme");
  }, [pathname]);

  return (
    <AppProviders>
      <Suspense fallback={<Fallback />}>
        <Outlet />
      </Suspense>
    </AppProviders>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootProviders />,
    children: [
      {
        element: <PublicShell />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/auctions", element: <AuctionDiscoveryPage /> },
          { path: "/auctions/:id", element: <AuctionDetailPage /> },
          { path: "/reports/:id", element: <ReportPublicPage /> },
          { path: "/reset-password", element: <ResetPasswordPage /> },
          {
            element: <GuestOnly />,
            children: [
              { path: "/login", element: <LoginPage /> },
              { path: "/register", element: <RegisterPage /> },
              { path: "/forgot-password", element: <ForgotPasswordPage /> },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      {
        path: "/app",
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "profile", element: <ProfilePage /> },
              { path: "kyc", element: <KycPage /> },
              { path: "deposits", element: <DepositsPage /> },
              { path: "documents", element: <DocumentsPage /> },
              { path: "notifications", element: <NotificationsPage /> },
              { path: "disputes", element: <DisputesPage /> },
              { path: "telegram", element: <TelegramPage /> },
              { path: "ai-assistant", element: <AiAssistantPage /> },
              {
                // Compliance officers work inside the auction workspace too
                // (deposits, anomalies, disputes, reports) but cannot edit.
                element: (
                  <RequireRole
                    roles={["auction_officer", "org_admin", "compliance_officer", "super_admin"]}
                  />
                ),
                children: [
                  { path: "auctions", element: <WorkspaceAuctionsPage /> },
                  {
                    path: "auctions/:id",
                    element: <WorkspaceAuctionDetailPage />,
                  },
                ],
              },
              {
                element: (
                  <RequireRole
                    roles={["auction_officer", "org_admin", "super_admin"]}
                  />
                ),
                children: [
                  { path: "auctions/new", element: <AuctionFormPage /> },
                  { path: "auctions/:id/edit", element: <AuctionFormPage /> },
                ],
              },
              {
                element: (
                  <RequireRole
                    roles={["compliance_officer", "org_admin", "super_admin"]}
                  />
                ),
                children: [{ path: "kyc/review", element: <VerificationReviewPage /> }],
              },
              {
                element: (
                  <RequireRole
                    roles={[
                      "auction_officer",
                      "org_admin",
                      "compliance_officer",
                      "super_admin",
                    ]}
                  />
                ),
                children: [
                  { path: "reports", element: <ReportsPage /> },
                  { path: "audit", element: <AuditPage /> },
                  { path: "ai", element: <AiPage /> },
                ],
              },
              {
                element: (
                  <RequireRole
                    roles={[
                      "org_admin",
                      "compliance_officer",
                      "auction_officer",
                    ]}
                  />
                ),
                children: [{ path: "autofetch", element: <AutofetchPage /> }],
              },
              {
                element: <RequireRole roles={["org_admin", "super_admin"]} />,
                children: [{ path: "organizations", element: <OrganizationsPage /> }],
              },
              {
                element: <RequireRole roles={["super_admin"]} />,
                children: [{ path: "categories", element: <CategoriesPage /> }],
              },
            ],
          },
        ],
      },
      { path: "/dashboard", element: <Navigate to="/app" replace /> },
    ],
  },
]);
