"use client";

import { useState, useEffect, useRef } from "react";

export default function VideoCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [apiResponse, setApiResponse] = useState<string>("");

  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      const intervalId = setInterval(() => {
        captureAndSendFrame();
      }, 1000); // send a frame every second

      return () => clearInterval(intervalId);
    }
  }, [stream]);

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
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error sending frame to backend:", error);
      setApiResponse("Error: Failed to get response from backend");
    }
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
        <h3 className="text-lg font-semibold mb-2">User Attention:</h3>
        <pre className="whitespace-pre-wrap">{apiResponse}</pre>
      </div>
    </div>
  );
}
