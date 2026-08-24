import { assemblePacket, heuristicNarrative } from "@/lib/assemble";
import { extractJdHeuristic } from "@/lib/extract";
import { matchJob } from "@/lib/match";
import { computeScore } from "@/lib/scoring";
import type { HirePacketResult } from "@/lib/types";

export function heuristicFit(jobDescription: string): HirePacketResult {
  const extraction = extractJdHeuristic(jobDescription);
  const buckets = matchJob(extraction);
  const fitScore = computeScore(buckets).total;
  const narrative = heuristicNarrative(extraction, Object.values(buckets).flat(), fitScore);
  return assemblePacket(extraction, buckets, narrative, "heuristic");
}
