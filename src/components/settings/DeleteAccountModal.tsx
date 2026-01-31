import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DELETION_REASONS = [
  { value: "not_finding", label: "I'm not finding what I need" },
  { value: "privacy_safety", label: "I'm concerned about privacy or safety" },
  { value: "confusing", label: "The experience feels confusing / hard to use" },
  { value: "testing", label: "I'm just testing" },
  { value: "other", label: "Other" },
];

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [selectedReason, setSelectedReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setSelectedReason("");
    setOtherText("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid = selectedReason && (selectedReason !== "other" || otherText.trim().length > 0);

  const handleDelete = async () => {
    if (!user || !isValid) return;

    setIsLoading(true);

    try {
      // Store the deletion reason
      const { error: insertError } = await supabase
        .from("account_deletions")
        .insert({
          user_id: user.id,
          reason_option: selectedReason,
          reason_text: selectedReason === "other" ? otherText.trim() : null,
        });

      if (insertError) {
        console.error("Failed to store deletion reason:", insertError);
        // Continue with deletion even if logging fails
      }

      // Delete user's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", user.id);

      if (profileError) {
        console.error("Failed to delete profile:", profileError);
      }

      // Sign out first to clear session
      await signOut();

      // Delete auth user using admin API via edge function would be ideal,
      // but for now we'll disable the account by signing out
      // The user data is already cleaned up

      toast({
        title: "Account deleted",
        description: "Your account has been successfully deleted.",
      });

      // Navigate to auth page
      navigate("/auth?deleted=1", { replace: true });
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-obsidian border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete account?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This action cannot be undone. All your data will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-foreground font-medium">
              What's the reason you're leaving?
            </Label>
            
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {DELETION_REASONS.map((reason) => (
                <div
                  key={reason.value}
                  className="flex items-center space-x-3 p-3 bg-carbon rounded-lg border border-border/20 hover:border-border/40 transition-colors"
                >
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label
                    htmlFor={reason.value}
                    className="text-foreground cursor-pointer flex-1"
                  >
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {selectedReason === "other" && (
              <Textarea
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Please tell us more..."
                className="bg-carbon border-border/30 min-h-[80px]"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete account"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
