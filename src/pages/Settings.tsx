import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, Bell, Shield, CreditCard, HelpCircle, BookOpen, ChevronRight, Loader2, Mail, Smartphone, Trash2, BellRing, Bug, MessageSquare, Plus, CheckCircle, AlertCircle, ExternalLink, DollarSign, Ticket, Coins, TrendingUp, History, Landmark, Clock, Zap, Check, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { useCreatorEarnings } from "@/hooks/useCreatorEarnings";
import { useCountryCheck } from "@/hooks/useCountryCheck";
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
import { usePlan, PLAN_META, type PlanTier } from "@/hooks/usePlan";

// Menu category types
type SettingsCategory = "account" | "notifications" | "privacy" | "payments" | "help" | "guidelines";
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
  const [searchParams] = useSearchParams();
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

  // Set default category on desktop - run only once after initial render.
  // A ?tab= deep-link (e.g. from a tip notification → ?tab=payments) takes
  // precedence and applies on BOTH mobile and desktop.
  useEffect(() => {
    if (!isInitialized) {
      const validTabs: SettingsCategory[] = ["account", "notifications", "privacy", "payments", "help", "guidelines"];
      const requestedTab = searchParams.get("tab") as SettingsCategory | null;
      if (requestedTab && validTabs.includes(requestedTab)) {
        setActiveCategory(requestedTab);
      } else if (!isMobile) {
        setActiveCategory("account");
      }
      setIsInitialized(true);
      console.log("[Settings] Initialized, isMobile:", isMobile);
    }
  }, [isMobile, isInitialized, searchParams]);
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
    case "help":
      return <HelpContent />;
    case "guidelines":
      return <GuidelinesContent />;
    default:
      return <div className="text-muted-foreground">Coming soon...</div>;
  }
}

// Creator Studio Toggles — Feature 6 (auto thank-you email) + Feature 7 (tipping)
function CreatorStudioToggles() {
  const { user } = useAuth();
  const { mode: userMode } = useUserMode();
  const [autoThankyou, setAutoThankyou] = useState(true);
  const [tippingEnabled, setTippingEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata;
      setAutoThankyou(meta?.auto_thankyou_email !== false);
      setTippingEnabled(meta?.tipping_enabled === true);
      setLoaded(true);
    });
  }, [user]);

  const save = async (key: string, value: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { [key]: value } });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded || userMode !== "creator") return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Studio Settings</span>
      </div>
      <div className="space-y-3">
        <ToggleCard
          title="Auto thank-you email"
          description="Send attendees a thank-you email 30 minutes after each session ends"
          checked={autoThankyou}
          onToggle={() => {
            triggerClickHaptic();
            const newVal = !autoThankyou;
            setAutoThankyou(newVal);
            save("auto_thankyou_email", newVal);
          }}
          disabled={saving}
        />
        <ToggleCard
          title="Accept tips / appreciation"
          description="Show an optional 'Send Appreciation' button to ticket holders during and after your sessions"
          checked={tippingEnabled}
          onToggle={() => {
            triggerClickHaptic();
            const newVal = !tippingEnabled;
            setTippingEnabled(newVal);
            save("tipping_enabled", newVal);
          }}
          disabled={saving}
        />
      </div>
    </div>
  );
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

      {/* Creator Studio Settings */}
      <CreatorStudioToggles />
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

// ─── Sub-view router types ─────────────────────────────────────────────
type PaymentSubView = "menu" | "methods" | "payout" | "history";
type HistoryTab = "all" | "purchases" | "earnings";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BRAND_STYLE: Record<string, string> = {
  visa:       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  mastercard: "bg-red-500/20 text-red-400 border-red-500/30",
  amex:       "bg-sky-500/20 text-sky-400 border-sky-500/30",
  discover:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  jcb:        "bg-green-500/20 text-green-400 border-green-500/30",
  unionpay:   "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

// ── TOP-LEVEL ROUTER ─────────────────────────────────────────────────
function PaymentsContent() {
  const [subView, setSubView] = useState<PaymentSubView>("menu");

  return (
    <AnimatePresence mode="wait">
      {subView === "menu" && (
        <motion.div key="menu" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
          <PaymentsMenuView onNavigate={setSubView} />
        </motion.div>
      )}
      {subView === "methods" && (
        <motion.div key="methods" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
          <PaymentMethodsView onBack={() => setSubView("menu")} />
        </motion.div>
      )}
      {subView === "payout" && (
        <motion.div key="payout" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
          <PayoutSettingsView onBack={() => setSubView("menu")} />
        </motion.div>
      )}
      {subView === "history" && (
        <motion.div key="history" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
          <TransactionHistoryView onBack={() => setSubView("menu")} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PaymentsMenuView({ onNavigate }: { onNavigate: (v: PaymentSubView) => void }) {
  const navigate = useNavigate();
  const { plan, tier, isLoading: planLoading, setPlan, isUpdating } = usePlan();
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

  const handleDowngrade = async () => {
    triggerClickHaptic();
    await setPlan("free");
    setShowDowngradeConfirm(false);
    toast({ title: "Plan updated", description: "You're now on Free Studio." });
  };

  // DEV ONLY: quick plan switcher — remove before public launch
  const handleDevSetPlan = async (newTier: "free" | "pro" | "plus") => {
    try {
      // Write to auth metadata — works regardless of DB schema/RLS
      const { error } = await supabase.auth.updateUser({
        data: { plan_override: newTier === "free" ? null : newTier },
      });
      if (error) throw error;
      // Also try DB update (non-blocking)
      await setPlan(newTier).catch(() => null);
      toast({ title: `Dev: Switched to ${newTier.toUpperCase()}`, description: "Plan updated — features unlocked." });
    } catch (err) {
      toast({ title: "Dev switcher error", description: String(err), variant: "destructive" });
    }
  };

  const planBadgeClass = cn(
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tracking-wider",
    tier === "free"
      ? "bg-muted/50 text-muted-foreground"
      : tier === "pro"
      ? "bg-electric/15 text-electric border border-electric/30 shadow-[0_0_10px_hsl(7_100%_67%/0.2)]"
      : "bg-gold/15 text-gold border border-gold/30 shadow-[0_0_10px_hsl(43_72%_52%/0.2)]"
  );

  const planFeatures: Record<PlanTier, string[]> = {
    free: ["First 10 sessions — zero commission", "Unlimited live sessions", "Built-in ticketing & payments", "8% commission", "Up to 50 attendees"],
    pro: ["Everything in Free", "Custom studio colors & URL", "Advanced analytics", "Unlimited attendees", "4% commission"],
    plus: ["Everything in Pro", "Dedicated account manager", "White-label studio room", "API access"],
  };

  return (
    <div className="space-y-5">
      {/* ── YOUR PLAN hero card ── */}
      <div className={cn(
        "rounded-2xl border p-5 relative overflow-hidden",
        tier === "free"
          ? "border-border/25 bg-obsidian/70"
          : tier === "pro"
          ? "border-electric/30 bg-obsidian shadow-[0_0_40px_hsl(7_100%_67%/0.08)]"
          : "border-gold/30 bg-obsidian shadow-[0_0_40px_hsl(43_72%_52%/0.08)]"
      )}>
        {/* Subtle gradient shimmer in top-right */}
        <div className={cn(
          "absolute top-0 right-0 w-48 h-48 rounded-full opacity-[0.07] blur-3xl pointer-events-none",
          tier === "pro" ? "bg-electric" : tier === "plus" ? "bg-gold" : "bg-muted"
        )} />

        <div className="relative">
          {/* Plan name + badge */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 tracking-wide">Your plan</p>
              <div className="flex items-center gap-2">
                {planLoading ? (
                  <div className="h-7 w-24 bg-muted/30 rounded-full animate-pulse" />
                ) : (
                  <>
                    <h3 className="font-display text-xl font-semibold text-foreground">{plan.label}</h3>
                    <span className={planBadgeClass}>
                      {(tier === "pro" || tier === "plus") && <Zap className="w-2.5 h-2.5" />}
                      {plan.shortLabel}
                    </span>
                  </>
                )}
              </div>
              {tier !== "free" && (
                <p className="text-xs text-muted-foreground mt-1">
                  ${plan.monthlyPrice}/month · {plan.commission} commission
                </p>
              )}
              {tier === "free" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Free forever · {plan.commission} commission · {plan.attendeeLimit}
                </p>
              )}
            </div>
          </div>

          {/* Feature list */}
          {!planLoading && (
            <ul className="space-y-2 mb-5">
              {planFeatures[tier].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/80">
                  <span className={cn(
                    "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center",
                    tier === "free" ? "bg-muted/50" : tier === "pro" ? "bg-electric/15" : "bg-gold/15"
                  )}>
                    <Check className={cn(
                      "w-2.5 h-2.5",
                      tier === "pro" ? "text-electric" : tier === "plus" ? "text-gold" : "text-muted-foreground"
                    )} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          )}

          {/* CTA row */}
          <div className="flex items-center gap-3">
            {tier === "free" ? (
              <button
                onClick={() => { triggerClickHaptic(); navigate("/pricing"); }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-electric text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_hsl(7_100%_67%/0.3)] hover:shadow-[0_6px_28px_hsl(7_100%_67%/0.45)] transition-shadow active:scale-[0.98]"
              >
                <Zap className="w-4 h-4" />
                Upgrade Plan
              </button>
            ) : (
              <>
                <button
                  onClick={() => { triggerClickHaptic(); navigate("/pricing"); }}
                  className="flex-1 py-2.5 rounded-xl border border-border/30 bg-transparent text-sm text-foreground hover:bg-surface-elevated transition-colors"
                >
                  View All Plans
                </button>
                {!showDowngradeConfirm ? (
                  <button
                    onClick={() => { triggerClickHaptic(); setShowDowngradeConfirm(true); }}
                    className="py-2.5 px-4 rounded-xl text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Downgrade
                  </button>
                ) : (
                  <button
                    onClick={handleDowngrade}
                    disabled={isUpdating}
                    className="py-2.5 px-4 rounded-xl text-xs text-destructive bg-destructive/10 border border-destructive/20 font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Confirm downgrade to Free
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── DEV ONLY: Plan switcher — remove before public launch ── */}
      {import.meta.env.DEV && (
        <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/5 p-4">
          <p className="text-xs font-bold text-yellow-500/80 uppercase tracking-wider mb-3">⚙ Dev — Plan Switcher</p>
          <div className="flex gap-2">
            {(["free", "pro", "plus"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleDevSetPlan(t)}
                disabled={isUpdating || tier === t}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase border transition-colors disabled:opacity-40 ${
                  tier === t
                    ? "bg-yellow-500/20 border-yellow-500/60 text-yellow-400"
                    : "border-border/40 text-muted-foreground hover:border-yellow-500/40 hover:text-yellow-400"
                }`}
              >
                {tier === t ? "✓ " : ""}{t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Rest of payment settings ── */}
      <SettingsCard
        title="Payment Methods"
        description="Manage your saved payment methods"
        action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
        onClick={() => { triggerClickHaptic(); onNavigate("methods"); }}
      />
      <SettingsCard
        title="Payout Settings"
        description="Set up how you receive your earnings"
        action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
        onClick={() => { triggerClickHaptic(); onNavigate("payout"); }}
      />
      <SettingsCard
        title="Transaction History"
        description="View your payment and payout history"
        action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
        onClick={() => { triggerClickHaptic(); onNavigate("history"); }}
      />
    </div>
  );
}

// ── 1 of 3 — PAYMENT METHODS ─────────────────────────────────────────
interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  isDefault: boolean;
}

function PaymentMethodsView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchCards = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-payment-methods", { body: { action: "list" } });
      if (error) throw error;
      setCards(data?.paymentMethods ?? []);
    } catch {
      toast({ title: "Error", description: "Could not load payment methods", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const handleSetDefault = async (id: string) => {
    setActionLoading(`${id}_default`);
    try {
      const { error } = await supabase.functions.invoke("manage-payment-methods", { body: { action: "set_default", paymentMethodId: id } });
      if (error) throw error;
      setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
      toast({ title: "Default card updated" });
    } catch {
      toast({ title: "Error", description: "Could not update default", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (id: string) => {
    setActionLoading(`${id}_remove`);
    try {
      const { error } = await supabase.functions.invoke("manage-payment-methods", { body: { action: "remove", paymentMethodId: id } });
      if (error) throw error;
      setCards((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Card removed" });
    } catch {
      toast({ title: "Error", description: "Could not remove card", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddCard = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-setup-session");
      if (error || !data?.url) throw new Error("Could not start setup");
      window.location.href = data.url;
    } catch {
      toast({ title: "Error", description: "Could not open payment setup", variant: "destructive" });
      setPortalLoading(false);
    }
  };

  // Show success toast and refresh when returning from Stripe Checkout setup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "success") {
      toast({ title: "Card saved", description: "Your payment method has been added." });
      window.history.replaceState({}, "", `${window.location.pathname}?tab=payments`);
      fetchCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { triggerClickHaptic(); onBack(); }} className="w-9 h-9 rounded-full bg-obsidian flex items-center justify-center hover:bg-muted/40 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h3 className="font-display text-lg text-foreground">Payment Methods</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-electric" />
        </div>
      ) : cards.length === 0 ? (
        <div className="p-8 bg-carbon rounded-xl border border-border/20 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-electric/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-electric" />
          </div>
          <p className="text-foreground font-medium mb-1">No saved cards</p>
          <p className="text-sm text-muted-foreground">Add a card for faster checkout at sessions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const brandStyle = BRAND_STYLE[card.brand] ?? "bg-muted/20 text-muted-foreground border-border/30";
            const isDefaulting = actionLoading === `${card.id}_default`;
            const isRemoving = actionLoading === `${card.id}_remove`;
            return (
              <div key={card.id} className="p-4 bg-carbon rounded-xl border border-border/20 space-y-3">
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs uppercase font-semibold px-2 py-1 rounded border", brandStyle)}>{card.brand}</span>
                  <div className="flex-1">
                    <p className="text-foreground text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>•••• {card.last4}</p>
                    <p className="text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                      Expires {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
                    </p>
                  </div>
                  {card.isDefault && (
                    <span className="text-xs px-2 py-1 rounded bg-electric/10 text-electric border border-electric/20">Default</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!card.isDefault && (
                    <button
                      onClick={() => handleSetDefault(card.id)}
                      disabled={!!actionLoading}
                      className="flex-1 text-sm py-2 rounded-lg bg-electric/10 text-electric border border-electric/20 hover:bg-electric/20 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {isDefaulting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set as Default"}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(card.id)}
                    disabled={!!actionLoading}
                    className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleAddCard}
        disabled={portalLoading}
        className="w-full flex items-center justify-center gap-2 p-4 bg-electric/10 text-electric border border-electric/30 rounded-xl hover:bg-electric/20 transition-colors disabled:opacity-50"
      >
        {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {portalLoading ? "Opening setup…" : "Add Payment Method"}
      </button>
      <p className="text-xs text-muted-foreground text-center">Payment methods are stored securely by Stripe</p>
    </div>
  );
}

// ── 2 of 3 — PAYOUT SETTINGS ─────────────────────────────────────────
interface PayoutRecord {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

function PayoutSettingsView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { status, loading: connectLoading, startOnboarding, getDashboardLink, requestPayout, refetchStatus } = useStripeConnect(user?.id);
  const { isUS, isLoading: countryLoading, hasChecked } = useCountryCheck(user?.id);
  const { data: earningsData } = useCreatorEarnings(user?.id);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setPayoutsLoading(true);
      try {
        const { data } = await supabase
          .from("creator_payouts")
          .select("id, amount, status, created_at")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);
        setPayouts(data || []);
      } catch { setPayouts([]); }
      finally { setPayoutsLoading(false); }
    })();
  }, [user?.id]);

  const data = earningsData ?? { availableToPayout: 0, totalPaidOut: 0, lifetimeEarnings: 0 };

  const handleCTA = async () => {
    triggerClickHaptic();
    if (status === "not_connected" || status === "onboarding_incomplete") {
      const result = await startOnboarding();
      if (result.usOnly) { toast({ title: "US Only", description: "Studio hosting is US-only for now. More regions coming soon.", variant: "destructive" }); return; }
      if (result.url) window.location.href = result.url;
      else toast({ title: "Error", description: "Could not start Stripe setup", variant: "destructive" });
      return;
    }
    if (status === "pending_verification") { toast({ title: "Pending", description: "Stripe is reviewing your account — usually 1–2 business days." }); return; }
    if (status === "active" && data.availableToPayout > 0) {
      setPayoutLoading(true);
      const result = await requestPayout();
      setPayoutLoading(false);
      if (result.success) { toast({ title: "Payout Requested!", description: `${formatCents(result.amount ?? 0)} is on its way to your bank.` }); refetchStatus(); }
      else toast({ title: "Payout Failed", description: result.error ?? "Please try again", variant: "destructive" });
    }
  };

  const handleDashboard = async () => {
    triggerClickHaptic();
    const url = await getDashboardLink();
    if (url) window.open(url, "_blank");
    else toast({ title: "Error", description: "Could not open Stripe dashboard", variant: "destructive" });
  };

  const isDisabled = payoutLoading || connectLoading || status === "pending_verification" || (status === "active" && data.availableToPayout === 0);
  const ctaIsGold = !isDisabled && status === "active" && data.availableToPayout > 0;
  const ctaIsElectric = !isDisabled && (status === "not_connected" || status === "onboarding_incomplete");
  const ctaLabel = payoutLoading ? "Processing…" : connectLoading ? "Loading…" : status === "not_connected" ? "Connect Bank Account" : status === "onboarding_incomplete" ? "Continue Setup" : status === "pending_verification" ? "Verification in Progress" : status === "active" && data.availableToPayout > 0 ? `Payout ${formatCents(data.availableToPayout)}` : "No Balance Available";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { triggerClickHaptic(); onBack(); }} className="w-9 h-9 rounded-full bg-obsidian flex items-center justify-center hover:bg-muted/40 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h3 className="font-display text-lg text-foreground">Payout Settings</h3>
      </div>

      <div className="p-4 bg-carbon rounded-xl border border-border/20">
        <div className="flex items-start gap-3">
          {status === "loading" && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0 mt-0.5" />}
          {status === "active" && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {status === "pending_verification" && <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
          {(status === "not_connected" || status === "onboarding_incomplete") && <AlertCircle className="w-5 h-5 text-electric shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="text-foreground font-medium text-sm">
              {status === "loading" ? "Checking status…" : status === "active" ? "Payouts Enabled" : status === "pending_verification" ? "Verification Pending" : status === "onboarding_incomplete" ? "Setup Incomplete" : "Not Connected"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {status === "active" ? "Your Stripe account is verified and ready for payouts." : status === "pending_verification" ? "Stripe is reviewing your account — usually 1–2 business days." : status === "onboarding_incomplete" ? "Complete Stripe onboarding to start receiving payouts." : "Connect a bank account to receive your earnings."}
            </p>
          </div>
        </div>
      </div>

      {status === "active" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-carbon rounded-xl border border-border/20">
            <p className="text-xs text-muted-foreground mb-1">Available</p>
            <p className="text-xl font-display text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCents(data.availableToPayout)}</p>
          </div>
          <div className="p-4 bg-carbon rounded-xl border border-border/20">
            <p className="text-xs text-muted-foreground mb-1">Paid Out</p>
            <p className="text-xl font-display text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCents(data.totalPaidOut)}</p>
          </div>
        </div>
      )}

      {status !== "loading" && (
        <button
          onClick={handleCTA}
          disabled={isDisabled}
          className={cn(
            "w-full flex items-center justify-center gap-2 p-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            ctaIsGold && "bg-electric text-carbon hover:bg-electric/90",
            ctaIsElectric && "bg-electric/10 text-electric border border-electric/30 hover:bg-electric/20",
            !ctaIsGold && !ctaIsElectric && "bg-muted/20 text-muted-foreground border border-border/30"
          )}
        >
          {(payoutLoading || connectLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
          {!payoutLoading && !connectLoading && ctaIsGold && <DollarSign className="w-4 h-4" />}
          {!payoutLoading && !connectLoading && ctaIsElectric && <Landmark className="w-4 h-4" />}
          {ctaLabel}
        </button>
      )}

      {status === "active" && (
        <button
          onClick={handleDashboard}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-obsidian text-foreground border border-border/20 hover:border-border/40 transition-colors text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Open Stripe Dashboard
        </button>
      )}

      {hasChecked && !isUS && !countryLoading && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-400 font-medium">Studio hosting is US-only right now</p>
            <p className="text-xs text-amber-400/80 mt-1">Stripe Connect payouts are available for US-based artists only. More regions coming soon.</p>
          </div>
        </div>
      )}

      <div className="p-3 bg-obsidian/50 rounded-lg border border-border/10">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Exhiby takes a platform fee based on your plan (8% Free · 4% Pro/Plus). First payout typically processes within 7 days.
        </p>
      </div>

      {/* Payout / Withdrawal History */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          Withdrawal History
        </h4>
        {payoutsLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-obsidian rounded-xl border border-border/20 animate-pulse" />
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-4 bg-obsidian rounded-xl border border-border/20 text-center">
            <p className="text-sm text-muted-foreground">No withdrawals yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Your payout history will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-obsidian rounded-xl border border-border/20">
                <div>
                  <p className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCents(p.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider",
                  p.status === "paid" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : p.status === "pending" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "bg-destructive/15 text-destructive border border-destructive/20"
                )}>
                  {p.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3 of 3 — TRANSACTION HISTORY ──────────────────────────────────────
interface FanPurchase {
  id: string;
  event_id: string;
  event_title: string;
  amount: number;
  created_at: string;
}

interface HistoryRow {
  id: string;
  event_title: string;
  amount: number;
  created_at: string;
  kind: "ticket_sold" | "tip_received" | "ticket_bought";
}

function TransactionHistoryView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [purchases, setPurchases] = useState<FanPurchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const { data: earningsData, isLoading: earningsLoading } = useCreatorEarnings(user?.id);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setPurchasesLoading(true);
      try {
        // Only confirmed purchases — exclude pending/abandoned checkouts
        const { data: ticketRows, error } = await supabase
          .from("tickets")
          .select("id, event_id, amount, created_at, payment_status")
          .eq("user_id", user.id)
          .in("payment_status", ["paid", "free"])
          .gt("amount", 0)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!ticketRows?.length) { setPurchases([]); return; }
        const eventIds = [...new Set(ticketRows.map((t) => t.event_id))];
        const { data: events } = await supabase.from("events").select("id, title").in("id", eventIds);
        const evMap = new Map((events ?? []).map((e) => [e.id, e.title]));
        // tickets.amount is stored in dollars (numeric); convert to cents for unified formatting
        setPurchases(ticketRows.map((t) => ({
          id: t.id,
          event_id: t.event_id,
          event_title: evMap.get(t.event_id) ?? "Session",
          amount: Math.round(Number(t.amount ?? 0) * 100),
          created_at: t.created_at,
        })));
      } catch (err) {
        console.error("[TransactionHistory]", err);
        setPurchases([]);
      } finally {
        setPurchasesLoading(false);
      }
    })();
  }, [user?.id]);

  const earningRows: HistoryRow[] = (earningsData?.transactions ?? []).map((tx) => ({ id: tx.id, event_title: tx.event_title, amount: tx.amount_net, created_at: tx.created_at, kind: tx.type === "tip" ? "tip_received" : "ticket_sold" }));
  const purchaseRows: HistoryRow[] = purchases.map((p) => ({ id: p.id, event_title: p.event_title, amount: p.amount, created_at: p.created_at, kind: "ticket_bought" }));
  const allRows: HistoryRow[] = [...earningRows, ...purchaseRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const displayRows = activeTab === "all" ? allRows : activeTab === "earnings" ? earningRows : purchaseRows;
  const isLoading = purchasesLoading || earningsLoading;
  const totalEarned = earningRows.reduce((s, r) => s + r.amount, 0);
  const totalSpent = purchaseRows.reduce((s, r) => s + r.amount, 0);
  const tabs: { id: HistoryTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: allRows.length },
    { id: "purchases", label: "Purchases", count: purchaseRows.length },
    { id: "earnings", label: "Earnings", count: earningRows.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { triggerClickHaptic(); onBack(); }} className="w-9 h-9 rounded-full bg-obsidian flex items-center justify-center hover:bg-muted/40 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h3 className="font-display text-lg text-foreground">Transaction History</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-carbon rounded-xl border border-border/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </div>
          <p className="text-lg font-display text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCents(totalEarned)}</p>
        </div>
        <div className="p-4 bg-carbon rounded-xl border border-border/20">
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="w-3.5 h-3.5 text-electric" />
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </div>
          <p className="text-lg font-display text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCents(totalSpent)}</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-carbon rounded-xl border border-border/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { triggerClickHaptic(); setActiveTab(tab.id); }}
            className={cn(
              "flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5",
              activeTab === tab.id ? "bg-obsidian text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted/30" style={{ fontVariantNumeric: "tabular-nums" }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-electric" />
        </div>
      ) : displayRows.length === 0 ? (
        <div className="p-8 bg-carbon rounded-xl border border-border/20 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/20 flex items-center justify-center">
            <History className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium mb-1">No transactions yet</p>
          <p className="text-sm text-muted-foreground">
            {activeTab === "earnings" ? "Host paid sessions to start earning" : activeTab === "purchases" ? "Buy tickets to sessions to see them here" : "Your transactions will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayRows.map((row) => {
            const isTip = row.kind === "tip_received";
            const isEarning = row.kind === "ticket_sold" || isTip;
            return (
              <div key={`${row.kind}-${row.id}`} className="flex items-center gap-3 p-3 bg-carbon rounded-xl border border-border/20">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", isTip ? "bg-amber-500/10" : isEarning ? "bg-emerald-500/10" : "bg-electric/10")}>
                  {isTip ? <Coins className="w-4 h-4 text-amber-400" /> : isEarning ? <DollarSign className="w-4 h-4 text-emerald-400" /> : <Ticket className="w-4 h-4 text-electric" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm truncate">{row.event_title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide", isTip ? "bg-amber-500/10 text-amber-400" : isEarning ? "bg-emerald-500/10 text-emerald-400" : "bg-electric/10 text-electric")}>
                      {isTip ? "Tip" : isEarning ? "Sale" : "Purchase"}
                    </span>
                    <span>{format(new Date(row.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <div className={cn("text-sm font-medium shrink-0", isEarning ? "text-emerald-400" : "text-foreground")} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {isEarning ? "+" : "−"}{formatCents(row.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Help Center Content
const FAQ_ITEMS = [
  {
    q: "How do I start a live session?",
    a: "Tap 'Open Studio' on your creator profile, set your session title and price, then go live. Your followers get notified automatically.",
  },
  {
    q: "When do I get paid?",
    a: "Earnings are processed via Stripe Connect. Once your account is verified, you can request a payout anytime from Settings → Payments & Payouts. First payout usually arrives within 7 days.",
  },
  {
    q: "What is the platform fee?",
    a: "Free plan: 8% commission (first 10 sessions are 0% commission). Pro & Plus plans: 4% commission. Fees are deducted from each transaction automatically.",
  },
  {
    q: "How do ticket refunds work?",
    a: "Refunds are handled through Stripe. Contact support with your ticket ID and we'll process a refund within 5 business days if the session hasn't started.",
  },
  {
    q: "Can I schedule sessions in advance?",
    a: "Yes — tap 'Schedule' on your creator profile to set a future date, time, price and cover image. Followers receive an email notification when you schedule.",
  },
  {
    q: "What's the attendee limit?",
    a: "Free plan: up to 50 concurrent viewers. Pro and Plus plans have unlimited attendees.",
  },
  {
    q: "How do I upgrade my plan?",
    a: "Go to Settings → Payments & Payouts, or tap your plan badge in your profile. Upgrading unlocks unlimited attendees, 4% fees, and advanced analytics.",
  },
  {
    q: "Is Stripe Connect available internationally?",
    a: "Currently, Studio hosting and payouts are available for US-based artists only. International support is coming soon.",
  },
];

function HelpContent() {
  const [showBugModal, setShowBugModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleContactSupport = () => {
    openSupportEmail();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="space-y-3">
          <SettingsCard
            title="Contact Support"
            description="Get help from our team — we reply within 24 hours"
            action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
            onClick={handleContactSupport}
          />
          <SettingsCard
            title="Report a Bug"
            description="Help us improve by reporting issues"
            action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
            onClick={() => { triggerClickHaptic(); setShowBugModal(true); }}
          />
        </div>

        {/* FAQ */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Frequently Asked Questions
          </h3>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-obsidian rounded-xl border border-border/20 overflow-hidden">
                <button
                  onClick={() => { triggerClickHaptic(); setOpenFaq(openFaq === i ? null : i); }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-foreground">{item.q}</span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200", openFaq === i && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/20 pt-3">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground/40">Exhiby · Beta v0.1</p>
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