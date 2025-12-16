import { motion } from "framer-motion";
import { Calendar, Clock, Ticket, Users } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  price: number;
  image: string;
  attendees: number;
}

interface StageTabProps {
  events: Event[];
  onBuyTicket: (eventId: string) => void;
}

export function StageTab({ events, onBuyTicket }: StageTabProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-obsidian flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center">
          No upcoming events scheduled
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {events.map((event, index) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-obsidian border border-border/30 rounded-2xl overflow-hidden"
        >
          <div className="flex">
            {/* Event Image */}
            <div className="w-24 h-28 flex-shrink-0">
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Event Details */}
            <div className="flex-1 p-3 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-foreground font-medium line-clamp-1">
                  {event.title}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs">{event.date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs">{event.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs">{event.attendees} attending</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <Ticket className="w-4 h-4 text-gold" />
                  <span className="font-semibold text-gold">
                    {event.price === 0 ? "Free" : `$${event.price}`}
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    triggerClickHaptic();
                    onBuyTicket(event.id);
                  }}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
                  }}
                >
                  {event.price === 0 ? "RSVP" : "Buy Ticket"}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}