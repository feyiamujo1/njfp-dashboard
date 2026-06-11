"use client";

import { Card, Row, Col, Skeleton, Result, Button } from "antd";
import KPICard from "@/components/cards/KPICard";
import RiskDonutChart from "@/components/charts/RiskDonutChart";
import RiskTable from "@/components/tables/RiskTable";
import { useRisk } from "@/hooks/useRisk";

export default function RiskPage() {
  const { data, isLoading, isError, error, refetch } = useRisk();

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load risk data"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Inactive > 7 Days"
            value={data?.inactiveOver7Days.toLocaleString() ?? "—"}
            valueColor="#D97706"
            trend={{ direction: "down", label: "needs follow-up" }}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Inactive > 14 Days"
            value={data?.inactiveOver14Days.toLocaleString() ?? "—"}
            valueColor="#DC2626"
            trend={{ direction: "down", label: "critical" }}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Low Quiz Score (<50%)"
            value={data?.lowQuizScore.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="No Mentorship Engagement"
            value={data?.noMentorshipEngagement.toLocaleString() ?? "—"}
            loading={isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Risk Distribution">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <RiskDonutChart data={data!.distribution} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title="Cohort Breakdown" className="h-full">
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <div className="grid grid-cols-3 gap-4 h-full">
                {[
                  {
                    label: "Active Learners",
                    count: data!.distribution.active,
                    color: "#16A34A",
                    bg: "#F0FDF4",
                  },
                  {
                    label: "At-Risk Learners",
                    count: data!.distribution.atRisk,
                    color: "#D97706",
                    bg: "#FFFBEB",
                  },
                  {
                    label: "Inactive Learners",
                    count: data!.distribution.inactive,
                    color: "#DC2626",
                    bg: "#FEF2F2",
                  },
                ].map((item) => {
                  const total =
                    data!.distribution.active +
                    data!.distribution.atRisk +
                    data!.distribution.inactive;
                  const pct = Math.round((item.count / total) * 100);
                  return (
                    <div
                      key={item.label}
                      className="rounded-lg p-5 flex flex-col items-center justify-center text-center"
                      style={{ backgroundColor: item.bg }}
                    >
                      <div
                        className="text-3xl font-bold"
                        style={{ color: item.color }}
                      >
                        {item.count.toLocaleString()}
                      </div>
                      <div className="text-sm font-medium text-slate-700 mt-1">
                        {item.label}
                      </div>
                      <div
                        className="text-xs mt-1 font-semibold"
                        style={{ color: item.color }}
                      >
                        {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Learners — Risk Overview">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <RiskTable data={data!.fellows} />
        )}
      </Card>
    </div>
  );
}
