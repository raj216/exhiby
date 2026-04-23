import { useSearchParams } from "react-router-dom";
import LiveRoom from "./LiveRoom";
import StudioCameraPage from "./StudioCameraPage";
import CompanionModePage from "./CompanionModePage";

/**
 * Entry router for /live/:eventId.
 *
 * ?cam=1        → StudioCameraPage  (phone as second camera angle — streams video)
 * ?companion=1  → CompanionModePage (second device for creator — chat/manage only, no camera)
 * (default)     → full LiveRoom
 */
export default function LiveRoomEntry() {
  const [searchParams] = useSearchParams();
  const camMode = searchParams.get("cam") === "1";
  const companionMode = searchParams.get("companion") === "1";

  if (camMode) {
    return <StudioCameraPage />;
  }

  if (companionMode) {
    return <CompanionModePage />;
  }

  return <LiveRoom />;
}
