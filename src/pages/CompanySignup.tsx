import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Mail, Lock, ArrowRight, CheckCircle2,
  KeyRound, User, Briefcase, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

type Stage = "email" | "otp" | "details";

export default function CompanySignup() {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    hiringFor: "",
  });

  const { signup } = useAuth();
  const navigate = useNavigate();

  // ── Stage 1: Send OTP ──
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Please enter a valid email address.");
    }
    setOtpLoading(true);
    try {
      await api.companyOtpSend(email.trim().toLowerCase());
      toast({ title: "OTP Sent!", description: "Check your email inbox for the 6-digit code." });
      setStage("otp");
    } catch (err: any) {
      setError(err?.error ?? "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Stage 2: Verify OTP ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6) return setError("Please enter the 6-digit OTP.");
    setVerifyLoading(true);
    try {
      await api.companyOtpVerify(email.trim().toLowerCase(), otp.trim());
      toast({ title: "Email Verified!", description: "Complete your company profile." });
      setStage("details");
    } catch (err: any) {
      setError(err?.error ?? "Invalid or expired OTP.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Stage 3: Submit ──
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim()) return setError("Please enter your full name.");
    if (!form.companyName.trim()) return setError("Please enter the company name.");
    if (!form.hiringFor.trim()) return setError("Please specify the role you are hiring for.");
    if (!/^[0-9]{10}$/.test(form.phone.trim())) return setError("Phone must be 10 digits.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");

    setSignupLoading(true);
    try {
      await signup({
        role: "company_admin",
        fullName: form.fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        companyName: form.companyName.trim(),
        hiringFor: form.hiringFor.trim(),
        education: {},
        experience: {},
        career: {},
      });
      toast({ title: "Welcome aboard!", description: "Your company account is ready." });
      navigate("/company");
    } catch (err: any) {
      setError(err?.error ?? "Signup failed. Please try again.");
    } finally {
      setSignupLoading(false);
    }
  };

  const stageIcons = [
    { icon: Mail, label: "Email" },
    { icon: ShieldCheck, label: "Verify" },
    { icon: Building2, label: "Profile" },
  ];
  const stageIndex = stage === "email" ? 0 : stage === "otp" ? 1 : 2;

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
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">Company Sign Up</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create a recruiter account to find top talent
              </p>
            </div>

            {/* Progress Stepper */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {stageIcons.map((s, i) => (
                <div key={s.label} className="flex items-center">
                  <div
                    className={
                      i < stageIndex
                        ? "stepper-dot-completed"
                        : i === stageIndex
                        ? "stepper-dot-active"
                        : "stepper-dot-pending"
                    }
                  >
                    {i < stageIndex ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <s.icon className="w-4 h-4" />
                    )}
                  </div>
                  {i < stageIcons.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${i < stageIndex ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* Stage 1 — Email */}
              {stage === "email" && (
                <motion.form
                  key="email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSendOtp}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="company-email">Company Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="company-email"
                        type="email"
                        placeholder="recruiter@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full gradient-primary text-primary-foreground border-0 gap-2"
                    disabled={otpLoading}
                  >
                    {otpLoading ? "Sending OTP..." : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    We'll send a 6-digit verification code to your email.
                  </p>
                </motion.form>
              )}

              {/* Stage 2 — OTP */}
              {stage === "otp" && (
                <motion.form
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-4"
                >
                  <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20 mb-2">
                    <Mail className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">OTP sent to</p>
                    <p className="text-sm text-primary font-bold">{email}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp-input">6-Digit OTP</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="otp-input"
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

                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setStage("email"); setError(null); setOtp(""); }}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 gradient-primary text-primary-foreground border-0 gap-2"
                      disabled={verifyLoading}
                    >
                      {verifyLoading ? "Verifying..." : <>Verify <ShieldCheck className="w-4 h-4" /></>}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => handleSendOtp({ preventDefault: () => {} } as any)}
                    disabled={otpLoading}
                  >
                    {otpLoading ? "Resending..." : "Resend OTP"}
                  </Button>
                </motion.form>
              )}

              {/* Stage 3 — Company Details */}
              {stage === "details" && (
                <motion.form
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSignup}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2 col-span-2">
                      <Label>Your Full Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="John Smith"
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Company Name *</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Acme Corp"
                          value={form.companyName}
                          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Hiring For (Role) *</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Full Stack Developer"
                          value={form.hiringFor}
                          onChange={(e) => setForm({ ...form, hiringFor: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Phone *</Label>
                      <Input
                        type="tel"
                        placeholder="10-digit mobile"
                        maxLength={10}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Min 8 chars"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Confirm *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Re-enter"
                          value={form.confirmPassword}
                          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full gradient-primary text-primary-foreground border-0 gap-2"
                    disabled={signupLoading}
                  >
                    {signupLoading ? "Creating Account..." : <>Create Company Account <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Login
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
