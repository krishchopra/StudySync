"use client";

import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";

type AttentionState =
  | "Paying attention!"
  | "Taking notes..."
  | "Thinking!"
  | "Distracted..."
  | "Distracted #2...";

export default function VideoCamera({
  socket,
  roomId,
}: {
  socket: Socket;
  roomId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [apiResponse, setApiResponse] =
    useState<AttentionState>("Paying attention!");
  const [points, setPoints] = useState(0);
  const [attentionStates, setAttentionStates] = useState<AttentionState[]>([]);

  const stateColorMap = {
    "Paying attention!": "text-green-300",
    "Taking notes...": "text-blue-300",
    "Thinking!": "text-yellow-300",
    "Distracted...": "text-red-300",
    "Distracted #2...": "text-red-300",
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // start capturing frames after the stream is set up
        intervalId = setInterval(() => {
          captureAndSendFrame();
        }, 1000);
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    }

    setupCamera();

    const pointsIntervalId = setInterval(() => {
      calculateAndSendPoints();
    }, 10000);

    return () => {
      clearInterval(intervalId);
      clearInterval(pointsIntervalId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, socket]); // remove 'stream' from dependencies

  const captureAndSendFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      const frameData = canvas.toDataURL("image/jpeg");
      sendFrameToBackend(frameData);
    }
  };

  const sendFrameToBackend = async (frameData: string) => {
    const url =
      process.env.NODE_ENV === "production"
        ? "https://studysync-image-processing.onrender.com/process_video/"
        : "http://localhost:8000/process_video/";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: frameData.split(",")[1] }), // extract base64 part only
      });
      const data = await response.json();
      const newState = data.state as AttentionState;
      console.log("Received state from backend:", newState);
      setApiResponse(newState);
      setAttentionStates(prevStates => {
        const newStates = [...prevStates, newState];
        console.log("Updated attentionStates:", newStates);
        return newStates.slice(-10); // keep only the last 10 states
      });
    } catch (error) {
      console.error("Error sending frame to backend:", error);
      setApiResponse("Failed to get response from backend" as AttentionState);
    }
  };

  const calculateAndSendPoints = () => {
    console.log("attentionStates:", attentionStates);
    const lastTenStates = attentionStates.slice(-10);
    const stateCounts = lastTenStates.reduce((acc, state) => {
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {} as Record<AttentionState, number>);

    const attentionPercentage = (stateCounts["Paying attention!"] || 0) / 10;
    const thinkingPercentage = (stateCounts["Thinking!"] || 0) / 10;
    const distractionPercentage =
      ((stateCounts["Distracted..."] || 0) +
        (stateCounts["Distracted #2..."] || 0)) /
      10;

    let pointsEarned = Math.round(attentionPercentage * 10);

    if (distractionPercentage > 0) {
      pointsEarned -= Math.round(thinkingPercentage * 5);
    } else {
      pointsEarned += Math.round(thinkingPercentage * 5);
    }

    pointsEarned -= Math.round(distractionPercentage * 10);

    setPoints((prevPoints) => prevPoints + pointsEarned);
    console.log("Sending points update:", { roomId, points: pointsEarned });
    socket.emit("updatePoints", { roomId, points: pointsEarned });

    setAttentionStates([]);
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-auto rounded-lg transform scale-x-[-1]"
      />
      <div className="mt-4 p-4 bg-black rounded-lg">
        <h3 className="text-lg font-semibold mb-2">
          User Attention:{" "}
          <span className={`font-medium ${stateColorMap[apiResponse]}`}>
            {apiResponse}
          </span>
        </h3>
        <p className="text-white">Points: {points}</p>
      </div>
    </div>
  );
}
