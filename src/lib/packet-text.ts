import { CATEGORY_LABELS, type HirePacketResult } from "@/lib/types";

function contactLines(packet: HirePacketResult): string[] {
  const c = packet.candidate;
  return [c.email, c.phone, c.linkedin, c.github, c.portfolio].filter(Boolean);
}

export function packetToPlainText(packet: HirePacketResult): string {
  const reqs = packet.requirements
    .map((m) => {
      const proof = m.evidence.length ? m.evidence.map((e) => `  - ${e}`).join("\n") : `  ${m.gap ?? "Gap"}`;
      return `[${m.status}] ${m.requirement}\n${proof}`;
    })
    .join("\n");

  const gapBlock = (title: string, items: { requirement: string; note: string }[]) =>
    items.length ? [`${title}`, ...items.map((g) => `• ${g.requirement} — ${g.note}`)] : [];

  return [
    `HIRE PACKET — ${packet.candidate.name}`,
    `${packet.roleGuess} · ${packet.seniority}`,
    `Recommendation: ${packet.recommendation}`,
    `Fit score: ${packet.fitScore}/100 (computed in code)`,
    "",
    "SCORE BREAKDOWN",
    ...(["requiredSkills", "experience", "responsibilities", "preferredSkills", "education"] as const).map((key) => {
      const row = packet.scoreBreakdown[key];
      return row.na ? `${CATEGORY_LABELS[key]}: not in JD` : `${CATEGORY_LABELS[key]}: ${row.earned}/${row.max}`;
    }),
    "",
    packet.summary,
    "",
    "TOP MATCHING QUALIFICATIONS",
    ...packet.whyInterview.map((item, i) => `${i + 1}. ${item}`),
    "",
    "REQUIREMENTS",
    reqs,
    "",
    ...gapBlock("MISSING EXPERIENCE", packet.gaps.missing),
    ...gapBlock("TRANSFERABLE EXPERIENCE", packet.gaps.transferable),
    ...gapBlock("DISCUSS IN INTERVIEW", packet.gaps.discuss),
    "",
    "INTERVIEW QUESTIONS",
    ...packet.interviewQuestions.map((q, i) => `${i + 1}. ${q.question}\n   (${q.basedOn}: ${q.context})`),
    "",
    "RECRUITER NOTE",
    packet.recruiterPitch,
    "",
    "CONTACT",
    ...contactLines(packet),
    "",
    packet.disclosure,
  ].join("\n");
}

export function sectionText(
  packet: HirePacketResult,
  section: "why" | "requirements" | "gaps" | "questions" | "pitch" | "score"
): string {
  if (section === "why") return packet.whyInterview.map((w, i) => `${i + 1}. ${w}`).join("\n");
  if (section === "requirements") {
    return packet.requirements
      .map((m) => `${m.requirement} — ${m.status}\n${m.evidence.join("\n") || m.gap || ""}`)
      .join("\n\n");
  }
  if (section === "gaps") {
    return [
      ...packet.gaps.missing.map((g) => `Missing: ${g.requirement} — ${g.note}`),
      ...packet.gaps.transferable.map((g) => `Transferable: ${g.requirement} — ${g.note}`),
    ].join("\n");
  }
  if (section === "questions") {
    return packet.interviewQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
  }
  if (section === "score") {
    return `Fit score ${packet.fitScore}/100 · ${packet.recommendation}`;
  }
  return packet.recruiterPitch;
}
