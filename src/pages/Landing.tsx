import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

// Demo chat messages for the preview
const demoMessages = [
  {
    role: 'assistant',
    content: 'Hi there! I\'m your AI travel assistant. Where would you like to go on your next adventure?'
  },
  {
    role: 'user',
    content: 'I\'d like to plan a trip to Paris for next month.'
  },
  {
    role: 'assistant',
    content: 'Paris is a wonderful choice! When are you planning to visit and how many days will you stay?'
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl font-medium text-gray-900">AI Travel Assistant</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link to="/features" className="text-sm text-gray-500 hover:text-gray-900">Features</Link>
            <Link to="/about" className="text-sm text-gray-500 hover:text-gray-900">About</Link>
            <Link to="/auth">
              <Button variant="outline" className="rounded-full px-6">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight"
            >
              Plan your perfect trip with AI
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-xl text-gray-500 max-w-lg"
            >
              Experience travel planning reimagined. Our AI assistant creates personalized itineraries tailored to your preferences in seconds.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-10"
            >
              <Link to="/auth">
                <Button size="lg" className="bg-black hover:bg-gray-800 text-white rounded-full px-8 py-6 text-lg flex items-center">
                  Start Planning
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Chat Showcase */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200"
          >
            <div className="bg-gray-100 px-6 py-3 border-b border-gray-200 flex items-center">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <span className="ml-4 text-sm font-medium text-gray-700">AI Travel Assistant</span>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {demoMessages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + (index * 0.3) }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-xs md:max-w-sm rounded-2xl px-4 py-3 ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white ml-12' 
                          : 'bg-gray-200 text-gray-900 mr-12'
                      }`}
                    >
                      {message.content}
                    </div>
                  </motion.div>
                ))}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.0 }}
                  className="flex items-center mt-4 border-t border-gray-200 pt-4"
                >
                  <input 
                    type="text" 
                    placeholder="Ask about your next destination..." 
                    className="flex-1 p-2 border-none focus:ring-0 text-sm bg-gray-100 rounded-full px-4"
                  />
                  <button className="ml-2 p-2 rounded-full bg-blue-500 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Designed for effortless travel planning</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: 'AI-Powered Itineraries',
              description: 'Our intelligent assistant creates personalized travel plans based on your preferences and interests.',
              icon: '✨'
            },
            {
              title: 'Real-Time Recommendations',
              description: 'Get up-to-date suggestions for attractions, restaurants, and activities from TripAdvisor and Google Maps.',
              icon: '🗺️'
            },
            {
              title: 'Smart Scheduling',
              description: 'Optimize your days with intelligent time management that considers location, opening hours, and travel time.',
              icon: '⏱️'
            }
          ].map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 * index }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="bg-black rounded-3xl px-6 py-12 md:py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to plan your next adventure?</h2>
          <p className="text-gray-300 max-w-2xl mx-auto mb-8">
            Join thousands of travelers who have simplified their trip planning with our AI assistant.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-white hover:bg-gray-100 text-black rounded-full px-8 py-6 text-lg">
              Get Started for Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Product</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="/features" className="text-base text-gray-500 hover:text-gray-900">Features</Link></li>
              <li><Link to="/pricing" className="text-base text-gray-500 hover:text-gray-900">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Support</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="/help" className="text-base text-gray-500 hover:text-gray-900">Help Center</Link></li>
              <li><Link to="/contact" className="text-base text-gray-500 hover:text-gray-900">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Company</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="/about" className="text-base text-gray-500 hover:text-gray-900">About</Link></li>
              <li><Link to="/careers" className="text-base text-gray-500 hover:text-gray-900">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Legal</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="/privacy" className="text-base text-gray-500 hover:text-gray-900">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-base text-gray-500 hover:text-gray-900">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-200 pt-8">
          <p className="text-base text-gray-400 text-center">
            &copy; {new Date().getFullYear()} AI Travel Assistant. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
} 