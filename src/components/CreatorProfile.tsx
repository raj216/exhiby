import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileActionBar } from "./ProfileActionBar";
import { StageTab } from "./StageTab";
import { VaultTab } from "./VaultTab";
import { WIPTab } from "./WIPTab";
import { NotificationPreferenceModal } from "./NotificationPreferenceModal";
import { toast } from "@/hooks/use-toast";

interface CreatorProfileProps {
  onBack: () => void;
}

// Mock data
const mockCreator = {
  name: "Elena Voss",
  bio: "Pencil realist specializing in hyperrealistic portraits. Teaching artists worldwide for 8+ years.",
  coverImage: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80",
  avatarImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
  signatureImage: undefined,
  isLive: false,
  isVerified: true,
  tags: [
    { icon: "pencil", label: "Pencil Realism" },
    { icon: "teacher", label: "Master Teacher" },
    { icon: "trophy", label: "Verified Artist" },
  ],
};

const mockEvents = [
  {
    id: "1",
    title: "Realistic Eye Workshop",
    date: "Sat, Dec 21",
    time: "8 PM EST",
    price: 5,
    image: "https://images.unsplash.com/photo-1495231916356-a86217efff12?w=400&q=80",
    attendees: 47,
  },
  {
    id: "2",
    title: "Drawing Realistic Hair Techniques",
    date: "Sun, Dec 22",
    time: "3 PM EST",
    price: 10,
    image: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=400&q=80",
    attendees: 32,
  },
];

const mockArtworks = [
  { id: "1", image: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=600&q=80", title: "Portrait Study I" },
  { id: "2", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=600&q=80", title: "Eyes of Wonder" },
  { id: "3", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80", title: "Charcoal Dreams" },
  { id: "4", image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80", title: "Abstract Motion" },
];

const mockWIP = [
  { id: "1", type: "video" as const, thumbnail: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80", title: "Eye drawing process" },
  { id: "2", type: "video" as const, thumbnail: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&q=80", title: "Shading techniques" },
  { id: "3", type: "image" as const, thumbnail: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&q=80", title: "Sketch 1" },
  { id: "4", type: "image" as const, thumbnail: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&q=80", title: "Sketch 2" },
  { id: "5", type: "image" as const, thumbnail: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80", title: "Sketch 3" },
];

type TabType = "stage" | "vault" | "wip";

export function CreatorProfile({ onBack }: CreatorProfileProps) {
  const [activeTab, setActiveTab] = useState<TabType>("stage");
  const [isFollowing, setIsFollowing] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const tabs: { id: TabType; label: string }[] = [
    { id: "stage", label: "The Stage" },
    { id: "vault", label: "The Vault" },
    { id: "wip", label: "W.I.P." },
  ];

  const handleFollowClick = () => {
    if (isFollowing) {
      setIsFollowing(false);
      toast({ title: "Unfollowed", description: `You unfollowed ${mockCreator.name}` });
    } else {
      setShowNotificationModal(true);
    }
  };

  const handleConfirmFollow = (preferences: string[]) => {
    setIsFollowing(true);
    const prefLabels = preferences.join(", ");
    toast({
      title: "Following!",
      description: `Notifications set for: ${prefLabels}`,
    });
  };

  const handleBuyTicket = (eventId: string) => {
    const event = mockEvents.find((e) => e.id === eventId);
    toast({
      title: "Ticket Reserved!",
      description: `You got a ticket for "${event?.title}"`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onBack}
        className="fixed top-4 left-4 z-20 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center"
      >
        <ArrowLeft className="w-5 h-5 text-foreground" />
      </motion.button>

      {/* Header */}
      <ProfileHeader
        coverImage={mockCreator.coverImage}
        avatarImage={mockCreator.avatarImage}
        name={mockCreator.name}
        bio={mockCreator.bio}
        isLive={mockCreator.isLive}
        signatureImage={mockCreator.signatureImage}
        tags={mockCreator.tags}
        isVerified={mockCreator.isVerified}
      />

      {/* Action Bar */}
      <ProfileActionBar
        isFollowing={isFollowing}
        onFollowClick={handleFollowClick}
        onMessageClick={() => toast({ title: "Coming Soon", description: "Messaging feature coming soon!" })}
        onSupportClick={() => toast({ title: "Tip Sent!", description: "You sent a $5 tip to Elena" })}
      />

      {/* Tabs */}
      <div className="mt-6 border-b border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 text-sm font-semibold relative transition-colors ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-20">
        {activeTab === "stage" && (
          <StageTab events={mockEvents} onBuyTicket={handleBuyTicket} />
        )}
        {activeTab === "vault" && <VaultTab artworks={mockArtworks} />}
        {activeTab === "wip" && <WIPTab items={mockWIP} />}
      </div>

      {/* Notification Modal */}
      <NotificationPreferenceModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onConfirm={handleConfirmFollow}
        creatorName={mockCreator.name}
      />
    </div>
  );
}
