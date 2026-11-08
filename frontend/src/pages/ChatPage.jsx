import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import useAuthUser from "../hooks/useAuthUser.js";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api.js";

import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader.jsx";
import CallButton from "../components/CallButton.jsx";
import { reportTyping } from "../lib/push.js";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const ChatPage = () => {
  const { id: targetUserId } = useParams();

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const typingTimer = useRef(null);
  const typingActive = useRef(false);

  const { authUser } = useAuthUser();

  useEffect(() => () => {
    clearTimeout(typingTimer.current);
    if (typingActive.current) {
      typingActive.current = false;
      void reportTyping(targetUserId, "typing.stop");
    }
  }, [targetUserId]);

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser, // this will run only when authUser is available
  });

  useEffect(() => {
    const initChat = async () => {
      if (!tokenData?.token || !authUser) return;

      try {
        console.log("Initializing stream chat client...");

        const client = StreamChat.getInstance(STREAM_API_KEY);

        await client.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token
        );

        //
        const channelId = [authUser._id, targetUserId].sort().join("-");

        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });

        await currChannel.watch();

        setChatClient(client);
        setChannel(currChannel);
      } catch (error) {
        console.error("Error initializing chat:", error);
        toast.error("Could not connect to chat. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [tokenData, authUser, targetUserId]);

  const handleTyping = () => {
    if (!typingActive.current) {
      typingActive.current = true;
      void reportTyping(targetUserId, "typing.start");
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingActive.current = false;
      void reportTyping(targetUserId, "typing.stop");
    }, 3000);
  };

  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (typingActive.current) {
      typingActive.current = false;
      void reportTyping(targetUserId, "typing.stop");
    }
  };

  const handleVideoCall = async () => {
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;

      try {
        await channel.sendMessage({
          text: `I've started a video call. Join me here: ${callUrl}`,
          meetify_event: "call.invite",
          call_id: channel.id,
        });
        toast.success("Video call link sent successfully!");
      } catch {
        toast.error("Could not send the call invitation. Please try again.");
      }
    }
  };

  if (loading || !chatClient || !channel) return <ChatLoader />;

  return (
    <div className="h-[93vh]">
      <Chat client={chatClient}>
        <Channel channel={channel}>
          <div className="w-full relative">
            <CallButton handleVideoCall={handleVideoCall} />
            <Window>
              <ChannelHeader />
              <MessageList />
              <div onInputCapture={handleTyping} onBlurCapture={stopTyping}>
                <MessageInput focus />
              </div>
            </Window>
          </div>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};
export default ChatPage;
