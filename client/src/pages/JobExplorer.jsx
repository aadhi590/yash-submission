import React, { useState, useEffect } from 'react';
import { Layers, Play, RefreshCw, Search, Plus, X, Calendar, Clock, CheckCircle, AlertOctagon, Terminal } from 'lucide-react';

const JobExplorer = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [queues, setQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState('');

  // Jobs state
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Selected Job Details modal
  const [activeJob, setActiveJob] = useState(null);
  const [activeJobLogs, setActiveJobLogs] = useState([]);
  const [activeJobExecutions, setActiveJobExecutions] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Create Job modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [jobPayload, setJobPayload] = useState('{\n  "task": "send_welcome_email",\n  "userId": "123"\n}');
  const [jobType, setJobType] = useState('immediate');
  const [jobDelay, setJobDelay] = useState(60);
  const [jobCron, setJobCron] = useState('*/5 * * * *');
  const [batchPayloads, setBatchPayloads] = useState('[\n  {"userId": "1"},\n  {"userId": "2"}\n]');

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Fetch initial Projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await fetch('/api/projects', { headers });
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
          if (data.length > 0) {
            setSelectedProjectId(data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadProjects();
  }, []);

  // Fetch Queues whenever selected Project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    const loadQueues = async () => {
      try {
        const res = await fetch(`/api/projects/${selectedProjectId}/queues`, { headers });
        if (res.ok) {
          const data = await res.json();
          setQueues(data);
          if (data.length > 0) {
            setSelectedQueueId(data[0].id);
          } else {
            setSelectedQueueId('');
            setJobs([]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadQueues();
  }, [selectedProjectId]);

  // Load jobs when selected Queue, Page, Status Filter, or Search changes
  const fetchJobs = async () => {
    if (!selectedQueueId) return;
    setLoading(true);
    try {
      const url = `/api/queues/${selectedQueueId}/jobs?page=${page}&limit=10&status=${statusFilter}&search=${searchQuery}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [selectedQueueId, page, statusFilter, searchQuery]);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      let parsedPayload;
      let bodyData = { type: jobType };

      if (jobType === 'batch') {
        parsedPayload = JSON.parse(batchPayloads);
        bodyData.batch = parsedPayload;
      } else {
        parsedPayload = JSON.parse(jobPayload);
        bodyData.payload = parsedPayload;
      }

      if (jobType === 'delayed') {
        bodyData.delay = parseInt(jobDelay, 10);
      } else if (jobType === 'scheduled') {
        bodyData.cron = jobCron;
      }

      const res = await fetch(`/api/queues/${selectedQueueId}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchJobs();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      alert(`Invalid JSON format: ${err.message}`);
    }
  };

  const handleShowDetails = async (job) => {
    setActiveJob(job);
    setShowDetailsModal(true);
    try {
      const [logsRes, execRes] = await Promise.all([
        fetch(`/api/jobs/${job.id}/logs`, { headers }),
        fetch(`/api/jobs/${job.id}/executions`, { headers }),
      ]);
      if (logsRes.ok && execRes.ok) {
        const logs = await logsRes.json();
        const execs = await execRes.json();
        setActiveJobLogs(logs);
        setActiveJobExecutions(execs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetryJob = async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        alert('Job reschedule success! Job status is reset to QUEUED.');
        setShowDetailsModal(false);
        fetchJobs();
      } else {
        const err = await res.json();
        alert(`Failed to retry job: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      QUEUED: 'bg-indigo-500/10 text-indigo-400 border-indigo-900/30',
      SCHEDULED: 'bg-blue-500/10 text-blue-400 border-blue-900/30',
      CLAIMED: 'bg-yellow-500/10 text-yellow-400 border-yellow-900/30',
      RUNNING: 'bg-yellow-400/20 text-yellow-300 border-yellow-700/30',
      COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-900/30',
      FAILED: 'bg-red-500/10 text-red-400 border-red-900/30',
      RETRY: 'bg-orange-500/10 text-orange-400 border-orange-900/30',
      DLQ: 'bg-rose-950/30 text-rose-400 border-rose-900/40',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badges[status] || 'bg-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Job Explorer</h1>
          <p className="text-sm text-gray-400 mt-1">Submit, monitor, inspect, and retry individual jobs</p>
        </div>
        <button
          disabled={!selectedQueueId}
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white shadow-lg shadow-indigo-600/15 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Enqueue Job
        </button>
      </div>

      {/* Selectors card */}
      <div className="bg-[#0d1527]/30 border border-gray-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Queue</label>
          <select
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            disabled={queues.length === 0}
            className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none disabled:opacity-50"
          >
            {queues.length > 0 ? (
              queues.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))
            ) : (
              <option>No queues available</option>
            )}
          </select>
        </div>
      </div>

      {/* Filters and search row */}
      {selectedQueueId && (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#0d1527]/10 p-4 border border-gray-850 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Filter status</span>
            {['', 'QUEUED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'DLQ'].map((st) => (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                    : 'bg-transparent border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                }`}
              >
                {st || 'ALL'}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search payloads..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-[#070b13] border border-gray-850 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2 pl-9 pr-4 text-xs text-gray-200 outline-none"
            />
          </div>
        </div>
      )}

      {/* Job table */}
      {selectedQueueId && (
        <div className="bg-[#0d1527]/30 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#0d1527]/80 text-gray-400 font-semibold text-xs uppercase border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4">Job ID</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Retries</th>
                  <th className="px-6 py-4">Scheduled For</th>
                  <th className="px-6 py-4">Payload Preview</th>
                  <th className="px-6 py-4">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 mx-auto"></div>
                    </td>
                  </tr>
                ) : jobs.length > 0 ? (
                  jobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => handleShowDetails(job)}
                      className="hover:bg-gray-800/10 cursor-pointer transition-all duration-150"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">{job.id.substring(0, 8)}...</td>
                      <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                      <td className="px-6 py-4 font-semibold text-xs text-gray-400">
                        {job.retryCount} / {job.maxRetries}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">
                        {new Date(job.runAt).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate text-xs font-mono text-gray-500">
                        {JSON.stringify(job.payload)}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-600 font-medium">
                      No jobs matched the current criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-800/40 bg-[#0d1527]/50 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Showing page <strong className="text-gray-300">{pagination.page}</strong> of{' '}
                <strong className="text-gray-300">{pagination.totalPages}</strong> ({pagination.total} total jobs)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 transition"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details / Logs Modal */}
      {showDetailsModal && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0c1222] border-l border-gray-800 w-full max-w-2xl h-screen p-8 space-y-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Modal header */}
              <div className="flex justify-between items-start border-b border-gray-800 pb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white">Job Details</h3>
                    {getStatusBadge(activeJob.status)}
                  </div>
                  <span className="text-xs font-mono text-gray-500 block mt-1">{activeJob.id}</span>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1.5 rounded-lg border border-gray-850 hover:bg-gray-800 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status details / Actions */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-[#070b13]/40 p-4 border border-gray-850 rounded-xl">
                <div className="space-y-1">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Attempts</span>
                  <p className="text-gray-200 font-bold">{activeJob.retryCount} / {activeJob.maxRetries}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Scheduled run time</span>
                  <p className="text-gray-200 font-mono text-xs">{new Date(activeJob.runAt).toLocaleString()}</p>
                </div>
                {(activeJob.status === 'FAILED' || activeJob.status === 'DLQ') && (
                  <div className="col-span-2 pt-2">
                    <button
                      onClick={() => handleRetryJob(activeJob.id)}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white shadow-md shadow-emerald-600/10"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Queue Job for Manual Retry</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Payload Code box */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payload Data</span>
                <pre className="p-4 rounded-xl bg-[#070b13] border border-gray-850 text-xs font-mono text-indigo-300 overflow-x-auto max-h-[150px]">
                  {JSON.stringify(activeJob.payload, null, 2)}
                </pre>
              </div>

              {/* Execution Error display */}
              {activeJob.error && (
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 text-xs font-mono text-red-400 space-y-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-red-500">Error stacktrace</span>
                  <p>{activeJob.error}</p>
                </div>
              )}

              {/* Executions log */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  Terminal Execution Logs
                </span>
                <div className="bg-[#070b13] border border-gray-850 rounded-xl p-4 h-[200px] overflow-y-auto font-mono text-xs text-gray-400 space-y-2">
                  {activeJobLogs.length > 0 ? (
                    activeJobLogs.map((log) => (
                      <div key={log.id} className="flex gap-2">
                        <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span
                          className={
                            log.level === 'ERROR'
                              ? 'text-red-400 font-bold'
                              : log.level === 'WARN'
                              ? 'text-amber-400'
                              : 'text-gray-300'
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-600 text-center py-12">No terminal execution logs loaded.</div>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowDetailsModal(false)}
              className="w-full py-3 bg-gray-850 hover:bg-gray-800 border border-gray-800 rounded-xl text-sm font-semibold text-gray-300 transition mt-6"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0d1527] border border-gray-800 rounded-2xl w-full max-w-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Enqueue New Job</h3>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Job Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {['immediate', 'delayed', 'scheduled', 'batch'].map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setJobType(tp)}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize border ${
                        jobType === tp
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-[#070b13] border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              </div>

              {jobType === 'delayed' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Delay (Seconds)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={jobDelay}
                    onChange={(e) => setJobDelay(e.target.value)}
                    className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
                  />
                </div>
              )}

              {jobType === 'scheduled' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cron Schedule</label>
                  <input
                    type="text"
                    required
                    value={jobCron}
                    onChange={(e) => setJobCron(e.target.value)}
                    placeholder="*/5 * * * *"
                    className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none font-mono"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">Standard 5-field cron: minute hour day-of-month month day-of-week</span>
                </div>
              )}

              {jobType === 'batch' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Batch Payloads (JSON Array)</label>
                  <textarea
                    rows="6"
                    required
                    value={batchPayloads}
                    onChange={(e) => setBatchPayloads(e.target.value)}
                    className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs font-mono text-gray-300 outline-none resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payload (JSON Object)</label>
                  <textarea
                    rows="6"
                    required
                    value={jobPayload}
                    onChange={(e) => setJobPayload(e.target.value)}
                    className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs font-mono text-gray-300 outline-none resize-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 transition"
                >
                  Enqueue Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobExplorer;
