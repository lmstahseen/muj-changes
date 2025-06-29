import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import walletService, { ROIAnalysis } from '../services/walletService';

interface WalletAnalyticsProps {
  className?: string;
}

export function WalletAnalytics({ className = '' }: WalletAnalyticsProps) {
  const { user } = useAuth();
  const [roiAnalysis, setROIAnalysis] = useState<ROIAnalysis | null>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (user) {
      loadAnalyticsData();
    }
  }, [user, period]);

  const loadAnalyticsData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Load ROI analysis
      const roiResult = await walletService.calculateROI(user.id, period);
      if (roiResult.success && roiResult.analysis) {
        setROIAnalysis(roiResult.analysis);
      }

      // Load wallet analytics
      const analyticsResult = await walletService.getWalletAnalytics(user.id, period);
      if (analyticsResult.success && analyticsResult.analytics) {
        setAnalytics(analyticsResult.analytics);
      }
    } catch (err) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Icon icon="solar:chart-bold-duotone" width={20} className="text-primary-600" />
            <span>Financial Analytics</span>
          </h3>
          
          <div className="flex items-center space-x-3">
            <select
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
            
            <button
              onClick={loadAnalyticsData}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh data"
            >
              <Icon icon="solar:refresh-bold-duotone" width={16} />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
            <Icon icon="solar:graph-down-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* ROI Overview */}
        {roiAnalysis && (
          <div className="mb-8">
            <h4 className="font-medium text-gray-900 mb-4">ROI Overview</h4>
            
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-sm text-gray-600 mb-1">Invested</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(roiAnalysis.total_invested)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-sm text-gray-600 mb-1">Returned</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(roiAnalysis.total_returned)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-sm text-gray-600 mb-1">Net Profit</div>
                <div className={`text-xl font-bold ${
                  roiAnalysis.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(roiAnalysis.net_profit)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-sm text-gray-600 mb-1">ROI</div>
                <div className={`text-xl font-bold ${
                  roiAnalysis.roi_percentage >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {roiAnalysis.roi_percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Breakdown */}
        {roiAnalysis && roiAnalysis.monthly_breakdown.length > 0 && (
          <div className="mb-8">
            <h4 className="font-medium text-gray-900 mb-4">Monthly Breakdown</h4>
            
            <div className="space-y-3">
              {roiAnalysis.monthly_breakdown.map((month: any) => (
                <div key={month.month} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      month.net >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      <Icon icon={month.net >= 0 ? "solar:graph-up-bold-duotone" : "solar:graph-down-bold-duotone"} width={20} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{month.month}</div>
                      <div className="text-sm text-gray-600">
                        In: {formatCurrency(month.invested)} | Out: {formatCurrency(month.returned)}
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${
                    month.net >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {month.net >= 0 ? '+' : ''}{formatCurrency(month.net)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {analytics.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Performance Metrics</h4>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Icon icon="solar:medal-bold-duotone" width={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Success Rate</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {analytics[analytics.length - 1]?.success_rate?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-blue-700">
                  Communities won vs. total joined
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Icon icon="solar:bolt-bold-duotone" width={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">ROI Percentage</span>
                </div>
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {analytics[analytics.length - 1]?.roi_percentage?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-green-700">
                  Return on investment
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Icon icon="solar:target-bold-duotone" width={16} className="text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Communities</span>
                </div>
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {analytics[analytics.length - 1]?.communities_joined || 0}
                </div>
                <p className="text-xs text-purple-700">
                  Total communities joined
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {(!roiAnalysis || roiAnalysis.monthly_breakdown.length === 0) && analytics.length === 0 && (
          <div className="text-center py-8">
            <Icon icon="solar:chart-bold-duotone" width={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Data</h3>
            <p className="text-gray-600">
              Start joining communities and completing goals to see your financial analytics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}