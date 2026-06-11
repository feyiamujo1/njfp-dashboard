"use client";

import { useState } from "react";
import { ConfigProvider } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 60 * 1000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#1D4ED8",
            colorSuccess: "#16A34A",
            colorWarning: "#D97706",
            colorError: "#DC2626",
            colorBgLayout: "#F8FAFC",
            colorBgContainer: "#FFFFFF",
            borderRadius: 8,
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
          },
          components: {
            Menu: {
              itemBg: "#F0F2F6",
              itemSelectedBg: "#DBEAFE",
              itemSelectedColor: "#1D4ED8",
              itemHoverBg: "#E8ECF5",
              itemColor: "#374151",
              iconSize: 15,
            },
          },
        }}
      >
        {children}
        <ToastContainer position="top-right" autoClose={3000} />
      </ConfigProvider>
    </QueryClientProvider>
  );
}
