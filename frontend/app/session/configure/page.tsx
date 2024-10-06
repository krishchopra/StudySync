"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import io from "socket.io-client";

export default function ConfigureSession() {
  const [studyNotes, setStudyNotes] = useState("");
  const [quizInterval, setQuizInterval] = useState(15);
  const [questionsPerQuiz, setQuestionsPerQuiz] = useState(5);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const socketUrl =
        process.env.NODE_ENV === "production"
          ? "https://studysync-lg2d.onrender.com"
          : "http://localhost:3001";
      const newSocket = io(socketUrl);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Server timeout"));
        }, 20000); // 20 seconds timeout

        newSocket.on("connect", () => {
          newSocket.emit("createRoom", newSessionId, {
            studyNotes,
            quizInterval,
            questionsPerQuiz,
          });
        });

        newSocket.on("sectionsCreated", (sections) => {
          console.log("Sections created:", sections);
          clearTimeout(timeout);
          resolve(sections);
        });

        newSocket.on("roomCreated", (roomId) => {
          clearTimeout(timeout);
          resolve(roomId);
        });

        newSocket.on("roomError", (errorMessage) => {
          clearTimeout(timeout);
          reject(new Error(errorMessage));
        });
      });

      // If we get here, the room was created successfully and sections were generated
      router.push(`/session/${newSessionId}?created=true`);
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create session. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-blue-800 mb-6">Configure Study Session</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="studyNotes" className="block text-sm font-medium text-gray-700">
              Study Notes
            </label>
            <textarea
              id="studyNotes"
              value={studyNotes}
              onChange={(e) => setStudyNotes(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
              rows={5}
              required
            />
          </div>
          <div>
            <label htmlFor="quizInterval" className="block text-sm font-medium text-gray-700">
              Quiz Interval (minutes)
            </label>
            <input
              type="number"
              id="quizInterval"
              value={quizInterval}
              onChange={(e) => setQuizInterval(Math.min(45, Math.max(2, parseInt(e.target.value))))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
              min={2}
              max={45}
              required
            />
          </div>
          <div>
            <label htmlFor="questionsPerQuiz" className="block text-sm font-medium text-gray-700">
              Questions per Quiz
            </label>
            <input
              type="number"
              id="questionsPerQuiz"
              value={questionsPerQuiz}
              onChange={(e) => setQuestionsPerQuiz(Math.min(15, Math.max(5, parseInt(e.target.value))))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
              min={5}
              max={15}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full text-lg transition duration-300 transform hover:scale-105 disabled:opacity-50"
          >
            {isCreating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating...
              </div>
            ) : (
              "Create Session"
            )}
          </button>
        </form>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
