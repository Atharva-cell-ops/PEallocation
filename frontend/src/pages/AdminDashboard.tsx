import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { 
  Play, 
  Lock, 
  CheckCircle, 
  Download, 
  FileText,
  AlertCircle,
  BarChart3
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Fetch all cycles
  const { data: cycles = [], isLoading: cyclesLoading } = useQuery({
    queryKey: ['adminCycles'],
    queryFn: async () => {
      const res = await api.get('/admin/cycles');
      const list = res.data?.data || [];
      if (list.length > 0 && !selectedCycleId) {
        setSelectedCycleId(list[0].id);
      }
      return list;
    },
  });

  const activeCycle = cycles.find((c: any) => c.id === selectedCycleId) || cycles[0];

  // 2. Fetch allocations & seat stats for selected cycle
  const { data: allocationDetails } = useQuery({
    queryKey: ['cycleAllocations', selectedCycleId],
    queryFn: async () => {
      if (!selectedCycleId) return null;
      const res = await api.get(`/admin/cycles/${selectedCycleId}/allocations`);
      return res.data;
    },
    enabled: !!selectedCycleId,
  });

  // 3. Fetch Audit Logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs', selectedCycleId],
    queryFn: async () => {
      const res = await api.get(`/admin/audit-logs${selectedCycleId ? `?cycleId=${selectedCycleId}` : ''}`);
      return res.data?.data || [];
    },
    enabled: !!selectedCycleId,
  });

  // Action Mutations
  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/cycles/${selectedCycleId}/close`);
      return res.data;
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', message: data.message });
      queryClient.invalidateQueries({ queryKey: ['adminCycles'] });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Action failed' });
    },
  });

  const allocateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/cycles/${selectedCycleId}/allocate`);
      return res.data;
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', message: data.message });
      queryClient.invalidateQueries({ queryKey: ['adminCycles'] });
      queryClient.invalidateQueries({ queryKey: ['cycleAllocations', selectedCycleId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Allocation failed' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/cycles/${selectedCycleId}/publish`);
      return res.data;
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', message: data.message });
      queryClient.invalidateQueries({ queryKey: ['adminCycles'] });
      queryClient.invalidateQueries({ queryKey: ['cycleAllocations', selectedCycleId] });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Publishing failed' });
    },
  });

  const handleExportCsv = () => {
    if (!selectedCycleId) return;
    window.open(`/api/v1/admin/cycles/${selectedCycleId}/export.csv`, '_blank');
  };

  if (cyclesLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header with Cycle Selector & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Allocation Administration</h1>
            <p className="text-sm text-slate-500">Manage cycles, execute matching engines, and publish results</p>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={selectedCycleId || ''}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {cycles.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Toolbar */}
        {activeCycle && (
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
            {activeCycle.status === 'OPEN' && (
              <button
                type="button"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition"
              >
                <Lock className="h-4 w-4" />
                <span>Close Submissions</span>
              </button>
            )}

            {activeCycle.status === 'CLOSED' && (
              <button
                type="button"
                onClick={() => allocateMutation.mutate()}
                disabled={allocateMutation.isPending}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
              >
                <Play className="h-4 w-4" />
                <span>Run Allocation Engine</span>
              </button>
            )}

            {activeCycle.status === 'ALLOCATED' && (
              <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Publish Official Results</span>
              </button>
            )}

            {(activeCycle.status === 'ALLOCATED' || activeCycle.status === 'PUBLISHED') && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition ml-auto"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV Report</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Feedback Message */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-center space-x-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 3. Seat Utilization Metrics */}
      {allocationDetails?.seatUtilization && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <span>Capacity & Seat Utilization</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {allocationDetails.seatUtilization.map((off: any) => {
              const pct = Math.round((off.assigned / off.capacity) * 100);
              return (
                <div key={off.code} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {off.code}
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-2 truncate">{off.title}</p>
                  <div className="mt-3 flex items-baseline justify-between text-xs text-slate-600">
                    <span>
                      {off.assigned} / {off.capacity} seats
                    </span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Student Allocations Table */}
      {allocationDetails?.allocations && allocationDetails.allocations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Student Allocations Breakdown</h3>
            <span className="text-xs text-slate-500 font-medium">
              {allocationDetails.allocatedCount} Allocated • {allocationDetails.unallocatedCount} Unallocated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-700 tracking-wider">
                <tr>
                  <th className="px-6 py-3">Roll Number</th>
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">CGPA</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Allocated Elective</th>
                  <th className="px-6 py-3">Preference Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocationDetails.allocations.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{a.student.rollNumber}</td>
                    <td className="px-6 py-3.5">{a.student.name}</td>
                    <td className="px-6 py-3.5 font-medium">{a.student.cgpa.toFixed(2)}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          a.status === 'ALLOCATED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      {a.elective ? `${a.elective.code} - ${a.elective.title}` : `None (${a.unallocatedReason})`}
                    </td>
                    <td className="px-6 py-3.5">
                      {a.rank ? (
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          Rank #{a.rank}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Audit Trail */}
      {auditLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <span>Cycle Audit Trail</span>
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between">
                <div>
                  <span className="font-bold text-slate-800">{log.action}</span>
                  <p className="text-slate-500 mt-0.5">{log.details}</p>
                </div>
                <span className="text-slate-400 font-mono">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
