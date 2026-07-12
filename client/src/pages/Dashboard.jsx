import React, { useState, useEffect } from 'react';
import { Cpu, Server, CheckCircle2, AlertTriangle, Play, Pause, Layers } from 'lucide-react';

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    projectsCount: 0,
    queuesCount: 0,
    activeWorkersCount: 0,
    jobStatuses: {
      QUEUED: 0,
      SCHEDULED: 0,
      CLAIMED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RETRY: 0,
      DLQ: 0,
      total: 0,
    },
  });
  const [throughput, setThroughput] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      };

      const [statsRes, workersRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }),
        fetch('/api/workers', { headers }),
      ]);

      if (statsRes.ok && workersRes.ok) {
        const statsData = await statsRes.json();
        const workersData = await workersRes.json();
        setMetrics(statsData.metrics);
        setThroughput(statsData.throughput);
        setWorkers(workersData);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Calculate SVG Graph points
  const maxVal = Math.max(...throughput.map(t => t.completed + t.failed), 10);
  const graphHeight = 150;
  const graphWidth = 800;

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">System Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Real-time overview of your distributed job execution environment</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#0d1527]/55 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-indigo-500/20">
            <Layers className="w-16 h-16" />
          </div>
          <span className="text-sm text-gray-400 font-medium">Projects & Queues</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics.projectsCount}</span>
            <span className="text-xs text-gray-500">Projects</span>
            <span className="text-3xl font-bold text-gray-600">/</span>
            <span className="text-3xl font-bold text-white">{metrics.queuesCount}</span>
            <span className="text-xs text-gray-500">Queues</span>
          </div>
        </div>

        <div className="bg-[#0d1527]/55 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-emerald-500/20">
            <Server className="w-16 h-16" />
          </div>
          <span className="text-sm text-gray-400 font-medium">Active Workers</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics.activeWorkersCount}</span>
            <span className="text-xs text-emerald-500 font-semibold uppercase">Online</span>
          </div>
        </div>

        <div className="bg-[#0d1527]/55 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-amber-500/20">
            <CheckCircle2 className="w-16 h-16" />
          </div>
          <span className="text-sm text-gray-400 font-medium">Completed Jobs</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics.jobStatuses.COMPLETED}</span>
            <span className="text-xs text-gray-500">Total processed</span>
          </div>
        </div>

        <div className="bg-[#0d1527]/55 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-red-500/20">
            <AlertTriangle className="w-16 h-16" />
          </div>
          <span className="text-sm text-gray-400 font-medium">Failed & DLQ Jobs</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-red-500">
              {metrics.jobStatuses.FAILED + metrics.jobStatuses.DLQ}
            </span>
            <span className="text-xs text-gray-500">Requires review</span>
          </div>
        </div>
      </div>

      {/* Jobs State Breakdowns */}
      <div className="bg-[#0d1527]/30 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Job Lifecycle Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: 'Queued', val: metrics.jobStatuses.QUEUED, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-900/40' },
            { label: 'Scheduled', val: metrics.jobStatuses.SCHEDULED, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-900/40' },
            { label: 'Running', val: metrics.jobStatuses.RUNNING + metrics.jobStatuses.CLAIMED, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-900/40' },
            { label: 'Completed', val: metrics.jobStatuses.COMPLETED, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-900/40' },
            { label: 'Retrying', val: metrics.jobStatuses.RETRY, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-900/40' },
            { label: 'Dead Letter', val: metrics.jobStatuses.DLQ, color: 'text-red-400', bg: 'bg-red-500/10 border-red-900/40' },
          ].map((item) => (
            <div key={item.label} className={`border rounded-xl p-4 flex flex-col ${item.bg}`}>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{item.label}</span>
              <span className={`text-2xl font-bold mt-1.5 ${item.color}`}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Throughput Metric Graph */}
      <div className="bg-[#0d1527]/30 border border-gray-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">Execution Throughput (Last 24 Hours)</h2>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              <span>Failed</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          {throughput.length > 0 ? (
            <div className="min-w-[800px] h-[200px] flex flex-col justify-between">
              {/* SVG Canvas */}
              <svg className="w-full" viewBox={`0 0 ${graphWidth} ${graphHeight}`}>
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={graphHeight - r * graphHeight}
                    x2={graphWidth}
                    y2={graphHeight - r * graphHeight}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Graph bars */}
                {throughput.map((item, index) => {
                  const x = (index / (throughput.length - 1)) * (graphWidth - 40) + 20;
                  const completedHeight = (item.completed / maxVal) * (graphHeight - 20);
                  const failedHeight = (item.failed / maxVal) * (graphHeight - 20);

                  return (
                    <g key={index}>
                      {/* Completed stack */}
                      {completedHeight > 0 && (
                        <rect
                          x={x - 6}
                          y={graphHeight - completedHeight}
                          width="5"
                          height={completedHeight}
                          fill="#10b981"
                          rx="1.5"
                          className="transition-all duration-300"
                        />
                      )}
                      {/* Failed stack */}
                      {failedHeight > 0 && (
                        <rect
                          x={x}
                          y={graphHeight - failedHeight}
                          width="5"
                          height={failedHeight}
                          fill="#ef4444"
                          rx="1.5"
                          className="transition-all duration-300"
                        />
                      )}
                      {/* Hover guideline */}
                      <line
                        x1={x - 0.5}
                        y1="0"
                        x2={x - 0.5}
                        y2={graphHeight}
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        opacity="0"
                        className="hover:opacity-20 cursor-pointer"
                      />
                    </g>
                  );
                })}
              </svg>
              {/* X Axis Time Labels */}
              <div className="flex justify-between px-4 mt-2 border-t border-gray-800/60 pt-2 text-[10px] text-gray-500 font-semibold">
                {throughput.map((t, idx) => (
                  <span key={idx} className={idx % 4 === 0 ? '' : 'hidden md:block'}>
                    {t.time}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-gray-600 text-sm">
              No executions logged in the last 24 hours
            </div>
          )}
        </div>
      </div>

      {/* Workers Status List */}
      <div className="bg-[#0d1527]/30 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Cluster Worker Nodes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#0d1527]/80 text-gray-400 font-semibold text-xs uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl">Worker Name</th>
                <th className="px-6 py-4">IP Address & Host</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">CPU Utilization</th>
                <th className="px-6 py-4">Memory Utilization</th>
                <th className="px-6 py-4">Active Jobs</th>
                <th className="px-6 py-4 rounded-tr-xl">Last Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {workers.length > 0 ? (
                workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-800/10">
                    <td className="px-6 py-4 font-medium text-gray-100 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-400" />
                      {worker.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="block text-xs font-mono text-gray-400">{worker.ipAddress}</span>
                      <span className="block text-[11px] text-gray-500">{worker.hostname}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          worker.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-gray-800 text-gray-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            worker.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                          }`}
                        ></span>
                        {worker.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${worker.metrics?.cpuUsage || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-gray-500 font-bold block mt-1">
                        {(worker.metrics?.cpuUsage || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-purple-500 h-1.5 rounded-full"
                          style={{ width: `${worker.metrics?.memoryUsage || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-gray-500 font-bold block mt-1">
                        {(worker.metrics?.memoryUsage || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-200">
                      {worker.activeJobsCount}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(worker.lastHeartbeat).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-600 font-medium">
                    No worker nodes currently registered
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
