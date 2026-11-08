import { LoaderIcon } from "lucide-react";

function ChatLoader() {
  return (
    <div className="h-full min-h-0 flex flex-col items-center justify-center p-4" role="status">
      <LoaderIcon className="animate-spin size-10 text-primary" />
      <p className="mt-4 text-center text-lg font-mono">Connecting to chat...</p>
    </div>
  );
}

export default ChatLoader;
