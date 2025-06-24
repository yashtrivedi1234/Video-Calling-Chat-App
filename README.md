# 📹 Video Calling Chat App

A full-stack real-time video calling and chat application built with the MERN stack, WebRTC, and Socket.IO. This application enables users to authenticate, send friend requests, initiate peer-to-peer video calls, chat in real-time, and share their screen—all from the browser.

**Live Demo**: [https://video-calling-chat-app.onrender.com](https://video-calling-chat-app.onrender.com)

---

## ✨ Key Features

- 🔐 **User Authentication** – Register, login, and manage sessions with JWT.
- 🤝 **Friend Requests** – Send, receive, and manage friend requests.
- 📞 **One-on-One Video Calling** – Peer-to-peer WebRTC-based calls.
- 💬 **Real-Time Chat** – Exchange instant messages during calls.
- 🖥️ **Screen Sharing** – Present or collaborate with screen sharing.
- 🌐 **Socket.IO Integration** – Real-time signaling and status updates.
- 📱 **Responsive UI** – Optimized for both desktop and mobile devices.

---

## 🛠️ Tech Stack

### Frontend
- **React.js** with Vite
- **Socket.IO Client**
- **WebRTC APIs**
- **Context API & Hooks**

### Backend
- **Node.js**, **Express.js**
- **MongoDB** with **Mongoose**
- **Socket.IO Server**
- **JWT** for authentication
- **Nodemailer** for notifications

---

## 📁 Project Structure

Video-Calling-Chat-App/
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── socket.js
│   └── server.js
│
└── frontend/
├── src/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── pages/
│   ├── App.jsx
│   └── main.jsx

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB URI (local or MongoDB Atlas)

### Installation

```bash
git clone https://github.com/yashtrivedi1234/Video-Calling-Chat-App.git
cd Video-Calling-Chat-App

Install backend dependencies:

cd backend
npm install

Install frontend dependencies:

cd ../frontend
npm install

Create a .env file in the backend/ directory:

PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret


⸻

Run the Application

In two separate terminals:

# Terminal 1 - Backend
cd backend
npm run start

# Terminal 2 - Frontend
cd frontend
npm run dev

Visit: http://localhost:5173

⸻

🔐 Authentication Flow
	•	Passwords are hashed using bcryptjs.
	•	JWT token is issued upon login and stored in localStorage.
	•	All protected routes validate the token before access.

⸻

📡 WebRTC Call Flow
	1.	User connects to Socket.IO server after login.
	2.	When initiating a call, the app sends an SDP offer through socket signaling.
	3.	The receiving peer sends back an SDP answer.
	4.	ICE candidates are exchanged for NAT traversal.
	5.	Direct P2P connection is established for video, audio, and screen data.

⸻

🔄 API Endpoints Overview

Method	Endpoint	Description	Auth Required
POST	/api/auth/register	Register a new user	❌
POST	/api/auth/login	Login and get token	❌
GET	/api/user/me	Get authenticated user info	✅
POST	/api/friends/request/:id	Send friend request	✅
PUT	/api/friends/accept/:id	Accept friend request	✅
GET	/api/friends/list	Get user’s friend list	✅

⚠️ Additional WebSocket events handle call signaling, messaging, and online status.

⸻

📷 UI Snapshots

Add screenshots or screen recordings here to show login, call interface, chat, screen sharing, etc.

Example:

Login Page

Video Call in Action


⸻

🧪 Testing
	•	Use multiple browser tabs or devices to simulate different users.
	•	For WebSocket activity, inspect the browser console and server logs.
	•	Use browser permissions to allow mic and camera.

⸻

🧱 Deployment
	•	Frontend: Deploy to Vercel, Netlify, or GitHub Pages
	•	Backend: Deploy to Render, Railway, or Heroku
	•	Make sure to update your environment variables and client URLs

⸻

📌 Roadmap
	•	Group video calling
	•	Typing indicators in chat
	•	Video call history and logs
	•	Push notifications via service workers

⸻

🤝 Contribution Guidelines
	1.	Fork the repository
	2.	Create a feature branch (git checkout -b feat/your-feature)
	3.	Commit your changes (git commit -m "Add: your feature")
	4.	Push to the branch (git push origin feat/your-feature)
	5.	Open a Pull Request

⸻

📄 License

This project is licensed under the MIT License.

⸻

🙋‍♂️ Author

Yash Trivedi
GitHub: @yashtrivedi1234
Email: yashtrivedi.dev@gmail.com

---

✅ You can now paste this entire content into your `README.md` file in the root of your GitHub repo for a professional presentation. If you'd like me to add **badges**, **real screenshots**, or a **demo walkthrough video**, just let me know!
