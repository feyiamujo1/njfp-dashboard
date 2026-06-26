import { NextResponse } from "next/server";
import { supabase } from "@/integration/supabase/server";
import { buildAllFellowSummaries } from "@/lib/server/sharedData";
import type { MentorshipStats, MentorshipMember } from "@/lib/types";

export const maxDuration = 120;

export async function GET() {
  try {
    const [groupsResult, membersResult, fellows] = await Promise.all([
      supabase.from("mentorship_groups").select("id, name, description, idnumber").order("id"),
      supabase.from("mentorship_group_members").select("group_id, user_id"),
      buildAllFellowSummaries(),
    ]);

    if (groupsResult.error) throw new Error(groupsResult.error.message);
    if (membersResult.error) throw new Error(membersResult.error.message);

    const groupsData = groupsResult.data ?? [];
    const membersData = membersResult.data ?? [];

    const fellowMap = new Map(fellows.map(f => [f.id, f]));
    const assignedUserIds = new Set(membersData.map(m => m.user_id));

    const toMember = (uid: number): MentorshipMember | null => {
      const f = fellowMap.get(uid);
      if (!f) return null;
      return {
        id: f.id,
        fullname: f.fullname,
        email: f.email,
        profileimageurl: f.profileimageurl,
        state: f.state,
        gender: f.gender,
        completionPct: f.completionPct,
        engagementScore: f.engagementScore,
        riskLevel: f.riskLevel,
        daysSinceActive: f.daysSinceActive,
        lastcourseaccess: f.lastcourseaccess,
      };
    };

    const avg = (nums: number[]) =>
      nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

    const groups = groupsData.map(g => {
      const memberIds = membersData.filter(m => m.group_id === g.id).map(m => m.user_id);
      const members = memberIds.map(toMember).filter((m): m is MentorshipMember => m !== null);

      const riskBreakdown = { active: 0, atRisk: 0, inactive: 0 };
      const completionBreakdown = { completed: 0, inProgress: 0, notStarted: 0 };
      for (const m of members) {
        if (m.riskLevel === "active") riskBreakdown.active++;
        else if (m.riskLevel === "at_risk") riskBreakdown.atRisk++;
        else riskBreakdown.inactive++;

        if (m.completionPct === 100) completionBreakdown.completed++;
        else if (m.completionPct > 0) completionBreakdown.inProgress++;
        else completionBreakdown.notStarted++;
      }

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        idnumber: g.idnumber,
        memberCount: members.length,
        avgCompletionPct: avg(members.map(m => m.completionPct)),
        avgEngagementScore: avg(members.map(m => m.engagementScore)),
        riskBreakdown,
        completionBreakdown,
        members,
      };
    });

    const assignedCount = fellows.filter(f => assignedUserIds.has(f.id)).length;
    const unassigned = fellows
      .filter(f => !assignedUserIds.has(f.id))
      .map(f => toMember(f.id))
      .filter((m): m is MentorshipMember => m !== null);

    const totalGroups = groups.length;
    const avgGroupSize = totalGroups > 0 ? Math.round(assignedCount / totalGroups) : 0;
    const overallAvgCompletion = avg(groups.map(g => g.avgCompletionPct));

    const stats: MentorshipStats = {
      totalGroups,
      assignedCount,
      unassignedCount: unassigned.length,
      totalEnrolled: fellows.length,
      avgGroupSize,
      overallAvgCompletion,
      groups,
      unassigned,
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error" },
      { status: 500 }
    );
  }
}
