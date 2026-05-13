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

// Only the home page loads eagerly — it's what every visitor sees first
import Index from "./pages/Index";

// Auth is lazy — only needed when someone clicks Sign In
const Auth = lazy(() => import("./pages/Auth"));

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

// Minimal dark-screen fallback — carbon background, no white flash.
// Uses Tailwind's animate-spin (keyframes already in the global CSS) so
// no <style> tag is injected on every mount.
const PageLoader = () => (
  <div className="min-h-svh bg-carbon flex items-center justify-center">
    <div className="w-5 h-5 rounded-full border-2 border-electric/25 border-t-electric animate-spin" />
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
