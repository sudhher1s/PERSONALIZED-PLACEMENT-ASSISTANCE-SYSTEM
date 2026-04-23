import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { User } from "../models/User";
import mongoose from "mongoose";
import { z } from "zod";
import { sendEmail } from "../services/mailer";

export const companyRouter = Router();

// All company routes require authentication as company_admin
companyRouter.use(requireAuth, requireRole("company_admin"));

// ─── GET /api/company/stats ───────────────────────────────────────────────
companyRouter.get("/stats", async (req, res) => {
  const companyUser = await User.findById(req.user!.userId);
  if (!companyUser) return res.status(404).json({ error: "Company not found" });

  const hiringFor = companyUser.hiringFor;

  // Query students
  const matchFilter: any = { role: "student" };
  if (hiringFor) {
    matchFilter["profile.career.careerPath"] = { $regex: new RegExp(hiringFor, "i") };
  }

  const students = await User.find(matchFilter).lean();

  const totalCandidates = students.length;
  const withResume = students.filter((s: any) => s.resumeUrl).length;

  // Pull latest interview sessions to count high scorers
  const InterviewSession = getInterviewModel();
  let highInterviewScore = 0;
  if (InterviewSession) {
    const sessions = await InterviewSession.find({
      userId: { $in: students.map((s: any) => s._id) },
    }).lean();
    const best: Record<string, number> = {};
    for (const s of sessions as any[]) {
      const uid = String(s.userId);
      const score = s.overallScore ?? s.score ?? 0;
      if (!best[uid] || score > best[uid]) best[uid] = score;
    }
    highInterviewScore = Object.values(best).filter((v) => v >= 7).length;
  }

  return res.json({
    companyName: companyUser.companyName,
    hiringFor: companyUser.hiringFor,
    totalCandidates,
    withResume,
    highInterviewScore,
    highReadiness: 0, // filled below if needed
  });
});

// ─── GET /api/company/students ────────────────────────────────────────────
// Query params: sort (readiness|interview|resume), careerPath, search
companyRouter.get("/students", async (req, res) => {
  const companyUser = await User.findById(req.user!.userId);
  if (!companyUser) return res.status(404).json({ error: "Company not found" });

  const { sort = "readiness", careerPath, search } = req.query as Record<string, string>;

  const matchFilter: any = { role: "student" };

  // Filter by career path (company's hiringFor takes precedence unless an explicit filter passed)
  const targetPath = careerPath || companyUser.hiringFor;
  if (targetPath) {
    matchFilter["profile.career.careerPath"] = { $regex: new RegExp(targetPath, "i") };
  }

  // Search filter on name / college
  if (search && search.trim()) {
    const re = new RegExp(search.trim(), "i");
    matchFilter.$or = [
      { "profile.fullName": re },
      { "profile.education.collegeName": re },
      { "profile.education.branch": re },
    ];
  }

  const students = await User.find(matchFilter)
    .select("-passwordHash")
    .lean() as any[];

  // Pull interview sessions
  const InterviewSession = getInterviewModel();
  const sessionMap: Record<string, any> = {};
  if (InterviewSession) {
    const sessions = await InterviewSession.find({
      userId: { $in: students.map((s: any) => s._id) },
    }).lean() as any[];

    // Keep only latest session per user
    for (const s of sessions) {
      const uid = String(s.userId);
      if (!sessionMap[uid] || new Date(s.createdAt) > new Date(sessionMap[uid].createdAt)) {
        sessionMap[uid] = s;
      }
    }
  }

  // Pull placement predictions
  const PredictionModel = getPredictionModel();
  const predMap: Record<string, number> = {};
  if (PredictionModel) {
    const preds = await PredictionModel.find({
      userId: { $in: students.map((s: any) => s._id) },
    }).lean() as any[];
    for (const p of preds) {
      const uid = String(p.userId);
      predMap[uid] = p.probability ?? p.placementProbability ?? 0;
    }
  }

  // Build enriched list
  const enriched = students.map((s) => {
    const uid = String(s._id);
    const session = sessionMap[uid];
    const readiness = predMap[uid] ?? computeFallbackReadiness(s);

    return {
      id: uid,
      studentId: s.studentId,
      fullName: s.profile?.fullName,
      email: s.profile?.email,
      avatarUrl: s.profile?.avatarUrl,
      education: s.profile?.education,
      career: s.profile?.career,
      experience: s.profile?.experience,
      hasResume: Boolean(s.resumeUrl),
      resumeUrl: s.resumeUrl ?? null,
      readiness: Math.round(readiness * 100) / 100,
      interviewScore: session?.overallScore ?? session?.score ?? null,
      interviewBreakdown: session
        ? {
            overall: session.overallScore ?? session.score ?? null,
            communication: session.communicationScore ?? null,
            dsa: session.dsaScore ?? null,
            technical: session.technicalScore ?? null,
          }
        : null,
      latestExamScore: null, // could enrich later
    };
  });

  // Sort
  enriched.sort((a, b) => {
    if (sort === "interview") {
      return (b.interviewScore ?? -1) - (a.interviewScore ?? -1);
    }
    if (sort === "resume") {
      if (a.hasResume && !b.hasResume) return -1;
      if (!a.hasResume && b.hasResume) return 1;
      return b.readiness - a.readiness;
    }
    // Default: readiness
    return b.readiness - a.readiness;
  });

  return res.json({ students: enriched });
});

// ─── POST /api/company/send-invite ────────────────────────────────────────
// Send interview invitation email to a student
const inviteSchema = z.object({
  studentId: z.string().min(1),
  message: z.string().max(2000).optional(),
});

companyRouter.post("/send-invite", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request. Provide studentId." });

  const companyUser = await User.findById(req.user!.userId);
  if (!companyUser) return res.status(404).json({ error: "Company not found" });

  const student = await User.findById(parsed.data.studentId);
  if (!student || student.role !== "student") {
    return res.status(404).json({ error: "Student not found" });
  }

  const studentEmail = student.profile?.email;
  const studentName = student.profile?.fullName || "Student";
  if (!studentEmail) return res.status(400).json({ error: "Student has no email address." });

  const companyName = companyUser.companyName || "A Company";
  const hiringFor = companyUser.hiringFor || "a role";
  const recruiterName = companyUser.profile?.fullName || "Recruiter";
  const customMessage = parsed.data.message?.trim() || "";

  const emailResult = await sendEmail({
    to: studentEmail,
    subject: `🎉 Interview Invitation from ${companyName} — PlacePrep`,
    text:
      `Hi ${studentName},\n\n` +
      `Great news! ${companyName} has reviewed your profile on PlacePrep and would like to invite you for an interview.\n\n` +
      `Role: ${hiringFor}\n` +
      `Recruiter: ${recruiterName}\n` +
      (customMessage ? `\nMessage from recruiter:\n${customMessage}\n` : "") +
      `\nPlease log in to PlacePrep to view your profile and prepare.\n\n` +
      `Best regards,\n${companyName} via PlacePrep`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#6c63ff,#9c5fff);padding:32px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🎉</div>
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Interview Invitation</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">from ${companyName}</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:16px;margin:0 0 16px;">Hi <strong>${studentName}</strong>,</p>
          <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Great news! <strong>${companyName}</strong> has reviewed your profile on PlacePrep and would like to invite you for an interview for the position of:
          </p>

          <!-- Role Card -->
          <div style="background:linear-gradient(135deg,#f0edff,#e8e4ff);border:1px solid #d4d0ff;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#8b83c7;margin-bottom:4px;">Position</div>
            <div style="font-size:20px;font-weight:700;color:#6c63ff;">${hiringFor}</div>
          </div>

          <!-- Recruiter Info -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px 16px;background:#f9f9fb;border-radius:10px;">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#9c5fff);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">${recruiterName.charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-size:14px;font-weight:600;color:#333;">${recruiterName}</div>
              <div style="font-size:12px;color:#888;">Recruiter at ${companyName}</div>
            </div>
          </div>

          ${customMessage ? `
          <!-- Custom Message -->
          <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin-bottom:6px;font-weight:600;">Message from Recruiter</div>
            <p style="color:#78350f;font-size:14px;line-height:1.6;margin:0;">${customMessage}</p>
          </div>
          ` : ""}

          <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 24px;">
            Please make sure your profile is up-to-date and your resume is uploaded. Prepare well and give it your best!
          </p>

          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:16px;">
            <a href="http://localhost:8080/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#9c5fff);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(108,99,255,0.35);">
              View Your Dashboard →
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #eee;text-align:center;">
          <p style="color:#aaa;font-size:11px;margin:0;">Sent via PlacePrep Placement Assistance System</p>
        </div>
      </div>`,
  });

  if (!emailResult.ok && !emailResult.skipped) {
    console.error("[Company] Invite email failed:", emailResult.error);
    return res.status(500).json({ error: `Failed to send invite email: ${emailResult.error}` });
  }

  console.log(`[Company] Interview invite sent from ${companyName} to ${studentEmail}`);
  return res.json({ ok: true, message: `Interview invitation sent to ${studentName} (${studentEmail})` });
});

// ─── Helpers ─────────────────────────────────────────────────────────────

function computeFallbackReadiness(student: any): number {
  const edu = student.profile?.education ?? {};
  const exp = student.profile?.experience ?? {};
  const career = student.profile?.career ?? {};

  let score = 0;
  let total = 0;

  if (edu.btechCgpa != null) { score += (edu.btechCgpa / 10) * 30; total += 30; }
  if (edu.tenthPercent != null) { score += (edu.tenthPercent / 100) * 10; total += 10; }
  if (edu.twelfthPercent != null) { score += (edu.twelfthPercent / 100) * 10; total += 10; }
  if (exp.projectCount != null) { score += Math.min(exp.projectCount / 5, 1) * 15; total += 15; }
  if (exp.internshipsCount != null) { score += Math.min(exp.internshipsCount / 2, 1) * 15; total += 15; }
  const dsaMap: Record<string, number> = { Beginner: 0.3, Intermediate: 0.65, Advanced: 1 };
  if (career.dsaLevel) { score += (dsaMap[career.dsaLevel] ?? 0) * 10; total += 10; }
  if (career.softSkillsLevel) { score += (dsaMap[career.softSkillsLevel] ?? 0) * 10; total += 10; }

  return total > 0 ? Math.min((score / total) * 100, 100) : 50;
}

function getInterviewModel() {
  try {
    return mongoose.model("InterviewSession");
  } catch {
    return null;
  }
}

function getPredictionModel() {
  try {
    return mongoose.model("PlacementPrediction");
  } catch {
    return null;
  }
}
