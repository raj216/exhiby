import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserModeProvider } from "@/contexts/UserModeContext";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LiveNotificationToast } from "@/components/LiveNotificationToast";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PublicProfile from "./pages/PublicProfile";
import LiveRoom from "./pages/LiveRoom";
import ExploreStudios from "./pages/ExploreStudios";
import AdminFeedback from "./pages/AdminFeedback";
import EarningsHistory from "./pages/EarningsHistory";
import TicketsHistory from "./pages/TicketsHistory";
import SessionResolver from "./pages/SessionResolver";
import Settings from "./pages/Settings";
import Schedule from "./pages/Schedule";
import Browse from "./pages/Browse";
import NotFound from "./pages/NotFound";
import ProfileResolver from "./pages/ProfileResolver";

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
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/s/:sessionId" element={<SessionResolver />} />
                {/* Protected Profile Routes - Auth Gate */}
                <Route path="/profile/:userId" element={
                  <RequireAuth>
                    <PublicProfile />
                  </RequireAuth>
                } />
                <Route path="/user/:identifier" element={
                  <RequireAuth>
                    <ProfileResolver />
                  </RequireAuth>
                } />
                <Route path="/live/:eventId" element={
                  <RequireAuth>
                    <LiveRoom />
                  </RequireAuth>
                } />
                <Route path="/explore" element={<ExploreStudios />} />
                <Route path="/admin/feedback" element={<AdminFeedback />} />
                <Route path="/earnings-history" element={<EarningsHistory />} />
                <Route path="/tickets-history" element={<TicketsHistory />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/browse" element={<Browse />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </UserModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
