import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { HomeScreen } from "@/components/HomeScreen";
import { GoLiveWizard } from "@/components/GoLiveWizard";
import { LiveSession } from "@/components/LiveSession";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

interface EventData {
  coverImage: string | null;
  category: string;
  title: string;
  description: string;
  price: number;
  scheduleType: "now" | "scheduled";
}

const Index = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);

  const handleGoLive = (data: EventData) => {
    setEventData(data);
    setShowWizard(false);

    if (data.scheduleType === "now") {
      setShowLiveSession(true);
      toast.success("You're now live!", {
        description: "Your gallery doors are open",
      });
    } else {
      toast.success("Event scheduled!", {
        description: "We'll notify your followers",
      });
    }
  };

  const handleCloseLiveSession = () => {
    setShowLiveSession(false);
    setEventData(null);
    toast("Session ended", {
      description: "Thanks for streaming!",
    });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background">
      <Toaster position="top-center" />
      
      <HomeScreen onGoLive={() => setShowWizard(true)} />

      <AnimatePresence>
        {showWizard && (
          <GoLiveWizard
            onClose={() => setShowWizard(false)}
            onGoLive={handleGoLive}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLiveSession && eventData && (
          <LiveSession eventData={eventData} onClose={handleCloseLiveSession} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
