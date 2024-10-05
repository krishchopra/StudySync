import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.get("/", (_req, res) => {
  res.send("Welcome to the StudySync backend server!");
});
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? "http://localhost:3000" // edit this to be the frontend url when deployed!
        : "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 3001;

io.on("connection", (socket) => {
  console.log("A user connected");
});

server.listen(port, () => {
  console.log(`Server running on port ${port}!`);
});
