import { useSearchParams } from "react-router-dom";
import LiveRoom from "./LiveRoom";
import StudioCameraPage from "./StudioCameraPage";

/**
 * Entry router for /live/:eventId.
 *
 * ?cam=1   → StudioCameraPage (phone as second camera angle — streams video)
 * default  → full LiveRoom (auto-detects primary vs companion using
 *            events.primary_device_id — no QR-code URL is required)
 */
export default function LiveRoomEntry() {
  const [searchParams] = useSearchParams();
  const camMode = searchParams.get("cam") === "1";

  if (camMode) {
    return <StudioCameraPage />;
  }

  return <LiveRoom />;
}
