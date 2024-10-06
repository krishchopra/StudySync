import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import OpenAI from "openai";

interface Section {
  title: string;
  content: string;
}

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

const rooms = new Map<
  string,
  {
    users: Map<string, { name: string; points: number }>;
    studyNotes: string;
    quizInterval: number;
    questionsPerQuiz: number;
    quiz?: any;
    sections?: Section[];
  }
>();

function generateRoomId() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateSections(studyNotes: string): Promise<Section[]> {
  const prompt = `Create a numbered list of sections based on the following study notes. Each section should have a title and a brief content summary. Format the output as a JSON array of objects with 'title' and 'content' properties.

Study Notes:
${studyNotes}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.error("No content returned from OpenAI");
      return [];
    }

    try {
      const parsedContent = JSON.parse(content);
      if (Array.isArray(parsedContent)) {
        return parsedContent;
      } else {
        console.error("Parsed content is not an array:", parsedContent);
        return [];
      }
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      // Attempt to extract JSON from the response if it's not properly formatted
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          console.error("Failed to extract JSON from response");
          return [];
        }
      }
      return [];
    }
  } catch (error) {
    console.error("Error generating sections:", error);
    return [];
  }
}

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createRoom", async (roomId, sessionConfig) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        studyNotes: sessionConfig.studyNotes,
        quizInterval: sessionConfig.quizInterval,
        questionsPerQuiz: sessionConfig.questionsPerQuiz,
      });
      socket.join(roomId);

      try {
        const sections = await generateSections(sessionConfig.studyNotes);

        rooms.get(roomId).sections = sections;
        socket.emit("sectionsCreated", sections);
        socket.emit("roomCreated", roomId);
      } catch (error) {
        console.error("Error creating sections:", error);
        socket.emit("roomError", "Failed to create sections");
      }
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
    if (rooms.has(roomId) && typeof points === "number" && !isNaN(points)) {
      const room = rooms.get(roomId);
      const user = room.users.get(socket.id);
      if (user) {
        user.points = points;
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

  socket.on("getSections", (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.sections) {
      console.log("Sending sections to client:", room.sections);
      socket.emit("sectionsUpdated", room.sections);
    } else {
      console.log("No sections found for room:", roomId);
      socket.emit("sectionsUpdated", []);
    }
  });

  socket.on("generateQuiz", async (roomId, sectionIndex) => {
    console.log("Generating quiz for room:", roomId, "section:", sectionIndex);
    const room = rooms.get(roomId);
    if (room && room.sections && room.sections[sectionIndex]) {
      try {
        const section = room.sections[sectionIndex];
        const quiz = await createQuiz(section.content, room.questionsPerQuiz, section.title, sectionIndex);
        console.log("Generated quiz:", quiz);
        io.to(roomId).emit("quizGenerated", {
          quiz,
          sectionIndex,
          sectionTitle: section.title,
        });
      } catch (error) {
        console.error("Error generating quiz:", error);
        socket.emit("quizError", "Failed to generate quiz");
      }
    } else {
      socket.emit("quizError", "Invalid section or room");
    }
  });
});

async function createQuiz(
  studyNotes: string,
  numQuestions: number,
  sectionTitle: string,
  sectionIndex: number
): Promise<{
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>;
}> {
  const prompt = `Create a multiple-choice quiz based on the following study notes for the section titled "${sectionTitle}" (Section ${
    sectionIndex + 1
  }). Generate ${numQuestions} questions with 4 options each. Format the output as a JSON array of objects with 'question', 'options', and 'correctAnswer' properties.

Study Notes:
${studyNotes}`;

  console.log("Prompt:", prompt);
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    console.log("OpenAI Response Content:", content);

    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    // Clean the response to remove backticks and json label
    const cleanedContent = content.replace(/```json|```/g, '').trim();

    try {
      const questions = JSON.parse(cleanedContent);
      console.log("Generated quiz:", questions);
      return { questions };
    } catch (error) {
      console.error("Error parsing quiz JSON:", error);
      return { questions: [] };
    }
  } catch (error) {
    console.error("Error creating quiz:", error);
    return { questions: [] };
  }
}

function updateLeaderboard(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    const leaderboard = Array.from(room.users.entries()).map(
      ([socketId, user]) => ({
        id: socketId,
        name: user.name,
        points: user.points,
      })
    );
    io.to(roomId).emit("updateLeaderboard", leaderboard);
  }
}

server.listen(port, () => {
  console.log(`Server running on port ${port}!`);
});