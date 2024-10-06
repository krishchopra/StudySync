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
import Sections from "@/app/components/Sections";
import QuizButton from "@/app/components/QuizButton";
import QuizComponent from "@/app/components/QuizComponent";

type ChatMessage = {
  id: string;
  text: string;
};

type Player = {
  id: string;
  name: string;
  points: number;
};

type Section = {
  id: string;
  name: string;
  description: string;
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
  const [quiz, setQuiz] = useState<{
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: string;
    }>;
  }>({ questions: [] });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);

  const moveToNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex((prevIndex) => prevIndex + 1);
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on("quizGenerated", (generatedQuiz) => {
        console.log("Quiz received:", generatedQuiz);
        setQuiz(generatedQuiz);
        setIsQuizActive(true);
        setCurrentQuestionIndex(0);
        setTimeLeft(15);
        setIsQuizLoading(false);
      });

      socket.on("quizError", (message) => {
        toast.error(message);
        setIsQuizLoading(false);
      });

      socket.on("sectionsUpdated", (updatedSections: Section[]) => {
        setSections(updatedSections);
      });

      return () => {
        socket.off("quizGenerated");
        socket.off("quizError");
        socket.off("sectionsUpdated");
      };
    }
  }, [socket]);

  useEffect(() => {
    if (isQuizActive && quiz && quiz.questions) {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            if (currentQuestionIndex < quiz.questions.length - 1) {
              setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
              return 15;
            } else {
              setIsQuizActive(false);
              clearInterval(timer);
              moveToNextSection();
              return 0;
            }
          }
          return prevTime - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isQuizActive, currentQuestionIndex, quiz, moveToNextSection]);

  const handleQuizGenerate = () => {
    setIsQuizLoading(true);
    if (socket) {
      socket.emit("generateQuiz", sessionId, currentSectionIndex);
    }
  };

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

    newSocket.on("quizGenerated", (generatedQuiz) => {
      console.log("Received quiz:", generatedQuiz);
      setQuiz(generatedQuiz);
      setIsQuizActive(true);
      setCurrentQuestionIndex(0);
      setTimeLeft(15);
      setIsQuizLoading(false);
    });

    newSocket.on("quizError", (message) => {
      toast.error(message);
    });

    newSocket.on("sectionsUpdated", (updatedSections: Section[]) => {
      setSections(updatedSections);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6 flex">
        <div className="flex-grow mr-6">
          <h1 className="text-3xl font-bold text-blue-800 mb-6">
            Study Session
          </h1>
          <p className="text-xl mb-4 text-black">
            Session ID: <span className="font-bold">{sessionId}</span>
          </p>

          <div className="mb-6">
            {socket && (
              <VideoCamera
                socket={socket}
                roomId={sessionId as string}
                onPointsUpdate={(points) => {
                  socket.emit("updatePoints", { roomId: sessionId, points });
                }}
              />
            )}
          </div>

          {isQuizLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : isQuizActive ? (
            <QuizComponent
              onQuizComplete={() => {
                setIsQuizActive(false);
                moveToNextSection();
              }}
            />
          ) : (
            <div className="flex flex-col items-center">
              <button
                onClick={handleQuizGenerate}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full"
                disabled={currentSectionIndex >= sections.length}
              >
                Quiz for Section {currentSectionIndex + 1}
              </button>
              <p className="mt-2 text-gray-600">
                Quizzes remaining: {sections.length - currentSectionIndex}
              </p>
            </div>
          )}
        </div>

        <div className="w-1/3 space-y-6">
          <Leaderboard players={players} />
          <div>
            <h2 className="text-2xl font-bold text-blue-800 mb-4">Chat</h2>
            <div className="h-48 overflow-y-auto border rounded p-4 mb-4">
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
          <Sections sessionId={sessionId as string} socket={socket} />
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
