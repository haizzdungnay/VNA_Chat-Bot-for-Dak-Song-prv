import React, { useState, useEffect, useCallback } from "react";
import type {
  AdminTab,
  AdminAIProfile,
  AdminAIProfileInput,
  VisitorConsentProfile,
  AuditLogItem,
  TelemetryEventItem,
  SystemOverview,
} from "./types";
import { adminApi, AdminApiError } from "./services/api";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { OverviewPage } from "./pages/OverviewPage";
import { VisitorsPage } from "./pages/VisitorsPage";
import { AIProfilesPage } from "./pages/AIProfilesPage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [profiles, setProfiles] = useState<AdminAIProfile[]>([]);
  const [visitors, setVisitors] = useState<VisitorConsentProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEventItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDevMock, setIsDevMock] = useState(false);

  const addToast = useCallback((type: "success" | "error" | "info", text: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ovData, profData, visData, logData] = await Promise.allSettled([
        adminApi.getOverview(),
        adminApi.getProfiles(),
        adminApi.getVisitors(),
        adminApi.getLogs(),
      ]);

      let hasAuthError = false;

      if (ovData.status === "fulfilled") {
        setOverview(ovData.value);
        setIsDevMock(!ovData.value.accessConfigured);
      } else if (ovData.reason instanceof AdminApiError && ovData.reason.status === 401) {
        hasAuthError = true;
      }

      if (profData.status === "fulfilled") {
        setProfiles(profData.value);
      }

      if (visData.status === "fulfilled") {
        setVisitors(visData.value);
      }

      if (logData.status === "fulfilled") {
        setAuditLogs(logData.value.auditLogs || []);
        setTelemetryEvents(logData.value.telemetryEvents || []);
      }

      if (hasAuthError) {
        addToast(
          "error",
          "Chưa xác thực Cloudflare Access (Fail-Closed). Kiểm tra lại quyền đăng nhập quản trị viên."
        );
      }
    } catch (err: any) {
      addToast("error", err.message || "Lỗi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateProfile = async (input: AdminAIProfileInput) => {
    try {
      await adminApi.createProfile(input);
      addToast("success", "Đã lưu và mã hóa cấu hình AI thành công");
      await loadData();
    } catch (err: any) {
      addToast("error", err.message || "Lỗi tạo cấu hình");
      throw err;
    }
  };

  const handleUpdateProfile = async (id: string, input: Partial<AdminAIProfileInput>) => {
    try {
      await adminApi.updateProfile(id, input);
      addToast("success", "Đã cập nhật cấu hình");
      await loadData();
    } catch (err: any) {
      addToast("error", err.message || "Lỗi cập nhật cấu hình");
      throw err;
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await adminApi.deleteProfile(id);
      addToast("success", "Đã xóa cấu hình khỏi cơ sở dữ liệu");
      await loadData();
    } catch (err: any) {
      addToast("error", err.message || "Lỗi xóa cấu hình");
    }
  };

  const handleTestProfile = async (id: string) => {
    try {
      const res = await adminApi.testProfile(id);
      if (res.status === "success") {
        addToast("success", `Kiểm tra kết nối thành công (${res.latencyMs}ms)`);
      } else {
        addToast("error", `Kiểm tra thất bại: ${res.error || "Không thể kết nối"}`);
      }
      await loadData();
    } catch (err: any) {
      addToast("error", err.message || "Lỗi kiểm tra kết nối");
    }
  };

  const handleActivateProfile = async (id: string) => {
    try {
      await adminApi.activateProfile(id);
      addToast("success", "Đã kích hoạt cấu hình AI thành công");
      await loadData();
    } catch (err: any) {
      addToast("error", err.message || "Lỗi kích hoạt cấu hình");
    }
  };

  const handleRollbackToEnv = async () => {
    try {
      await adminApi.rollbackToEnv();
      addToast("info", "Đã rollback về cấu hình Worker Environment Variables gốc");
      await loadData();
    } catch (err: any) {
      addToast("error", err.message || "Lỗi rollback cấu hình");
    }
  };

  const activeProfile = profiles.find((p) => p.isActive);

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeProfileName={activeProfile?.name}
        visitorsCount={visitors.length}
      />

      <div className="main-wrapper">
        <Header
          currentTab={currentTab}
          onRefresh={loadData}
          isLoading={isLoading}
          adminEmail="admin@daksong.vn"
          isDevMock={isDevMock}
        />

        <main className="page-content">
          {currentTab === "overview" && (
            <OverviewPage overview={overview} onNavigateTab={setCurrentTab} />
          )}

          {currentTab === "visitors" && (
            <VisitorsPage visitors={visitors} isLoading={isLoading} />
          )}

          {currentTab === "profiles" && (
            <AIProfilesPage
              profiles={profiles}
              isLoading={isLoading}
              onRefresh={loadData}
              onCreateProfile={handleCreateProfile}
              onUpdateProfile={handleUpdateProfile}
              onDeleteProfile={handleDeleteProfile}
              onTestProfile={handleTestProfile}
              onActivateProfile={handleActivateProfile}
              onRollbackToEnv={handleRollbackToEnv}
              featureFlagActive={overview?.featureFlagActive ?? false}
            />
          )}

          {currentTab === "logs" && (
            <LogsPage
              auditLogs={auditLogs}
              telemetryEvents={telemetryEvents}
              isLoading={isLoading}
            />
          )}

          {currentTab === "settings" && <SettingsPage overview={overview} />}
        </main>
      </div>

      <ToastContainer messages={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;

