import { useState } from "react";
import { HardDrive, Eye, EyeOff, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { hashPassword, saveSession } from "@/lib/auth";
import { toast } from "sonner";
import DarkModeToggle from "@/components/DarkModeToggle";
import { motion, AnimatePresence } from "framer-motion";

const REGISTRATION_CODE = "WanbangCS2026Admin";

// Live password requirement checks
function getPasswordChecks(pw) {
  return [
    { label: "8–20 characters", ok: pw.length >= 8 && pw.length <= 20 },
    { label: "At least one uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "At least one special character", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw) },
  ];
}

function getUsernameError(username) {
  if (!username) return "";
  if (username.length < 4) return "Username must be at least 4 characters.";
  return "";
}

function FieldError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs text-destructive flex items-center gap-1 mt-1"
        >
          <XCircle className="h-3 w-3 flex-shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function PasswordChecklist({ password }) {
  const checks = getPasswordChecks(password);
  const hasInput = password.length > 0;
  return (
    <AnimatePresence>
      {hasInput && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-2 space-y-1 overflow-hidden"
        >
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-1.5 text-[11px]">
              {c.ok ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
              )}
              <span className={c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                {c.label}
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AuthPage({ onSuccess, onBack }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [regCode, setRegCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Touched state for validation feedback
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const reset = () => {
    setUsername(""); setPassword(""); setConfirmPassword("");
    setRegCode(""); setShowPw(false); setLoginError("");
    setUsernameTouched(false); setPasswordTouched(false); setConfirmTouched(false);
  };

  const usernameError = usernameTouched ? getUsernameError(username) : "";
  const pwChecks = getPasswordChecks(password);
  const pwValid = pwChecks.every((c) => c.ok);
  const confirmError = confirmTouched && confirmPassword && password !== confirmPassword
    ? "Passwords do not match." : "";

  // Red border logic
  const usernameBorder = usernameError ? "border-destructive focus-visible:ring-destructive" : "";
  const passwordBorder = passwordTouched && !pwValid && password.length > 0 ? "border-destructive focus-visible:ring-destructive" : "";
  const confirmBorder = confirmError ? "border-destructive focus-visible:ring-destructive" : "";

  const handleRegister = async () => {
    setUsernameTouched(true); setPasswordTouched(true); setConfirmTouched(true);
    if (username.trim().length < 4) return;
    if (!pwValid) return;
    if (password !== confirmPassword) return;
    if (regCode !== REGISTRATION_CODE) { toast.error("Invalid registration code."); return; }

    setLoading(true);
    const existing = await base44.entities.Manager.filter({ username: username.trim() });
    if (existing.length > 0) {
      toast.error("Username already taken.");
      setLoading(false);
      return;
    }
    await base44.entities.Manager.create({ username: username.trim(), password_hash: hashPassword(password) });
    saveSession(username.trim());
    toast.success("Account created! Welcome, " + username.trim());
    setLoading(false);
    onSuccess(username.trim());
  };

  const handleLogin = async () => {
    setUsernameTouched(true);
    setLoginError("");
    if (!username.trim() || !password) { setLoginError("Please fill in all fields."); return; }
    setLoading(true);
    const managers = await base44.entities.Manager.filter({ username: username.trim() });
    if (managers.length === 0 || managers[0].password_hash !== hashPassword(password)) {
      setLoginError("Incorrect username or password. Please try again.");
      setLoading(false);
      return;
    }
    saveSession(username.trim());
    toast.success("Welcome back, " + username.trim() + "!");
    setLoading(false);
    onSuccess(username.trim());
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><DarkModeToggle /></div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg"
          >
            <HardDrive className="h-7 w-7 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold font-heading">WBCS Disk</h1>
          <p className="text-sm text-muted-foreground mt-1">Manager Portal</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {/* Tabs */}
          <div className="flex bg-secondary rounded-xl p-1 mb-6">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); reset(); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === m ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Login" : "Register"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-4"
            >
              {/* Username */}
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={() => setUsernameTouched(true)}
                  placeholder="Enter username"
                  autoComplete="username"
                  className={`transition-colors duration-200 ${usernameBorder}`}
                />
                <FieldError message={usernameError} />
                {mode === "register" && !usernameError && usernameTouched && username.length >= 4 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Looks good!
                  </motion.p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordTouched(true); }}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder="Enter password"
                    className={`pr-10 transition-colors duration-200 ${passwordBorder}`}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "register" && <PasswordChecklist password={password} />}
              </div>

              {/* Register-only fields */}
              {mode === "register" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => setConfirmTouched(true)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      className={`transition-colors duration-200 ${confirmBorder}`}
                    />
                    <FieldError message={confirmError} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Registration Code</Label>
                    <Input
                      type="password"
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value)}
                      placeholder="Enter admin registration code"
                    />
                  </div>
                </>
              )}

              {/* Login error banner */}
              {mode === "login" && (
                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -6, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2.5 text-sm"
                    >
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                      {loginError}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              <Button
                onClick={mode === "login" ? handleLogin : handleRegister}
                disabled={loading}
                className="w-full mt-2"
              >
                {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          onClick={onBack}
          className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to WBCS Disk
        </button>
      </motion.div>
    </div>
  );
}