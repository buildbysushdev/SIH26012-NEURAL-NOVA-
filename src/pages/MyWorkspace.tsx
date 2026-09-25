import { useState, useEffect } from "react";
import {
  CheckSquare,
  FileText,
  BellRing,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Tag,
  Save,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useToast } from "../context/ToastContext";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: "High" | "Medium" | "Normal";
  dueDate?: string;
  createdAt: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

interface Reminder {
  id: string;
  title: string;
  date: string;
  priority: "High" | "Medium" | "Low";
}

const DEFAULT_TASKS: Task[] = [
  {
    id: "tsk-1",
    title: "Verify duplicate work flag for Rural Community Center",
    completed: false,
    priority: "High",
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  },
  {
    id: "tsk-2",
    title: "Submit Q3 fund expenditure utilization summary to MoSPI",
    completed: false,
    priority: "High",
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  },
  {
    id: "tsk-3",
    title: "Conduct physical verification of delayed road surfacing",
    completed: true,
    priority: "Medium",
    dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_NOTES: Note[] = [
  {
    id: "not-1",
    title: "MPLADS Inspection Protocol Notes",
    content:
      "All community assets with sanctioned amount > ₹25 Lakhs require mandatory geo-tagged satellite image verification prior to releasing the 3rd payment milestone.",
    category: "Guidelines",
    updatedAt: new Date().toLocaleDateString("en-IN"),
  },
  {
    id: "not-2",
    title: "District Coordination Meeting Points",
    content:
      "Key discussion items: implementing agency reporting delays, road works quality anomalies, and resolution of citizen complaints within 14 statutory days.",
    category: "Meetings",
    updatedAt: new Date(Date.now() - 86400000 * 2).toLocaleDateString("en-IN"),
  },
];

const DEFAULT_REMINDERS: Reminder[] = [
  {
    id: "rem-1",
    title: "State Level Monitoring Committee Review",
    date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    priority: "High",
  },
  {
    id: "rem-2",
    title: "Quarterly Audit Reconciliation Deadline",
    date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    priority: "High",
  },
  {
    id: "rem-3",
    title: "District Engineers Bi-weekly Sync",
    date: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
    priority: "Medium",
  },
];

export default function MyWorkspace() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "tasks" | "notes" | "reminders" | "calendar">("all");

  // LocalStorage Persisted States
  const [tasks, setTasks] = useState<Task[]>(() => {
    const s = localStorage.getItem("mplads_workspace_tasks");
    return s ? JSON.parse(s) : DEFAULT_TASKS;
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    const s = localStorage.getItem("mplads_workspace_notes");
    return s ? JSON.parse(s) : DEFAULT_NOTES;
  });

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const s = localStorage.getItem("mplads_workspace_reminders");
    return s ? JSON.parse(s) : DEFAULT_REMINDERS;
  });

  useEffect(() => {
    localStorage.setItem("mplads_workspace_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("mplads_workspace_notes", JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem("mplads_workspace_reminders", JSON.stringify(reminders));
  }, [reminders]);

  // Tasks Form State
  const [taskInput, setTaskInput] = useState("");
  const [taskPriority, setTaskPriority] = useState<"High" | "Medium" | "Normal">("Normal");
  const [taskDueDate, setTaskDueDate] = useState("");

  // Notes Form State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("General");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Reminders Form State
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderPriority, setReminderPriority] = useState<"High" | "Medium" | "Low">("Medium");

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Task Actions
  function handleAddTask() {
    if (!taskInput.trim()) return;
    const newTask: Task = {
      id: `tsk-${Date.now()}`,
      title: taskInput.trim(),
      completed: false,
      priority: taskPriority,
      dueDate: taskDueDate || undefined,
      createdAt: new Date().toISOString(),
    };
    setTasks([newTask, ...tasks]);
    setTaskInput("");
    setTaskDueDate("");
    showToast("Task added to workspace.", "success");
  }

  function toggleTask(id: string) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  }

  function deleteTask(id: string) {
    setTasks(tasks.filter((t) => t.id !== id));
    showToast("Task removed.", "info");
  }

  // Note Actions
  function handleSaveNote() {
    if (!noteTitle.trim()) return;
    if (editingNoteId) {
      setNotes(
        notes.map((n) =>
          n.id === editingNoteId
            ? { ...n, title: noteTitle.trim(), content: noteContent.trim(), category: noteCategory, updatedAt: new Date().toLocaleDateString("en-IN") }
            : n
        )
      );
      setEditingNoteId(null);
      showToast("Note updated.", "success");
    } else {
      const newNote: Note = {
        id: `not-${Date.now()}`,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        category: noteCategory || "General",
        updatedAt: new Date().toLocaleDateString("en-IN"),
      };
      setNotes([newNote, ...notes]);
      showToast("Note created.", "success");
    }
    setNoteTitle("");
    setNoteContent("");
    setIsAddingNote(false);
  }

  function startEditNote(n: Note) {
    setEditingNoteId(n.id);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setNoteCategory(n.category);
    setIsAddingNote(true);
  }

  function deleteNote(id: string) {
    setNotes(notes.filter((n) => n.id !== id));
    showToast("Note deleted.", "info");
  }

  // Reminder Actions
  function handleAddReminder() {
    if (!reminderTitle.trim() || !reminderDate) {
      showToast("Please provide title and date for the reminder.", "error");
      return;
    }
    const newRem: Reminder = {
      id: `rem-${Date.now()}`,
      title: reminderTitle.trim(),
      date: reminderDate,
      priority: reminderPriority,
    };
    setReminders([...reminders, newRem].sort((a, b) => (a.date > b.date ? 1 : -1)));
    setReminderTitle("");
    setReminderDate("");
    showToast("Reminder scheduled.", "success");
  }

  function deleteReminder(id: string) {
    setReminders(reminders.filter((r) => r.id !== id));
    showToast("Reminder cleared.", "info");
  }

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("en-IN", { month: "long" });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Workspace Header */}
      <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              Official Workspace · मेरा कार्यक्षेत्र
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Personal operational tasks, compliance notes, scheduled statutory reminders, and event calendar.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-navy-800 p-1 rounded-md text-xs font-medium shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === "all"
                ? "bg-white dark:bg-navy-950 text-navy-900 dark:text-amber-400 shadow-sm font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
          >
            Dashboard Grid
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "tasks"
                ? "bg-white dark:bg-navy-950 text-navy-900 dark:text-amber-400 shadow-sm font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
          >
            <CheckSquare size={13} /> Tasks ({tasks.filter((t) => !t.completed).length})
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "notes"
                ? "bg-white dark:bg-navy-950 text-navy-900 dark:text-amber-400 shadow-sm font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
          >
            <FileText size={13} /> Notes ({notes.length})
          </button>
          <button
            onClick={() => setActiveTab("reminders")}
            className={`px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "reminders"
                ? "bg-white dark:bg-navy-950 text-navy-900 dark:text-amber-400 shadow-sm font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
          >
            <BellRing size={13} /> Reminders ({reminders.length})
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 ${
              activeTab === "calendar"
                ? "bg-white dark:bg-navy-950 text-navy-900 dark:text-amber-400 shadow-sm font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
            }`}
          >
            <CalendarIcon size={13} /> Calendar
          </button>
        </div>
      </div>

      {/* Main Content: 2x2 Grid or Focused Tab */}
      <div
        className={`grid gap-5 ${
          activeTab === "all" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-4xl mx-auto"
        }`}
      >
        {/* ===================== SUB-SECTION 1: MY TASKS ===================== */}
        {(activeTab === "all" || activeTab === "tasks") && (
          <Card className="flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <CheckSquare size={17} className="text-[#0b2545] dark:text-amber-400" />
                <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  My Tasks · कार्य सूची
                </h2>
              </div>
              <span className="text-[11px] font-semibold bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                {tasks.filter((t) => !t.completed).length} Pending
              </span>
            </div>

            {/* Add Task Input Form */}
            <div className="pt-3 pb-2 space-y-2">
              <div className="flex gap-2">
                <input
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  placeholder="Add a new official task or action item..."
                  className="flex-1 rounded border border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 outline-none focus:bg-white dark:focus:bg-navy-950 focus:border-[#0b2545] dark:focus:border-amber-400"
                />
                <Button size="sm" onClick={handleAddTask} icon={<Plus size={14} />}>
                  Add
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400 text-[11px]">Priority:</span>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="rounded border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400 text-[11px]">Due Date:</span>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="rounded border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-0.5 text-xs text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto max-h-80 divide-y divide-gray-100 dark:divide-navy-800 pr-1">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">No tasks in workspace.</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="py-2.5 flex items-start justify-between gap-3 group hover:bg-gray-50 dark:hover:bg-navy-800/40 px-1.5 rounded transition-colors"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="mt-0.5 text-gray-400 hover:text-navy-700 dark:hover:text-amber-400 shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs ${
                          task.completed
                            ? "line-through text-gray-400 dark:text-gray-500"
                            : "text-gray-800 dark:text-gray-200 font-medium"
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                            task.priority === "High"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : task.priority === "Medium"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-gray-100 text-gray-600 dark:bg-navy-800 dark:text-gray-400"
                          }`}
                        >
                          {task.priority}
                        </span>
                        {task.dueDate && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock size={10} /> {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity p-1"
                      title="Delete Task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* ===================== SUB-SECTION 2: MY NOTES ===================== */}
        {(activeTab === "all" || activeTab === "notes") && (
          <Card className="flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-[#0b2545] dark:text-amber-400" />
                <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  My Notes · टिप्पणियाँ
                </h2>
              </div>
              <Button
                size="sm"
                variant={isAddingNote ? "outline" : "primary"}
                onClick={() => {
                  if (isAddingNote) {
                    setIsAddingNote(false);
                    setEditingNoteId(null);
                    setNoteTitle("");
                    setNoteContent("");
                  } else {
                    setIsAddingNote(true);
                  }
                }}
                icon={<Plus size={13} />}
              >
                {isAddingNote ? "Cancel" : "New Note"}
              </Button>
            </div>

            {/* Note Editor */}
            {isAddingNote && (
              <div className="p-3 my-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-md space-y-2.5 animate-fade-in">
                <Input
                  label="Title"
                  placeholder="e.g. Audit Observation on Road Project"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Category / Tag"
                    placeholder="e.g. Compliance, Inspection"
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                  <textarea
                    rows={3}
                    placeholder="Write detailed observation, meeting points or guideline reference..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 p-2 text-xs text-gray-900 dark:text-gray-100 outline-none focus:border-[#0b2545] dark:focus:border-amber-400"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={handleSaveNote} icon={<Save size={13} />}>
                    Save Note
                  </Button>
                </div>
              </div>
            )}

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto max-h-80 space-y-2.5 pt-3 pr-1">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">No notes saved in workspace.</div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded border border-gray-200 dark:border-navy-800 bg-gray-50/60 dark:bg-navy-900/60 hover:border-gray-300 dark:hover:border-navy-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Tag size={12} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-navy-950 px-1.5 py-0.5 rounded">
                          {note.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditNote(note)}
                          className="text-[11px] text-gray-500 hover:text-navy-700 dark:hover:text-amber-400 px-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-[11px] text-red-500 hover:text-red-700 px-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-1">{note.title}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2 text-right">Updated: {note.updatedAt}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* ===================== SUB-SECTION 3: REMINDERS ===================== */}
        {(activeTab === "all" || activeTab === "reminders") && (
          <Card className="flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <BellRing size={17} className="text-[#0b2545] dark:text-amber-400" />
                <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Statutory Reminders · स्मरण-पत्र
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                Sorted by Upcoming Date
              </span>
            </div>

            {/* Add Reminder Form */}
            <div className="pt-3 pb-2 space-y-2">
              <div className="flex gap-2">
                <input
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="Reminder text (e.g. Joint Site Inspection)..."
                  className="flex-1 rounded border border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 outline-none focus:border-[#0b2545] dark:focus:border-amber-400"
                />
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="rounded border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
                />
                <Button size="sm" onClick={handleAddReminder} icon={<Plus size={14} />}>
                  Set
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 text-[11px]">Priority:</span>
                {(["High", "Medium", "Low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setReminderPriority(p)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                      reminderPriority === p
                        ? "border-[#0b2545] bg-[#0b2545] text-white dark:border-amber-400 dark:bg-amber-400 dark:text-navy-950 font-bold"
                        : "border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Reminder List */}
            <div className="flex-1 overflow-y-auto max-h-80 divide-y divide-gray-100 dark:divide-navy-800 pr-1">
              {reminders.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">No scheduled reminders.</div>
              ) : (
                reminders.map((rem) => {
                  const isSoon =
                    new Date(rem.date).getTime() - Date.now() < 86400000 * 3 &&
                    new Date(rem.date).getTime() >= Date.now() - 86400000;
                  return (
                    <div
                      key={rem.id}
                      className="py-2.5 flex items-center justify-between gap-3 group hover:bg-gray-50 dark:hover:bg-navy-800/40 px-1.5 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            rem.priority === "High" ? "bg-red-500" : rem.priority === "Medium" ? "bg-amber-500" : "bg-blue-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{rem.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <CalendarIcon size={10} /> {rem.date}
                            </span>
                            {isSoon && (
                              <span className="text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center gap-0.5">
                                <AlertCircle size={9} /> Due soon
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteReminder(rem.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity p-1"
                        title="Dismiss"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}

        {/* ===================== SUB-SECTION 4: MONTH CALENDAR ===================== */}
        {(activeTab === "all" || activeTab === "calendar") && (
          <Card className="flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <CalendarIcon size={17} className="text-[#0b2545] dark:text-amber-400" />
                <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                  Operational Calendar · पंचांग
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-600 dark:text-gray-300"
                  title="Previous Month"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-navy-950 dark:text-white px-1">
                  {monthName} {year}
                </span>
                <button
                  onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-600 dark:text-gray-300"
                  title="Next Month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Month View Grid */}
            <div className="pt-3">
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              <div className="grid grid-cols-7 gap-1 text-xs">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-9 sm:h-11 rounded bg-transparent" />;
                  }

                  const formattedDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayReminders = reminders.filter((r) => r.date === formattedDay);
                  const dayTasks = tasks.filter((t) => t.dueDate === formattedDay);
                  const hasEvents = dayReminders.length > 0 || dayTasks.length > 0;
                  const isSelected = selectedCalendarDate === formattedDay;
                  const isToday = new Date().toISOString().slice(0, 10) === formattedDay;

                  return (
                    <button
                      key={`day-${day}`}
                      onClick={() => setSelectedCalendarDate(isSelected ? null : formattedDay)}
                      className={`h-9 sm:h-11 rounded border flex flex-col items-center justify-between p-1 transition-all ${
                        isSelected
                          ? "border-[#0b2545] dark:border-amber-400 bg-navy-50 dark:bg-navy-800 font-bold shadow-sm"
                          : isToday
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 font-bold"
                          : "border-gray-100 dark:border-navy-800/80 hover:bg-gray-50 dark:hover:bg-navy-800/50 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span className={`text-[11px] ${isToday ? "text-amber-700 dark:text-amber-400" : ""}`}>
                        {day}
                      </span>
                      {hasEvents && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayReminders.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                          {dayTasks.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Date Detail Drawer */}
              {selectedCalendarDate && (
                <div className="mt-3 p-3 rounded-md bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 animate-fade-in">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 dark:border-navy-800">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      Agenda for {selectedCalendarDate}
                    </span>
                    <button
                      onClick={() => setSelectedCalendarDate(null)}
                      className="text-[10px] text-gray-400 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {reminders.filter((r) => r.date === selectedCalendarDate).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <BellRing size={12} />
                        <span>Reminder: {r.title} ({r.priority} Priority)</span>
                      </div>
                    ))}
                    {tasks.filter((t) => t.dueDate === selectedCalendarDate).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <CheckSquare size={12} />
                        <span>Task: {t.title}</span>
                      </div>
                    ))}
                    {!reminders.some((r) => r.date === selectedCalendarDate) &&
                      !tasks.some((t) => t.dueDate === selectedCalendarDate) && (
                        <p className="text-gray-400 text-xs">No scheduled tasks or reminders on this date.</p>
                      )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
