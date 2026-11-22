import React, { useState, useEffect } from 'react';
import { Settings, Calendar, Plus, Trash2, CheckCircle2, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { api } from '../api';

export default function SettingsView() {
  const [settings, setSettings] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Holiday Form
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDesc, setHolidayDesc] = useState('');

  // Priority Change Policy
  const [selectedPolicy, setSelectedPolicy] = useState('RECALCULATE_FROM_REMAINING_RATIO');
  const [autoCloseDays, setAutoCloseDays] = useState(5);
  const [reopenDays, setReopenDays] = useState(5);

  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsData, holidaysData] = await Promise.all([
        api.getSettings(),
        api.getHolidays(),
      ]);
      setSettings(settingsData.settings || {});
      setHolidays(holidaysData.holidays || []);

      if (settingsData.settings?.priorityChangePolicy) {
        setSelectedPolicy(settingsData.settings.priorityChangePolicy);
      }
      if (settingsData.settings?.autoCloseDays) {
        setAutoCloseDays(settingsData.settings.autoCloseDays);
      }
      if (settingsData.settings?.reopenDays) {
        setReopenDays(settingsData.settings.reopenDays);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) return;

    try {
      setErrorMsg(null);
      await api.addHoliday({
        name: holidayName.trim(),
        date: holidayDate.trim(),
        description: holidayDesc.trim(),
      });
      setHolidayName('');
      setHolidayDate('');
      setHolidayDesc('');
      setSuccessMsg('Festival holiday added successfully. SLA engine cache updated.');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add holiday.');
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      setErrorMsg(null);
      await api.deleteHoliday(id);
      setSuccessMsg('Holiday removed. SLA engine updated.');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to remove holiday.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setErrorMsg(null);
      await api.updateSettings({
        SLA_PRIORITY_CHANGE_POLICY: selectedPolicy,
        SLA_AUTO_CLOSE_WORKING_DAYS: autoCloseDays,
        SLA_REOPEN_WINDOW_WORKING_DAYS: reopenDays,
      });
      setSuccessMsg('Arvo SLA policies updated successfully.');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <span>Arvo Systems SLA & Business Schedule Settings</span>
        </h2>
        <p className="text-xs text-slate-500">
          Configure working schedules, festival holiday exclusions, automatic closure deadlines, and priority change policies.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: Business Schedule & SLA Policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Working Hours Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Working Schedule Commitments</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Working Days</span>
              <span className="font-semibold text-slate-900">Monday to Friday (5 Days)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Working Hours</span>
              <span className="font-semibold text-slate-900">9:30 AM to 6:30 PM (9.0 Hours / Day)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Weekends</span>
              <span className="font-semibold text-red-600">Excluded (Clock Stops)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Off-Hours (After 6:30 PM)</span>
              <span className="font-semibold text-red-600">Excluded (Advances to 9:30 AM Next Workday)</span>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 mb-2">Priority Response Commitments:</h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 bg-orange-50 rounded border border-orange-200 flex justify-between">
                <span className="font-bold text-orange-800">Urgent:</span>
                <span>2 working hours reply · Same working day resolution</span>
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200 flex justify-between">
                <span className="font-bold text-blue-800">Medium:</span>
                <span>Half a working day reply · ~3 working days resolution</span>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                <span className="font-bold text-slate-800">Small:</span>
                <span>1 working day reply · ~1 working week (5 days) resolution</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Policy Configuration Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            <Settings className="w-4 h-4 text-blue-600" />
            <span>Configurable SLA Engine Policies</span>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            {/* Mid-flight priority change policy (Directly addresses unresolved meeting question) */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Priority-Change SLA Policy (Unresolved Meeting Rule)
              </label>
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                When an agent upgrades/downgrades priority mid-ticket, which mathematical rule applies?
              </p>
              <select
                value={selectedPolicy}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="RECALCULATE_FROM_REMAINING_RATIO">
                  1. Recalculate Proportional Remaining Working Time (Recommended Default)
                </option>
                <option value="RESET_FROM_CREATION">
                  2. Strict Reset from Creation Timestamp (Historical Target)
                </option>
                <option value="RECALCULATE_FROM_NOW">
                  3. Grant Fresh SLA Duration from Change Moment
                </option>
              </select>
            </div>

            {/* Auto Close Window */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Automatic Ticket Closure Threshold (Working Days)
              </label>
              <p className="text-[11px] text-slate-500 mb-1">
                Automatically closes tickets in <em>Waiting for Customer</em> when unanswered.
              </p>
              <input
                type="number"
                min="1"
                max="30"
                value={autoCloseDays}
                onChange={(e) => setAutoCloseDays(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            {/* Reopening Window */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Customer Reopening Window (Working Days)
              </label>
              <p className="text-[11px] text-slate-500 mb-1">
                Permits customer to reopen a resolved ticket. After this period, a new ticket is required.
              </p>
              <input
                type="number"
                min="1"
                max="30"
                value={reopenDays}
                onChange={(e) => setReopenDays(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-all disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save SLA Settings'}
            </button>
          </form>
        </div>
      </div>

      {/* Festival Holidays Management */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Configured Festival Holidays</span>
            </h3>
            <p className="text-xs text-slate-500">
              The SLA calculation engine automatically skips these dates when computing deadlines.
            </p>
          </div>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Holiday Name</label>
            <input
              type="text"
              required
              placeholder="E.g. Diwali Holiday"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date (YYYY-MM-DD)</label>
            <input
              type="date"
              required
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="Non-working festival"
              value={holidayDesc}
              onChange={(e) => setHolidayDesc(e.target.value)}
              className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Holiday</span>
            </button>
          </div>
        </form>

        {/* Holidays List */}
        <div className="divide-y divide-slate-100">
          {holidays.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No festival holidays configured.</div>
          ) : (
            holidays.map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {h.date}
                  </span>
                  <span className="font-semibold text-slate-900">{h.name}</span>
                  {h.description && <span className="text-slate-400 text-[11px]">— {h.description}</span>}
                </div>

                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Remove holiday"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
