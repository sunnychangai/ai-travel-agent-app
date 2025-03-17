import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { useAuth } from '../../contexts/AuthContext';

export const AuthContainer: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { user, signOut } = useAuth();

  // If user is logged in, show profile/logout
  if (user) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Profile</h2>
        
        <div className="mb-4">
          <p className="text-gray-700">
            <span className="font-medium">Email:</span> {user.email}
          </p>
        </div>
        
        <button
          onClick={() => signOut()}
          className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div>
      {isLogin ? <LoginForm /> : <SignUpForm />}
      
      <div className="mt-4 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 hover:underline focus:outline-none"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}; 