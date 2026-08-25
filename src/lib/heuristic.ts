import { assemblePacket, heuristicNarrative } from "@/lib/assemble";
import { extractJdHeuristic } from "@/lib/extract";
import { matchJob } from "@/lib/match";
import { computeScore } from "@/lib/scoring";
import { sampleCandidateResume } from "@/data/resume";
import type { CandidateResume, HirePacketResult } from "@/lib/types";

export function heuristicFit(
  jobDescription: string,
  resume: CandidateResume = sampleCandidateResume()
): HirePacketResult {
  const extraction = extractJdHeuristic(jobDescription);
  const buckets = matchJob(extraction, resume);
  const fitScore = computeScore(buckets).total;
  const narrative = heuristicNarrative(extraction, Object.values(buckets).flat(), fitScore, resume);
  return assemblePacket(extraction, buckets, narrative, "heuristic", resume);
}
