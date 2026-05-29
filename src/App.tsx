import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HomeButton } from "./components/HomeButton";
import { RoleProvider } from "./contexts/RoleContext";
import { HelpWidget } from "./components/HelpWidget";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const AcceptMemberInvitation = lazy(() => import("./pages/auth/AcceptMemberInvitation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SelectRole = lazy(() => import("./pages/SelectRole"));
const Setup = lazy(() => import("./pages/Setup"));
const RequestAssociation = lazy(() => import("./pages/RequestAssociation"));
const RequestCompany = lazy(() => import("./pages/RequestCompany"));
const EventsCalendar = lazy(() => import("./pages/EventsCalendar"));
const AdminActions = lazy(() => import("./pages/admin/AdminActions"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const AdminAssociations = lazy(() => import("./pages/admin/AdminAssociations"));
const AdminCompanies = lazy(() => import("./pages/admin/AdminCompanies"));
const AdminAssociationRequests = lazy(() => import("./pages/admin/AdminAssociationRequests"));
const AdminCompanyRequests = lazy(() => import("./pages/admin/AdminCompanyRequests"));
const AssociationProfileView = lazy(() => import("./pages/admin/AssociationProfileView"));
const AdminCompanyProfileView = lazy(() => import("./pages/admin/AdminCompanyProfileView"));
const CreateAssociation = lazy(() => import("./pages/admin/CreateAssociation"));
const BrowseCompanies = lazy(() => import("./pages/member/BrowseCompanies"));
const BrowseAssociations = lazy(() => import("./pages/member/BrowseAssociations"));
const CompanyProfileView = lazy(() => import("./pages/member/CompanyProfileView"));
const MemberAssociationProfileView = lazy(() => import("./pages/member/AssociationProfileView"));
const CreateCompany = lazy(() => import("./pages/admin/CreateCompany"));
const CreateUser = lazy(() => import("./pages/admin/CreateUser"));
const BulkUploadAssociations = lazy(() => import("./pages/admin/BulkUploadAssociations"));
const BulkUploadCompanies = lazy(() => import("./pages/admin/BulkUploadCompanies"));
const AdminEmailLists = lazy(() => import("./pages/admin/AdminEmailLists"));
const AdminEmailListDetail = lazy(() => import("./pages/admin/AdminEmailListDetail"));
const AdminEmailAnalytics = lazy(() => import("./pages/admin/AdminEmailAnalytics"));
const AdminWhatsAppLists = lazy(() => import("./pages/admin/AdminWhatsAppLists"));
const AdminWhatsAppListDetail = lazy(() => import("./pages/admin/AdminWhatsAppListDetail"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const MemberInvitations = lazy(() => import("./pages/admin/MemberInvitations"));
const AssociationDashboard = lazy(() => import("./pages/association/AssociationDashboard"));
const AssociationCompanies = lazy(() => import("./pages/association/AssociationCompanies"));
const AssociationInvitations = lazy(() => import("./pages/association/AssociationInvitations"));
const AssociationMembers = lazy(() => import("./pages/association/AssociationMembers"));
const AssociationProfile = lazy(() => import("./pages/association/AssociationProfile"));
const AssociationBulkUploadCompanies = lazy(() => import("./pages/association/BulkUploadCompanies"));
const AssociationEmailLists = lazy(() => import("./pages/association/AssociationEmailLists"));
const AssociationEmailListDetail = lazy(() => import("./pages/association/AssociationEmailListDetail"));
const AssociationEmailAnalytics = lazy(() => import("./pages/association/AssociationEmailAnalytics"));
const AssociationAnalytics = lazy(() => import("./pages/association/AssociationAnalytics"));
const CompanyDashboard = lazy(() => import("./pages/company/CompanyDashboard"));
const CompanyMembers = lazy(() => import("./pages/company/CompanyMembers"));
const CompanyEmailLists = lazy(() => import("./pages/company/CompanyEmailLists"));
const CompanyEmailListDetail = lazy(() => import("./pages/company/CompanyEmailListDetail"));
const CompanyEmailAnalytics = lazy(() => import("./pages/company/CompanyEmailAnalytics"));
const MemberDashboard = lazy(() => import("./pages/member/MemberDashboard"));
const MemberCompanies = lazy(() => import("./pages/member/MemberCompanies"));
const MemberConnections = lazy(() => import("./pages/member/MemberConnections"));
const BrowseMembers = lazy(() => import("./pages/member/BrowseMembers"));
const MemberProfile = lazy(() => import("./pages/member/MemberProfile"));
const MemberFeed = lazy(() => import("./pages/member/MemberFeed"));
const MemberMessages = lazy(() => import("./pages/member/MemberMessages"));
const SavedPosts = lazy(() => import("./pages/member/SavedPosts"));
const MemberNotifications = lazy(() => import("./pages/member/MemberNotifications"));
const CompanyFeed = lazy(() => import("./pages/company/CompanyFeed"));
const AssociationFeed = lazy(() => import("./pages/association/AssociationFeed"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const EventLandingPages = lazy(() => import("./pages/admin/EventLandingPages"));
const CreateLandingPage = lazy(() => import("./pages/admin/CreateLandingPage"));
const EventLandingPageView = lazy(() => import("./pages/public/EventLandingPageView"));
const CouponManagement = lazy(() => import("./pages/admin/CouponManagement"));
const EventRegistrations = lazy(() => import("./pages/admin/EventRegistrations"));
const DataExport = lazy(() => import("./pages/admin/DataExport"));
const MemberConnectionRequests = lazy(() => import("./pages/admin/MemberConnectionRequests"));
const JoinViaLink = lazy(() => import("./pages/join/JoinViaLink"));
const AssociationWalkthrough = lazy(() => import("./pages/public/AssociationWalkthrough"));
const Terms = lazy(() => import("./pages/public/Terms"));
const RefundPolicy = lazy(() => import("./pages/public/RefundPolicy"));
const PrivacyPolicy = lazy(() => import("./pages/public/PrivacyPolicy"));
const ShippingPolicy = lazy(() => import("./pages/public/ShippingPolicy"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Page load error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-lg font-semibold">Something went wrong</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent = () => {
  const location = useLocation();
  const hideHomeButton = ['/', '/auth/login', '/auth/register', '/walkthrough', '/terms', '/refund-policy', '/privacy-policy', '/shipping-policy'].includes(location.pathname) || location.pathname.startsWith('/event/') || location.pathname.startsWith('/join/');

  return (
    <>
      {!hideHomeButton && <HomeButton />}
      <HelpWidget />
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            <Route path="/register" element={<AcceptMemberInvitation />} />
            <Route
              path="/select-role"
              element={
                <ProtectedRoute>
                  <SelectRole />
                </ProtectedRoute>
              }
            />
            <Route path="/account-settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <Setup />
            </ProtectedRoute>
          }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <EventsCalendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/messages"
            element={
              <ProtectedRoute>
                <MemberMessages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/actions"
            element={
              <ProtectedRoute>
                <AdminActions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/create-user"
            element={
              <ProtectedRoute>
                <CreateUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/associations"
            element={
              <ProtectedRoute>
                <AdminAssociations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/associations/:id"
            element={
              <ProtectedRoute>
                <AssociationProfileView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/companies"
            element={
              <ProtectedRoute>
                <AdminCompanies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/companies/:id"
            element={
              <ProtectedRoute>
                <AdminCompanyProfileView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/requests"
            element={
              <ProtectedRoute>
                <AdminAssociationRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/company-requests"
            element={
              <ProtectedRoute>
                <AdminCompanyRequests />
              </ProtectedRoute>
            }
           />
          <Route
            path="/admin/data-export"
            element={
              <ProtectedRoute>
                <DataExport />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/create-association"
            element={
              <ProtectedRoute>
                <CreateAssociation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/create-company"
            element={
              <ProtectedRoute>
                <CreateCompany />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/bulk-upload-associations"
            element={
              <ProtectedRoute>
                <BulkUploadAssociations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/bulk-upload-companies"
            element={
              <ProtectedRoute>
                <BulkUploadCompanies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/email-lists"
            element={
              <ProtectedRoute>
                <AdminEmailLists />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/email-lists/:listId"
            element={
              <ProtectedRoute>
                <AdminEmailListDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/email-analytics"
            element={
              <ProtectedRoute>
                <AdminEmailAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/whatsapp-lists"
            element={
              <ProtectedRoute>
                <AdminWhatsAppLists />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/whatsapp-lists/:listId"
            element={
              <ProtectedRoute>
                <AdminWhatsAppListDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/invitations"
            element={
              <ProtectedRoute>
                <MemberInvitations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/member-connections"
            element={
              <ProtectedRoute>
                <MemberConnectionRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/event-landing-pages"
            element={
              <ProtectedRoute>
                <EventLandingPages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/event-landing-pages/new"
            element={
              <ProtectedRoute>
                <CreateLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/event-landing-pages/:id/edit"
            element={
              <ProtectedRoute>
                <CreateLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/event-landing-pages/:id/registrations"
            element={
              <ProtectedRoute>
                <EventRegistrations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/coupons"
            element={
              <ProtectedRoute>
                <CouponManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/event-landing-pages"
            element={
              <ProtectedRoute>
                <EventLandingPages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/event-landing-pages/new"
            element={
              <ProtectedRoute>
                <CreateLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/event-landing-pages/:id/edit"
            element={
              <ProtectedRoute>
                <CreateLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/event-landing-pages/:id/registrations"
            element={
              <ProtectedRoute>
                <EventRegistrations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/coupons"
            element={
              <ProtectedRoute>
                <CouponManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/event-landing-pages"
            element={
              <ProtectedRoute>
                <EventLandingPages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/event-landing-pages/new"
            element={
              <ProtectedRoute>
                <CreateLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/event-landing-pages/:id/edit"
            element={
              <ProtectedRoute>
                <CreateLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/event-landing-pages/:id/registrations"
            element={
              <ProtectedRoute>
                <EventRegistrations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/coupons"
            element={
              <ProtectedRoute>
                <CouponManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/request-association"
            element={
              <ProtectedRoute>
                <RequestAssociation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/request-company"
            element={
              <ProtectedRoute>
                <RequestCompany />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association"
            element={
              <ProtectedRoute>
                <AssociationDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/companies"
            element={
              <ProtectedRoute>
                <AssociationCompanies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/invitations"
            element={
              <ProtectedRoute>
                <AssociationInvitations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/members"
            element={
              <ProtectedRoute>
                <AssociationMembers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/profile"
            element={
              <ProtectedRoute>
                <AssociationProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/bulk-upload-companies"
            element={
              <ProtectedRoute>
                <AssociationBulkUploadCompanies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/manage-invitations"
            element={
              <ProtectedRoute>
                <MemberInvitations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/email-lists"
            element={
              <ProtectedRoute>
                <AssociationEmailLists />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/email-lists/:listId"
            element={
              <ProtectedRoute>
                <AssociationEmailListDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/email-analytics"
            element={
              <ProtectedRoute>
                <AssociationEmailAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/analytics"
            element={
              <ProtectedRoute>
                <AssociationAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/feed"
            element={
              <ProtectedRoute>
                <AssociationFeed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company"
            element={
              <ProtectedRoute>
                <CompanyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/members"
            element={
              <ProtectedRoute>
                <CompanyMembers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/manage-invitations"
            element={
              <ProtectedRoute>
                <MemberInvitations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/email-lists"
            element={
              <ProtectedRoute>
                <CompanyEmailLists />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/email-lists/:listId"
            element={
              <ProtectedRoute>
                <CompanyEmailListDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/email-analytics"
            element={
              <ProtectedRoute>
                <CompanyEmailAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/feed"
            element={
              <ProtectedRoute>
                <CompanyFeed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member"
            element={
              <ProtectedRoute>
                <MemberDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <MemberCompanies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/connections"
            element={
              <ProtectedRoute>
                <MemberConnections />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/connections"
            element={
              <ProtectedRoute>
                <MemberConnections />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <BrowseMembers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/browse-companies"
            element={
              <ProtectedRoute>
                <BrowseCompanies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/browse-associations"
            element={
              <ProtectedRoute>
                <BrowseAssociations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/company/:id"
            element={
              <ProtectedRoute>
                <CompanyProfileView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/associations/:id"
            element={
              <ProtectedRoute>
                <MemberAssociationProfileView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <ProtectedRoute>
                <MemberProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <MemberFeed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MemberMessages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved-posts"
            element={
              <ProtectedRoute>
                <SavedPosts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <MemberNotifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/feed"
            element={
              <ProtectedRoute>
                <CompanyFeed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/association/feed"
            element={
              <ProtectedRoute>
                <AssociationFeed />
              </ProtectedRoute>
            }
          />
          {/* Public walkthrough - NO AUTH REQUIRED */}
          <Route path="/walkthrough" element={<AssociationWalkthrough />} />

          {/* Public policy pages - NO AUTH REQUIRED */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />

          {/* Public invite links - NO AUTH REQUIRED */}
          <Route path="/join/:token" element={<JoinViaLink />} />

          {/* Public event landing pages - NO AUTH REQUIRED */}
          <Route path="/event/:slug" element={<EventLandingPageView />} />
          <Route path="/event/:slug/:subPage" element={<EventLandingPageView />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RoleProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
