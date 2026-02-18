import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bug, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface ReportBugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportBugModal({ isOpen, onClose }: ReportBugModalProps) {
  const { user } = useAuth();
  const [issueText, setIssueText] = useState("");
  const [page, setPage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setIssueText("");
    setPage("");
    setScreenshot(null);
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 5MB.",
          variant: "destructive",
        });
        return;
      }
      setScreenshot(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!issueText.trim()) {
      setError("Please describe the issue");
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to report a bug.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      let screenshotUrl: string | null = null;

      // Upload screenshot if provided
      if (screenshot) {
        const fileExt = screenshot.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from("avatars") // Reusing avatars bucket for now
          .upload(`bug-reports/${fileName}`, screenshot);

        if (uploadError) {
          console.error("Screenshot upload error:", uploadError);
        } else if (data) {
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(`bug-reports/${fileName}`);
          screenshotUrl = urlData.publicUrl;
        }
      }

      // Insert bug report
      const { error: insertError } = await supabase
        .from("bug_reports")
        .insert({
          user_id: user.id,
          issue_text: issueText.trim(),
          page: page.trim() || null,
          screenshot_url: screenshotUrl,
        });

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Thank you — we're on it.",
        description: "We've received your bug report.",
      });
      handleClose();
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast({
        title: "Error",
        description: "Failed to submit bug report. Please try again.",
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
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Bug className="w-5 h-5 text-electric" />
            Report a bug
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tell us what felt off — we'll improve it.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Issue Description */}
          <div className="space-y-2">
            <Label htmlFor="issue" className="text-foreground">
              Issue <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="issue"
              value={issueText}
              onChange={(e) => {
                if (e.target.value.length <= 1000) setIssueText(e.target.value);
              }}
              maxLength={1000}
              placeholder="Describe what happened..."
              className="bg-carbon border-border/30 min-h-[100px]"
            />
            <span className="text-xs text-muted-foreground">{issueText.length}/1000</span>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Page / Section */}
          <div className="space-y-2">
            <Label htmlFor="page" className="text-foreground">
              Page / Section <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="page"
              value={page}
              onChange={(e) => {
                if (e.target.value.length <= 100) setPage(e.target.value);
              }}
              maxLength={100}
              placeholder="e.g., Profile settings, Live room"
              className="bg-carbon border-border/30"
            />
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-2">
            <Label className="text-foreground">
              Screenshot <span className="text-muted-foreground">(optional)</span>
            </Label>
            
            {screenshot ? (
              <div className="flex items-center gap-3 p-3 bg-carbon rounded-lg border border-border/20">
                <span className="text-sm text-foreground truncate flex-1">
                  {screenshot.name}
                </span>
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 bg-carbon rounded-lg border border-dashed border-border/30 cursor-pointer hover:border-border/50 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click to upload an image
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
