"use client";

import { Avatar, Tag } from "antd";
import moment from "moment";
import type { FellowSummary, RiskLevel } from "@/lib/types";

const RISK_TAG: Record<RiskLevel, { color: string; label: string }> = {
  active: { color: "success", label: "Active" },
  at_risk: { color: "warning", label: "At Risk" },
  inactive: { color: "error", label: "Inactive" },
};

interface Props {
  fellow: FellowSummary;
}

export default function FellowHeader({ fellow }: Props) {
  const risk = RISK_TAG[fellow.riskLevel];

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <Avatar
        src={fellow.profileimageurl}
        size={72}
        className="shrink-0 border-2 border-slate-200"
        style={{ backgroundColor: "#f1f5f9", color: "#334155" }}
      >
        {fellow.fullname.charAt(0)}
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h2 className="text-xl font-bold text-slate-900 m-0">
            {fellow.fullname}
          </h2>
          <Tag color={risk.color}>{risk.label}</Tag>
        </div>
        <p className="text-slate-500 text-sm m-0">{fellow.email}</p>
        <p className="text-slate-400 text-xs mt-1">
          Last active:{" "}
          <span className="text-slate-600">
            {moment.unix(fellow.lastcourseaccess).format("DD MMM YYYY")}
          </span>{" "}
          ({moment.unix(fellow.lastcourseaccess).fromNow()})
        </p>
      </div>
    </div>
  );
}
