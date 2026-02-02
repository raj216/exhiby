import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Copy, ExternalLink, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUPPORT_EMAIL = "support@joinexhiby.com";

export function ContactSupportModal({ isOpen, onClose }: ContactSupportModalProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
    return isMobile ? "Mobile" : "Desktop";
  };

  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edge")) return "Edge";
    return "Unknown";
  };

  const subject = "Exhiby Support";
  const bodyTemplate = `Hi Exhiby Support,

Issue:

Page/Section:

Device/Browser: ${getDeviceInfo()} / ${getBrowserInfo()}

—`;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      toast({ title: "Email copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleOpenGmail = () => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(bodyTemplate);
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${encodedSubject}&body=${encodedBody}`,
      "_blank"
    );
    onClose();
  };

  const handleOpenOutlook = () => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(bodyTemplate);
    window.open(
      `https://outlook.office.com/mail/deeplink/compose?to=${SUPPORT_EMAIL}&subject=${encodedSubject}&body=${encodedBody}`,
      "_blank"
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-obsidian border-border/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Mail className="w-5 h-5 text-electric" />
            Contact Support
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Email us at{" "}
            <span className="text-foreground font-medium">{SUPPORT_EMAIL}</span>
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleCopyEmail}
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-carbon border-border/30 hover:bg-muted/20"
            >
              {copied ? (
                <Check className="w-4 h-4 text-electric" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
              <span>{copied ? "Copied!" : "Copy Email"}</span>
            </Button>

            <Button
              onClick={handleOpenGmail}
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-carbon border-border/30 hover:bg-muted/20"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <span>Open Gmail</span>
            </Button>

            <Button
              onClick={handleOpenOutlook}
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-carbon border-border/30 hover:bg-muted/20"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <span>Open Outlook</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
