"use client";

import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";

type AttentionState =
  | "Paying attention!"
  | "Taking notes..."
  | "Thinking!"
  | "Distracted..."
  | "Distracted #2..."
  | "Sleeping..."
  | "On phone!"
  | "Get off phone!";

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
  const [totalPoints, setTotalPoints] = useState(0);
  const [getOffPhoneNotified, setGetOffPhoneNotified] = useState(0);
  const [sleepingNotified, setSleepingNotified] = useState(0); // New state to track sleeping notification
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0); // State to track the last notification time
  const audio = new Audio("/phoneaway.mp3");
  const sleepAudio = new Audio("/sleep2.mp3");
  const alarmAudio = new Audio("/alarm.mp3");
  const mixAudio = new Audio("/mixed.mp3");

  const stateColorMap = {
    "Paying attention!": "text-green-300",
    "Taking notes...": "text-blue-300",
    "Thinking!": "text-yellow-300",
    "Distracted...": "text-red-300",
    "Distracted #2...": "text-red-300",
    "Sleeping...": "text-purple-300",
    "On phone!": "text-red-300",
    "Get off phone!": "text-red-300",
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

        // Start capturing frames after the stream is set up
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
  }, [roomId, socket]);

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
        body: JSON.stringify({ image: frameData.split(",")[1] }), // Extract base64 part only
      });
      const data = await response.json();
      const newState = data.state as AttentionState;
      console.log("Received state from backend:", newState);
      setApiResponse(newState);

      notifyUser(newState);

      let pointsToAdd = 0;
      switch (newState) {
        case "Paying attention!":
          pointsToAdd = 2;
          break;
        case "Taking notes...":
          pointsToAdd = 1;
          break;
        case "Thinking!":
          pointsToAdd = 1;
          break;
        case "Distracted...":
        case "Distracted #2...":
          pointsToAdd = -2;
          break;
        case "On phone!":
          pointsToAdd = -4;
          break;
        case "Get off phone!":
          pointsToAdd = -6;
          break;
        case "Sleeping...":
          pointsToAdd = -5; // You can adjust points for sleeping as needed
          break;
        default:
          pointsToAdd = 0;
          break;
      }

      setTotalPoints((prevPoints) => {
        const newTotalPoints = prevPoints + pointsToAdd;
        console.log("Sending points update:", {
          roomId,
          points: newTotalPoints,
        });
        socket.emit("updatePoints", { roomId, points: newTotalPoints });
        return newTotalPoints;
      });

      setAttentionStates((prevStates) => [...prevStates, newState]);

      if (newState !== "Get off phone!") {
        setGetOffPhoneNotified(0);
      } else {
        setGetOffPhoneNotified((val) => val + 1);
      }

      if (newState !== "Sleeping...") {
        setSleepingNotified(0);
      } else {
        setSleepingNotified((val) => val + 1);
      }
    } catch (error) {
      console.error("Error sending frame to backend:", error);
      setApiResponse("Failed to get response from backend" as AttentionState);
    }
  };

  const notifyUser = (newState: AttentionState) => {
    const now = Date.now();
    const timeElapsed = (now - lastNotificationTime) / 1000; // Convert to seconds

    // Notify for "Get off phone!" if the user hasn't been notified yet
    if (newState === "Get off phone!" && getOffPhoneNotified === 0 && timeElapsed > 20) {
      console.log("Sending notification for 'Get off phone!'");
      audio.play();
      const notification = new Notification("GET OFF YOUR PHONE!", {
        body: `Break time will come, study for now`,
        icon: "../icon.ico",
      });

      notification.onclick = () => {
        window.focus();
      };

      setLastNotificationTime(now); // Update the last notification time
    }

    // Notify for "Sleeping..." if the user hasn't been notified yet
    if (newState === "Sleeping..." && sleepingNotified === 0 && timeElapsed > 20) {
      console.log("Sending notification for 'Sleeping...'");
      alarmAudio.play();
      sleepAudio.play();
      // mixAudio.play();
      const notification = new Notification("Wakey Wakey", {
        body: `It seems like you are sleeping. Please stay alert!`,
        icon: "../icon.ico",
      });

      notification.onclick = () => {
        window.focus();
      };

      setLastNotificationTime(now); // Update the last notification time
    }
  };

  const calculateAndSendPoints = () => {
    console.log("attentionStates:", attentionStates);
    const lastTenStates = attentionStates;
    const stateCounts = lastTenStates.reduce((acc, state) => {
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {} as Record<AttentionState, number>);

    console.log("stateCounts:", stateCounts);

    let pointsEarned = 0;
    pointsEarned += (stateCounts["Paying attention!"] || 0) * 2; // Add 2 points for paying attention
    pointsEarned += (stateCounts["Thinking!"] || 0) * 1; // Add 1 point for thinking
    pointsEarned -= (stateCounts["Distracted..."] || 0) * 2; // Subtract 2 points for being distracted
    pointsEarned -= (stateCounts["Distracted #2..."] || 0) * 2; // Subtract 2 points for being distracted

    console.log("Points earned:", pointsEarned);

    setTotalPoints((prevPoints) => {
      const newTotalPoints = prevPoints + pointsEarned;
      console.log("Sending points update:", { roomId, points: newTotalPoints });
      if (!isNaN(newTotalPoints)) {
        socket.emit("updatePoints", { roomId, points: newTotalPoints });
      } else {
        console.error("Invalid points value:", newTotalPoints);
      }
      return isNaN(newTotalPoints) ? prevPoints : newTotalPoints;
    });

    setPoints(pointsEarned);
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
        <h3 className="text-lg font-semibold">
          User Attention:{" "}
          <span className={`font-medium ${stateColorMap[apiResponse]}`}>
            {apiResponse}
          </span>
        </h3>
      </div>
    </div>
  );
}