import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollLock } from "@/hooks/useScrollLock";
import { 
  ArrowLeft, 
  CreditCard,
  Bell,
  ChevronRight,
  Palette,
  X,
  HelpCircle,
  FileText,
  MessageSquare,
  Bug,
  BookOpen,
  Shield,
  Trash2,
  Mail,
  Smartphone,
  Loader2
} from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { useUserMode } from "@/contexts/UserModeContext";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Switch } from "@/components/ui/switch";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStudio?: () => void;
}

type SettingsView = "main" | "support" | "legal" | "notifications";

export function SettingsDrawer({ isOpen, onClose, onOpenStudio }: SettingsDrawerProps) {
  const [settingsView, setSettingsView] = useState<SettingsView>("main");
  const { isVerifiedCreator } = useUserMode();
  const { preferences, loading: prefsLoading, saving, updatePreferences } = useNotificationPreferences();
  
  // Lock body scroll when drawer is open
  useScrollLock(isOpen);

  const handleToggle = async (key: keyof typeof preferences) => {
    triggerClickHaptic();
    try {
      await updatePreferences({ [key]: !preferences[key] });
    } catch {
      toast({ title: "Error", description: "Failed to update preference", variant: "destructive" });
    }
  };

  const handleClose = () => {
    onClose();
    setSettingsView("main");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.9 }}
            transition={{ 
              type: "spring", 
              damping: 28, 
              stiffness: 350,
              mass: 0.8 
            }}
            className="fixed bottom-0 left-0 right-0 bg-obsidian rounded-t-3xl z-50 max-h-[85dvh] flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="p-6 flex flex-col flex-1 overflow-y-auto min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                {settingsView !== "main" ? (
                  <button
                    onClick={() => setSettingsView("main")}
                    className="flex items-center gap-2 text-foreground"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-display text-xl">
                      {settingsView === "support" ? "Support" : settingsView === "legal" ? "Legal" : "Notifications"}
                    </span>
                  </button>
                ) : (
                  <h2 className="font-display text-xl text-foreground">Settings</h2>
                )}
                <button
                  onClick={handleClose}
                  className="w-10 h-10 rounded-full bg-carbon/50 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1">
                <AnimatePresence mode="wait">
                  {/* Main Settings View */}
                  {settingsView === "main" && (
                    <motion.div
                      key="main"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 30,
                        mass: 0.8
                      }}
                      className="space-y-3"
                    >
                      {/* Payment Methods */}
                      <button 
                        onClick={() => toast({ title: "Payment Methods", description: "Opening payment settings..." })}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Payment Methods</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Notifications */}
                      <button 
                        onClick={() => {
                          triggerClickHaptic();
                          setSettingsView("notifications");
                        }}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Notifications</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Get Help - Opens Support Sub-menu */}
                      <button 
                        onClick={() => {
                          triggerClickHaptic();
                          setSettingsView("support");
                        }}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <HelpCircle className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Get Help</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Privacy & Terms - Opens Legal Sub-menu */}
                      <button 
                        onClick={() => {
                          triggerClickHaptic();
                          setSettingsView("legal");
                        }}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Privacy & Terms</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Open Studio (only if not verified) */}
                      {!isVerifiedCreator && onOpenStudio && (
                        <button 
                          onClick={() => {
                            triggerClickHaptic();
                            onOpenStudio();
                            handleClose();
                          }}
                          className="w-full mt-4 p-4 rounded-xl bg-gradient-to-r from-electric to-crimson flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <Palette className="w-5 h-5 text-white" />
                            <div className="text-left">
                              <span className="text-white font-semibold block">Open Your Studio</span>
                              <span className="text-white/70 text-xs">Become a verified creator</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-white" />
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* Support Sub-menu */}
                  {settingsView === "support" && (
                    <motion.div
                      key="support"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 30,
                        mass: 0.8
                      }}
                      className="space-y-3"
                    >
                      {/* FAQ */}
                      <button 
                        onClick={() => toast({ title: "FAQ", description: "Opening FAQ..." })}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-electric" />
                          <span className="text-foreground">FAQ</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Contact Support - mailto */}
                      <button 
                        onClick={() => {
                          triggerClickHaptic();
                          // Create a temporary anchor element to trigger mailto - most reliable cross-platform method
                          const link = document.createElement('a');
                          link.href = "mailto:support@joinexhiby.com?subject=Exhiby%20App%20Support&body=Hi%20Exhiby%20team%2C%20I%20need%20help%20with%3A";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Contact Support</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Report a Bug */}
                      <button 
                        onClick={() => toast({ title: "Report a Bug", description: "Opening bug report form..." })}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <Bug className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Report a Bug</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Community Guidelines */}
                      <button 
                        onClick={() => toast({ title: "Community Guidelines", description: "Opening community guidelines..." })}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Community Guidelines</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </motion.div>
                  )}

                  {/* Legal Sub-menu */}
                  {settingsView === "legal" && (
                    <motion.div
                      key="legal"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 30,
                        mass: 0.8
                      }}
                      className="space-y-3"
                    >
                      {/* Terms of Service */}
                      <button 
                        onClick={() => toast({ title: "Terms of Service", description: "Opening terms..." })}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Terms of Service</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Privacy Policy */}
                      <button 
                        onClick={() => toast({ title: "Privacy Policy", description: "Opening privacy policy..." })}
                        className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-electric" />
                          <span className="text-foreground">Privacy Policy</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>

                      {/* Delete Account - Red at bottom */}
                      <div className="pt-8">
                        <button 
                          onClick={() => {
                            triggerClickHaptic();
                            toast({ 
                              title: "Delete Account", 
                              description: "This action cannot be undone. Please contact support to delete your account.",
                              variant: "destructive"
                            });
                          }}
                          className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-destructive/30"
                        >
                          <div className="flex items-center gap-3">
                            <Trash2 className="w-5 h-5 text-destructive" />
                            <span className="text-destructive">Delete Account</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-destructive/60" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Notifications Sub-menu */}
                  {settingsView === "notifications" && (
                    <motion.div
                      key="notifications"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 30,
                        mass: 0.8
                      }}
                      className="space-y-6"
                    >
                      {prefsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-electric" />
                        </div>
                      ) : (
                        <>
                          {/* Email Notifications Section */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">Email Notifications</span>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30">
                                <div>
                                  <span className="text-foreground">Live sessions</span>
                                  <p className="text-xs text-muted-foreground">When creators you follow go live</p>
                                </div>
                                <Switch
                                  checked={preferences.email_live}
                                  onCheckedChange={() => handleToggle("email_live")}
                                  disabled={saving}
                                />
                              </div>
                              <div className="flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30">
                                <div>
                                  <span className="text-foreground">Scheduled sessions</span>
                                  <p className="text-xs text-muted-foreground">When a new session is scheduled</p>
                                </div>
                                <Switch
                                  checked={preferences.email_scheduled}
                                  onCheckedChange={() => handleToggle("email_scheduled")}
                                  disabled={saving}
                                />
                              </div>
                              <div className="flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30">
                                <div>
                                  <span className="text-foreground">Reminders</span>
                                  <p className="text-xs text-muted-foreground">15 minutes before a session starts</p>
                                </div>
                                <Switch
                                  checked={preferences.email_reminders}
                                  onCheckedChange={() => handleToggle("email_reminders")}
                                  disabled={saving}
                                />
                              </div>
                            </div>
                          </div>

                          {/* In-App Notifications Section */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Smartphone className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">In-App Notifications</span>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30">
                                <div>
                                  <span className="text-foreground">Live sessions</span>
                                  <p className="text-xs text-muted-foreground">When creators you follow go live</p>
                                </div>
                                <Switch
                                  checked={preferences.inapp_live}
                                  onCheckedChange={() => handleToggle("inapp_live")}
                                  disabled={saving}
                                />
                              </div>
                              <div className="flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30">
                                <div>
                                  <span className="text-foreground">Scheduled sessions</span>
                                  <p className="text-xs text-muted-foreground">When a new session is scheduled</p>
                                </div>
                                <Switch
                                  checked={preferences.inapp_scheduled}
                                  onCheckedChange={() => handleToggle("inapp_scheduled")}
                                  disabled={saving}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
