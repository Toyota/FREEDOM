/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";
import * as React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDialogs } from "@toolpad/core/useDialogs";
import { useNotifications } from "@toolpad/core/useNotifications";

import { useUnsavedChangesGuard } from "@/providers/UnsavedChangesProvider";
import NodeTab from "./NodeTab";
import JobTab from "./JobTab";


type NodeItem = {
  repository: string;
  node: string;
  node_id: string;
  label: string;
};

type AllowItem = {
  repository: string;
  node: string;
  node_id: string;
};

type UserItem = {
  id: string;
  username: string | null;
  displayUsername: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
};

type TabKey = "node" | "job";

function keyOf(c: string, id: string) {
  return `${c}@@${id}`;
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function userLabel(u: UserItem) {
  const parts: string[] = [];
  if (u.displayUsername) parts.push(u.displayUsername);
  else if (u.username) parts.push(u.username);
  else if (u.name) parts.push(u.name);
  else if (u.email) parts.push(u.email);
  if (u.role) parts.push(`(${u.role})`);
  return parts.join(" ");
}

export default function Page() {
  const t = useTranslations("Admin.accessControl");
  const tUnsaved = useTranslations("Common.unsavedNavigation");
  const tDialog = useTranslations("Common.dialog");
  const dialogs = useDialogs();
  const notifications = useNotifications();

  const searchParams = useSearchParams();
  const initialUserId = searchParams.get("userId") ?? "";

  const [tab, setTab] = React.useState<TabKey>("node");

  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [nodes, setNodes] = React.useState<NodeItem[]>([]);
  const [jobNames, setJobNames] = React.useState<string[]>([]);

  const [userId, setUserId] = React.useState<string>("");

  const [isLoadingInit, setIsLoadingInit] = React.useState(true);

  const [busy, setBusy] = React.useState(false);
  const [busyText, setBusyText] = React.useState("");

  const [nodeTabAllowed, setNodeTabAllowed] = React.useState<Set<string>>(new Set());
  const [nodeTabSnapshot, setNodeTabSnapshot] = React.useState<Set<string>>(new Set());
  const [nodeTabDirty, setNodeTabDirty] = React.useState(false);
  const [nodeTabLoadedUserId, setNodeTabLoadedUserId] = React.useState<string>("");

  const [jobAllowed, setJobAllowed] = React.useState<Set<string>>(new Set());
  const [jobSnapshot, setJobSnapshot] = React.useState<Set<string>>(new Set());
  const [jobDirty, setJobDirty] = React.useState(false);
  const [jobLoadedUserId, setJobLoadedUserId] = React.useState<string>("");

  const dirtyAny = nodeTabDirty || jobDirty;

  useUnsavedChangesGuard(dirtyAny);

  const currentLoadUserRef = React.useRef<string>("");
  const autoLoadedOnceRef = React.useRef(false);

  const selectedUser = React.useMemo(
    () => users.find((u) => u.id === userId) ?? null,
    [users, userId]
  );
  const isSelectedAdmin = selectedUser?.role === "admin";

  const withBusy = React.useCallback(
    async (textKey: string, fn: () => Promise<void>) => {
      setBusyText(t(textKey));
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
        setBusyText("");
      }
    },
    [t]
  );

  const clearUserIdFromUrl = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("userId")) return;
    url.searchParams.delete("userId");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const loadUsers = React.useCallback(async () => {
    const r = await fetch("/api/admin/users", { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    setUsers(Array.isArray(d?.items) ? d.items : []);
  }, []);

  const loadNodes = React.useCallback(async () => {
    const r = await fetch("/api/admin/nodes", { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    setNodes(Array.isArray(d?.items) ? d.items : []);
  }, []);

  const loadJobNames = React.useCallback(async () => {
    const r = await fetch("/api/job-names", { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    setJobNames(Array.isArray(d?.items) ? d.items : []);
  }, []);

  const loadNodeAllowed = React.useCallback(async (uid: string) => {
    currentLoadUserRef.current = uid;

    const r = await fetch(`/api/admin/user-node-allow?userId=${encodeURIComponent(uid)}`, {
      cache: "no-store",
    });
    if (!r.ok) throw new Error(await r.text());

    const d = await r.json();
    if (currentLoadUserRef.current !== uid) return;

    const items: AllowItem[] = Array.isArray(d?.items) ? d.items : [];
    const s = new Set<string>();
    for (const it of items) s.add(keyOf(it.node, it.node_id));

    setNodeTabAllowed(s);
    setNodeTabSnapshot(new Set(s));
    setNodeTabDirty(false);
    setNodeTabLoadedUserId(uid);
  }, []);

  const loadJobAllowed = React.useCallback(async (uid: string) => {
    currentLoadUserRef.current = uid;

    const r = await fetch(`/api/admin/user-job-allow?userId=${encodeURIComponent(uid)}`, {
      cache: "no-store",
    });
    if (!r.ok) throw new Error(await r.text());

    const d = await r.json();
    if (currentLoadUserRef.current !== uid) return;

    const items: string[] = Array.isArray(d?.items) ? d.items : [];
    const s = new Set<string>();
    for (const name of items) s.add(String(name));

    setJobAllowed(s);
    setJobSnapshot(new Set(s));
    setJobDirty(false);
    setJobLoadedUserId(uid);
  }, []);

  const loadAdminAllowAll = React.useCallback(
    (uid: string) => {
      const nodeAll = new Set<string>(nodes.map((r) => keyOf(r.node, r.node_id)));
      setNodeTabAllowed(nodeAll);
      setNodeTabSnapshot(new Set(nodeAll));
      setNodeTabDirty(false);
      setNodeTabLoadedUserId(uid);

      const jobAll = new Set<string>(jobNames.map((name) => String(name)));
      setJobAllowed(jobAll);
      setJobSnapshot(new Set(jobAll));
      setJobDirty(false);
      setJobLoadedUserId(uid);
    },
    [nodes, jobNames]
  );

  React.useEffect(() => {
    setIsLoadingInit(true);
    Promise.all([loadUsers(), loadNodes(), loadJobNames()])
      .catch((e) => {
        console.error(e);
        notifications.show(t("notify.init.error"), { severity: "error", autoHideDuration: 3000 });
      })
      .finally(() => setIsLoadingInit(false));
  }, [loadUsers, loadNodes, loadJobNames, notifications, t]);

  React.useEffect(() => {
    if (!initialUserId) return;
    if (isLoadingInit) return;
    if (users.length === 0) return;
    if (autoLoadedOnceRef.current) return;

    const exists = users.some((u) => u.id === initialUserId);
    if (!exists) return;

    if (!userId) setUserId(initialUserId);

    autoLoadedOnceRef.current = true;
    setTab("node");

    void (async () => {
      try {
        await withBusy("busy.load", async () => {
          const initialUser = users.find((u) => u.id === initialUserId) ?? null;
          if (initialUser?.role === "admin") {
            loadAdminAllowAll(initialUserId);
          } else {
            await loadNodeAllowed(initialUserId);
            await loadJobAllowed(initialUserId);
          }
        });
      } catch (e) {
        console.error(e);
        notifications.show(t("notify.load.error"), { severity: "error", autoHideDuration: 3000 });
      } finally {
        clearUserIdFromUrl();
      }
    })();
  }, [initialUserId, isLoadingInit, users, userId, withBusy, loadNodeAllowed, loadJobAllowed, loadAdminAllowAll, notifications, t, clearUserIdFromUrl]);

  const resetAllStateForUserChange = React.useCallback(() => {
    setNodeTabAllowed(new Set());
    setNodeTabSnapshot(new Set());
    setNodeTabDirty(false);
    setNodeTabLoadedUserId("");

    setJobAllowed(new Set());
    setJobSnapshot(new Set());
    setJobDirty(false);
    setJobLoadedUserId("");
  }, []);

  const canEditNodeTab = !!userId && userId === nodeTabLoadedUserId && !busy;
  const canEditJob = !!userId && userId === jobLoadedUserId && !busy;
  const canEditNodeTabEffective = canEditNodeTab && !isSelectedAdmin;
  const canEditJobEffective = canEditJob && !isSelectedAdmin;

  const currentDirty = tab === "node" ? nodeTabDirty : jobDirty;
  const currentLoadedUser = tab === "node" ? nodeTabLoadedUserId : jobLoadedUserId;

  const onTabChange = async (_: any, next: TabKey) => {
    if (next === tab) return;

    if (!dirtyAny) {
      setTab(next);
      return;
    }

    const ok = await dialogs.confirm(tUnsaved("body"), {
      title: tUnsaved("title"),
      okText: tUnsaved("ok"),
      cancelText: tDialog("cancel"),
    });
    if (!ok) return;

    if (tab === "node") {
      setNodeTabAllowed(new Set(nodeTabSnapshot));
      setNodeTabDirty(false);
    } else {
      setJobAllowed(new Set(jobSnapshot));
      setJobDirty(false);
    }

    setTab(next);
  };

  const onLoad = async () => {
    if (!userId) {
      notifications.show(t("notify.userRequired"), { severity: "warning", autoHideDuration: 3000 });
      return;
    }

    await withBusy("busy.load", async () => {
      if (isSelectedAdmin) {
        loadAdminAllowAll(userId);
        notifications.show(t("notify.load.success"), { severity: "success", autoHideDuration: 3000 });
        return;
      }

      const results = await Promise.allSettled([loadNodeAllowed(userId), loadJobAllowed(userId)]);

      const nodeOk = results[0].status === "fulfilled";
      const jobOk = results[1].status === "fulfilled";

      if (nodeOk && jobOk) {
        notifications.show(t("notify.load.success"), { severity: "success", autoHideDuration: 3000 });
        return;
      }

      if (!nodeOk) {
        console.error(results[0]);
        notifications.show(t("notify.load.nodeError"), { severity: "error", autoHideDuration: 3000 });
      }
      if (!jobOk) {
        console.error(results[1]);
        notifications.show(t("notify.load.jobError"), { severity: "error", autoHideDuration: 3000 });
      }
    });
  };

  const onSave = async () => {
    if (!userId) {
      notifications.show(t("notify.userRequired"), { severity: "warning", autoHideDuration: 3000 });
      return;
    }
    if (!currentDirty) return;
    if (userId !== currentLoadedUser) {
      notifications.show(t("notify.loadRequired"), { severity: "warning", autoHideDuration: 3000 });
      return;
    }

    const ok = await dialogs.confirm(t("confirm.save.body"), {
      title: tDialog("title"),
      okText: t("confirm.save.ok"),
      cancelText: tDialog("cancel"),
    });
    if (!ok) return;

    await withBusy("busy.save", async () => {
      try {
        if (tab === "node") {
          const items: AllowItem[] = nodes
            .filter((r) => nodeTabAllowed.has(keyOf(r.node, r.node_id)))
            .map((r) => ({
              repository: r.repository,
              node: r.node,
              node_id: r.node_id,
            }));

          const res = await fetch("/api/admin/user-node-allow", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId, items }),
          });
          if (!res.ok) throw new Error(await res.text());
          await loadNodeAllowed(userId);
        } else {
          const items = Array.from(jobAllowed);

          const res = await fetch("/api/admin/user-job-allow", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId, items }),
          });
          if (!res.ok) throw new Error(await res.text());
          await loadJobAllowed(userId);
        }

        notifications.show(t("notify.save.success"), { severity: "success", autoHideDuration: 3000 });
      } catch (e) {
        console.error(e);
        notifications.show(t("notify.save.error"), { severity: "error", autoHideDuration: 3000 });
      }
    });
  };

  const guardEditable = React.useCallback(() => {
    if (!userId) {
      notifications.show(t("notify.userRequiredForEdit"), { severity: "warning", autoHideDuration: 3000 });
      return false;
    }
    if (isSelectedAdmin) {
      return false;
    }
    if (tab === "node") {
      if (userId !== nodeTabLoadedUserId) {
        notifications.show(t("notify.loadRequired"), { severity: "warning", autoHideDuration: 3000 });
        return false;
      }
    } else {
      if (userId !== jobLoadedUserId) {
        notifications.show(t("notify.loadRequired"), { severity: "warning", autoHideDuration: 3000 });
        return false;
      }
    }
    return true;
  }, [notifications, t, userId, tab, nodeTabLoadedUserId, jobLoadedUserId, isSelectedAdmin]);

  const toggleNodeOne = React.useCallback(
    (r: NodeItem) => {
      if (!guardEditable()) return;
      const k = keyOf(r.node, r.node_id);
      setNodeTabAllowed((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        setNodeTabDirty(!setsEqual(next, nodeTabSnapshot));
        return next;
      });
    },
    [guardEditable, nodeTabSnapshot]
  );

  const toggleJobOne = React.useCallback(
    (name: string) => {
      if (!guardEditable()) return;
      setJobAllowed((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setJobDirty(!setsEqual(next, jobSnapshot));
        return next;
      });
    },
    [guardEditable, jobSnapshot]
  );

  const onNodeBulkSelect = React.useCallback(
    (list: NodeItem[]) => {
      if (!guardEditable()) return;
      setNodeTabAllowed((prev) => {
        const next = new Set(prev);
        for (const r of list) next.add(keyOf(r.node, r.node_id));
        setNodeTabDirty(!setsEqual(next, nodeTabSnapshot));
        return next;
      });
      notifications.show(t("notify.selectAll.success"), { severity: "success", autoHideDuration: 3000 });
    },
    [guardEditable, nodeTabSnapshot, notifications, t]
  );

  const onNodeBulkClear = React.useCallback(
    (list: NodeItem[]) => {
      if (!guardEditable()) return;
      setNodeTabAllowed((prev) => {
        const next = new Set(prev);
        for (const r of list) next.delete(keyOf(r.node, r.node_id));
        setNodeTabDirty(!setsEqual(next, nodeTabSnapshot));
        return next;
      });
      notifications.show(t("notify.clearAll.success"), { severity: "success", autoHideDuration: 3000 });
    },
    [guardEditable, nodeTabSnapshot, notifications, t]
  );

  const onJobBulkSelect = React.useCallback(
    (list: string[]) => {
      if (!guardEditable()) return;
      setJobAllowed((prev) => {
        const next = new Set(prev);
        for (const name of list) next.add(name);
        setJobDirty(!setsEqual(next, jobSnapshot));
        return next;
      });
      notifications.show(t("notify.selectAll.success"), { severity: "success", autoHideDuration: 3000 });
    },
    [guardEditable, jobSnapshot, notifications, t]
  );

  const onJobBulkClear = React.useCallback(
    (list: string[]) => {
      if (!guardEditable()) return;
      setJobAllowed((prev) => {
        const next = new Set(prev);
        for (const name of list) next.delete(name);
        setJobDirty(!setsEqual(next, jobSnapshot));
        return next;
      });
      notifications.show(t("notify.clearAll.success"), { severity: "success", autoHideDuration: 3000 });
    },
    [guardEditable, jobSnapshot, notifications, t]
  );

  const showLoading = isLoadingInit || busy;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack spacing={1.5} sx={{ height: "calc(100dvh - 64px)" }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("title")}
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Autocomplete
            options={users}
            value={users.find((u) => u.id === userId) ?? null}
            onChange={async (_, v) => {
              if (dirtyAny) {
                const ok = await dialogs.confirm(tUnsaved("body"), {
                  title: tUnsaved("title"),
                  okText: tUnsaved("ok"),
                  cancelText: tDialog("cancel"),
                });
                if (!ok) return;

                setNodeTabAllowed(new Set(nodeTabSnapshot));
                setNodeTabDirty(false);
                setJobAllowed(new Set(jobSnapshot));
                setJobDirty(false);
              }

              const nextId = v?.id ?? "";
              setUserId(nextId);
              resetAllStateForUserChange();
            }}
            getOptionLabel={(u) => userLabel(u)}
            renderInput={(params) => <TextField {...params} label={t("labels.user")} size="small" />}
            sx={{ width: { xs: "100%", sm: 420 } }}
            disabled={busy || isLoadingInit}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ ml: { sm: "auto" } }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={onLoad}
              disabled={busy || isLoadingInit || !userId}
            >
              {t("buttons.load")}
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={onSave}
              disabled={busy || isLoadingInit || !userId || !currentDirty || userId !== currentLoadedUser}
            >
              {t("buttons.save")}
            </Button>
          </Stack>
        </Stack>

        <Divider />

        <Tabs value={tab} onChange={onTabChange} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="node" label={t("tabs.node")} disabled={busy || isLoadingInit} />
          <Tab value="job" label={t("tabs.job")} disabled={busy || isLoadingInit} />
        </Tabs>

        <Box sx={{ flex: 1, minHeight: 240 }}>
          {showLoading ? (
            <Box
              sx={{
                height: "100%",
                minHeight: 240,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Stack alignItems="center" spacing={2}>
                <CircularProgress />
                {busy ? (
                  <Typography variant="body2" color="text.secondary">
                    {busyText || t("busy.default")}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          ) : tab === "node" ? (
            <NodeTab
              nodes={nodes}
              allowed={nodeTabAllowed}
              canEdit={canEditNodeTabEffective}
              busy={busy}
              onToggle={toggleNodeOne}
              onBulkSelect={onNodeBulkSelect}
              onBulkClear={onNodeBulkClear}
            />
          ) : (
            <JobTab
              jobNames={jobNames}
              allowed={jobAllowed}
              canEdit={canEditJobEffective}
              busy={busy}
              onToggle={toggleJobOne}
              onBulkSelect={onJobBulkSelect}
              onBulkClear={onJobBulkClear}
            />
          )}
        </Box>
      </Stack>
    </Box>
  );
}
