import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import communityService from '../services/communityService';

export function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    goal: '',
    stakeAmount: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    category: '',
    maxMembers: '',
    weeklyMeetingDays: [] as string[],
    totalMinimumHours: '',
    preferredTimePeriod: '',
    description: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [creatorStakePaid, setCreatorStakePaid] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const categories = ['Fitness', 'Coding', 'Learning', 'Business', 'Health', 'Creative'];
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timePeriods = [
    { value: '00:00-03:00', label: '12 AM - 3 AM' },
    { value: '03:00-06:00', label: '3 AM - 6 AM' },
    { value: '06:00-09:00', label: '6 AM - 9 AM' },
    { value: '09:00-12:00', label: '9 AM - 12 PM' },
    { value: '12:00-15:00', label: '12 PM - 3 PM' },
    { value: '15:00-18:00', label: '3 PM - 6 PM' },
    { value: '18:00-21:00', label: '6 PM - 9 PM' },
    { value: '21:00-00:00', label: '9 PM - 12 AM' }
  ];

  // Auto-fill function with random valid data
  const autoFillForm = () => {
    const sampleCommunities = [
      {
        title: '30-Day Coding Challenge',
        goal: 'Code for at least 2 hours daily and build a complete web application using modern frameworks',
        category: 'Coding',
        description: 'Join fellow developers in a month-long coding journey. We\'ll build projects, share progress, and support each other through daily coding sessions. Perfect for improving skills and building portfolio projects.'
      },
      {
        title: 'Morning Fitness Warriors',
        goal: 'Complete a 45-minute workout every morning before 8 AM with proper form and intensity',
        category: 'Fitness',
        description: 'Start your day strong with our morning fitness community. We focus on building consistent exercise habits through accountability and motivation. Includes strength training, cardio, and flexibility work.'
      },
      {
        title: 'Daily Reading Club',
        goal: 'Read for 1 hour daily and finish 2 books this month with detailed notes and discussions',
        category: 'Learning',
        description: 'Expand your knowledge and develop a reading habit. Share insights, discuss books, and track your reading progress with like-minded individuals. Focus on personal development and skill-building books.'
      },
      {
        title: 'Meditation Masters',
        goal: 'Meditate for 20 minutes daily using guided sessions and track mindfulness progress',
        category: 'Health',
        description: 'Develop mindfulness and reduce stress through daily meditation practice. Perfect for beginners and experienced practitioners alike. Includes guided sessions and progress tracking.'
      },
      {
        title: 'Creative Writing Challenge',
        goal: 'Write 500 words daily and complete a short story with character development and plot',
        category: 'Creative',
        description: 'Unleash your creativity and improve your writing skills. Share your work, get feedback, and support fellow writers in their creative journey. Focus on storytelling and narrative techniques.'
      },
      {
        title: 'Entrepreneurship Bootcamp',
        goal: 'Work on business idea for 3 hours daily and create MVP with user testing and feedback',
        category: 'Business',
        description: 'Turn your business idea into reality. Get accountability, feedback, and support from fellow entrepreneurs as you build your startup. Includes market research, product development, and customer validation.'
      }
    ];

    const randomCommunity = sampleCommunities[Math.floor(Math.random() * sampleCommunities.length)];
    
    // Generate random stake amount between $25-$200
    const stakeAmount = (Math.floor(Math.random() * 176) + 25).toString();
    
    // Generate random max members between 5-25
    const maxMembers = (Math.floor(Math.random() * 21) + 5).toString();
    
    // Generate random total minimum hours between 20-100
    const totalMinimumHours = (Math.floor(Math.random() * 81) + 20).toString();
    
    // Generate start date (3-14 days from now)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 12) + 3);
    
    // Generate random start time
    const startHours = Math.floor(Math.random() * 24);
    const startMinutes = Math.random() < 0.5 ? '00' : '30';
    const startTime = `${startHours.toString().padStart(2, '0')}:${startMinutes}`;
    
    // Generate end date (21-60 days after start date)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 40) + 21);
    
    // Generate random end time
    const endHours = Math.floor(Math.random() * 24);
    const endMinutes = Math.random() < 0.5 ? '00' : '30';
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes}`;
    
    // Generate random meeting days (2-4 days)
    const shuffledDays = [...daysOfWeek].sort(() => 0.5 - Math.random());
    const numDays = Math.floor(Math.random() * 3) + 2; // 2-4 days
    const meetingDays = shuffledDays.slice(0, numDays);
    
    // Select random time period
    const randomTimePeriod = timePeriods[Math.floor(Math.random() * timePeriods.length)].value;

    setFormData({
      title: randomCommunity.title,
      goal: randomCommunity.goal,
      stakeAmount,
      startDate: startDate.toISOString().split('T')[0],
      startTime,
      endDate: endDate.toISOString().split('T')[0],
      endTime,
      category: randomCommunity.category,
      maxMembers,
      weeklyMeetingDays: meetingDays,
      totalMinimumHours,
      preferredTimePeriod: randomTimePeriod,
      description: randomCommunity.description
    });

    setSubmitStatus({ type: null, message: '' });
    setShowValidation(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSubmitStatus({ type: null, message: '' });
    
    // Real-time validation feedback
    if (showValidation) {
      validateField(name, value);
    }
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      weeklyMeetingDays: prev.weeklyMeetingDays.includes(day)
        ? prev.weeklyMeetingDays.filter(d => d !== day)
        : [...prev.weeklyMeetingDays, day]
    }));
  };

  const validateField = (name: string, value: any): string | null => {
    switch (name) {
      case 'title':
        if (!value.trim()) return 'Title is required';
        if (value.trim().length < 3) return 'Title must be at least 3 characters';
        if (value.trim().length > 100) return 'Title must be less than 100 characters';
        break;
      case 'goal':
        if (!value.trim()) return 'Goal is required';
        if (value.trim().length < 10) return 'Goal must be at least 10 characters';
        if (value.trim().length > 500) return 'Goal must be less than 500 characters';
        break;
      case 'stakeAmount':
        const stake = parseFloat(value);
        if (!value || stake < 10) return 'Stake must be at least $10';
        if (stake > 1000) return 'Stake cannot exceed $1000';
        break;
      case 'startDate':
        if (!value) return 'Start date is required';
        const startDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startDate < today) return 'Start date must be in the future';
        break;
      case 'endDate':
        if (!value) return 'End date is required';
        if (formData.startDate) {
          const start = new Date(formData.startDate);
          const end = new Date(value);
          if (end <= start) return 'End date must be after start date';
          const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff < 7) return 'Duration must be at least 7 days';
          if (daysDiff > 365) return 'Duration cannot exceed 365 days';
        }
        break;
      case 'maxMembers':
        const members = parseInt(value);
        if (!value || members < 3) return 'Must allow at least 3 members';
        if (members > 50) return 'Cannot exceed 50 members';
        break;
      case 'totalMinimumHours':
        const hours = parseFloat(value);
        if (!value || hours < 10) return 'Must be at least 10 hours';
        if (hours > 500) return 'Cannot exceed 500 hours';
        break;
    }
    return null;
  };

  const validateForm = (): string | null => {
    const fields = ['title', 'goal', 'stakeAmount', 'startDate', 'endDate', 'maxMembers', 'totalMinimumHours'];
    
    for (const field of fields) {
      const error = validateField(field, formData[field as keyof typeof formData]);
      if (error) return error;
    }

    if (!formData.category) return 'Category is required';
    if (formData.weeklyMeetingDays.length === 0) return 'At least one meeting day is required';
    if (!formData.preferredTimePeriod) return 'Preferred meeting time period is required';
    if (!formData.startTime) return 'Start time is required';
    if (!formData.endTime) return 'End time is required';

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowValidation(true);
    
    if (!user) {
      setSubmitStatus({ type: 'error', message: 'You must be logged in to create a community' });
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setSubmitStatus({ type: 'error', message: validationError });
      return;
    }

    if (!creatorStakePaid) {
      setSubmitStatus({ type: 'error', message: 'Please complete the creator stake payment first' });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const communityData = {
        title: formData.title.trim(),
        goal: formData.goal.trim(),
        stake_amount: parseFloat(formData.stakeAmount),
        start_date: `${formData.startDate}T${formData.startTime}:00`,
        end_date: `${formData.endDate}T${formData.endTime}:00`,
        category: formData.category,
        max_members: parseInt(formData.maxMembers),
        weekly_meeting_days: formData.weeklyMeetingDays,
        total_minimum_hours: parseFloat(formData.totalMinimumHours),
        preferred_time_period: formData.preferredTimePeriod,
        preferred_time: formData.startTime,
        start_time: formData.startTime,
        end_time: formData.endTime,
        description: formData.description.trim()
      };

      const result = await communityService.createCommunity(communityData, user.id);

      if (result.success && result.community) {
        setSubmitStatus({ type: 'success', message: 'Community created successfully! Redirecting...' });
        
        // Redirect to the new community page after a short delay
        setTimeout(() => {
          navigate(`/communities/${result.community!.id}`);
        }, 2000);
      } else {
        setSubmitStatus({ type: 'error', message: result.error || 'Failed to create community' });
      }
    } catch (error) {
      console.error('Error creating community:', error);
      setSubmitStatus({ type: 'error', message: 'An unexpected error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateCreatorStake = () => {
    const stake = parseFloat(formData.stakeAmount) || 0;
    return stake; // Creator pays the same stake amount as members
  };

  const handleSimulateCreatorPayment = async () => {
    if (!user) return;
    
    // Simulate payment processing
    setSubmitStatus({ type: null, message: '' });
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setCreatorStakePaid(true);
      setSubmitStatus({ 
        type: 'success', 
        message: `Creator stake payment of $${calculateCreatorStake().toFixed(2)} simulated successfully!` 
      });
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Payment simulation failed. Please try again.' });
    }
  };

  const getFieldError = (fieldName: string) => {
    if (!showValidation) return null;
    return validateField(fieldName, formData[fieldName as keyof typeof formData]);
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Community</h1>
              <p className="text-gray-600">Set up a goal-oriented community and help others achieve their dreams.</p>
            </div>
            
            {/* Auto-fill Button */}
            <button
              type="button"
              onClick={autoFillForm}
              className="mt-4 sm:mt-0 flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-purple-700 transition-all shadow-sm"
            >
              <Icon icon="solar:bolt-bold-duotone" width={20} />
              <span>Auto-fill with Sample Data</span>
            </button>
          </div>
          
          {/* Auto-fill Notice */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <Icon icon="solar:info-circle-bold-duotone" width={20} className="text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-purple-800 mb-1">Quick Testing</h3>
                <p className="text-sm text-purple-700">
                  Use the "Auto-fill with Sample Data" button to instantly populate all fields with valid random data for quick testing.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Status Messages */}
              {submitStatus.type && (
                <div className={`rounded-xl p-4 flex items-center space-x-3 ${
                  submitStatus.type === 'success' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {submitStatus.type === 'success' ? (
                    <Icon icon="solar:check-circle-bold-duotone" width={20} className="text-green-600 flex-shrink-0" />
                  ) : (
                    <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${
                    submitStatus.type === 'success' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {submitStatus.message}
                  </p>
                </div>
              )}

              {/* Community Details */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                  <Icon icon="solar:target-bold-duotone" width={20} className="text-primary-600" />
                  <span>Community Details</span>
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Community Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="e.g., 30-Day Coding Challenge"
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        getFieldError('title') ? 'border-red-300' : 'border-gray-200'
                      }`}
                      required
                    />
                    {getFieldError('title') && (
                      <p className="text-red-600 text-sm mt-1">{getFieldError('title')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Goal Description *
                    </label>
                    <textarea
                      name="goal"
                      value={formData.goal}
                      onChange={handleInputChange}
                      placeholder="Describe the specific goal members will work towards..."
                      rows={3}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        getFieldError('goal') ? 'border-red-300' : 'border-gray-200'
                      }`}
                      required
                    />
                    {getFieldError('goal') && (
                      <p className="text-red-600 text-sm mt-1">{getFieldError('goal')}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      {formData.goal.length}/500 characters
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Additional details about your community..."
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select category</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Members *</label>
                      <input
                        type="number"
                        name="maxMembers"
                        value={formData.maxMembers}
                        onChange={handleInputChange}
                        min="3"
                        max="50"
                        placeholder="15"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          getFieldError('maxMembers') ? 'border-red-300' : 'border-gray-200'
                        }`}
                        required
                      />
                      {getFieldError('maxMembers') && (
                        <p className="text-red-600 text-sm mt-1">{getFieldError('maxMembers')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Settings */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                  <Icon icon="solar:dollar-bold-duotone" width={20} className="text-primary-600" />
                  <span>Financial Commitment</span>
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Member Stake Amount *</label>
                  <div className="relative">
                    <Icon icon="solar:dollar-bold-duotone" width={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      name="stakeAmount"
                      value={formData.stakeAmount}
                      onChange={handleInputChange}
                      min="10"
                      max="1000"
                      step="0.01"
                      placeholder="100"
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        getFieldError('stakeAmount') ? 'border-red-300' : 'border-gray-200'
                      }`}
                      required
                    />
                  </div>
                  {getFieldError('stakeAmount') && (
                    <p className="text-red-600 text-sm mt-1">{getFieldError('stakeAmount')}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-2">
                    Amount each member commits to achieve their goal. Higher stakes increase motivation.
                  </p>
                </div>
              </div>

              {/* Accountability Requirements */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                  <Icon icon="solar:users-group-rounded-bold-duotone" width={20} className="text-primary-600" />
                  <span>Accountability Requirements</span>
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Weekly Meeting Days *</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {daysOfWeek.map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            formData.weeklyMeetingDays.includes(day)
                              ? 'bg-primary-100 text-primary-800 border-2 border-primary-300'
                              : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    {showValidation && formData.weeklyMeetingDays.length === 0 && (
                      <p className="text-red-600 text-sm mt-1">At least one meeting day is required</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Minimum Hours *</label>
                      <input
                        type="number"
                        name="totalMinimumHours"
                        value={formData.totalMinimumHours}
                        onChange={handleInputChange}
                        min="10"
                        max="500"
                        step="1"
                        placeholder="50"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          getFieldError('totalMinimumHours') ? 'border-red-300' : 'border-gray-200'
                        }`}
                        required
                      />
                      {getFieldError('totalMinimumHours') && (
                        <p className="text-red-600 text-sm mt-1">{getFieldError('totalMinimumHours')}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        Total minimum hours required for the entire community duration
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Meeting Time *</label>
                      <select
                        name="preferredTimePeriod"
                        value={formData.preferredTimePeriod}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select time period</option>
                        {timePeriods.map(period => (
                          <option key={period.value} value={period.value}>{period.label}</option>
                        ))}
                      </select>
                      {showValidation && !formData.preferredTimePeriod && (
                        <p className="text-red-600 text-sm mt-1">Preferred meeting time period is required</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                  <Icon icon="solar:calendar-bold-duotone" width={20} className="text-primary-600" />
                  <span>Community Schedule</span>
                </h2>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        getFieldError('startDate') ? 'border-red-300' : 'border-gray-200'
                      }`}
                      required
                    />
                    {getFieldError('startDate') && (
                      <p className="text-red-600 text-sm mt-1">{getFieldError('startDate')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                    {showValidation && !formData.startTime && (
                      <p className="text-red-600 text-sm mt-1">Start time is required</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      min={formData.startDate || new Date().toISOString().split('T')[0]}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        getFieldError('endDate') ? 'border-red-300' : 'border-gray-200'
                      }`}
                      required
                    />
                    {getFieldError('endDate') && (
                      <p className="text-red-600 text-sm mt-1">{getFieldError('endDate')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
                    <input
                      type="time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                    {showValidation && !formData.endTime && (
                      <p className="text-red-600 text-sm mt-1">End time is required</p>
                    )}
                  </div>
                </div>

                {/* Duration Display */}
                {formData.startDate && formData.endDate && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Duration:</strong> {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                )}
              </div>

              {/* Creator Stake Payment */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                  <Icon icon="solar:card-bold-duotone" width={20} className="text-primary-600" />
                  <span>Creator Stake Payment</span>
                </h2>

                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon icon="solar:info-circle-bold-duotone" width={16} className="text-primary-600" />
                    <span className="text-sm font-medium text-primary-800">Creator Commitment</span>
                  </div>
                  <p className="text-sm text-primary-700">
                    As the creator, you'll pay the same stake amount as other members to show your commitment to the community's success.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
                  <span className="text-gray-700">Your Stake Amount:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${calculateCreatorStake().toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateCreatorPayment}
                  disabled={creatorStakePaid || !formData.stakeAmount}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                    creatorStakePaid 
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {creatorStakePaid ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Icon icon="solar:check-circle-bold-duotone" width={20} />
                      <span>Creator Payment Completed</span>
                    </div>
                  ) : (
                    'Simulate Creator Payment'
                  )}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !creatorStakePaid}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-4 px-6 rounded-xl text-lg font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating Community...</span>
                  </>
                ) : (
                  <>
                    <Icon icon="solar:graph-up-bold-duotone" width={20} />
                    <span>Create Community</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* How Communities Work */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">How Communities Work</h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-600 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Community Creation</h4>
                    <p className="text-sm text-gray-600">Set your goal, stake amount, and accountability requirements.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-600 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Member Recruitment</h4>
                    <p className="text-sm text-gray-600">Members discover and join your community by paying stakes.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-600 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Active Phase</h4>
                    <p className="text-sm text-gray-600">Hold regular meetings with screen sharing for accountability.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-600 font-semibold text-sm">4</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Reward Distribution</h4>
                    <p className="text-sm text-gray-600">Successful members split stakes from those who didn't complete goals.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Success Tips */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Success Tips</h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• Set clear, measurable goals</li>
                <li>• Choose appropriate stake amounts</li>
                <li>• Schedule regular meeting times</li>
                <li>• Create detailed descriptions</li>
                <li>• Be an active, supportive leader</li>
              </ul>
            </div>

            {/* Testing Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Icon icon="solar:info-circle-bold-duotone" width={16} className="text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Testing Mode</span>
              </div>
              <p className="text-sm text-yellow-700">
                All payments are simulated for testing purposes. No real money will be charged.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}