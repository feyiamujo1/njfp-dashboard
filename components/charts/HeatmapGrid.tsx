"use client";

import { useMemo } from "react";

interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
}

interface Props {
  data: HeatmapCell[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function HeatmapGrid({ data }: Props) {
  const cellMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(({ day, hour, count }) => {
      map[`${day}-${hour}`] = count;
    });
    return map;
  }, [data]);

  const maxCount = useMemo(
    () => Math.max(1, ...data.map((d) => d.count)),
    [data]
  );

  const cells = useMemo(() => {
    const rows: { hour: number; day: number; count: number }[][] = [];
    for (let h = 0; h < 24; h++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        row.push({ hour: h, day: d, count: cellMap[`${d}-${h}`] ?? 0 });
      }
      rows.push(row);
    }
    return rows;
  }, [cellMap]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        {/* Day headers */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "36px repeat(7, 1fr)" }}>
          <div />
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[11px] text-slate-500 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Hour rows */}
        {cells.map((row, hour) => (
          <div
            key={hour}
            className="grid gap-1 mb-1"
            style={{ gridTemplateColumns: "36px repeat(7, 1fr)" }}
          >
            <div className="text-[10px] text-slate-400 text-right pr-2 leading-5">
              {String(hour).padStart(2, "0")}h
            </div>
            {row.map(({ day, count }) => {
              const opacity = 0.08 + (count / maxCount) * 0.88;
              return (
                <div
                  key={day}
                  className="h-5 rounded-sm"
                  style={{ backgroundColor: `rgba(29, 78, 216, ${opacity})` }}
                  title={`${DAYS[day]} ${String(hour).padStart(2, "0")}:00 — ${count} logins`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[11px] text-slate-400">Less</span>
          {[0.08, 0.3, 0.55, 0.75, 0.96].map((op) => (
            <div
              key={op}
              className="h-4 w-4 rounded-sm"
              style={{ backgroundColor: `rgba(29, 78, 216, ${op})` }}
            />
          ))}
          <span className="text-[11px] text-slate-400">More</span>
        </div>
      </div>
    </div>
  );
}
