import { StreamChat } from "stream-chat";
import "dotenv/config";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.log(
    "STREAM_API_KEY and STREAM_API_SECRET must be set in environment variables"
  );
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const upsertStreamUser = async (userdata) => {
  try {
    await streamClient.upsertUser(userdata);
    return {
      success: true,
      message: "Stream user created successfully",
      user: userdata,
    };
  } catch (error) {
    console.error("Error creating Stream user:", error);
    throw error;
  }
};

export const generateStreamToken = (userId) => {
  try {
    const userIdStr = userId.toString();
    return streamClient.createToken(userIdStr);
  } catch (error) {
    console.error("Error generating Stream token:", error);
  }
};
