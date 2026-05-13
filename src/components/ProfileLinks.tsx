import { Globe, Instagram, ShoppingBag, Link as LinkIcon, ExternalLink } from "lucide-react";
import type { ProfileLink } from "./EditProfileModal";

interface ProfileLinksProps {
  links: ProfileLink[];
  className?: string;
}

const TYPE_ICON: Record<ProfileLink["type"], React.ReactNode> = {
  website: <Globe className="w-3 h-3" />,
  social:  <Instagram className="w-3 h-3" />,
  shop:    <ShoppingBag className="w-3 h-3" />,
  other:   <LinkIcon className="w-3 h-3" />,
};

function getDisplayLabel(link: ProfileLink): string {
  if (link.label) return link.label;
  try {
    const hostname = new URL(link.url).hostname.replace("www.", "");
    return hostname;
  } catch {
    return link.url;
  }
}

export function ProfileLinks({ links, className = "" }: ProfileLinksProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="group flex items-center gap-1.5 px-3 py-2 rounded-full bg-obsidian border border-border/40 text-foreground/80 hover:border-electric/40 hover:text-electric hover:bg-electric/5 transition-all min-h-[36px]"
        >
          <span className="text-electric/70 group-hover:text-electric transition-colors">
            {TYPE_ICON[link.type]}
          </span>
          <span className="font-medium text-[13px] leading-none max-w-[180px] truncate">{getDisplayLabel(link)}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-80 transition-opacity shrink-0" />
        </a>
      ))}
    </div>
  );
}
