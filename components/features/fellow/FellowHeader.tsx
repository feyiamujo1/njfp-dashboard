"use client";

import { Avatar, Tag } from "antd";
import {
  EnvironmentOutlined,
  UserOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import moment from "moment";
import type { Fellow, RiskLevel } from "@/lib/types";

const RISK_TAG: Record<RiskLevel, { color: string; label: string }> = {
  active: { color: "success", label: "Active" },
  at_risk: { color: "warning", label: "At Risk" },
  inactive: { color: "error", label: "Inactive" },
};

interface Props {
  fellow: Fellow;
  riskLevel?: RiskLevel;
}

export default function FellowHeader({ fellow, riskLevel }: Props) {
  const risk = riskLevel ? RISK_TAG[riskLevel] : null;

  return (
    <div className="flex items-start gap-5 flex-wrap">
      <Avatar
        src={fellow.profileimageurl}
        size={72}
        className="shrink-0 border-2 border-slate-200"
        style={{ backgroundColor: "#f1f5f9", color: "#334155" }}
      >
        {fellow.fullname.charAt(0)}
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Name + risk tag */}
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <h2 className="text-xl font-bold text-slate-900 m-0">{fellow.fullname}</h2>
          {risk && <Tag color={risk.color}>{risk.label}</Tag>}
          {fellow.gender && (
            <Tag color={fellow.gender === "Female" ? "pink" : "blue"} className="m-0">
              {fellow.gender}
            </Tag>
          )}
        </div>

        {/* Email */}
        <p className="text-slate-500 text-sm m-0">{fellow.email}</p>

        {/* Demographic info */}
        {(fellow.state || fellow.lga || fellow.region) && (
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {fellow.region && (
              <span className="flex items-center gap-1 text-slate-500 text-xs">
                <GlobalOutlined className="text-slate-400" />
                {fellow.region}
              </span>
            )}
            {fellow.state && (
              <span className="flex items-center gap-1 text-slate-500 text-xs">
                <EnvironmentOutlined className="text-slate-400" />
                {fellow.state}
                {fellow.lga ? `, ${fellow.lga}` : ""}
              </span>
            )}
          </div>
        )}

        {/* Last active */}
        <p className="text-slate-400 text-xs mt-1.5 mb-0">
          <UserOutlined className="mr-1" />
          Last active:{" "}
          <span className="text-slate-600">
            {fellow.lastcourseaccess
              ? `${moment.unix(fellow.lastcourseaccess).format("DD MMM YYYY")} (${moment.unix(fellow.lastcourseaccess).fromNow()})`
              : "Never"}
          </span>
        </p>
      </div>
    </div>
  );
}
