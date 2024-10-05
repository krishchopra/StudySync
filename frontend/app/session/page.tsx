"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import io from "socket.io-client";

export default function SessionLanding() {
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [justCreated, setJustCreated] = useState(false);
  const router = useRouter();

  const createSession = async () => {
    setIsCreating(true);
    try {
      const newSessionId = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      const newSocket = io("http://localhost:3001");

      newSocket.on("connect", () => {
        newSocket.emit("createRoom", newSessionId);
      });

      newSocket.on("roomCreated", (roomId) => {
        router.push(`/session/${roomId}?created=true`);
      });

      newSocket.on("roomError", (errorMessage) => {
        toast.error(errorMessage);
      });
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create session. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const joinSession = async () => {
    if (!sessionId) {
      toast.error("Please enter a session ID");
      return;
    }

    setIsJoining(true);

    try {
      const response = await fetch(
        `http://localhost:3001/check-room/${sessionId}`
      );
      const data = await response.json();

      if (data.exists) {
        await router.push(`/session/${sessionId}`);
      } else {
        toast.error("Invalid session ID. Please try again.");
      }
    } catch (error) {
      console.error("Error joining session:", error);
      toast.error("Failed to join session. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-blue-800 mb-6">Study Session</h1>
        <p className="text-xl mb-8">
          Create a new session or join an existing one.
        </p>

        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={createSession}
            disabled={isCreating}
            className="w-[380px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full text-lg transition duration-300 transform hover:scale-105 disabled:opacity-50"
          >
            {isCreating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating...
              </div>
            ) : (
              "Create New Session"
            )}
          </button>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              placeholder="Enter Session ID"
              className="flex-grow border-2 border-purple-300 rounded-full px-4 py-2 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={joinSession}
              disabled={isJoining}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full text-lg transition duration-300 transform hover:scale-105 disabled:opacity-50"
            >
              {isJoining ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Joining...
                </div>
              ) : (
                "Join Session"
              )}
            </button>
          </div>
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
