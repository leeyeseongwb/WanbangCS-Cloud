import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";

// Global task state via window events
window._tasks = [];
window._taskListeners = [];

function notifyTaskListeners() {
  window._taskListeners.forEach(fn => fn([...window._tasks]));
}

window.addTask = function(type, title) {
  const id = Date.now() + Math.random();
  window._tasks.push({ id, type, title, progress: 0, status: "running" });
  notifyTaskListeners();
  return id;
};

window.updateTask = function(id, updates) {
  const task = window._tasks.find(t => t.id === id);
  if (task) { Object.assign(task, updates); notifyTaskListeners(); }
};

window.removeTask = function(id) {
  window._tasks = window._tasks.filter(t => t.id !== id);
  notifyTaskListeners();
};

function TaskBar() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const listener = () => setTasks([...window._tasks]);
    window._taskListeners.push(listener);
    setTasks([...window._tasks]);
    return () => { window._taskListeners = window._taskListeners.filter(fn => fn !== listener); };
  }, []);

  const runningTasks = tasks.filter(t => t.status === "running");
  if (runningTasks.length === 0) return null;

  const handleCancel = (task) => {
    if (task.cancelling) return;
    try { task.onCancel?.(); } catch (e) { console.warn(e); }
    // Mark as cancelling so the button reflects the in-progress cancel.
    window.updateTask(task.id, { cancelling: true, title: `${task.title} (cancelling…)` });
  };

  return (
    <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl">
      {runningTasks.map(task => (
        <div key={task.id} className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-sm font-medium flex items-center gap-2 min-w-0">
              <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              <span className="truncate">{task.title}</span>
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-mono text-muted-foreground">{Math.round(task.progress)}%</span>
              {typeof task.onCancel === "function" && (
                <button
                  onClick={() => handleCancel(task)}
                  disabled={task.cancelling}
                  title="Cancel"
                  className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500 ease-out bg-primary" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};
const pageTransition = { duration: 0.3, ease: "easeOut" };

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />} />
          <Route path="/" element={<Home />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, navigateToLogin } = useAuth();
  if (isLoadingAuth) {
    return <div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }
  if (authError) {
    if (authError.type === 'user_not_registered') return <div className="fixed inset-0 flex items-center justify-center"><p>User not registered</p></div>;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }
  return <AnimatedRoutes />;
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <TaskBar />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
