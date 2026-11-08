 ## Demo Video


https://github.com/user-attachments/assets/fd762b54-3e0f-4378-a4b1-b9a6eaffcf1a


 ---



# Video Calling Chat App – Real-Time Communication Platform

This is a full-stack MERN (MongoDB, Express, React, Node.js) application that allows users to register, connect with friends, and engage in one-on-one video calls with real-time chat and screen sharing. Built using WebRTC and Socket.IO, it provides a seamless communication experience directly in the browser without needing any external software.

# Live Link: https://video-calling-chat-app.onrender.com

---

## ✨ Features

- 🔐 **Secure Authentication**
  - Register and login with JWT-based session handling
  - Passwords encrypted using bcrypt

- 🤝 **Friend Request System**
  - Send and accept friend requests
  - Fetch list of accepted friends

- 📞 **One-on-One Video Calling**
  - Real-time peer-to-peer calls using WebRTC
  - Supports video, audio, and screen sharing

- 💬 **Real-Time Chat**
  - Text chat alongside video calls
  - Socket.IO-powered messaging

- 🖥️ **Screen Sharing**
  - Share your screen in-call for collaboration or presentation

- 📡 **WebSocket Integration**
  - Real-time presence updates (online/offline)
  - Call signaling handled over Socket.IO

- 🎨 **Responsive UI**
  - Clean and modern design using React
  - Optimized for mobile and desktop devices

- 📁 **Modular Codebase**
  - Well-structured backend & frontend folders
  - Easy to maintain and scale

---

## 🛠️ Tech Stack

### 🧩 Frontend

| Technology   | Purpose                                 |
|--------------|------------------------------------------|
| **React.js** | Frontend library for building UI         |
| **Vite**     | Fast development server and bundler      |
| **Socket.IO Client** | Real-time WebSocket communication |
| **WebRTC**   | Peer-to-peer audio, video, and screen sharing |
| **Context API & Hooks** | State management and reusability |

### ⚙️ Backend

| Technology     | Purpose                                     |
|----------------|----------------------------------------------|
| **Node.js**    | JavaScript runtime for server-side logic     |
| **Express.js** | Backend framework for routing and middleware |
| **MongoDB**    | NoSQL database for storing user data         |
| **Mongoose**   | ODM for MongoDB schema and queries           |
| **Socket.IO**  | Real-time bidirectional communication         |
| **JWT**        | Secure token-based authentication            |
| **bcryptjs**   | Password hashing                             |
| **dotenv**     | Environment variable management               |

### 🌐 Dev Tools & Hosting

| Tool         | Purpose                              |
|--------------|---------------------------------------|
| **Render**   | Backend deployment                    |
| **Vercel** / **Netlify** | Frontend deployment       |
| **Thunder Client / Postman** | API testing           |
| **Git & GitHub** | Version control and collaboration |

---

## 📡 API Endpoints Overview

| Method | Endpoint                     | Description                   | Auth Required |
|--------|------------------------------|-------------------------------|---------------|
| POST   | `/api/auth/register`         | Register a new user           | ❌            |
| POST   | `/api/auth/login`            | Login and receive JWT token   | ❌            |
| GET    | `/api/user/me`               | Get authenticated user info   | ✅            |
| POST   | `/api/friends/request/:id`   | Send a friend request         | ✅            |
| PUT    | `/api/friends/accept/:id`    | Accept a friend request       | ✅            |
| GET    | `/api/friends/list`          | Retrieve list of user friends | ✅            |

---

## 🌐 Environment Variables

To run this project, create a `.env` file in the `backend/` directory with the following variables:

| Variable Name         | Description                                      |
|-----------------------|--------------------------------------------------|
| `PORT`                | Port on which the backend server runs (e.g. 5001) |
| `MONGODB_URI`        | MongoDB connection string (`MONGO_URI` is also accepted for existing Render services) |
| `STREAM_API_KEY`      | Stream Chat API public key                       |
| `STREAM_API_SECRET`   | Stream Chat API secret key                       |
| `JWT_SECRET_KEY`      | Secret used to sign and verify JWTs              |
| `CLIENT_URL`          | Frontend origin, e.g. `http://localhost:5173` locally or `https://video-calling-chat-app.onrender.com` on Render |
| `EMAIL_USER`          | Gmail address used to send password reset emails (backend only) |
| `EMAIL_PASS`          | Google app password for the sender account (backend only; keep out of Git) |

For the frontend, create a `.env` file in the `frontend/` directory:

| Variable Name          | Description                         |
|------------------------|-------------------------------------|
| `VITE_STREAM_API_KEY`  | Vite-exposed Stream API public key  |

---

## Password recovery

The login page includes **Forgot password?**. Users request a reset link by email, then set and confirm their new password. Links expire after 15 minutes, are single-use, and are replaced by newer links. A successful reset signs out existing sessions. Requests for unknown accounts return the same confirmation as known accounts; each account can receive at most one link per minute.

Password reset emails use Nodemailer with Gmail. Set `EMAIL_USER`, `EMAIL_PASS`, and `CLIENT_URL` in the ignored `backend/.env` file or the hosting service's private environment settings. `EMAIL_PASS` must be a [Google app password](https://support.google.com/accounts/answer/185833); remove the spaces Google displays between groups. Use an HTTPS `CLIENT_URL` in production. Never commit email credentials.

**Hosting requirement:** Gmail SMTP uses port 465. [Render Free blocks outbound SMTP ports 25, 465, and 587](https://render.com/docs/free), so this setup requires hosting that permits SMTP. Changing environment variables on Render Free does not remove that restriction.

Missing email configuration returns a clear service-unavailable response without affecting login. Delivery failures are logged without credentials or reset tokens; users can request a new link. Pending delivery is handled in the running backend process, so a process restart during delivery may require requesting another link.

The raw reset token is sent only in the email and kept in the URL fragment so it is not sent in HTTP request URLs. MongoDB stores its SHA-256 hash. Password hashes and reset metadata are excluded from user responses. No real email is sent by the automated tests.

Run `npm test` for the authentication regression checks and `npm run build --prefix frontend` for the production frontend build.

## Browser push notifications

The bell-plus button in the signed-in navigation enables browser push. Permission is requested only after clicking it. The same button disables push; logout unlinks the current browser and clears its notification binding. Different accounts sharing a browser cannot see each other's queued notifications. Subscriptions are private, tied to the signed-in user, and removed when the browser push service reports that they expired.

Events covered: friend requests sent/received/accepted; new conversations; new, edited, deleted and read messages; reactions added/changed/removed; conversation/member changes; video call invitations and participants joining/leaving; typing start/stop; friends coming online/offline; account creation/sign-in/sign-out; profile updates; password reset requests and completed changes. Typing is reported once per burst and stops after three seconds of inactivity. Presence uses a 30-second heartbeat, supports multiple tabs/devices, and marks missed disconnects offline after a 90-second lease plus the cleanup interval (up to 30 seconds). Browser/OS notification settings still control whether notifications appear or make a sound.

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in the backend environment. `VAPID_SUBJECT` should be a contact such as `mailto:you@example.com`. Generate the pair once with `npx --prefix backend web-push generate-vapid-keys`; keep the private key out of Git, and keep the same pair across redeploys. The frontend obtains only the public key from the authenticated configuration endpoint. No frontend secrets or Firebase account are needed. Web Push uses HTTPS and works with Render Free independently of Gmail SMTP restrictions.

After deploying the backend, configure Stream to forward chat events to the signed webhook endpoint:

```sh
npm run configure:push --prefix backend -- https://video-calling-chat-app.onrender.com/api/notifications/stream-webhook
```

This setup command preserves existing Stream event hooks. It must target a deployed backend containing this route. The handler verifies the raw request's Stream signature, restricts notifications to the channel's friends, and retries transient push failures via Stream's webhook retries. Messages and read receipts need this webhook for background delivery. Typing and call/presence activity are reported by the authenticated app. A call tab closed abruptly may miss its leave event; its presence still expires normally. The service worker remembers the last 100 event IDs to suppress webhook retries and replaces repeated activity notifications by tag.

Use HTTPS in production or localhost during development. On iOS/iPadOS, install the site to the Home Screen and enable notifications from the installed app. Push delivery also requires the browser/OS push service to be available. Automated push tests mock the transport and never send messages to real user devices.
