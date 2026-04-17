import { useSearchParams } from "react-router-dom";
import LiveRoom from "./LiveRoom";
import StudioCameraPage from "./StudioCameraPage";

/**
 * Entry router for /live/:eventId.
 * Renders the phone-only StudioCameraView when `?cam=1`,
 * otherwise the full LiveRoom experience.
 *
 * Using a wrapper avoids hooks-rules issues from short-circuiting inside LiveRoom.
 */
export default function LiveRoomEntry() {
  const [searchParams] = useSearchParams();
  const camMode = searchParams.get("cam") === "1";

  if (camMode) {
    return <StudioCameraPage />;
  }

  return <LiveRoom />;
}
