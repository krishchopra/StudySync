import React, { useState, useEffect } from 'react';

const quiz = {
  questions: [
    {
      question: 'What is a hypothesis in the context of organizational behaviour research?',
      options: [
        'A statement that describes a variable',
        'A testable prediction about the relationship between variables',
        'A conclusion drawn from data analysis',
        'An assumption made without evidence'
      ],
      correctAnswer: 'A testable prediction about the relationship between variables'
    },
    {
      question: 'Which type of variable is manipulated to observe its effect on another variable?',
      options: [
        'Dependent variable',
        'Independent variable',
        'Mediating variable',
        'Moderating variable'
      ],
      correctAnswer: 'Independent variable'
    },
    {
      question: 'What distinguishes a moderating variable from a mediating variable?',
      options: [
        'Moderators affect the strength of the relationship, while mediators explain the relationship',
        'Moderators are always independent, while mediators are dependent',
        'Moderators are used in qualitative research, while mediators are used in quantitative research',
        'Moderators can only be demographic variables, while mediators cannot'
      ],
      correctAnswer: 'Moderators affect the strength of the relationship, while mediators explain the relationship'
    },
    {
      question: 'In organizational behaviour research, what is the purpose of identifying dependent variables?',
      options: [
        'To determine what influences other variables',
        'To predict future organizational outcomes',
        'To assess the credibility of the research',
        'To establish control groups'
      ],
      correctAnswer: 'To determine what influences other variables'
    },
    {
      question: 'What is the primary focus of organizational behavior?',
      options: [
        'The study of individual and group behavior in organizational settings',
        'The analysis of financial performance in organizations',
        'The development of new technologies for business',
        'The implementation of marketing strategies'
      ],
      correctAnswer: 'The study of individual and group behavior in organizational settings'
    }
  ]
};

const QuizComponent: React.FC = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const currentQuestion = quiz.questions[currentQuestionIndex];

  useEffect(() => {
    if (timeLeft === 0) {
      const timer = setTimeout(() => {
        if (currentQuestionIndex < quiz.questions.length - 1) {
          setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
          setCurrentAnswer(null);
          setTimeLeft(10);
        } else {
          setQuizCompleted(true);
        }
      }, 3000); // 3 seconds delay before moving to the next question

      return () => clearTimeout(timer);
    }
  }, [timeLeft, currentQuestionIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => (prevTime > 0 ? prevTime - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      {!quizCompleted ? (
        <>
          <h2 className="text-2xl font-bold text-blue-800 mb-4">
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </h2>
          <p className="text-xl mb-6 text-black">{currentQuestion.question}</p>
          <ul className="space-y-4">
            {currentQuestion.options.map((option, index) => (
              <li
                key={index}
                className={`bg-gray-100 text-black p-4 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors ${
                  currentAnswer === option ? 'bg-gray-300' : ''
                } ${
                  timeLeft === 0 && option === currentQuestion.correctAnswer
                    ? 'border-2 border-green-500'
                    : ''
                }`}
                onClick={() => setCurrentAnswer(option)}
              >
                {option}
                {timeLeft === 0 && option === currentQuestion.correctAnswer && (
                  <span className="ml-2 text-green-500 font-bold">✓ Correct Answer</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-right text-xl font-semibold text-black">
            {timeLeft > 0 ? `Time left: ${timeLeft} seconds` : "Time's up!"}
          </p>
        </>
      ) : (
        <button
          onClick={() => {
            setCurrentQuestionIndex(0);
            setQuizCompleted(false);
            setTimeLeft(10);
          }}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full"
        >
          Start Next Quiz
        </button>
      )}
    </div>
  );
};

export default QuizComponent;