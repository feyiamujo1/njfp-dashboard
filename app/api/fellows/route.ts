import { NextResponse } from "next/server";
import { moodleCall } from "@/lib/moodle";
import { COURSE_ID } from "@/lib/constants";

interface MoodleUser {
  id: number;
  fullname: string;
  email: string;
  lastaccess: number;
  lastcourseaccess: number;
  profileimageurl: string;
  roles: Array<{ shortname: string }>;
}

async function fetchAllEnrolledStudents(): Promise<MoodleUser[]> {
  const all: MoodleUser[] = [];
  let offset = 0;
  const perPage = 1000;

  while (true) {
    const batch = await moodleCall<MoodleUser[]>(
      "core_enrol_get_enrolled_users",
      {
        courseid: COURSE_ID,
        "options[0][name]": "limitfrom",
        "options[0][value]": offset,
        "options[1][name]": "limitnumber",
        "options[1][value]": perPage,
      }
    );
    all.push(
      ...batch.filter((u) => u.roles.some((r) => r.shortname === "student"))
    );
    if (batch.length < perPage) break;
    offset += perPage;
  }

  return all;
}

export async function GET() {
  try {
    const students = await fetchAllEnrolledStudents();

    return NextResponse.json({
      fellows: students.map((u) => ({
        id: u.id,
        fullname: u.fullname,
        email: u.email,
        lastaccess: u.lastaccess,
        lastcourseaccess: u.lastcourseaccess,
        profileimageurl: u.profileimageurl,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
