import { useState } from "react";
import { LiveRoom } from "./LiveRoom";
import { Button } from "./ui/button";
import { Video, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Demo room URL - replace with your actual Daily.co room for testing
const DEMO_ROOM_URL = "https://exhiby.daily.co/test-room";

export function LiveRoomTest() {
  const [showRoom, setShowRoom] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | undefined>();

  const handleTestClick = () => {
    setRoomUrl(DEMO_ROOM_URL);
    setShowRoom(true);
  };

  const handleLeave = () => {
    setShowRoom(false);
    setRoomUrl(undefined);
  };

  return (
    <>
      {/* Test Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40"
      >
        <Button
          onClick={handleTestClick}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-6 py-3 rounded-full shadow-lg"
        >
          <Video className="w-5 h-5" />
          Test Live Stage
        </Button>
      </motion.div>

      {/* Live Room */}
      <AnimatePresence>
        {showRoom && (
          <>
            <LiveRoom roomUrl={roomUrl} onLeave={handleLeave} />
            
            {/* Close button overlay */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleLeave}
              className="fixed top-4 right-4 z-[60] p-3 rounded-full glass"
            >
              <X className="w-5 h-5 text-foreground" />
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
