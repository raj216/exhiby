import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, Bell, Shield, CreditCard, Palmtree, MapPin, HelpCircle, BookOpen, ChevronRight, Loader2, Mail, Smartphone, Trash2, BellRing, Bug, MessageSquare } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { openSupportEmail } from "@/lib/supportContact";
import { navigateBack } from "@/lib/navigation";
import { useUserMode } from "@/contexts/UserModeContext";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailModal, ChangePasswordModal, DeleteAccountModal, ReportBugModal } from "@/components/settings";
import { useAuth } from "@/contexts/AuthContext";

// Menu category types
type SettingsCategory = "account" | "notifications" | "privacy" | "payments" | "vacation" | "shipping" | "help" | "guidelines";
interface MenuItem {
  id: SettingsCategory;
  label: string;
  icon: React.ElementType;
  group: "general" | "studio" | "support";
}
const menuItems: MenuItem[] = [
// Group 1: General
{
  id: "account",
  label: "Account",
  icon: User,
  group: "general"
}, {
  id: "notifications",
  label: "Notifications",
  icon: Bell,
  group: "general"
}, {
  id: "privacy",
  label: "Privacy & Safety",
  icon: Shield,
  group: "general"
},
// Group 2: The Studio (Creator Tools)
{
  id: "payments",
  label: "Payments & Payouts",
  icon: CreditCard,
  group: "studio"
}, {
  id: "vacation",
  label: "Vacation Mode",
  icon: Palmtree,
  group: "studio"
}, {
  id: "shipping",
  label: "Shipping Addresses",
  icon: MapPin,
  group: "studio"
},
// Group 3: Support
{
  id: "help",
  label: "Help Center",
  icon: HelpCircle,
  group: "support"
}, {
  id: "guidelines",
  label: "Community Guidelines",
  icon: BookOpen,
  group: "support"
}];

// Memoized menu item groups - never changes
const generalItems = menuItems.filter(item => item.group === "general");
const studioItems = menuItems.filter(item => item.group === "studio");
const supportItems = menuItems.filter(item => item.group === "support");
export default function Settings() {
  console.log("[Settings] Component mounted at", Date.now());
  const navigate = useNavigate();
  const {
    isVerifiedCreator
  } = useUserMode();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if mobile - stable callback
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Set default category on desktop - run only once after initial render
  useEffect(() => {
    if (!isInitialized) {
      if (!isMobile) {
        setActiveCategory("account");
      }
      setIsInitialized(true);
      console.log("[Settings] Initialized, isMobile:", isMobile);
    }
  }, [isMobile, isInitialized]);
  const handleBack = useCallback(() => {
    if (isMobile && activeCategory) {
      setActiveCategory(null);
    } else {
      // Use navigateBack with fallback to profile (not home)
      navigateBack(navigate, "/profile");
    }
  }, [isMobile, activeCategory, navigate]);
  const handleCategoryClick = useCallback((category: SettingsCategory) => {
    triggerClickHaptic();
    setActiveCategory(category);
  }, []);

  // Mobile: Show menu list OR category content
  if (isMobile) {
    return <div className="min-h-screen bg-carbon">
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-4 bg-carbon/95 backdrop-blur-xl border-b border-border/20">
          <button onClick={handleBack} className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-xl text-foreground">
            {activeCategory ? menuItems.find(m => m.id === activeCategory)?.label : "Settings"}
          </h1>
        </header>

        <AnimatePresence mode="wait">
          {!activeCategory ? <motion.div key="menu" initial={{
          opacity: 0,
          x: -20
        }} animate={{
          opacity: 1,
          x: 0
        }} exit={{
          opacity: 0,
          x: -20
        }} transition={{
          type: "spring",
          stiffness: 400,
          damping: 30
        }} className="p-4 space-y-6 pb-24">
              {/* General Section */}
              <MenuSection title="General" items={generalItems} onSelect={handleCategoryClick} />
              
              {/* The Studio Section */}
              {isVerifiedCreator && <MenuSection title="The Studio" items={studioItems} onSelect={handleCategoryClick} />}
              
              {/* Support Section */}
              <MenuSection title="Support" items={supportItems} onSelect={handleCategoryClick} />
            </motion.div> : <motion.div key={activeCategory} initial={{
          opacity: 0,
          x: 20
        }} animate={{
          opacity: 1,
          x: 0
        }} exit={{
          opacity: 0,
          x: 20
        }} transition={{
          type: "spring",
          stiffness: 400,
          damping: 30
        }} className="p-4 pb-24">
              <CategoryContent category={activeCategory} />
            </motion.div>}
        </AnimatePresence>
      </div>;
  }

  // Desktop/Tablet: 2-Column Layout
  return <div className="min-h-screen bg-carbon">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-6 py-4 bg-carbon/95 backdrop-blur-xl border-b border-border/20">
        <button onClick={handleBack} className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center hover:bg-muted/50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="font-display text-xl text-foreground">Settings</h1>
      </header>

      <div className="flex">
        {/* Left Sidebar - Menu */}
        <aside className="w-[280px] min-h-[calc(100vh-65px)] bg-black border-r border-border/20 p-4 sticky top-[65px]">
          <div className="space-y-6">
            {/* General Section */}
            <DesktopMenuSection title="General" items={generalItems} activeCategory={activeCategory} onSelect={handleCategoryClick} />
            
            {/* The Studio Section */}
            {isVerifiedCreator && <DesktopMenuSection title="The Studio" items={studioItems} activeCategory={activeCategory} onSelect={handleCategoryClick} />}
            
            {/* Support Section */}
            <DesktopMenuSection title="Support" items={supportItems} activeCategory={activeCategory} onSelect={handleCategoryClick} />
          </div>
        </aside>

        {/* Right Panel - Content */}
        <main className="flex-1 min-h-[calc(100vh-65px)] bg-obsidian p-8">
          <AnimatePresence mode="wait">
            {activeCategory && <motion.div key={activeCategory} initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0,
            y: -10
          }} transition={{
            type: "spring",
            stiffness: 400,
            damping: 30
          }}>
                <h2 className="font-display text-2xl text-foreground mb-6">
                  {menuItems.find(m => m.id === activeCategory)?.label}
                </h2>
                <CategoryContent category={activeCategory} />
              </motion.div>}
          </AnimatePresence>
        </main>
      </div>
    </div>;
}

// Mobile Menu Section Component
function MenuSection({
  title,
  items,
  onSelect
}: {
  title: string;
  items: MenuItem[];
  onSelect: (id: SettingsCategory) => void;
}) {
  return <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map(item => <button key={item.id} onClick={() => onSelect(item.id)} className="w-full flex items-center justify-between p-4 bg-obsidian rounded-xl border border-border/20 hover:border-border/40 transition-colors">
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-electric" />
              <span className="text-foreground">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>)}
      </div>
    </div>;
}

// Desktop Menu Section Component
function DesktopMenuSection({
  title,
  items,
  activeCategory,
  onSelect
}: {
  title: string;
  items: MenuItem[];
  activeCategory: SettingsCategory | null;
  onSelect: (id: SettingsCategory) => void;
}) {
  return <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map(item => {
        const isActive = activeCategory === item.id;
        return <button key={item.id} onClick={() => onSelect(item.id)} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200", isActive ? "bg-electric/10 border-l-2 border-electric text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/20")}>
              <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-electric" : "text-muted-foreground")} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>;
      })}
      </div>
    </div>;
}

// Category Content Component
function CategoryContent({
  category
}: {
  category: SettingsCategory;
}) {
  switch (category) {
    case "account":
      return <AccountContent />;
    case "notifications":
      return <NotificationsContent />;
    case "privacy":
      return <PrivacyContent />;
    case "payments":
      return <PaymentsContent />;
    case "vacation":
      return <VacationContent />;
    case "shipping":
      return <ShippingContent />;
    case "help":
      return <HelpContent />;
    case "guidelines":
      return <GuidelinesContent />;
    default:
      return <div className="text-muted-foreground">Coming soon...</div>;
  }
}

// Account Settings Content
function AccountContent() {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <>
      <div className="space-y-4">
        <SettingsCard 
          title="Email Address" 
          description="Your email for login and notifications" 
          action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} 
          onClick={() => {
            triggerClickHaptic();
            setShowEmailModal(true);
          }} 
        />
        <SettingsCard 
          title="Password" 
          description="Update your password" 
          action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} 
          onClick={() => {
            triggerClickHaptic();
            setShowPasswordModal(true);
          }} 
        />
        
        {/* Delete Account - Danger Zone */}
        <div className="pt-6 border-t border-border/20">
          <button 
            onClick={() => {
              triggerClickHaptic();
              setShowDeleteModal(true);
            }} 
            className="w-full flex items-center justify-between p-4 bg-destructive/10 rounded-xl border border-destructive/30 hover:border-destructive/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-destructive" />
              <span className="text-destructive">Delete Account</span>
            </div>
            <ChevronRight className="w-5 h-5 text-destructive/60" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <EmailModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
      <DeleteAccountModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </>
  );
}

// Notifications Settings Content
function NotificationsContent() {
  const {
    preferences,
    loading,
    saving,
    updatePreferences
  } = useNotificationPreferences();
  
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();

  const handleToggle = async (key: keyof typeof preferences) => {
    triggerClickHaptic();
    try {
      await updatePreferences({
        [key]: !preferences[key]
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive"
      });
    }
  };

  const handlePushToggle = async () => {
    triggerClickHaptic();
    try {
      if (pushSubscribed) {
        await unsubscribePush();
        toast({ title: "Push notifications disabled" });
      } else {
        const success = await subscribePush();
        if (success) {
          toast({ title: "Push notifications enabled!" });
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update push notifications",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-electric" />
      </div>;
  }
  return <div className="space-y-6">
      {/* Push Notifications */}
      {pushSupported && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BellRing className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Push Notifications</span>
          </div>
          <div className="space-y-3">
            <ToggleCard 
              title="Enable Push Notifications" 
              description="Get notified about new messages even when the app is closed" 
              checked={pushSubscribed} 
              onToggle={handlePushToggle} 
              disabled={pushLoading} 
            />
            <p className="text-xs text-muted-foreground px-1">
              On iPhone, notifications require installing Exhiby to Home Screen (PWA).
            </p>
          </div>
        </div>
      )}

      {/* Email Notifications */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Email Notifications</span>
        </div>
        <div className="space-y-3">
          <ToggleCard title="Live sessions" description="When creators you follow go live" checked={preferences.email_live} onToggle={() => handleToggle("email_live")} disabled={saving} />
          <ToggleCard title="Scheduled sessions" description="When a new session is scheduled" checked={preferences.email_scheduled} onToggle={() => handleToggle("email_scheduled")} disabled={saving} />
          <ToggleCard title="Reminders" description="30 minutes before sessions you've saved" checked={preferences.email_reminders} onToggle={() => handleToggle("email_reminders")} disabled={saving} />
        </div>
      </div>

      {/* In-App Notifications */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">In-App Notifications</span>
        </div>
        <div className="space-y-3">
          <ToggleCard title="Live sessions" description="When creators you follow go live" checked={preferences.inapp_live} onToggle={() => handleToggle("inapp_live")} disabled={saving} />
          <ToggleCard title="Scheduled sessions" description="When a new session is scheduled" checked={preferences.inapp_scheduled} onToggle={() => handleToggle("inapp_scheduled")} disabled={saving} />
        </div>
      </div>
    </div>;
}

// Privacy Settings Content
function PrivacyContent() {
  return <div className="space-y-4">
      <SettingsCard title="Profile Visibility" description="Control who can see your profile" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "Privacy",
      description: "Privacy settings coming soon"
    })} />
      <SettingsCard title="Blocked Users" description="Manage your blocked users list" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "Blocked",
      description: "Blocked users coming soon"
    })} />
      <SettingsCard title="Terms of Service" description="Read our terms and conditions" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "Terms",
      description: "Opening terms..."
    })} />
      <SettingsCard title="Privacy Policy" description="Read our privacy policy" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "Privacy",
      description: "Opening privacy policy..."
    })} />
    </div>;
}

// Payments Settings Content
function PaymentsContent() {
  return <div className="space-y-4">
      <SettingsCard title="Payment Methods" description="Manage your saved payment methods" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "Payments",
      description: "Payment methods coming soon"
    })} />
      <SettingsCard title="Payout Settings" description="Set up how you receive your earnings" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "Payouts",
      description: "Payout settings coming soon"
    })} />
      <SettingsCard title="Transaction History" description="View your payment and payout history" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "History",
      description: "Transaction history coming soon"
    })} />
    </div>;
}

// Vacation Mode Content
function VacationContent() {
  const [vacationMode, setVacationMode] = useState(false);
  const handleToggle = () => {
    triggerClickHaptic();
    setVacationMode(!vacationMode);
    toast({
      title: vacationMode ? "Vacation Mode Off" : "Vacation Mode On",
      description: vacationMode ? "Your studio is now active" : "Your studio is now on vacation"
    });
  };
  return <div className="space-y-4">
      <div className="p-6 bg-carbon rounded-xl border border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-electric/10 flex items-center justify-center">
              <Palmtree className="w-6 h-6 text-electric" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Vacation Mode</h3>
              <p className="text-sm text-muted-foreground">
                Pause your studio while you're away
              </p>
            </div>
          </div>
          <Switch checked={vacationMode} onCheckedChange={handleToggle} />
        </div>
        <p className="text-sm text-muted-foreground">
          When vacation mode is enabled, your followers will see that you're temporarily away. 
          You won't be able to go live or schedule new sessions.
        </p>
      </div>
    </div>;
}

// Shipping Addresses Content
function ShippingContent() {
  return <div className="space-y-4">
      <SettingsCard title="Add New Address" description="Add a shipping address for physical art" action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} onClick={() => toast({
      title: "Address",
      description: "Address form coming soon"
    })} />
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No saved addresses yet</p>
      </div>
    </div>;
}

// Help Center Content
function HelpContent() {
  const [showBugModal, setShowBugModal] = useState(false);

  const handleContactSupport = () => {
    openSupportEmail();
  };

  return (
    <>
      <div className="space-y-4">
        <SettingsCard 
          title="Contact Support" 
          description="Get help from our team" 
          action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
          onClick={handleContactSupport}
        />
        <SettingsCard 
          title="Report a Bug" 
          description="Help us improve by reporting issues" 
          action={<ChevronRight className="w-5 h-5 text-muted-foreground" />} 
          onClick={() => {
            triggerClickHaptic();
            setShowBugModal(true);
          }} 
        />
      </div>

      {/* Modals */}
      <ReportBugModal isOpen={showBugModal} onClose={() => setShowBugModal(false)} />
    </>
  );
}

// Community Guidelines Content
function GuidelinesContent() {
  return <div className="space-y-4">
      <div className="p-6 bg-carbon rounded-xl border border-border/20">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-electric" />
          <h3 className="text-lg font-semibold text-foreground">Community Guidelines</h3>
        </div>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Our community guidelines help ensure Exhiby remains a safe and welcoming space 
            for artists and collectors alike.
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Be respectful and supportive of other creators</li>
            <li>Share only original or properly licensed artwork</li>
            <li>Keep live sessions focused on art and creativity</li>
            <li>Report any inappropriate content or behavior</li>
          </ul>
          <button onClick={() => toast({
          title: "Guidelines",
          description: "Opening full guidelines..."
        })} className="text-electric hover:underline">
            Read Full Guidelines →
          </button>
        </div>
      </div>
    </div>;
}

// Reusable Settings Card Component
function SettingsCard({
  title,
  description,
  action,
  onClick
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  onClick?: () => void;
}) {
  return <button onClick={onClick} className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/20 hover:border-border/40 transition-colors text-left">
      <div>
        <span className="text-foreground block">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
      {action}
    </button>;
}

// Reusable Toggle Card Component
function ToggleCard({
  title,
  description,
  checked,
  onToggle,
  disabled
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return <div className="flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/20">
      <div>
        <span className="text-foreground block">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
    </div>;
}