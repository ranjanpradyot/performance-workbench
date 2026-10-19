import { z } from "zod";

export const reporteeFormSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  employeeId: z.string().optional(),
  role: z.string().optional(),
  team: z.string().optional(),
  manager: z.string().optional(),
  joiningDate: z.string().optional(),
  themeColor: z.string().min(4, "Choose a theme color."),
  notes: z.string().optional(),
});

export const achievementSchema = z.enum(["achieved", "not_achieved", "pending", "not_applicable", "insufficient_evidence"]);

export const checklistFormSchema = z.object({
  quarterId: z.string().min(1, "Choose a quarter."),
  kpiAffected: z.string().trim().min(1, "KPI affected is required."),
  okrMet: achievementSchema,
  weightage: z.string(),
  okrs: z.string().trim().min(1, "OKR text is required."),
  deliverableExpected: z.string().optional(),
  evidenceNote: z.string().optional(),
  artifacts: z.string().optional(),
  otherLinks: z.string().optional(),
});

export const ticketFormSchema = z.object({
  ticketNo: z.string().trim().regex(/^\d+$/, "Ticket number should contain digits only."),
  description: z.string().optional(),
  status: z.string().optional(),
  month: z.string().optional(),
  assignDate: z.string().optional(),
  closureDate: z.string().optional(),
  owner: z.string().optional(),
  spChange: z.string().optional(),
  codeChange: z.string().optional(),
  codeLines: z.string(),
  sqlLines: z.string(),
  cycleDays: z.string(),
  quarterId: z.string().optional(),
  azurePrUrl: z.string().optional(),
});

export const learningFormSchema = z.object({
  quarterId: z.string().min(1, "Choose a quarter."),
  kpi: z.string().optional(),
  focusArea: z.string().trim().min(1, "A focus area or POC name is required."),
  evidenceLink: z.string().optional(),
  status: achievementSchema,
  problemStatement: z.string().optional(),
  comments: z.string().optional(),
});

export const quarterFormSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  quarterNumber: z.coerce.number().int().min(1).max(4),
  notes: z.string().optional(),
});
