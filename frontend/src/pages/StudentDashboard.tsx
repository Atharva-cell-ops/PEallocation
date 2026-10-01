import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Plus, 
  BookOpen, 
  Award,
  Sparkles
} from 'lucide-react';

interface ElectiveOffering {
  id: string;
  code: string;
  title: string;
  department: string;
  credits: number;
  description: string | null;
  maxCapacity: number;
  minCgpa: number | null;
  isEligible: boolean;
  ineligibilityReason: string | null;
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPrefs, setSelectedPrefs] = useState<{ cycleElectiveId: string; rank: number }[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Fetch Current Cycle
  const { data: cycleData, isLoading: cycleLoading } = useQuery({
    queryKey: ['currentCycle'],
    queryFn: async () => {
      const res = await api.get('/student/cycle/current');
      return res.data?.data;
    },
  });

  const cycleId = cycleData?.id;

  // 2. Fetch Offerings
  const { data: offerings = [], isLoading: offeringsLoading } = useQuery<ElectiveOffering[]>({
    queryKey: ['cycleOfferings', cycleId],
    queryFn: async () => {
      const res = await api.get(`/student/cycles/${cycleId}/electives`);
      return res.data?.data || [];
    },
    enabled: !!cycleId,
  });

  // 3. Fetch Existing Preferences
  const { data: existingPrefs = [] } = useQuery({
    queryKey: ['studentPreferences', cycleId],
    queryFn: async () => {
      const res = await api.get(`/student/cycles/${cycleId}/preferences`);
      return res.data?.data || [];
    },
    enabled: !!cycleId,
  });

  // 4. Fetch Published Allocation Result
  const { data: resultData } = useQuery({
    queryKey: ['allocationResult', cycleId],
    queryFn: async () => {
      const res = await api.get(`/student/cycles/${cycleId}/results`);
      return res.data;
    },
    enabled: !!cycleId,
  });

  // Sync existing preferences on load
  useEffect(() => {
    if (existingPrefs.length > 0 && selectedPrefs.length === 0) {
      setSelectedPrefs(
        existingPrefs.map((p: any) => ({
          cycleElectiveId: p.cycleElectiveId,
          rank: p.rank,
        }))
      );
    }
  }, [existingPrefs]);

  // Save Preferences Mutation
  const saveMutation = useMutation({
    mutationFn: async (prefs: { cycleElectiveId: string; rank: number }[]) => {
      const res = await api.put(`/student/cycles/${cycleId}/preferences`, { preferences: prefs });
      return res.data;
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', message: data.message || 'Preferences updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['studentPreferences', cycleId] });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update preferences.',
      });
    },
  });

  const handleAddElective = (offeringId: string) => {
    if (selectedPrefs.some((p) => p.cycleElectiveId === offeringId)) return;
    const newRank = selectedPrefs.length + 1;
    setSelectedPrefs([...selectedPrefs, { cycleElectiveId: offeringId, rank: newRank }]);
  };

  const handleRemove = (offeringId: string) => {
    const filtered = selectedPrefs.filter((p) => p.cycleElectiveId !== offeringId);
    const reindexed = filtered.map((p, idx) => ({ ...p, rank: idx + 1 }));
    setSelectedPrefs(reindexed);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedPrefs.length) return;

    const updated = [...selectedPrefs];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reindexed = updated.map((p, idx) => ({ ...p, rank: idx + 1 }));
    setSelectedPrefs(reindexed);
  };

  const handleSave = () => {
    setFeedback(null);
    saveMutation.mutate(selectedPrefs);
  };

  if (cycleLoading || offeringsLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!cycleData) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <Clock className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">No Active Allocation Cycle</h2>
        <p className="text-sm text-slate-500 mt-1">
          There are currently no open Professional Elective cycles for Semester {user?.student?.semester}.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Cycle Status Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">{cycleData.name}</h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                cycleData.status === 'OPEN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : cycleData.status === 'PUBLISHED'
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {cycleData.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Academic Year {cycleData.academicYear} • Semester {cycleData.semester} • Tie-Breaker Rule: {cycleData.tieBreakerRule}
          </p>
        </div>

        <div className="text-sm text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
          <span>Your Academic CGPA: </span>
          <span className="font-bold text-slate-900">{Number(user?.student?.cgpa).toFixed(2)}</span>
        </div>
      </div>

      {/* 2. Official Published Result Display */}
      {resultData?.published && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-indigo-600 text-white rounded-xl">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900">Official Allocation Result</h2>
              {resultData.status === 'ALLOCATED' && resultData.elective ? (
                <div className="mt-3 bg-white p-4 rounded-lg border border-indigo-100 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Allocated Course</span>
                    <h3 className="text-base font-bold text-slate-900">
                      {resultData.elective.code} - {resultData.elective.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {resultData.elective.department} • {resultData.elective.credits} Credits
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Matched from</span>
                    <p className="text-sm font-bold text-emerald-600">
                      Preference #{resultData.allocatedPreferenceRank}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-amber-800 bg-amber-50 p-3 rounded-md border border-amber-200">
                  <span className="font-semibold">Unallocated: </span>
                  {resultData.unallocatedReason || 'Capacity was exhausted across your submitted choices.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Feedback Alerts */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-center space-x-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 4. Preference Selection & Ordering Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Ranked Choices */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Award className="h-5 w-5 text-indigo-600" />
              <span>Your Ranked Preferences</span>
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {selectedPrefs.length} course{selectedPrefs.length !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-h-[300px] flex flex-col justify-between">
            {selectedPrefs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12 text-center">
                <BookOpen className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium">No electives ranked yet</p>
                <p className="text-xs text-slate-400">Click "+" on courses from the catalog to add them.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedPrefs.map((pref, idx) => {
                  const offering = offerings.find((o) => o.id === pref.cycleElectiveId);
                  if (!offering) return null;

                  return (
                    <div
                      key={pref.cycleElectiveId}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                          {pref.rank}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-tight">{offering.code}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[180px]">{offering.title}</p>
                        </div>
                      </div>

                      {cycleData.status === 'OPEN' && (
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, 'up')}
                            className="p-1 text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === selectedPrefs.length - 1}
                            onClick={() => handleMove(idx, 'down')}
                            className="p-1 text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(pref.cycleElectiveId)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {cycleData.status === 'OPEN' && (
              <div className="pt-4 mt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={selectedPrefs.length === 0 || saveMutation.isPending}
                  onClick={handleSave}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving Preferences...' : 'Save & Submit Preferences'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Available Electives Catalog */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Available Elective Offerings</h2>
          <div className="grid grid-cols-1 gap-3">
            {offerings.map((offering) => {
              const isSelected = selectedPrefs.some((p) => p.cycleElectiveId === offering.id);

              return (
                <div
                  key={offering.id}
                  className={`p-4 rounded-xl border transition ${
                    !offering.isEligible
                      ? 'bg-slate-50/60 border-slate-200 opacity-60'
                      : isSelected
                      ? 'bg-indigo-50/30 border-indigo-200 ring-1 ring-indigo-200'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {offering.code}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {offering.department} • {offering.credits} Credits • {offering.maxCapacity} Seats
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{offering.title}</h3>
                      {offering.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{offering.description}</p>
                      )}

                      {/* Eligibility Badges */}
                      <div className="mt-2.5 flex items-center space-x-2">
                        {offering.minCgpa !== null && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              offering.isEligible
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700 font-semibold'
                            }`}
                          >
                            Min CGPA: {offering.minCgpa.toFixed(2)}
                          </span>
                        )}
                        {!offering.isEligible && (
                          <span className="text-xs text-rose-600 flex items-center space-x-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>{offering.ineligibilityReason}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {cycleData.status === 'OPEN' && (
                      <button
                        type="button"
                        disabled={!offering.isEligible || isSelected}
                        onClick={() => handleAddElective(offering.id)}
                        className={`p-2 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                          isSelected
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : !offering.isEligible
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
