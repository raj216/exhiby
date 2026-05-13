import React, { lazy, Suspense, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserModeProvider } from "@/contexts/UserModeContext";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LiveNotificationToast } from "@/components/LiveNotificationToast";

// Home + Auth load eagerly — they're the first thing any visitor sees
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Every other route is lazy — only downloaded when the user navigates there.
// This cuts the initial JS bundle from 607 KB to the fraction needed for the home page.
const PublicProfile    = lazy(() => import("./pages/PublicProfile"));
const LiveRoomEntry    = lazy(() => import("./pages/LiveRoomEntry"));
const ExploreStudios   = lazy(() => import("./pages/ExploreStudios"));
const AdminFeedback    = lazy(() => import("./pages/AdminFeedback"));
const EarningsHistory  = lazy(() => import("./pages/EarningsHistory"));
const TicketsHistory   = lazy(() => import("./pages/TicketsHistory"));
const SessionResolver  = lazy(() => import("./pages/SessionResolver"));
const Settings         = lazy(() => import("./pages/Settings"));
const Schedule         = lazy(() => import("./pages/Schedule"));
const Browse           = lazy(() => import("./pages/Browse"));
const Messages         = lazy(() => import("./pages/Messages"));
const Chat             = lazy(() => import("./pages/Chat"));
const NotFound         = lazy(() => import("./pages/NotFound"));
const ProfileResolver  = lazy(() => import("./pages/ProfileResolver"));
const StudioCameraPage = lazy(() => import("./pages/StudioCameraPage"));
const Pricing          = lazy(() => import("./pages/Pricing"));

// Minimal dark-screen fallback — matches the app's carbon background so
// there's no white flash while a lazy chunk downloads.
const PageLoader = () => (
  <div
    style={{ minHeight: "100svh", background: "#0F0F11", display: "flex", alignItems: "center", justifyContent: "center" }}
  >
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: "2px solid rgba(99,102,241,0.25)",
        borderTopColor: "#6366f1",
        animation: "spin 0.7s linear infinite",
      }}
    />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserModeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-center" />
            <BrowserRouter>
              <LiveNotificationToast />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/s/:sessionId" element={<SessionResolver />} />

                  {/* Protected Profile Routes */}
                  <Route path="/profile/:userId" element={
                    <RequireAuth><PublicProfile /></RequireAuth>
                  } />
                  <Route path="/user/:identifier" element={
                    <RequireAuth><ProfileResolver /></RequireAuth>
                  } />

                  {/* Live Room */}
                  <Route path="/live/:eventId" element={
                    <RequireAuth><LiveRoomEntry /></RequireAuth>
                  } />
                  <Route path="/studio-camera/:eventId" element={
                    <RequireAuth><StudioCameraPage /></RequireAuth>
                  } />

                  {/* Messages */}
                  <Route path="/messages" element={
                    <RequireAuth><Messages /></RequireAuth>
                  } />
                  <Route path="/messages/:conversationId" element={
                    <RequireAuth><Chat /></RequireAuth>
                  } />
                  <Route path="/chat/new/:targetUserId" element={
                    <RequireAuth><Chat /></RequireAuth>
                  } />

                  {/* Public Routes */}
                  <Route path="/explore"          element={<ExploreStudios />} />
                  <Route path="/admin/feedback"   element={<AdminFeedback />} />
                  <Route path="/earnings-history" element={<EarningsHistory />} />
                  <Route path="/tickets-history"  element={<TicketsHistory />} />
                  <Route path="/settings"         element={<Settings />} />
                  <Route path="/schedule"         element={<Schedule />} />
                  <Route path="/browse"           element={<Browse />} />
                  <Route path="/pricing"          element={<Pricing />} />

                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </UserModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
