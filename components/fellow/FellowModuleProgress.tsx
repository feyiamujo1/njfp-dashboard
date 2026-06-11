"use client";

import { Progress } from "antd";
import type { ModuleProgress } from "@/lib/types";

interface Props {
  data: ModuleProgress[];
}

export default function FellowModuleProgress({ data }: Props) {
  return (
    <div className="space-y-4">
      {data.map((m) => {
        const pct = Math.max(0, Math.min(100, m.completionPct));
        const color =
          pct >= 70 ? "#16A34A" : pct >= 40 ? "#D97706" : "#DC2626";

        return (
          <div key={m.moduleId}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">
                <span className="text-slate-400 mr-1.5">M{m.moduleId}</span>
                {m.moduleName}
              </span>
              <span className="text-sm font-semibold" style={{ color }}>
                {pct}%
              </span>
            </div>
            <Progress
              percent={pct}
              showInfo={false}
              strokeColor={color}
              trailColor="#f1f5f9"
              size="small"
            />
          </div>
        );
      })}
    </div>
  );
}
