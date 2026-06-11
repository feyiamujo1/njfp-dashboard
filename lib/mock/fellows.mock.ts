import type { FellowSummary, RiskLevel } from "@/lib/types";

const NOW = 1749686400; // June 11, 2026 UTC
const DAY = 86400;

function fellow(
  id: number,
  name: string,
  daysAgo: number,
  completionPct: number,
  avgQuizScore: number,
  forumPosts: number
): FellowSummary {
  const riskLevel: RiskLevel =
    daysAgo > 14 || (!avgQuizScore && !forumPosts)
      ? "inactive"
      : daysAgo > 7 || completionPct < 25
      ? "at_risk"
      : "active";
  const [first, ...rest] = name.split(" ");
  const last = rest.join("").toLowerCase();
  return {
    id,
    fullname: name,
    email: `${first.toLowerCase()}.${last}@njfp.ng`,
    lastaccess: NOW - daysAgo * DAY,
    lastcourseaccess: NOW - daysAgo * DAY,
    profileimageurl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
    completionPct,
    avgQuizScore,
    assignmentsSubmitted: Math.min(7, Math.floor(completionPct / 14)),
    assignmentsTotal: 7,
    forumPosts,
    engagementScore: Math.min(
      100,
      Math.round(forumPosts * 3 + avgQuizScore * 0.3 + completionPct * 0.2)
    ),
    riskLevel,
    daysSinceActive: daysAgo,
  };
}

export const fellowsMock: FellowSummary[] = [
  // Active (0–6 days, solid progress)
  fellow(1, "Chukwuemeka Obi", 1, 92, 85, 12),
  fellow(2, "Amina Sule", 0, 88, 79, 8),
  fellow(3, "Tunde Adeyemi", 2, 95, 91, 15),
  fellow(4, "Ngozi Eze", 1, 78, 74, 7),
  fellow(5, "Babatunde Okonkwo", 3, 83, 82, 10),
  fellow(6, "Fatima Mohammed", 0, 90, 88, 11),
  fellow(7, "Emeka Nwachukwu", 2, 71, 68, 5),
  fellow(8, "Adaeze Okafor", 1, 85, 77, 9),
  fellow(9, "Ibrahim Musa", 4, 79, 72, 6),
  fellow(10, "Chioma Igwe", 0, 94, 89, 14),
  fellow(11, "Seun Afolabi", 3, 67, 65, 4),
  fellow(12, "Hauwa Garba", 2, 75, 70, 7),
  fellow(13, "Uche Okafor", 5, 81, 76, 8),
  fellow(14, "Zainab Ibrahim", 1, 88, 83, 11),
  fellow(15, "Bola Adesanya", 3, 72, 69, 5),
  fellow(16, "Nneka Onyekachi", 2, 86, 80, 10),
  fellow(17, "Yakubu Danladi", 4, 63, 61, 3),
  fellow(18, "Kemi Abiodun", 1, 91, 87, 13),
  fellow(19, "Chidi Nwosu", 6, 74, 71, 6),
  fellow(20, "Mariam Yusuf", 2, 80, 75, 8),
  fellow(21, "Rotimi Adeleye", 3, 69, 66, 4),
  fellow(22, "Chiamaka Obiora", 1, 93, 88, 14),
  fellow(23, "Mohammed Sani", 5, 77, 73, 7),
  fellow(24, "Toyin Akintola", 2, 84, 79, 9),
  fellow(25, "Olumide Fashola", 4, 70, 67, 5),
  fellow(26, "Grace Olatunde", 1, 87, 82, 11),
  fellow(27, "Abdullahi Nuhu", 3, 76, 72, 6),
  fellow(28, "Blessing Ojo", 2, 82, 78, 9),
  fellow(29, "Kwame Asante", 5, 65, 63, 3),
  fellow(30, "Aisha Bello", 1, 89, 84, 12),
  fellow(31, "Nnamdi Okeke", 6, 73, 70, 5),
  fellow(32, "Funmi Olanrewaju", 3, 78, 74, 7),
  // At-risk (7–14 days, low completion)
  fellow(33, "Hassan Abdulkadir", 8, 35, 48, 1),
  fellow(34, "Adeola Adeyemi", 10, 28, 42, 0),
  fellow(35, "Chinyere Okonkwo", 9, 42, 55, 2),
  fellow(36, "Musa Aliyu", 12, 22, 38, 0),
  fellow(37, "Yetunde Sowunmi", 7, 38, 50, 1),
  fellow(38, "Ikechukwu Eze", 11, 18, 35, 0),
  fellow(39, "Hafsat Mohammed", 8, 45, 58, 2),
  fellow(40, "Dami Adesina", 13, 30, 44, 1),
  fellow(41, "Obinna Nwofor", 9, 25, 40, 0),
  // Inactive (14+ days, very low completion)
  fellow(42, "Salamatu Musa", 16, 12, 28, 0),
  fellow(43, "Tolu Oduola", 20, 8, 22, 0),
  fellow(44, "Chinwe Nwankwo", 25, 15, 30, 0),
  fellow(45, "Ahmed Tijani", 18, 5, 18, 0),
  fellow(46, "Sola Adeleke", 30, 0, 0, 0),
  fellow(47, "Uju Okafor", 22, 10, 25, 0),
  fellow(48, "Femi Olatunde", 35, 3, 15, 0),
  fellow(49, "Hadiza Usman", 19, 7, 20, 0),
  fellow(50, "Chibundo Eke", 28, 12, 32, 0),
];
