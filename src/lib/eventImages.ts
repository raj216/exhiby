export function getEventThumbnailUrl(params: {
  eventCoverUrl?: string | null;
  eventThumbnailUrl?: string | null;
  creatorAvatarUrl?: string | null;
  placeholderUrl?: string;
}): string {
  const {
    eventCoverUrl,
    eventThumbnailUrl,
    creatorAvatarUrl,
    placeholderUrl = "/placeholder.svg",
  } = params;

  return (
    eventCoverUrl ||
    eventThumbnailUrl ||
    creatorAvatarUrl ||
    placeholderUrl
  );
}
