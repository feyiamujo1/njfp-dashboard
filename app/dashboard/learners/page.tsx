"use client";

import {
  Card,
  Input,
  Select,
  Empty,
  Skeleton,
  Result,
  Button,
  Table,
  Slider,
  Statistic,
  DatePicker,
  Segmented
} from "antd";
import {
  SearchOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useState, useMemo } from "react";
import type { Dayjs } from "dayjs";
import moment from "moment";
import {
  PieChart,
  Pie,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import type { TooltipProps } from "recharts";
import FellowsTable from "@/components/tables/FellowsTable";
import { useFellows } from "@/hooks/useFellows";
import { normalizeRegion, normalizeState } from "@/lib/util";

const { RangePicker } = DatePicker;

const GENDER_COLORS: Record<string, string> = {
  Female: "#ec4899",
  Male: "#3b82f6",
  "Not Specified": "#94a3b8"
};

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const lines = [
    headers.join(","),
    ...rows.map(r => r.map(v => `"${v}"`).join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type PctPayload = { pct: number; [key: string]: unknown };

function pctTooltipFormatter(
  value: TooltipProps<number, string>["formatter"] extends (
    v: infer V,
    ...rest: unknown[]
  ) => unknown
    ? V
    : number,
  _name: string,
  item: { payload?: PctPayload }
) {
  const pct = item.payload?.pct ?? 0;
  return [`${value} (${pct}%)`, "Students"] as [string, string];
}

type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

export default function FellowsPage() {
  const { data, isLoading, isError, error, refetch } = useFellows();
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [topStates, setTopStates] = useState(15);
  const [topStatesActivity, setTopStatesActivity] = useState(15);
  const [activityRange, setActivityRange] = useState<DateRangeValue>(null);
  const [timelineView, setTimelineView] = useState<"month" | "week">("month");
  const [timelineRange, setTimelineRange] = useState<DateRangeValue>(null);

  const regions = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(
        data
          .map(f => normalizeRegion(f.region))
          .filter(r => r !== "Not Specified")
      )
    ).sort();
  }, [data]);

  const genderDist = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.forEach(f => {
      const raw = f.gender?.trim().toLowerCase();
      const g =
        raw === "female" ? "Female" : raw === "male" ? "Male" : "Not Specified";
      counts[g] = (counts[g] ?? 0) + 1;
    });
    const total = data.length;
    return Object.entries(counts)
      .map(([gender, count]) => ({
        gender,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
        fill: GENDER_COLORS[gender] ?? "#94a3b8"
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const regionDist = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.forEach(f => {
      const r = normalizeRegion(f.region);
      counts[r] = (counts[r] ?? 0) + 1;
    });
    const total = data.length;
    return Object.entries(counts)
      .map(([region, count]) => ({
        region,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const stateDist = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.forEach(f => {
      const s = normalizeState(f.state);
      counts[s] = (counts[s] ?? 0) + 1;
    });
    const total = data.length;
    return Object.entries(counts)
      .map(([state, count]) => ({
        state,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const stateChartData = useMemo(
    () => stateDist.slice(0, topStates),
    [stateDist, topStates]
  );

  const activeByRegionDist = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, { active: number; inactive: number }> = {};
    data.forEach(f => {
      const r = normalizeRegion(f.region);
      if (!counts[r]) counts[r] = { active: 0, inactive: 0 };
      if (f.lastcourseaccess && f.lastcourseaccess > 0) counts[r].active++;
      else counts[r].inactive++;
    });
    return Object.entries(counts)
      .map(([region, { active, inactive }]) => ({
        region,
        active,
        inactive,
        total: active + inactive,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const activeByStateDist = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, { active: number; inactive: number }> = {};
    data.forEach(f => {
      const s = normalizeState(f.state);
      if (!counts[s]) counts[s] = { active: 0, inactive: 0 };
      if (f.lastcourseaccess && f.lastcourseaccess > 0) counts[s].active++;
      else counts[s].inactive++;
    });
    return Object.entries(counts)
      .map(([state, { active, inactive }]) => ({
        state,
        active,
        inactive,
        total: active + inactive,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const activeByStateChartData = useMemo(
    () => activeByStateDist.slice(0, topStatesActivity),
    [activeByStateDist, topStatesActivity]
  );

  // Active vs Inactive
  const activityDist = useMemo(() => {
    if (!data) return null;
    const startTs = activityRange?.[0]?.startOf("day").unix() ?? null;
    const endTs = activityRange?.[1]?.endOf("day").unix() ?? null;
    const isRange = startTs !== null && endTs !== null;

    let active = 0;
    let inactive = 0;
    data.forEach(f => {
      const ts = f.lastcourseaccess;
      if (isRange) {
        if (ts && ts >= startTs! && ts <= endTs!) active++;
        else inactive++;
      } else {
        if (ts && ts > 0) active++;
        else inactive++;
      }
    });

    const total = data.length;
    return {
      active,
      inactive,
      total,
      rate: total > 0 ? Math.round((active / total) * 100) : 0,
      isRange
    };
  }, [data, activityRange]);

  const activityChartData = activityDist
    ? [
        { name: "Active", value: activityDist.active, fill: "#22c55e" },
        {
          name: "Inactive / Never",
          value: activityDist.inactive,
          fill: "#e2e8f0"
        }
      ]
    : [];

  // Activity Timeline
  const activityTimeline = useMemo(() => {
    if (!data) return [];
    const unitSingle = timelineView === "month" ? "month" : "isoWeek";
    const unitPlural = timelineView === "month" ? "months" : "weeks";
    const fmt = timelineView === "month" ? "MMM YY" : "MMM D";

    type Period = { start: moment.Moment; end: moment.Moment; label: string };
    let periods: Period[];

    if (timelineRange?.[0] && timelineRange?.[1]) {
      // Dynamic range: generate all periods between the two selected dates
      periods = [];
      const cursor = moment(timelineRange[0].valueOf()).startOf(
        unitSingle as moment.unitOfTime.StartOf
      );
      const rangeEnd = moment(timelineRange[1].valueOf()).endOf(
        unitSingle as moment.unitOfTime.StartOf
      );
      while (
        cursor.isSameOrBefore(rangeEnd, unitSingle as moment.unitOfTime.StartOf)
      ) {
        periods.push({
          start: cursor
            .clone()
            .startOf(unitSingle as moment.unitOfTime.StartOf),
          end: cursor.clone().endOf(unitSingle as moment.unitOfTime.StartOf),
          label: cursor.format(fmt)
        });
        cursor.add(1, unitPlural as moment.DurationInputArg2);
      }
    } else {
      // Default: last 12 periods
      periods = Array.from({ length: 12 }, (_, i) => {
        const unitsAgo = 11 - i;
        const start = moment()
          .subtract(unitsAgo, unitPlural as moment.DurationInputArg2)
          .startOf(unitSingle as moment.unitOfTime.StartOf);
        const end = moment()
          .subtract(unitsAgo, unitPlural as moment.DurationInputArg2)
          .endOf(unitSingle as moment.unitOfTime.StartOf);
        return { start, end, label: start.format(fmt) };
      });
    }

    return periods.map(({ start, end, label }) => {
      const startTs = start.unix();
      const endTs = end.unix();
      const count = data.filter(
        f =>
          f.lastcourseaccess &&
          f.lastcourseaccess >= startTs &&
          f.lastcourseaccess <= endTs
      ).length;
      return { label, count };
    });
  }, [data, timelineView, timelineRange]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(f => {
      if (genderFilter !== "all") {
        const raw = f.gender?.trim().toLowerCase();
        const normalized =
          raw === "female"
            ? "Female"
            : raw === "male"
              ? "Male"
              : "Not Specified";
        if (normalized !== genderFilter) return false;
      }
      if (regionFilter !== "all" && normalizeRegion(f.region) !== regionFilter)
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !f.fullname.toLowerCase().includes(q) &&
          !f.email.toLowerCase().includes(q) &&
          !f.state?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [data, search, genderFilter, regionFilter]);

  if (isError) {
    return (
      <Result
        status="error"
        title="Failed to load Students"
        subTitle={(error as Error)?.message}
        extra={<Button onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const topStats = useMemo(() => {
    if (!data || !activityDist) return null;
    const female = genderDist.find(g => g.gender === "Female");
    const male = genderDist.find(g => g.gender === "Male");
    const statesCount = stateDist.filter(
      s => s.state !== "Not Specified"
    ).length;
    return {
      total: data.length,
      activeCount: activityDist.active,
      activeRate: activityDist.rate,
      femaleCount: female?.count ?? 0,
      femalePct: female?.pct ?? 0,
      maleCount: male?.count ?? 0,
      malePct: male?.pct ?? 0,
      statesCount
    };
  }, [data, activityDist, genderDist, stateDist]);

  return (
    <div className="space-y-4! md:space-y-6!">
      {/* ── Overview stats row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {isLoading || !topStats ? (
          [1, 2, 3, 4].map(i => (
            <Card key={i}>
              <Skeleton active paragraph={false} />
            </Card>
          ))
        ) : (
          <>
            <Card>
              <Statistic
                title="Total Students"
                value={topStats.total}
              />
            </Card>
            <Card>
              <Statistic
                title="Active Students"
                value={topStats.activeCount}
                suffix={
                  <span className="text-sm text-slate-400 font-normal ml-1">
                    {topStats.activeRate}%
                  </span>
                }
              />
            </Card>
            <Card>
              <Statistic
                title="Female"
                value={topStats.femaleCount}
                suffix={
                  <span className="text-sm text-slate-400 font-normal ml-1">
                    {topStats.femalePct}%
                  </span>
                }
              />
            </Card>
            <Card>
              <Statistic
                title="Male"
                value={topStats.maleCount}
                suffix={
                  <span className="text-sm text-slate-400 font-normal ml-1">
                    {topStats.malePct}%
                  </span>
                }
              />
            </Card>
            {/* <Card>
              <Statistic
                title="States Represented"
                value={topStats.statesCount}
                suffix={
                  <span className="text-sm text-slate-400 font-normal ml-1">
                    of 37
                  </span>
                }
              />
            </Card> */}
          </>
        )}
      </div>

      {/* ── Active vs Inactive ───────────────────────────────────────────── */}
      <Card
        title="Active vs Inactive"
        extra={
          <div className="flex items-center gap-2">
            <RangePicker
              size="small"
              value={activityRange}
              separator="-"
              onChange={val => setActivityRange(val as DateRangeValue)}
              placeholder={["Start date", "End date"]}
              allowClear
            />
            {activityRange && (
              <Button size="small" onClick={() => setActivityRange(null)}>
                Clear
              </Button>
            )}
          </div>
        }>
        {isLoading || !activityDist ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            <div className="w-full lg:w-72 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={activityChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                  />
                  <RechartTooltip formatter={val => [`${val} Students`, ""]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4 w-full">
              <div className="text-center p-4 rounded-lg bg-green-50">
                <div className="text-2xl font-bold text-green-700">
                  {activityDist.active.toLocaleString()}
                </div>
                <div className="text-sm text-green-600">
                  {activityDist.isRange
                    ? "Active in Period"
                    : "Active (All Time)"}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-slate-50">
                <div className="text-2xl font-bold text-slate-600">
                  {activityDist.inactive.toLocaleString()}
                </div>
                <div className="text-sm text-slate-500">
                  {activityDist.isRange
                    ? "Inactive in Period"
                    : "Never Accessed"}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50">
                <div className="text-2xl font-bold text-blue-700">
                  {activityDist.rate}%
                </div>
                <div className="text-sm text-blue-600">Activity Rate</div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Activity Timeline ────────────────────────────────────────────── */}
      <Card
        title="Activity Timeline"
        extra={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <RangePicker
              size="small"
              value={timelineRange}
              separator="-"
              onChange={val => setTimelineRange(val as DateRangeValue)}
              placeholder={["Start date", "End date"]}
              allowClear
              suffixIcon={null}
            />
            <Segmented
              size="small"
              value={timelineView}
              onChange={v => setTimelineView(v as "month" | "week")}
              options={[
                { label: "Monthly", value: "month" },
                { label: "Weekly", value: "week" }
              ]}
            />
          </div>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={activityTimeline}
                margin={{ bottom: 8, left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartTooltip
                  formatter={val => [`${val} Students`, "Last Active"]}
                />
                <Bar dataKey="count" fill="#3c83f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 mt-2">
              Based on each fellow&apos;s last course access date — shows how
              many had their most recent activity in each{" "}
              {timelineView === "month" ? "month" : "week"}.
            </p>
          </>
        )}
      </Card>

      {/* ── Gender Split ────────────────────────────────────────────────── */}
      <Card
        title="Gender Split"
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || genderDist.length === 0}
            onClick={() =>
              downloadCsv(
                "gender-distribution.csv",
                ["Gender", "Count", "Percentage"],
                genderDist.map(r => [r.gender, r.count, `${r.pct}%`])
              )
            }>
            Download
          </Button>
        }>
        {isLoading ? (
          <Skeleton active />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="w-full lg:w-80 shrink-0">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={genderDist}
                    dataKey="count"
                    nameKey="gender"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                  />
                  <RechartTooltip
                    formatter={(value, _name, item) =>
                      pctTooltipFormatter(
                        value as number,
                        _name as string,
                        item as { payload?: PctPayload }
                      )
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full">
              <Table
                size="small"
                dataSource={genderDist}
                rowKey="gender"
                pagination={false}
                columns={[
                  { title: "Gender", dataIndex: "gender", key: "gender" },
                  {
                    title: "Count",
                    dataIndex: "count",
                    key: "count",
                    align: "right" as const
                  },
                  {
                    title: "%",
                    dataIndex: "pct",
                    key: "pct",
                    align: "right" as const,
                    render: (v: number) => `${v}%`
                  }
                ]}
              />
            </div>
          </div>
        )}
      </Card>

      {/* ── Geopolitical Spread ──────────────────────────────────────────── */}
      <Card
        title="Geopolitical Spread"
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || regionDist.length === 0}
            onClick={() =>
              downloadCsv(
                "region-distribution.csv",
                ["Region", "Count", "Percentage"],
                regionDist.map(r => [r.region, r.count, `${r.pct}%`])
              )
            }>
            Download
          </Button>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <ResponsiveContainer
              width="100%"
              height={Math.max(300, regionDist.length * 48)}>
              <BarChart
                data={regionDist}
                layout="vertical"
                margin={{ left: 8, right: 40, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="region"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <RechartTooltip
                  formatter={(value, _name, item) =>
                    pctTooltipFormatter(
                      value as number,
                      _name as string,
                      item as { payload?: PctPayload }
                    )
                  }
                />
                <Bar
                  dataKey="count"
                  fill="#3c83f6"
                  radius={[0, 4, 4, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
            <Table
              size="small"
              dataSource={regionDist}
              rowKey="region"
              pagination={false}
              className="mt-4"
              columns={[
                { title: "Region", dataIndex: "region", key: "region" },
                {
                  title: "Count",
                  dataIndex: "count",
                  key: "count",
                  align: "right" as const
                },
                {
                  title: "%",
                  dataIndex: "pct",
                  key: "pct",
                  align: "right" as const,
                  render: (v: number) => `${v}%`
                }
              ]}
            />
          </>
        )}
      </Card>

      {/* ── Active vs Inactive by Region ────────────────────────────────── */}
      <Card title="Active vs Inactive by Region">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <ResponsiveContainer
            width="100%"
            height={Math.max(300, activeByRegionDist.length * 52)}>
            <BarChart
              data={activeByRegionDist}
              layout="vertical"
              margin={{ left: 8, right: 60, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="region"
                width={140}
                tick={{ fontSize: 12 }}
              />
              <RechartTooltip formatter={(val, name) => [`${val} Students`, name as string]} />
              <Legend />
              <Bar dataKey="active" name="Active" stackId="a" fill="#22c55e" barSize={28} />
              <Bar dataKey="inactive" name="Inactive" stackId="a" fill="#e2e8f0" barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── State Distribution ───────────────────────────────────────────── */}
      <Card
        title="State Distribution"
        extra={
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={isLoading || stateDist.length === 0}
            onClick={() =>
              downloadCsv(
                "state-distribution.csv",
                ["State", "Count", "Percentage"],
                stateDist.map(r => [r.state, r.count, `${r.pct}%`])
              )
            }>
            Download
          </Button>
        }>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-slate-500 whitespace-nowrap">
                Top {topStates} of {stateDist.length} states
              </span>
              <Slider
                min={5}
                max={Math.min(stateDist.length, 37)}
                value={topStates}
                onChange={setTopStates}
                className="flex-1"
                tooltip={{ formatter: v => `Top ${v}` }}
              />
            </div>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={stateChartData}
                margin={{ bottom: 80, left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="state"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartTooltip
                  formatter={(value, _name, item) =>
                    pctTooltipFormatter(
                      value as number,
                      _name as string,
                      item as { payload?: PctPayload }
                    )
                  }
                />
                <Bar dataKey="count" fill="#3c83f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <Table
              size="small"
              dataSource={stateDist}
              rowKey="state"
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showTotal: t => `${t} states`
              }}
              className="mt-4"
              columns={[
                { title: "State", dataIndex: "state", key: "state" },
                {
                  title: "Count",
                  dataIndex: "count",
                  key: "count",
                  align: "right" as const,
                  sorter: (a: { count: number }, b: { count: number }) =>
                    b.count - a.count,
                  defaultSortOrder: "ascend" as const
                },
                {
                  title: "%",
                  dataIndex: "pct",
                  key: "pct",
                  align: "right" as const,
                  render: (v: number) => `${v}%`
                }
              ]}
            />
          </>
        )}
      </Card>

      {/* ── Active vs Inactive by State ─────────────────────────────────── */}
      <Card title="Active vs Inactive by State">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-slate-500 whitespace-nowrap">
                Top {topStatesActivity} of {activeByStateDist.length} states
              </span>
              <Slider
                min={5}
                max={Math.min(activeByStateDist.length, 37)}
                value={topStatesActivity}
                onChange={setTopStatesActivity}
                className="flex-1"
                tooltip={{ formatter: v => `Top ${v}` }}
              />
            </div>
            <ResponsiveContainer width="100%" height={440}>
              <BarChart
                data={activeByStateChartData}
                margin={{ bottom: 80, left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="state"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartTooltip formatter={(val, name) => [`${val} Students`, name as string]} />
                <Legend />
                <Bar dataKey="active" name="Active" stackId="a" fill="#22c55e" />
                <Bar dataKey="inactive" name="Inactive" stackId="a" fill="#e2e8f0" />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>

      {/* ── All Students table ────────────────────────────────────────────── */}
      <Card title="All Students">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Search by name, email or state..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-72"
            allowClear
          />
          <Select
            value={genderFilter}
            onChange={setGenderFilter}
            className="w-36"
            options={[
              { label: "All Genders", value: "all" },
              { label: "Female", value: "Female" },
              { label: "Male", value: "Male" }
            ]}
          />
          <Select
            value={regionFilter}
            onChange={setRegionFilter}
            className="w-44"
            options={[
              { label: "All Regions", value: "all" },
              ...regions.map(r => ({ label: r, value: r }))
            ]}
          />
          {!isLoading && data && (
            <span className="text-slate-400 text-sm">
              {filtered.length !== data.length
                ? `${filtered.length.toLocaleString()} of ${data.length.toLocaleString()} Students`
                : `${data.length.toLocaleString()} Students`}
            </span>
          )}
        </div>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : filtered.length === 0 ? (
          <Empty description="No Students match your filters" />
        ) : (
          <FellowsTable data={filtered} />
        )}
      </Card>
    </div>
  );
}
