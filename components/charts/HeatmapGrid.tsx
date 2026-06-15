"use client";

import { useMemo } from "react";
import { Tooltip } from "antd";

interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
}

interface Props {
  data: HeatmapCell[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HeatmapGrid({ data }: Props) {
  const cellMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(({ day, hour, count }) => {
      map[`${day}-${hour}`] = count;
    });
    return map;
  }, [data]);

  const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[580px]">
        {/* Hour labels (every 3 hours) */}
        <div className="flex gap-0.5 mb-1.5">
          <div className="w-10 shrink-0" />
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex-1 text-center text-[10px] text-slate-400 leading-none"
            >
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </div>
          ))}
        </div>

        {/* Day rows — 7 rows × 24 cols */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex gap-0.5 mb-1">
            <div className="w-10 shrink-0 text-[11px] text-slate-500 font-medium flex items-center">
              {day}
            </div>
            {HOURS.map((hour) => {
              const count = cellMap[`${dayIdx}-${hour}`] ?? 0;
              const opacity = count === 0 ? 0.06 : 0.12 + (count / maxCount) * 0.84;
              return (
                <Tooltip
                  key={hour}
                  title={`${day} ${String(hour).padStart(2, "0")}:00 — ${count} login${count !== 1 ? "s" : ""}`}
                  mouseEnterDelay={0}
                >
                  <div
                    className="flex-1 h-8 rounded-sm cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-inset transition-all duration-100"
                    style={{ backgroundColor: `rgba(29, 78, 216, ${opacity})` }}
                  />
                </Tooltip>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[11px] text-slate-400">Less</span>
          {[0.06, 0.25, 0.5, 0.75, 0.96].map((op) => (
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
