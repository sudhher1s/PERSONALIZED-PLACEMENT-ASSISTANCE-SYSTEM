import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Mail, Lock, ArrowRight, KeyRound, Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

type LoginMode = "password" | "otp-email" | "otp-verify";

export default function Login() {
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, setUserFromToken } = useAuth();

  function redirectByToken() {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role === "admin") return navigate("/admin");
        if (payload.role === "company_admin") return navigate("/company");
      } catch { /* fallback */ }
    }
    navigate("/dashboard");
  }

  // ── Password Login ──
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      redirectByToken();
    } catch (err: any) {
      setError(err?.error ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Step 1: Send OTP ──
  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Please enter a valid email.");
    }
    setLoading(true);
    try {
      await api.loginOtpSend(email.trim().toLowerCase());
      toast({ title: "OTP Sent!", description: "Check your email inbox for the 6-digit code." });
      setLoginMode("otp-verify");
    } catch (err: any) {
      setError(err?.error ?? "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Step 2: Verify & Login ──
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6) return setError("Please enter the 6-digit OTP.");
    setLoading(true);
    try {
      const res = await api.loginOtpVerify(email.trim().toLowerCase(), otp.trim());
      // Save token & set user
      localStorage.setItem("auth_token", res.token);
      if (setUserFromToken) {
        setUserFromToken(res.token, res.user);
      }
      toast({ title: "Welcome back!", description: "Logged in successfully." });
      // Redirect by role
      const payload = JSON.parse(atob(res.token.split(".")[1]));
      if (payload.role === "admin") navigate("/admin");
      else if (payload.role === "company_admin") navigate("/company");
      else navigate("/dashboard");
    } catch (err: any) {
      setError(err?.error ?? "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  const isOtpMode = loginMode === "otp-email" || loginMode === "otp-verify";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">Welcome Back</h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in to continue your journey</p>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-muted/50 rounded-xl">
              <button
                onClick={() => { setLoginMode("password"); setError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  !isOtpMode
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                Password
              </button>
              <button
                onClick={() => { setLoginMode("otp-email"); setError(null); setOtp(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  isOtpMode
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mail className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                Email OTP
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* ── PASSWORD MODE ── */}
              {loginMode === "password" && (
                <motion.form
                  key="password"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handlePasswordLogin}
                  className="space-y-4"
                >
                  {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email / Username</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="text"
                        placeholder="you@example.com or admin"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      Forgot Password?
                    </Link>
                  </div>

                  <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0 gap-2" disabled={loading}>
                    {loading ? "Signing In..." : <> Sign In <ArrowRight className="w-4 h-4" /> </>}
                  </Button>
                </motion.form>
              )}

              {/* ── OTP: ENTER EMAIL ── */}
              {loginMode === "otp-email" && (
                <motion.form
                  key="otp-email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSendLoginOtp}
                  className="space-y-4"
                >
                  {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

                  <div className="text-center p-3 bg-primary/5 rounded-xl border border-primary/20 mb-2">
                    <Mail className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">We'll send a 6-digit login code to your registered email.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp-email-input">Your Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="otp-email-input"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0 gap-2" disabled={loading}>
                    {loading ? "Sending OTP..." : <> Send OTP <ArrowRight className="w-4 h-4" /> </>}
                  </Button>
                </motion.form>
              )}

              {/* ── OTP: VERIFY ── */}
              {loginMode === "otp-verify" && (
                <motion.form
                  key="otp-verify"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleVerifyLoginOtp}
                  className="space-y-4"
                >
                  {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

                  <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20 mb-2">
                    <Mail className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">OTP sent to</p>
                    <p className="text-sm text-primary font-bold">{email}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp-code">6-Digit OTP</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="otp-code"
                        type="text"
                        maxLength={6}
                        placeholder="••••••"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="pl-10 text-center text-xl tracking-widest font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setLoginMode("otp-email"); setError(null); setOtp(""); }}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 gradient-primary text-primary-foreground border-0 gap-2"
                      disabled={loading}
                    >
                      {loading ? "Verifying..." : <> Verify & Login <ShieldCheck className="w-4 h-4" /> </>}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => handleSendLoginOtp({ preventDefault: () => {} } as any)}
                    disabled={loading}
                  >
                    {loading ? "Resending..." : "Resend OTP"}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-5 pt-5 border-t border-border">
              <Link to="/company/signup">
                <Button variant="outline" className="w-full gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-primary" />
                  Company / Recruiter? Sign up here
                </Button>
              </Link>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Don't have a student account?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
