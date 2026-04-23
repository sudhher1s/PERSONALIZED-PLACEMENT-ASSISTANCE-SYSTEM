import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Users, FileText, TrendingUp, Search,
  ChevronDown, ChevronUp, Download, Star, Award,
  Briefcase, GraduationCap, Code2, Filter, SortAsc,
  LogOut, UserCheck, BarChart3, Trophy, Mail, Send, X, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

interface Candidate {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  education?: {
    btechCgpa?: number;
    tenthPercent?: number;
    twelfthPercent?: number;
    collegeName?: string;
    branch?: string;
    year?: string;
  };
  career?: { careerPath?: string; targetCompany?: string; targetLpa?: number };
  experience?: { projectCount?: number; internshipsCount?: number; technologies?: string[] };
  hasResume: boolean;
  resumeUrl?: string;
  readiness: number;
  interviewScore?: number | null;
  interviewBreakdown?: {
    overall?: number | null;
    communication?: number | null;
    dsa?: number | null;
    technical?: number | null;
  } | null;
}

interface Stats {
  companyName?: string;
  hiringFor?: string;
  totalCandidates: number;
  withResume: number;
  highInterviewScore: number;
}

const SORT_OPTIONS = [
  { value: "readiness", label: "Placement Readiness" },
  { value: "interview", label: "Interview Score" },
  { value: "resume", label: "Resume Priority" },
];

const CAREER_PATHS = [
  "All", "Full Stack Developer", "Backend Developer", "Frontend Developer",
  "Java Developer", "Python Developer", "DevOps Engineer", "Data Analyst",
  "ML Engineer", "App Developer",
];

function ReadinessBadge({ value }: { value: number }) {
  if (value >= 70) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">High</span>;
  if (value >= 45) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">Medium</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400">Low</span>;
}

function ScoreBar({ label, value }: { label: string; value?: number | null }) {
  const pct = Math.min(Math.max((value ?? 0) / 10 * 100, 0), 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium">{value != null ? `${value}/10` : "N/A"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{
            background: pct >= 70 ? "linear-gradient(90deg,#10b981,#34d399)" :
              pct >= 40 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" :
                "linear-gradient(90deg,#ef4444,#f87171)"
          }}
        />
      </div>
    </div>
  );
}

export default function CompanyDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inviteModal, setInviteModal] = useState<{ id: string; name: string } | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("readiness");
  const [filterPath, setFilterPath] = useState("All");

  const handleLogout = () => { logout(); navigate("/login"); };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsRes, studentsRes] = await Promise.all([
          api.companyStats(),
          api.companyStudents({ sort: sortBy, careerPath: filterPath !== "All" ? filterPath : undefined }),
        ]);
        setStats(statsRes);
        setCandidates(studentsRes.students ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sortBy, filterPath]);

  // Client-side search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(q) ||
        c.education?.collegeName?.toLowerCase().includes(q) ||
        c.education?.branch?.toLowerCase().includes(q) ||
        c.career?.careerPath?.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const handleDownloadResume = (candidate: Candidate) => {
    if (!candidate.resumeUrl) return;
    const link = document.createElement("a");
    link.href = candidate.resumeUrl;
    link.download = `${candidate.fullName?.replace(/\s+/g, "_") ?? "resume"}_resume.pdf`;
    link.click();
  };

  const handleSendInvite = async () => {
    if (!inviteModal) return;
    setInviteSending(true);
    try {
      const res = await api.companySendInvite(inviteModal.id, inviteMessage || undefined);
      toast({ title: "✅ Invite Sent!", description: res.message });
      setInvitedIds((prev) => new Set(prev).add(inviteModal.id));
      setInviteModal(null);
      setInviteMessage("");
    } catch (err: any) {
      toast({ title: "❌ Failed", description: err?.error ?? "Could not send invite.", variant: "destructive" });
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-16">
        {/* ── HERO HEADER ── */}
        <div className="relative overflow-hidden mb-8">
          <div className="absolute inset-0 gradient-hero opacity-40" />
          <div className="container mx-auto px-4 py-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow shrink-0">
                  <Building2 className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold">
                    {user?.companyName ?? "Company"} Dashboard
                  </h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    Hiring for <span className="text-primary font-semibold">{user?.hiringFor ?? "—"}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/company/profile">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <UserCheck className="w-4 h-4" /> Edit Profile
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" /> Logout
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4">
          {/* ── STAT CARDS ── */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { icon: Users, label: "Total Candidates", value: stats.totalCandidates, color: "from-violet-500 to-purple-600" },
                { icon: FileText, label: "With Resume", value: stats.withResume, color: "from-cyan-500 to-blue-600" },
                { icon: Star, label: "High Interview Score", value: stats.highInterviewScore, color: "from-amber-500 to-orange-500" },
                { icon: TrendingUp, label: "Avg Readiness", value: filtered.length > 0 ? `${Math.round(filtered.reduce((s, c) => s + c.readiness, 0) / filtered.length)}%` : "—", color: "from-emerald-500 to-teal-600" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-5"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3 shadow-md`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-2xl font-extrabold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── FILTER BAR ── */}
          <div className="glass-card p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, college, branch…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select value={filterPath} onValueChange={setFilterPath}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Career Path" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAREER_PATHS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <SortAsc className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setSortBy(o.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    sortBy === o.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── RESULTS COUNT ── */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> candidate{filtered.length !== 1 ? "s" : ""}
              {filterPath !== "All" && <> for <span className="text-primary font-medium">{filterPath}</span></>}
            </p>
            <p className="text-xs text-muted-foreground">Sorted by: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}</p>
          </div>

          {/* ── CANDIDATE CARDS ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
              />
              <p className="text-muted-foreground text-sm">Loading candidates…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="font-semibold text-lg mb-2">No Candidates Found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search query.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((candidate, rank) => (
                <motion.div
                  key={candidate.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rank * 0.04 }}
                  className="glass-card overflow-hidden"
                >
                  {/* Card Header */}
                  <div
                    className="p-5 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpanded(expanded === candidate.id ? null : candidate.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {rank === 0 ? (
                          <Trophy className="w-4 h-4 text-amber-400" />
                        ) : (
                          <span className="text-xs font-bold text-primary">#{rank + 1}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={candidate.avatarUrl} />
                        <AvatarFallback className="gradient-primary text-primary-foreground font-bold">
                          {candidate.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-base">{candidate.fullName}</span>
                          <ReadinessBadge value={candidate.readiness} />
                          {candidate.hasResume && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Resume
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                          {candidate.education?.collegeName && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" />
                              {candidate.education.collegeName}
                            </span>
                          )}
                          {candidate.career?.careerPath && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {candidate.career.careerPath}
                            </span>
                          )}
                          {candidate.education?.branch && (
                            <span>{candidate.education.branch}</span>
                          )}
                        </div>
                      </div>

                      {/* Score column */}
                      <div className="shrink-0 text-right hidden sm:block">
                        <div className="text-2xl font-extrabold gradient-text">{Math.round(candidate.readiness)}%</div>
                        <div className="text-xs text-muted-foreground">Readiness</div>
                        {candidate.interviewScore != null && (
                          <div className="text-xs font-medium text-amber-400 mt-1">
                            Interview: {candidate.interviewScore}/10
                          </div>
                        )}
                      </div>

                      {/* Expand icon */}
                      <div className="shrink-0 text-muted-foreground">
                        {expanded === candidate.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {expanded === candidate.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-border pt-4">
                          <div className="grid md:grid-cols-3 gap-6">
                            {/* Education */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                                <GraduationCap className="w-3.5 h-3.5" /> Education
                              </h4>
                              <div className="space-y-1.5 text-sm">
                                {candidate.education?.btechCgpa && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">B.Tech CGPA</span>
                                    <span className="font-semibold">{candidate.education.btechCgpa}</span>
                                  </div>
                                )}
                                {candidate.education?.tenthPercent && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">10th %</span>
                                    <span className="font-semibold">{candidate.education.tenthPercent}%</span>
                                  </div>
                                )}
                                {candidate.education?.twelfthPercent && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">12th %</span>
                                    <span className="font-semibold">{candidate.education.twelfthPercent}%</span>
                                  </div>
                                )}
                                {candidate.education?.year && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Year</span>
                                    <span className="font-semibold">{candidate.education.year}</span>
                                  </div>
                                )}
                              </div>

                              {/* Tech Stack */}
                              {(candidate.experience?.technologies ?? []).length > 0 && (
                                <div className="mt-4">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Code2 className="w-3.5 h-3.5" /> Tech Stack
                                  </h4>
                                  <div className="flex flex-wrap gap-1.5">
                                    {candidate.experience!.technologies!.map((t) => (
                                      <span key={t} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Interview Scores */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                                <BarChart3 className="w-3.5 h-3.5" /> Interview Breakdown
                              </h4>
                              {candidate.interviewBreakdown ? (
                                <div className="space-y-3">
                                  <ScoreBar label="Overall" value={candidate.interviewBreakdown.overall} />
                                  <ScoreBar label="Communication" value={candidate.interviewBreakdown.communication} />
                                  <ScoreBar label="DSA" value={candidate.interviewBreakdown.dsa} />
                                  <ScoreBar label="Technical" value={candidate.interviewBreakdown.technical} />
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">No interview session recorded yet.</p>
                              )}
                            </div>

                            {/* Readiness + Experience + Resume */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5" /> Placement Readiness
                              </h4>

                              {/* Readiness gauge */}
                              <div className="flex items-center gap-3 mb-4">
                                <div className="relative w-16 h-16 shrink-0">
                                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border" />
                                    <circle
                                      cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                                      stroke={candidate.readiness >= 70 ? "#10b981" : candidate.readiness >= 45 ? "#f59e0b" : "#ef4444"}
                                      strokeDasharray={`${candidate.readiness} 100`}
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                                    {Math.round(candidate.readiness)}%
                                  </div>
                                </div>
                                <div>
                                  <ReadinessBadge value={candidate.readiness} />
                                  <p className="text-xs text-muted-foreground mt-1">Placement Probability</p>
                                </div>
                              </div>

                              {/* Experience */}
                              <div className="space-y-1.5 text-sm mb-4">
                                {candidate.experience?.projectCount != null && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Projects</span>
                                    <span className="font-semibold">{candidate.experience.projectCount}</span>
                                  </div>
                                )}
                                {candidate.experience?.internshipsCount != null && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Internships</span>
                                    <span className="font-semibold">{candidate.experience.internshipsCount}</span>
                                  </div>
                                )}
                              </div>

                              {/* Resume Download */}
                              {candidate.hasResume ? (
                                <Button
                                  size="sm"
                                  className="w-full gradient-primary text-primary-foreground border-0 gap-2"
                                  onClick={() => handleDownloadResume(candidate)}
                                >
                                  <Download className="w-4 h-4" /> Download Resume (PDF)
                                </Button>
                              ) : (
                                <div className="text-xs text-muted-foreground italic text-center py-2">
                                  No resume uploaded by candidate.
                                </div>
                              )}

                              {/* Send Interview Invite */}
                              <Button
                                size="sm"
                                variant={invitedIds.has(candidate.id) ? "outline" : "default"}
                                className={`w-full mt-2 gap-2 ${
                                  invitedIds.has(candidate.id)
                                    ? "border-emerald-500/40 text-emerald-600"
                                    : "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:from-amber-600 hover:to-orange-600"
                                }`}
                                disabled={invitedIds.has(candidate.id)}
                                onClick={() => setInviteModal({ id: candidate.id, name: candidate.fullName || "Student" })}
                              >
                                {invitedIds.has(candidate.id) ? (
                                  <><UserCheck className="w-4 h-4" /> Invite Sent ✓</>
                                ) : (
                                  <><Mail className="w-4 h-4" /> Send Interview Invite</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Invite Modal ── */}
      <AnimatePresence>
        {inviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => { setInviteModal(null); setInviteMessage(""); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-md p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setInviteModal(null); setInviteMessage(""); }}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold">Send Interview Invite</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Invite <span className="text-primary font-semibold">{inviteModal.name}</span> for an interview
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                    Custom Message (Optional)
                  </label>
                  <textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="e.g., We were impressed by your profile and would love to schedule a technical interview..."
                    className="w-full h-24 px-3 py-2 rounded-xl border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right mt-0.5">{inviteMessage.length}/2000</p>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setInviteModal(null); setInviteMessage(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:from-amber-600 hover:to-orange-600 gap-2"
                    onClick={handleSendInvite}
                    disabled={inviteSending}
                  >
                    {inviteSending ? "Sending..." : <><Send className="w-4 h-4" /> Send Invite</>}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
