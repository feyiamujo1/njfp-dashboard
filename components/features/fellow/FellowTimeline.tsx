"use client";

import { Timeline } from "antd";
import moment from "moment";
import {
  CheckCircleOutlined,
  FormOutlined,
  LoginOutlined,
} from "@ant-design/icons";
import type { ActivityEvent } from "@/lib/types";

const EVENT_META: Record<
  ActivityEvent["type"],
  { icon: React.ReactNode; color: string }
> = {
  completion: { icon: <CheckCircleOutlined />, color: "#16A34A" },
  quiz: { icon: <FormOutlined />, color: "#1D4ED8" },
  login: { icon: <LoginOutlined />, color: "#94A3B8" },
};

interface Props {
  events: ActivityEvent[];
}

export default function FellowTimeline({ events }: Props) {
  const items = events.map((e) => {
    const meta = EVENT_META[e.type];
    return {
      dot: meta.icon,
      color: meta.color,
      children: (
        <div>
          <p className="text-slate-700 text-sm m-0">{e.description}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {moment.unix(e.timestamp).format("DD MMM YYYY, HH:mm")}
          </p>
        </div>
      ),
    };
  });

  return <Timeline items={items} />;
}
