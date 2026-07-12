import React, { useState, useEffect } from 'react';
import { Layers, Folder, Plus, Edit, Trash2, Play, Pause, ChevronRight, Settings } from 'lucide-react';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals / Form State
  const [showProjModal, setShowProjModal] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const [showQueueModal, setShowQueueModal] = useState(false);
  const [qName, setQName] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qPriority, setQPriority] = useState(1);
  const [qConcurrency, setQConcurrency] = useState(5);
  // Retry Policy Form State
  const [hasRetryPolicy, setHasRetryPolicy] = useState(false);
  const [rpStrategy, setRpStrategy] = useState('FIXED');
  const [rpDelay, setRpDelay] = useState(5);
  const [rpMaxRetries, setRpMaxRetries] = useState(3);
  const [rpFactor, setRpFactor] = useState(2);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', { headers });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueues = async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/queues`, { headers });
      if (res.ok) {
        const data = await res.json();
        setQueues(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    fetchQueues(project.id);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: projName, description: projDesc }),
      });
      if (res.ok) {
        setShowProjModal(false);
        setProjName('');
        setProjDesc('');
        fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? This will delete all queues and jobs associated with it.')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        if (selectedProject?.id === id) {
          setSelectedProject(null);
          setQueues([]);
        }
        fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateQueue = async (e) => {
    e.preventDefault();
    const retryPolicy = hasRetryPolicy
      ? {
          name: `${qName}-retry-policy`,
          strategy: rpStrategy,
          delay: parseInt(rpDelay, 10),
          maxRetries: parseInt(rpMaxRetries, 10),
          backoffFactor: parseFloat(rpFactor),
        }
      : null;

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/queues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: qName,
          description: qDesc,
          priority: parseInt(qPriority, 10),
          concurrencyLimit: parseInt(qConcurrency, 10),
          retryPolicy,
        }),
      });
      if (res.ok) {
        setShowQueueModal(false);
        setQName('');
        setQDesc('');
        setQPriority(1);
        setQConcurrency(5);
        setHasRetryPolicy(false);
        fetchQueues(selectedProject.id);
        fetchProjects(); // update queue counts
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleQueuePause = async (queue) => {
    const action = queue.isPaused ? 'resume' : 'pause';
    try {
      const res = await fetch(`/api/queues/${queue.id}/${action}`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        fetchQueues(selectedProject.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQueue = async (queueId) => {
    if (!confirm('Are you sure you want to delete this queue? All jobs within will be deleted.')) return;
    try {
      const res = await fetch(`/api/queues/${queueId}`, { method: 'DELETE', headers });
      if (res.ok) {
        fetchQueues(selectedProject.id);
        fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left panel: Projects list */}
      <div className="lg:col-span-1 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-400" />
            Projects
          </h2>
          <button
            onClick={() => setShowProjModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/10 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.length > 0 ? (
              projects.map((proj) => {
                const isSelected = selectedProject?.id === proj.id;
                return (
                  <div
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-start ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-500/5'
                        : 'bg-[#0d1527]/30 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="space-y-1 pr-4">
                      <h3 className="font-bold text-white text-base">{proj.name}</h3>
                      <p className="text-xs text-gray-400 line-clamp-2">{proj.description || 'No description'}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded bg-gray-800 text-[10px] text-gray-400 font-bold uppercase">
                        {proj._count.queues} {proj._count.queues === 1 ? 'Queue' : 'Queues'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-indigo-400' : 'text-gray-600'}`} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-[#0d1527]/10 border border-dashed border-gray-800 rounded-2xl text-gray-500 text-sm">
                No projects. Create one to start queue management.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel: Queues in selected project */}
      <div className="lg:col-span-2 space-y-6">
        {selectedProject ? (
          <>
            <div className="flex justify-between items-center border-b border-gray-800 pb-5">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedProject.name}</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedProject.description || 'No project description provided'}</p>
              </div>
              <button
                onClick={() => setShowQueueModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-600/15 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Add Queue
              </button>
            </div>

            {/* Queues list */}
            <div className="space-y-4">
              {queues.length > 0 ? (
                queues.map((q) => (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl bg-[#0d1527]/30 border border-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-gray-700/60 transition-all duration-150"
                  >
                    <div className="space-y-1.5 flex-1 pr-6">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-white text-lg">{q.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            q.priority === 3
                              ? 'bg-red-500/10 text-red-400 border-red-900/30'
                              : q.priority === 2
                              ? 'bg-amber-500/10 text-amber-400 border-amber-900/30'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-900/30'
                          }`}
                        >
                          {q.priority === 3 ? 'High' : q.priority === 2 ? 'Medium' : 'Low'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{q.description || 'No description'}</p>
                      
                      {/* Configuration stats row */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-xs text-gray-500">
                        <span>Concurrency Limit: <strong className="text-gray-300 font-semibold">{q.concurrencyLimit}</strong></span>
                        {q.retryPolicy ? (
                          <span>
                            Retry Policy:{' '}
                            <strong className="text-gray-300 font-semibold">
                              {q.retryPolicy.strategy} ({q.retryPolicy.maxRetries} max, {q.retryPolicy.delay}s delay)
                            </strong>
                          </span>
                        ) : (
                          <span>Retry Policy: <strong className="text-gray-500">None</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Pause / Resume Button */}
                      <button
                        onClick={() => handleToggleQueuePause(q)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                          q.isPaused
                            ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/20'
                            : 'bg-amber-950/20 border-amber-900/50 text-amber-400 hover:bg-amber-900/20'
                        }`}
                      >
                        {q.isPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteQueue(q.id)}
                        className="p-2.5 rounded-xl border border-gray-800 text-gray-400 hover:text-red-400 hover:bg-red-950/10 hover:border-red-900/30 transition-all duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-[#0d1527]/10 border border-dashed border-gray-800 rounded-2xl text-gray-500 text-sm">
                  No queues in this project. Create one to begin.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-2xl bg-[#0d1527]/5 p-8 text-center">
            <Layers className="w-12 h-12 text-gray-700 mb-3" />
            <h3 className="text-gray-400 font-bold">No Project Selected</h3>
            <p className="text-xs text-gray-500 max-w-xs mt-1">Select an existing project from the left panel or create a new one to view its queues.</p>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0d1527] border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Project Name</label>
                <input
                  type="text"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Email Delivery Service"
                  className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Description of the project's services and queues..."
                  rows="3"
                  className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjModal(false)}
                  className="px-4 py-2 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 transition"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Queue Modal */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#0d1527] border border-gray-800 rounded-2xl w-full max-w-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Add New Queue</h3>
            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Queue Name</label>
                <input
                  type="text"
                  required
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  placeholder="e.g. transactional-emails"
                  className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={qDesc}
                  onChange={(e) => setQDesc(e.target.value)}
                  placeholder="What tasks does this queue handle..."
                  rows="2"
                  className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Priority</label>
                  <select
                    value={qPriority}
                    onChange={(e) => setQPriority(e.target.value)}
                    className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
                  >
                    <option value={1}>Low</option>
                    <option value={2}>Medium</option>
                    <option value={3}>High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Concurrency Limit</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={qConcurrency}
                    onChange={(e) => setQConcurrency(e.target.value)}
                    className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
                  />
                </div>
              </div>

              {/* Retry Policy Config */}
              <div className="border-t border-gray-800 pt-4 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="has-retry"
                    checked={hasRetryPolicy}
                    onChange={(e) => setHasRetryPolicy(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-800 bg-[#070b13] text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="has-retry" className="text-sm font-bold text-gray-200 cursor-pointer">
                    Configure Queue Retry Policy
                  </label>
                </div>

                {hasRetryPolicy && (
                  <div className="space-y-4 p-4 rounded-xl bg-[#070b13]/50 border border-gray-800/80">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Backoff Strategy</label>
                        <select
                          value={rpStrategy}
                          onChange={(e) => setRpStrategy(e.target.value)}
                          className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
                        >
                          <option value="FIXED">Fixed delay</option>
                          <option value="LINEAR">Linear backoff</option>
                          <option value="EXPONENTIAL">Exponential backoff</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Delay (Seconds)</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={rpDelay}
                          onChange={(e) => setRpDelay(e.target.value)}
                          className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Max Retries</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={rpMaxRetries}
                          onChange={(e) => setRpMaxRetries(e.target.value)}
                          className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
                        />
                      </div>
                      {rpStrategy === 'EXPONENTIAL' && (
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Backoff Factor</label>
                          <input
                            type="number"
                            required
                            step="0.5"
                            min="1.0"
                            value={rpFactor}
                            onChange={(e) => setRpFactor(e.target.value)}
                            className="w-full bg-[#070b13] border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm text-gray-200 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowQueueModal(false)}
                  className="px-4 py-2 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 transition"
                >
                  Create Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
