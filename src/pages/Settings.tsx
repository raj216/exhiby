import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, Bell, Shield, CreditCard, Palmtree, MapPin, HelpCircle, BookOpen, ChevronRight, Loader2, Mail, Smartphone, Trash2, BellRing, Bug, MessageSquare, Plus, TrendingUp, ShoppingBag, History, ExternalLink, CheckCircle2, Zap } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useCreatorEarnings } from "@/hooks/useCreatorEarnings";
import { useStripeConnect } from "@/hooks/useStripeConnect";

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

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS CONTENT — 3 sub-views: Methods | Payouts | History
// ─────────────────────────────────────────────────────────────────────────────
type PaymentsView = "menu" | "methods" | "payouts" | "history";

function PaymentsContent() {
  const [view, setView] = useState<PaymentsView>("menu");

  if (view === "methods") return <PaymentMethodsView onBack={() => setView("menu")} />;
  if (view === "payouts") return <PayoutSettingsView onBack={() => setView("menu")} />;
  if (view === "history") return <TransactionHistoryView onBack={() => setView("menu")} />;

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Payment Methods"
        description="Manage your saved cards"
        action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
        onClick={() => setView("methods")}
      />
      <SettingsCard
        title="Payout Settings"
        description="Set up how you receive your earnings"
        action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
        onClick={() => setView("payouts")}
      />
      <SettingsCard
        title="Transaction History"
        description="View your payment and payout history"
        action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
        onClick={() => setView("history")}
      />
    </div>
  );
}

// ── Brand logo helper ──────────────────────────────────────────────────────
function CardBrandBadge({ brand }: { brand: string }) {
  const upper = brand.toUpperCase();
  const colors: Record<string, string> = {
    VISA: "bg-blue-600",
    MASTERCARD: "bg-orange-500",
    AMEX: "bg-indigo-600",
    DISCOVER: "bg-yellow-500",
  };
  const bg = colors[upper] || "bg-muted";
  return (
    <span className={`${bg} text-white text-[10px] font-bold px-2 py-0.5 rounded`}>
      {upper === "MASTERCARD" ? "MC" : upper.slice(0, 4)}
    </span>
  );
}

// ── Payment Methods sub-view ───────────────────────────────────────────────
interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

function PaymentMethodsView({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-payment-methods", {
        body: { action: "list" },
      });
      if (error) throw error;
      setCards(data.cards || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load cards", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleSetDefault = async (pmId: string) => {
    setActionId(pmId);
    try {
      const { error } = await supabase.functions.invoke("manage-payment-methods", {
        body: { action: "set_default", payment_method_id: pmId },
      });
      if (error) throw error;
      toast({ title: "Default updated" });
      await fetchCards();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = async (pmId: string) => {
    setActionId(pmId + "-remove");
    try {
      const { error } = await supabase.functions.invoke("manage-payment-methods", {
        body: { action: "remove", payment_method_id: pmId },
      });
      if (error) throw error;
      toast({ title: "Card removed" });
      await fetchCards();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleBillingPortal = async () => {
    setActionId("portal");
    try {
      const { data, error } = await supabase.functions.invoke("manage-payment-methods", {
        body: { action: "billing_portal", return_url: window.location.href },
      });
      if (error) throw error;
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Back row */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Payments
      </button>

      <h3 className="text-lg font-semibold text-foreground">Payment Methods</h3>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <CreditCard className="w-10 h-10 opacity-30" />
          <p className="text-sm">No saved cards yet.</p>
          <button
            onClick={handleBillingPortal}
            disabled={actionId === "portal"}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-electric text-black text-sm font-semibold"
          >
            {actionId === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Card
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cards.map(card => (
              <div
                key={card.id}
                className="flex items-center justify-between p-4 bg-obsidian rounded-xl border border-border/20"
              >
                <div className="flex items-center gap-3">
                  <CardBrandBadge brand={card.brand} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      •••• {card.last4}
                      {card.is_default && (
                        <span className="ml-2 text-[10px] font-semibold text-electric bg-electric/10 px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!card.is_default && (
                    <button
                      onClick={() => handleSetDefault(card.id)}
                      disabled={!!actionId}
                      className="text-xs text-electric hover:underline disabled:opacity-50"
                    >
                      {actionId === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Set default"}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(card.id)}
                    disabled={!!actionId}
                    className="text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    {actionId === card.id + "-remove" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add via Billing Portal */}
          <button
            onClick={handleBillingPortal}
            disabled={actionId === "portal"}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border/40 text-sm text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
          >
            {actionId === "portal" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add or manage cards via Stripe
                <ExternalLink className="w-3 h-3 opacity-50" />
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

// ── Payout Settings sub-view ───────────────────────────────────────────────
function PayoutSettingsView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { status, loading, startOnboarding, getDashboardLink, requestPayout } = useStripeConnect(user?.id);
  const { data: earningsData } = useCreatorEarnings(user?.id);
  const [actionLoading, setActionLoading] = useState(false);

  const statusConfig = {
    loading: { label: "Loading…", color: "text-muted-foreground", bg: "bg-muted/30" },
    not_connected: { label: "Not Connected", color: "text-destructive", bg: "bg-destructive/10" },
    onboarding_incomplete: { label: "Setup Incomplete", color: "text-yellow-400", bg: "bg-yellow-400/10" },
    pending_verification: { label: "Pending Verification", color: "text-yellow-400", bg: "bg-yellow-400/10" },
    active: { label: "Active", color: "text-green-400", bg: "bg-green-400/10" },
  };
  const cfg = statusConfig[status];

  const handleOnboarding = async () => {
    setActionLoading(true);
    const url = await startOnboarding();
    if (url) window.location.href = url;
    setActionLoading(false);
  };

  const handleDashboard = async () => {
    setActionLoading(true);
    const url = await getDashboardLink();
    if (url) window.open(url, "_blank");
    setActionLoading(false);
  };

  const handlePayout = async () => {
    setActionLoading(true);
    const result = await requestPayout();
    if (result.success) {
      toast({ title: "Payout requested!", description: `$${((result.amount || 0) / 100).toFixed(2)} will arrive in 2–5 days` });
    } else {
      toast({ title: "Payout failed", description: result.error || "Try again later", variant: "destructive" });
    }
    setActionLoading(false);
  };

  const available = earningsData?.availableToPayout || 0;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Payments
      </button>

      <h3 className="text-lg font-semibold text-foreground">Payout Settings</h3>

      {/* Status badge */}
      <div className="flex items-center gap-2 p-4 rounded-xl bg-obsidian border border-border/20">
        <Zap className="w-5 h-5 text-electric" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Stripe Connect Status</p>
          <p className="text-xs text-muted-foreground">Powered by Stripe — US accounts only</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Balance */}
      {earningsData && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-obsidian border border-border/20">
            <p className="text-xs text-muted-foreground mb-1">Lifetime Earnings</p>
            <p className="text-xl font-bold text-foreground">${(earningsData.lifetimeEarnings / 100).toFixed(2)}</p>
          </div>
          <div className="p-4 rounded-xl bg-obsidian border border-border/20">
            <p className="text-xs text-muted-foreground mb-1">Available to Pay Out</p>
            <p className="text-xl font-bold text-electric">${(available / 100).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {status === "active" ? (
        <div className="space-y-3">
          <button
            onClick={handlePayout}
            disabled={actionLoading || available === 0}
            className="w-full py-3.5 rounded-xl bg-electric text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {available === 0 ? "No earnings to pay out" : `Pay Out $${(available / 100).toFixed(2)}`}
          </button>
          <button
            onClick={handleDashboard}
            disabled={actionLoading}
            className="w-full py-3 rounded-xl border border-border/30 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> View Stripe Dashboard
          </button>
        </div>
      ) : status === "not_connected" || status === "onboarding_incomplete" ? (
        <button
          onClick={handleOnboarding}
          disabled={actionLoading || loading}
          className="w-full py-3.5 rounded-xl bg-electric text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {status === "onboarding_incomplete" ? "Complete Setup" : "Connect Stripe"}
        </button>
      ) : status === "pending_verification" ? (
        <div className="p-4 rounded-xl bg-yellow-400/5 border border-yellow-400/20 text-sm text-yellow-300 text-center">
          Your account is under review. Stripe will notify you by email once verified.
        </div>
      ) : null}

      {/* Disclosures */}
      <div className="text-xs text-muted-foreground space-y-1 px-1">
        <p>• Exhiby takes a 10% platform fee on all earnings.</p>
        <p>• Payouts are processed in USD and require a US bank account.</p>
        <p>• Funds typically arrive within 2–5 business days.</p>
      </div>
    </div>
  );
}

// ── Transaction History sub-view ───────────────────────────────────────────
type TxTab = "all" | "purchases" | "earnings";

interface PurchaseTx {
  id: string;
  event_title: string;
  purchased_at: string;
  amount_cents: number | null;
}

function TransactionHistoryView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<TxTab>("all");
  const [purchases, setPurchases] = useState<PurchaseTx[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  const { data: earningsData, isLoading: earningsLoading } = useCreatorEarnings(user?.id);

  useEffect(() => {
    if (!user) return;
    setPurchasesLoading(true);
    supabase
      .from("tickets")
      .select("id, purchased_at, event:events(title, ticket_price)")
      .eq("user_id", user.id)
      .order("purchased_at", { ascending: false })
      .then(({ data }) => {
        setPurchases(
          (data || []).map((t: any) => ({
            id: t.id,
            event_title: t.event?.title || "Untitled",
            purchased_at: t.purchased_at,
            amount_cents: t.event?.ticket_price ?? null,
          }))
        );
        setPurchasesLoading(false);
      });
  }, [user]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const earningRows = earningsData?.transactions || [];
  const allRows: Array<{ id: string; label: string; date: string; amount: number; type: "earning" | "purchase" }> = [
    ...earningRows.map(e => ({ id: e.id, label: e.event_title, date: e.created_at, amount: e.amount_net, type: "earning" as const })),
    ...purchases.map(p => ({ id: p.id, label: p.event_title, date: p.purchased_at, amount: p.amount_cents || 0, type: "purchase" as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const rows = tab === "all" ? allRows : tab === "earnings" ? allRows.filter(r => r.type === "earning") : allRows.filter(r => r.type === "purchase");
  const isLoading = purchasesLoading || earningsLoading;

  const tabs: { id: TxTab; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: History },
    { id: "purchases", label: "Purchases", icon: ShoppingBag },
    { id: "earnings", label: "Earnings", icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Payments
      </button>

      <h3 className="text-lg font-semibold text-foreground">Transaction History</h3>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-obsidian rounded-xl border border-border/20">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
                tab === t.id ? "bg-electric/10 text-electric" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <History className="w-10 h-10 opacity-30" />
          <p className="text-sm">No transactions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between p-4 bg-obsidian rounded-xl border border-border/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", row.type === "earning" ? "bg-green-500/10" : "bg-blue-500/10")}>
                  {row.type === "earning" ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(row.date)}</p>
                </div>
              </div>
              <p className={cn("text-sm font-semibold flex-shrink-0", row.type === "earning" ? "text-green-400" : "text-foreground")}>
                {row.type === "earning" ? "+" : "−"}${(row.amount / 100).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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