import { VideoIcon } from "lucide-react";

function CallButton({ handleVideoCall }) {
  return (
    <button type="button" onClick={handleVideoCall} className="btn btn-success btn-square size-11 shrink-0 text-white" aria-label="Start video call" title="Start video call">
      <VideoIcon className="size-5" aria-hidden="true" />
    </button>
  );
}

export default CallButton;
