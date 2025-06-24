
# Video Calling Chat App – Real-Time Communication Platform

This is a full-stack MERN (MongoDB, Express, React, Node.js) application that allows users to register, connect with friends, and engage in one-on-one video calls with real-time chat and screen sharing. Built using WebRTC and Socket.IO, it provides a seamless communication experience directly in the browser without needing any external software.

# Who it’s for:
- Developers exploring real-time peer-to-peer communication.
- Startups and teams looking for a basic video chat MVP.
- Students or engineers building portfolio projects.
- Anyone who wants to learn WebRTC and real-time app development.


## 📡 API Endpoints Overview

| Method | Endpoint                     | Description                   | Auth Required |
|--------|------------------------------|-------------------------------|---------------|
| POST   | `/api/auth/register`         | Register a new user           | ❌            |
| POST   | `/api/auth/login`            | Login and receive JWT token   | ❌            |
| GET    | `/api/user/me`               | Get authenticated user info   | ✅            |
| POST   | `/api/friends/request/:id`   | Send a friend request         | ✅            |
| PUT    | `/api/friends/accept/:id`    | Accept a friend request       | ✅            |
| GET    | `/api/friends/list`          | Retrieve list of user friends | ✅            |





## Acknowledgements

 - [Awesome Readme Templates](https://awesomeopensource.com/project/elangosundar/awesome-README-templates)
 - [Awesome README](https://github.com/matiassingers/awesome-readme)
 - [How to write a Good readme](https://bulldogjob.com/news/449-how-to-write-a-good-readme-for-your-github-project)


## Authors

- [@Yash Trivedi](https://www.github.com/yashtrivedi1234)


## Demo

Insert gif or link to demo

## 🌐 Environment Variables

To run this project, create a `.env` file in the `backend/` directory with the following variables:

| Variable Name         | Description                                      |
|-----------------------|--------------------------------------------------|
| `PORT`                | Port on which the backend server runs (e.g. 5001) |
| `MONGO_URI`           | MongoDB connection string                        |
| `STREAM_API_KEY`      | Stream Chat API public key                       |
| `STREAM_API_SECRET`   | Stream Chat API secret key                       |
| `JWT_SECRET_KEY`      | Secret used to sign and verify JWTs              |

For the frontend, create a `.env` file in the `frontend/` directory:

| Variable Name          | Description                         |
|------------------------|-------------------------------------|
| `VITE_STREAM_API_KEY`  | Vite-exposed Stream API public key  |



## FAQ

#### Question 1

Answer 1

#### Question 2

Answer 2


## Deployment

To deploy this project run

```bash
  npm run deploy
```

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

## 🛠️ Tech Stack

### 🧩 Frontend

| Technology   | Purpose                                 |
|--------------|------------------------------------------|
| **React.js** | Frontend library for building UI         |
| **Vite**     | Fast development server and bundler      |
| **Socket.IO Client** | Real-time WebSocket communication |
| **WebRTC**   | Peer-to-peer audio, video, and screen sharing |
| **Context API & Hooks** | State management and reusability |

---

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

---

### 🌐 Dev Tools & Hosting

| Tool         | Purpose                              |
|--------------|---------------------------------------|
| **Render**   | Backend deployment                    |
| **Vercel** / **Netlify** | Frontend deployment       |
| **Thunder Client / Postman** | API testing           |
| **Git & GitHub** | Version control and collaboration |

## Screenshots

![App Screenshot](https://via.placeholder.com/468x300?text=App+Screenshot+Here)


## Installation

Install my-project with npm

```bash
  npm install my-project
  cd my-project
```
    
## Run Locally

Clone the project

```bash
  git clone https://link-to-project
```

Go to the project directory

```bash
  cd my-project
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  npm run start
```

