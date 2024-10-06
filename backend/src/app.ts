import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/", (_req, res) => {
  res.send("Welcome to the StudySync backend server!");
});

app.get("/check-room/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const roomExists = rooms.has(roomId);
  res.json({ exists: roomExists });
});

app.get("/open-rooms", (_req, res) => {
  const openRooms = Array.from(rooms.keys());
  res.json({ rooms: openRooms });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? "https://www.studysync.study"
        : "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 3001;

const rooms = new Map();

function generateRoomId() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createRoom", (roomId, sessionConfig) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { 
        users: new Map(),
        studyNotes: sessionConfig.studyNotes,
        quizInterval: sessionConfig.quizInterval,
        questionsPerQuiz: sessionConfig.questionsPerQuiz
      });
      socket.join(roomId);
      socket.emit("roomCreated", roomId);
    } else {
      socket.emit("roomError", "Room already exists");
    }
  });

  socket.on("joinRoom", (roomId) => {
    if (rooms.has(roomId)) {
      socket.join(roomId);
      socket.emit("roomJoined", roomId);
    } else {
      socket.emit("roomError", "Room does not exist!");
    }
  });

  socket.on("setName", ({ roomId, name }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).users.set(socket.id, { name, points: 0 });
      console.log(`User ${socket.id} set name to ${name} in room ${roomId}`);
      updateLeaderboard(roomId);
    }
  });

  socket.on("sendMessage", ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (room) {
      const userName = room.users.get(socket.id)?.name || "Anonymous";
      const broadcastMessage = {
        id: message.id,
        text: `${userName}: ${message.text}`,
      };
      console.log("Broadcasting message:", broadcastMessage);
      io.to(roomId).emit("chatMessage", broadcastMessage);
    }
  });

  socket.on("updatePoints", ({ roomId, points }) => {
    console.log("Received updatePoints event:", { roomId, points });
    if (rooms.has(roomId) && typeof points === 'number' && !isNaN(points)) {
      const room = rooms.get(roomId);
      const user = room.users.get(socket.id);
      if (user) {
        console.log("Before update - User points:", user.points);
        user.points = points;
        console.log("After update - User points:", user.points);
        updateLeaderboard(roomId);
      } else {
        console.log("User not found in room");
      }
    } else {
      console.log("Room not found or invalid points value");
    }
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        updateLeaderboard(roomId);
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted due to no participants`);
          io.emit("roomDeleted", roomId);
        }
      }
    });
  });
});

function updateLeaderboard(roomId: string) {
  console.log("Updating leaderboard for room:", roomId);
  const room = rooms.get(roomId);
  if (room) {
    const leaderboard = Array.from(room.users.entries()).map(([socketId, user]) => ({
      id: socketId,
      name: user.name,
      points: user.points
    }));
    console.log("Leaderboard data:", leaderboard);
    io.to(roomId).emit("updateLeaderboard", leaderboard);
  }
}

server.listen(port, () => {
  console.log(`Server running on port ${port}!`);
});