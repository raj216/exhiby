import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LiveNotificationToast } from "@/components/LiveNotificationToast";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PublicProfile from "./pages/PublicProfile";
import LiveRoom from "./pages/LiveRoom";
import ExploreStudios from "./pages/ExploreStudios";
import AdminFeedback from "./pages/AdminFeedback";
import EarningsHistory from "./pages/EarningsHistory";
import TicketsHistory from "./pages/TicketsHistory";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <LiveNotificationToast />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/live/:eventId" element={<LiveRoom />} />
            <Route path="/explore" element={<ExploreStudios />} />
            <Route path="/admin/feedback" element={<AdminFeedback />} />
            <Route path="/earnings-history" element={<EarningsHistory />} />
            <Route path="/tickets-history" element={<TicketsHistory />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
