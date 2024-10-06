"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import io, { Socket } from "socket.io-client";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import VideoCamera from "@/app/components/VideoCamera";
import Leaderboard from "@/app/components/Leaderboard";

type ChatMessage = {
  id: string;
  text: string;
};

type Player = {
  id: string;
  name: string;
  points: number;
};

export default function Session() {
  const { sessionId } = useParams();
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const router = useRouter();

  useEffect(() => {
    const url =
      process.env.NODE_ENV === "production"
        ? "https://studysync-lg2d.onrender.com"
        : "http://localhost:3001";
    const newSocket = io(url);
    setSocket(newSocket);
  
    newSocket.on("connect", () => {
      console.log("Connected to server");
      if (sessionId && user) {
        newSocket.emit("joinRoom", sessionId);
        newSocket.emit("setName", { roomId: sessionId, name: user.firstName });
      }
    });
  
    newSocket.on("roomJoined", (id) => {
      setRoomId(id);
      const searchParams = new URLSearchParams(window.location.search);
      const created = searchParams.get("created");
      if (created === "true") {
        toast.success("Session created successfully!");
      } else {
        toast.success("Session joined successfully!");
      }

    });
  
    newSocket.on("roomError", (message) => {
      router.push(`/session?error=${encodeURIComponent(message)}`);
    });
  
    newSocket.on("chatMessage", (message: ChatMessage) => {
      console.log("Received message:", message);
      setMessages((prevMessages) => [...prevMessages, message]);

    });
  
    newSocket.on("updateLeaderboard", (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });
  
    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, router, user]);

  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputMessage.trim() && socket && user) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        text: inputMessage,
      };
      socket.emit("sendMessage", { roomId: sessionId, message: newMessage });
      setInputMessage("");
    } else {
      toast.error("Please enter a valid message.");
    }
  };

  const askNotificationPermission = () => {
    Notification.requestPermission().then((result) => {
      console.log("Notification permission result: ", result); // Debug log
      if (result === "granted") {
        toast.success("Notifications enabled!");
      } else {
        toast.warn("You won't receive notifications.");
      }
    });
  };

  const createNotification = (message: string) => {
    const [name, ...messageParts] = message.split(":");
    const body = messageParts.join(":").trim();
    

    const notification = new Notification("Hey, you need to wake up", {
      body: `${name}: ${body}`,
      icon: "../icon.ico",
      badge: "../icon.ico"
    });
  
    notification.onclick = () => {
      window.focus(); // Focus the window when the notification is clicked
    };
  };

  const sendTestNotification = () => {
    console.log("Button clicked"); // Check if the button click is detected
    if (Notification.permission === "granted") {
      console.log("Permission granted, sending notification"); // Check if permission is granted
      createNotification("Test User: This is a test notification.");
    } else {
      console.log("Notification permission not granted"); // If not granted
      toast.warn("You need to enable notifications first.");
      askNotificationPermission();
    }
  };
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6 flex">
        <div className="flex-grow mr-6">
          <h1 className="text-3xl font-bold text-blue-800 mb-6">Study Session</h1>
          <p className="text-xl mb-4 text-black">
            Session ID: <span className="font-bold">{sessionId}</span>
          </p>

          <div className="mb-6">
            {socket && <VideoCamera socket={socket} roomId={sessionId as string} />}
          </div>
        </div>

        <div className="w-1/3 space-y-6">
          <Leaderboard players={players} />

          <div>
            <h2 className="text-2xl font-bold text-blue-800 mb-4">Chat</h2>
            <div className="h-96 overflow-y-auto border rounded p-4 mb-4">
              {messages.map((msg) => {
                const [name, ...messageParts] = msg.text.split(":");
                const message = messageParts.join(":").trim();
                return (
                  <p key={msg.id} className="mb-2 text-black">
                    <strong>{name}:</strong> {message}
                  </p>
                );
              })}
            </div>

            <form onSubmit={handleMessageSubmit}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full p-2 border rounded text-black"
              />
              <button
                type="submit"
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded w-full"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}