import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-blue-800 mb-4 pb-4">Welcome to StudySync</h1>
          <p className="text-xl text-gray-600">
            Elevate your study sessions with our collaborative platform. Compete with friends, track attention, and ace your exams!
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">Key Features</h2>
            <ul className="space-y-2">
              {[
                "Create collaborative study sessions",
                "Track attention and earn points",
                "Periodic quizzes and active recall",
                "Customized study plans",
                "Public and private study rooms"
              ].map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-blue-600 rounded-lg shadow-lg p-6 text-white">
            <h2 className="text-2xl font-semibold mb-4">Why StudySync?</h2>
            <p className="mb-4">
              StudySync combines the power of collaboration, gamification, and proven study techniques to help you achieve your academic goals.
            </p>
            <p>
              Join our community of students who have improved their grades and study habits with StudySync!
            </p>
          </div>
        </div>

        <div className="text-center">
          <div className="flex justify-center space-x-4">
            <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full text-lg transition duration-300 transform hover:scale-105">
              Create Session
            </Link>
            <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full text-lg transition duration-300 transform hover:scale-105">
              Join Session
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center font-semibold text-gray-600">
          <p>&copy; 2024 StudySync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
