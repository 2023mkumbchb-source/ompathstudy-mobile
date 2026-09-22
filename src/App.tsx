import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ScrollToTop from "@/components/ScrollToTop";
import { ScrollProgressBar, BackToTopButton } from "@/components/ScrollFX";
import ContentProtection from "@/components/ContentProtection";
import PurchaseResume from "@/components/PurchaseResume";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useMobileApp } from "@/hooks/useMobileApp";
import { Loader2 } from "lucide-react";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import LearnerProfileGate from "@/components/LearnerProfileGate";
import OfflineStatusBanner from "@/components/OfflineStatusBanner";
import NotificationBanner from "@/components/NotificationBanner";
import { setupNativeNotificationListener } from "@/lib/notifications";
import { openNotificationAction } from "@/lib/notification-navigation";
import { useAutoSync } from "@/hooks/useAutoSync";
import { AdminRoute, SignedInRoute } from "@/components/AccessRoute";
import MedicalLaunchExperience from "@/components/MedicalLaunchExperience";
import { initOtaUpdater } from "@/lib/otaUpdater";
import "@/styles/workspace.css";

const Index = lazy(() => import("./pages/Index"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const FlashcardStudy = lazy(() => import("./pages/FlashcardStudy"));
const Exams = lazy(() => import("./pages/Exams"));
const ExamStart = lazy(() => import("./pages/ExamStart"));
const AdminEditor = lazy(() => import("./pages/AdminEditor"));
const Stories = lazy(() => import("./pages/Stories"));
const StoryRead = lazy(() => import("./pages/StoryRead"));
const SubmitStory = lazy(() => import("./pages/SubmitStory"));
const Essays = lazy(() => import("./pages/Essays"));
const EssayStudy = lazy(() => import("./pages/EssayStudy"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Account = lazy(() => import("./pages/Account"));
const Admin = lazy(() => import("./pages/Admin"));
const SourceLibrary = lazy(() => import("./pages/SourceLibrary"));
const YearHub = lazy(() => import("./pages/YearHub"));
const UnitPage = lazy(() => import("./pages/UnitPage"));
const MyRevision = lazy(() => import("./pages/MyRevision"));
const RevisionPlanner = lazy(() => import("./pages/RevisionPlanner"));
const RevisionIndex = lazy(() => import("./pages/RevisionIndex"));
const GlobalSearch = lazy(() => import("./pages/GlobalSearch"));
const StudySystemAdmin = lazy(() => import("./pages/StudySystemAdmin"));
const CategoryManager = lazy(() => import("./pages/CategoryManager"));
const About = lazy(() => import("./pages/About"));
const Contests = lazy(() => import("./pages/Contests"));
const ContestBriefing = lazy(() => import("./pages/ContestBriefing"));
const ContestRegistration = lazy(() => import("./pages/ContestRegistration"));
const ContestLobby = lazy(() => import("./pages/ContestLobby"));
const ContestRound = lazy(() => import("./pages/ContestRound"));
const ContestAdmin = lazy(() => import("./pages/ContestAdmin"));
const ContestSetup = lazy(() => import("./pages/ContestSetup"));
const ContestQuestionAdmin = lazy(() => import("./pages/ContestQuestionAdmin"));
const ContestOperations = lazy(() => import("./pages/ContestOperations"));
const ContestLeaderboard = lazy(() => import("./pages/ContestLeaderboard"));
const ContestRehearsal = lazy(() => import("./pages/ContestRehearsal"));
const ContestProgress = lazy(() => import("./pages/ContestProgress"));
const ContestCertificate = lazy(() => import("./pages/ContestCertificate"));
const ContestAppealsAdmin = lazy(() => import("./pages/ContestAppealsAdmin"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const Updates = lazy(() => import("./pages/Updates"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const RouteLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <RouteErrorBoundary key={location.pathname}>
      <main className="study-shell min-h-[65vh]">
        <Suspense fallback={<RouteLoader />}>
          <Routes location={location}>
            <Route path="/" element={<Index />} />
            <Route path="/year/:yearNumber" element={<YearHub />} />
            <Route path="/year/:yearNumber/unit/:unitSlug" element={<UnitPage />} />
            <Route path="/my-revision" element={<SignedInRoute><MyRevision /></SignedInRoute>} />
            <Route path="/revision-planner" element={<SignedInRoute><RevisionPlanner /></SignedInRoute>} />
            <Route path="/supplementary-revision" element={<Navigate to="/revision-index" replace />} />
            <Route path="/revision-index" element={<RevisionIndex />} />
            <Route path="/search" element={<GlobalSearch />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/flashcards/:id" element={<FlashcardStudy />} />
            <Route path="/mcqs" element={<Exams />} />
            <Route path="/mcqs/:id" element={<ExamStart />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/exams/:id/start" element={<ExamStart />} />
            <Route path="/contests" element={<Contests />} />
            <Route path="/contests/:slug/briefing" element={<ContestBriefing />} />
            <Route path="/contests/:slug/register" element={<SignedInRoute><ContestRegistration /></SignedInRoute>} />
            <Route path="/contests/:slug/lobby" element={<SignedInRoute><ContestLobby /></SignedInRoute>} />
            <Route path="/contests/:slug/round/:roundId" element={<SignedInRoute><ContestRound /></SignedInRoute>} />
            <Route path="/contests/:slug/leaderboard" element={<ContestLeaderboard />} />
            <Route path="/contests/:slug/progress" element={<SignedInRoute><ContestProgress /></SignedInRoute>} />
            <Route path="/contests/:slug/certificate/:attemptId" element={<SignedInRoute><ContestCertificate /></SignedInRoute>} />
            <Route path="/admin/editor" element={<AdminRoute><AdminEditor /></AdminRoute>} />
            <Route path="/admin/categories" element={<AdminRoute><CategoryManager /></AdminRoute>} />
            <Route path="/admin/study-system" element={<AdminRoute><StudySystemAdmin /></AdminRoute>} />
            <Route path="/admin/contests" element={<AdminRoute><ContestAdmin /></AdminRoute>} />
            <Route path="/admin/contests/setup" element={<AdminRoute><ContestSetup /></AdminRoute>} />
            <Route path="/admin/contests/questions" element={<AdminRoute><ContestQuestionAdmin /></AdminRoute>} />
            <Route path="/admin/contests/operations" element={<AdminRoute><ContestOperations /></AdminRoute>} />
            <Route path="/admin/contests/rehearsal" element={<AdminRoute><ContestRehearsal /></AdminRoute>} />
            <Route path="/admin/contests/appeals" element={<AdminRoute><ContestAppealsAdmin /></AdminRoute>} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/stories/:id" element={<StoryRead />} />
            <Route path="/submit-story" element={<SignedInRoute><SubmitStory /></SignedInRoute>} />
            <Route path="/essays" element={<Essays />} />
            <Route path="/essays/:slug" element={<EssayStudy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/account" element={<SignedInRoute><Account /></SignedInRoute>} />
            <Route path="/notifications" element={<SignedInRoute><Notifications /></SignedInRoute>} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
            <Route path="/admin/payments" element={<AdminRoute><Navigate to="/admin#payments" replace /></AdminRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/unedited-uploads" element={<AdminRoute><Navigate to="/source-library" replace /></AdminRoute>} />
            <Route path="/unedited-uploads" element={<AdminRoute><Navigate to="/source-library" replace /></AdminRoute>} />
            <Route path="/source-library" element={<AdminRoute><SourceLibrary /></AdminRoute>} />
            <Route path="/source-library/:slug" element={<AdminRoute><SourceLibrary /></AdminRoute>} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </RouteErrorBoundary>
  );
};

function MobileAppBridge() {
  const navigate = useNavigate();
  useMobileApp();
  useAutoSync();

  useEffect(() => {
    setupNativeNotificationListener((url) => {
      openNotificationAction(url, navigate);
    });
    void initOtaUpdater();
  }, [navigate]);

  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark", "amoled"]}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={import.meta.env.BASE_URL === "/ompathstudy-mobile/" ? "/ompathstudy-mobile" : undefined}>
            <MobileAppBridge />
            <MedicalLaunchExperience />
            <NotificationBanner />
            <ScrollToTop />
            <ScrollProgressBar />
            <BackToTopButton />
            <ContentProtection />
            <PurchaseResume />
            <LearnerProfileGate />
            <Navbar />
            <OfflineStatusBanner />
            <AnimatedRoutes />
            <SiteFooter />
            <MobileBottomNav />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
