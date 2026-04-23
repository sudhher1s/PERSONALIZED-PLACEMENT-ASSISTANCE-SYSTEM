import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { ExamAttempt } from "../models/ExamAttempt";
import { getCareerQuestions, getQuestionsForExam, toPublicQuestion } from "../services/questionBank";
import { computeGrade } from "../services/grading";
import { User } from "../models/User";
import { ExamSession } from "../models/ExamSession";
import { checkAndUnlockExamBadges, recordActivity, utcDateKey } from "../services/gamification";
import { sendEmailInBackground } from "../services/mailer";

export const examRouter = Router();

const examTypeSchema = z.enum(["aptitude", "dsa", "soft_skills", "career"]);

examRouter.get("/status", requireAuth, async (req, res) => {
  const attempts = await ExamAttempt.find({ userId: req.user!.userId })
    .sort({ createdAt: -1 })
    .lean();

  const byType = new Map<string, any[]>();
  for (const a of attempts) {
    const k = String(a.examType);
    if (!byType.has(k)) byType.set(k, []);
    byType.get(k)!.push(a);
  }

  const latest = (t: string) => (byType.get(t)?.[0] ?? null);
  const previous = (t: string) => (byType.get(t)?.[1] ?? null);

  const aptitudeDone = Boolean(latest("aptitude"));
  const dsaDone = Boolean(latest("dsa"));
  const softDone = Boolean(latest("soft_skills"));

  return res.json({
    aptitude: { unlocked: true, latest: latest("aptitude"), previous: previous("aptitude") },
    dsa: { unlocked: aptitudeDone, latest: latest("dsa"), previous: previous("dsa") },
    soft_skills: { unlocked: aptitudeDone && dsaDone, latest: latest("soft_skills"), previous: previous("soft_skills") },
    career: { unlocked: aptitudeDone && dsaDone && softDone, latest: latest("career"), previous: previous("career") },
  });
});

examRouter.get("/career/questions", requireAuth, async (req, res) => {
  const querySchema = z.object({
    count: z.coerce.number().int().min(1).max(50).default(15),
    labelCol: z.string().optional(),
    labelValue: z.string().optional(),
  });

  const q = querySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });

  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const careerPath = user.profile?.career?.careerPath || "Full Stack Developer";
  const rows = await getCareerQuestions(careerPath, q.data.count, {
    labelCol: q.data.labelCol,
    labelValue: q.data.labelValue,
  });

  const session = await ExamSession.create({
    userId: req.user!.userId,
    examType: "career",
    questions: rows.map((r) => ({ questionId: r.id, correctOption: r.correctOption })),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  return res.json({
    examType: "career",
    careerPath,
    suggestedDurationSeconds: 15 * 60,
    count: rows.length,
    sessionId: String(session._id),
    questions: rows.map(toPublicQuestion),
  });
});

examRouter.get("/:examType/questions", requireAuth, async (req, res) => {
  const examTypeParsed = examTypeSchema.safeParse(req.params.examType);
  if (!examTypeParsed.success) return res.status(400).json({ error: "Invalid examType" });

  const examType = examTypeParsed.data;
  if (examType === "career") {
    return res.status(400).json({ error: "Use /api/exams/career/questions" });
  }

  const querySchema = z.object({
    count: z.coerce.number().int().min(1).max(50).default(15),
    labelCol: z.string().optional(),
    labelValue: z.string().optional(),
  });

  const q = querySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });

  const rows = await getQuestionsForExam(examType, q.data.count, {
    labelCol: q.data.labelCol,
    labelValue: q.data.labelValue,
  });

  const session = await ExamSession.create({
    userId: req.user!.userId,
    examType,
    questions: rows.map((r) => ({ questionId: r.id, correctOption: r.correctOption })),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  return res.json({
    examType,
    suggestedDurationSeconds: 15 * 60,
    count: rows.length,
    sessionId: String(session._id),
    questions: rows.map(toPublicQuestion),
  });
});

const submitSchema = z.object({
  examType: examTypeSchema,
  sessionId: z.string().min(1),
  durationSeconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOption: z.string().min(1),
      })
    )
    .min(1)
    .max(50),
});

examRouter.post("/submit", requireAuth, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { examType, sessionId, answers, durationSeconds } = parsed.data;

  const session = await ExamSession.findOne({ _id: sessionId, userId: req.user!.userId, examType });
  if (!session) return res.status(404).json({ error: "Exam session not found" });
  if (session.usedAt) return res.status(409).json({ error: "Session already submitted" });
  if (session.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: "Session expired" });

  const correctById = new Map(session.questions.map((q) => [q.questionId, q.correctOption] as const));
  const scored = answers.map((a) => {
    const correctOption = correctById.get(a.questionId) ?? "";
    return {
      questionId: a.questionId,
      selectedOption: a.selectedOption,
      correctOption,
      isCorrect: Boolean(correctOption) && a.selectedOption === correctOption,
    };
  });

  const score = scored.filter((a) => a.isCorrect).length;
  const totalQuestions = scored.length;
  const percentage = (score / totalQuestions) * 100;
  const grade = computeGrade(percentage);

  session.usedAt = new Date();
  await session.save();

  const attempt = await ExamAttempt.create({
    userId: req.user!.userId,
    examType,
    totalQuestions,
    score,
    percentage,
    grade,
    durationSeconds,
    answers: scored,
  });

  // Timeline + heatmap event (does not award daily health point)
  await recordActivity({
    userId: req.user!.userId,
    dateKey: utcDateKey(),
    type: "exam_completed",
    title: `Completed ${examType.toUpperCase()} exam`,
    meta: { examType, percentage, score, totalQuestions, grade },
  });

  const unlockedBadges = await checkAndUnlockExamBadges(req.user!.userId, percentage);

  // Fire-and-forget email notification (don't block response)
  const u = await User.findById(req.user!.userId).select({ "profile.email": 1, "profile.fullName": 1 }).lean();
  const to = String((u as any)?.profile?.email ?? "").trim();
  if (to) {
    const name = String((u as any)?.profile?.fullName ?? "Student");
    const pct = Math.round(percentage);
    const barColor = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
    const gradeEmoji = grade === "A+" || grade === "A" ? "🏆" : grade === "B" ? "👏" : grade === "C" ? "💪" : "📚";
    sendEmailInBackground({
      to,
      subject: `${gradeEmoji} PlacePrep: ${examType.toUpperCase()} Exam Results — ${pct}%`,
      text:
        `Hi ${name},\n\n` +
        `You completed the ${examType.toUpperCase()} exam.\n` +
        `Score: ${score}/${totalQuestions} (${pct}%)\n` +
        `Grade: ${grade}\n\n` +
        `Keep going!\n` +
        `PlacePrep`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#6c63ff,#9c5fff);padding:28px 24px;text-align:center;">
            <div style="font-size:40px;margin-bottom:6px;">${gradeEmoji}</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Exam Results</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">${examType.toUpperCase()} Exam Completed</p>
          </div>
          <div style="padding:24px;">
            <p style="color:#333;font-size:15px;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
            <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">
              Great job completing your <strong>${examType.toUpperCase()}</strong> exam! Here are your results:
            </p>
            <div style="background:#f8f9fb;border-radius:12px;padding:20px;margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-size:13px;color:#888;">Score</span>
                <span style="font-size:20px;font-weight:800;color:#333;">${score} / ${totalQuestions}</span>
              </div>
              <div style="height:8px;border-radius:99px;background:#e5e7eb;overflow:hidden;margin-bottom:12px;">
                <div style="height:100%;width:${pct}%;border-radius:99px;background:${barColor};"></div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;color:#888;">Percentage</span>
                <span style="font-size:18px;font-weight:700;color:${barColor};">${pct}%</span>
              </div>
            </div>
            <div style="text-align:center;margin-bottom:20px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#f0edff,#e8e4ff);border:1px solid #d4d0ff;border-radius:12px;padding:12px 28px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#8b83c7;margin-bottom:2px;">Grade</div>
                <div style="font-size:28px;font-weight:900;color:#6c63ff;">${grade}</div>
              </div>
            </div>
            <div style="text-align:center;">
              <a href="http://localhost:8080/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#9c5fff);color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:700;font-size:14px;">
                View Dashboard →
              </a>
            </div>
          </div>
          <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #eee;text-align:center;">
            <p style="color:#aaa;font-size:11px;margin:0;">PlacePrep Placement Assistance System</p>
          </div>
        </div>`,
    });
  }

  return res.status(201).json({
    id: String(attempt._id),
    examType,
    score,
    totalQuestions,
    percentage,
    grade,
    answers: scored,
    unlockedBadges,
  });
});
