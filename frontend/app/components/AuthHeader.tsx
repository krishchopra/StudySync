"use client";

import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import Link from "next/link";

export default function AuthHeader() {
  const { user } = useUser();

  return (
    <header className="bg-blue-600 shadow-md p-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-white">
          StudySync
        </Link>
        <div className="flex items-center space-x-4">
          <SignedIn>
            <div className="flex items-center space-x-2">
              {/* {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              )} */}
              <span className="text-white mr-1">{user?.fullName}</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-white text-blue-600 font-bold py-2 px-5 rounded-full transition duration-200 transform hover:scale-105 disabled:opacity-50">
                Sign In / Sign Up
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
