import { BadgeCheck, UserCircle } from "lucide-react";

export interface FollowUser {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
}

interface FollowListRowProps {
  user: FollowUser;
  onActivate: (user: FollowUser) => void;
}

export function FollowListRow({ user, onActivate }: FollowListRowProps) {
  const label = user.handle || user.name;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate(user);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onActivate(user)}
      onKeyDown={handleKeyDown}
      className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <UserCircle className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-foreground font-medium truncate">{label}</p>
          {user.is_verified === true && (
            <BadgeCheck className="w-4 h-4 text-gold fill-gold/20 flex-shrink-0" />
          )}
        </div>
        {user.handle && (
          <p className="text-muted-foreground text-sm truncate">{user.name}</p>
        )}
      </div>
    </button>
  );
}
