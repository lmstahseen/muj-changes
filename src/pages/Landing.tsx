import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

export function Landing() {
  const steps = [
    {
      icon: 'solar:users-group-rounded-bold-duotone',
      title: 'Join Community',
      description: 'Find and join communities with shared goals and accountability partners.'
    },
    {
      icon: 'solar:dollar-bold-duotone',
      title: 'Commit Stake',
      description: 'Put your money where your motivation is. Financial commitment drives results.'
    },
    {
      icon: 'solar:videocamera-record-bold-duotone',
      title: 'Attend Meetings',
      description: 'Join mandatory video meetings with screen sharing to track your progress.'
    },
    {
      icon: 'solar:cup-star-bold-duotone',
      title: 'Earn Rewards',
      description: 'Complete your goals and earn back your stake plus rewards from others.'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Software Developer',
      content: 'Mujtama helped me finally complete my side project. The community accountability was exactly what I needed.',
      rating: 5
    },
    {
      name: 'Michael Rodriguez',
      role: 'Entrepreneur',
      content: 'Lost 30 pounds in 3 months thanks to my fitness community. The financial stake kept me motivated.',
      rating: 5
    },
    {
      name: 'Emily Johnson',
      role: 'Writer',
      content: 'Finished my first novel with the help of my writing community. The weekly check-ins were game-changing.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Turn Goals Into
            <span className="block text-primary-600">Achievements</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Join communities, commit stakes, attend video meetings, and achieve your goals through the power of social accountability and financial commitment.
          </p>
          <Link 
            to="/communities" 
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-medium hover:shadow-hover transform hover:translate-y-[-2px]"
          >
            <span>Discover Communities</span>
            <Icon icon="solar:arrow-right-bold-duotone" width={20} />
          </Link>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Simple steps to transform your goals into achievements through community accountability.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center animate-fade-in card p-8" style={{animationDelay: `${index * 0.1}s`}}>
                <div className="w-16 h-16 bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Icon icon={step.icon} width={32} className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Success Stories</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Real people achieving real results through community accountability.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="card p-8 hover:shadow-hover transition-all">
                <div className="flex space-x-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Icon key={i} icon="solar:star-bold" width={16} className="text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-gray-600 text-sm">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Why Choose Mujtama</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform is designed to maximize your chances of success
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-8">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <Icon icon="solar:check-circle-bold-duotone" width={24} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Financial Incentive</h3>
              <p className="text-gray-600">
                Stake your money and earn it back plus more when you achieve your goals. Loss aversion is a powerful motivator.
              </p>
            </div>
            
            <div className="card p-8">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Icon icon="solar:users-group-rounded-bold-duotone" width={24} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Community Support</h3>
              <p className="text-gray-600">
                Connect with like-minded individuals who share your goals and will hold you accountable.
              </p>
            </div>
            
            <div className="card p-8">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Icon icon="solar:videocamera-record-bold-duotone" width={24} className="text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Video Accountability</h3>
              <p className="text-gray-600">
                Regular video check-ins with screen sharing ensure real progress and prevent cheating.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Achieve Your Goals?</h2>
          <p className="text-xl mb-12 max-w-3xl mx-auto opacity-90">
            Join thousands of goal-achievers who are turning their dreams into reality through community accountability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/communities" 
              className="inline-flex items-center justify-center space-x-2 bg-white text-primary-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-all shadow-medium hover:shadow-hover"
            >
              <span>Explore Communities</span>
              <Icon icon="solar:arrow-right-bold-duotone" width={20} />
            </Link>
            <Link 
              to="/create" 
              className="inline-flex items-center justify-center space-x-2 bg-transparent text-white border-2 border-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/10 transition-all"
            >
              <span>Create Your Own</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold mb-4">Mujtama</h3>
              <p className="text-gray-400 mb-6 max-w-md">
                Empowering individuals to achieve their goals through community accountability, financial commitment, and social support.
              </p>
              <div className="flex space-x-4">
                <Icon icon="solar:twitter-bold-duotone" width={20} className="text-gray-400 hover:text-white cursor-pointer transition-colors" />
                <Icon icon="solar:instagram-bold-duotone" width={20} className="text-gray-400 hover:text-white cursor-pointer transition-colors" />
                <Icon icon="solar:youtube-bold-duotone" width={20} className="text-gray-400 hover:text-white cursor-pointer transition-colors" />
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <div className="space-y-2">
                <Link to="/communities" className="block text-gray-400 hover:text-white transition-colors">Communities</Link>
                <Link to="/create" className="block text-gray-400 hover:text-white transition-colors">Create</Link>
                <Link to="/wallet" className="block text-gray-400 hover:text-white transition-colors">Wallet</Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <div className="space-y-2">
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">Help Center</a>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="block text-gray-400 hover:text-white transition-colors">Terms of Service</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Mujtama. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}