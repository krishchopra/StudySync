import React, { useState } from "react";
import { Socket } from "socket.io-client";
import QuizComponent from "./QuizComponent";

type QuizButtonProps = {
  sessionId: string;
  socket: Socket | null;
  currentSectionIndex: number;
  sectionsLength: number;
  onQuizGenerate: () => void;
};

const QuizButton: React.FC<QuizButtonProps> = ({
  sessionId,
  socket,
  currentSectionIndex,
  sectionsLength,
  onQuizGenerate,
}) => {
  const [isQuizActive, setIsQuizActive] = useState(false);

  const handleGenerateQuiz = () => {
    if (socket) {
      onQuizGenerate(); // call this function to trigger loading state
      socket.emit("generateQuiz", sessionId, currentSectionIndex);
      setIsQuizActive(true);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleGenerateQuiz}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full"
      >
        Quiz for Section {currentSectionIndex + 1}
      </button>
      <p className="mt-2 text-gray-600">
        Quizzes remaining: {sectionsLength - currentSectionIndex}
      </p>
      {isQuizActive && <QuizComponent />}
    </div>
  );
};

export default QuizButton;
