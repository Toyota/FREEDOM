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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  Menu,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useRouter } from "@/i18n/navigation";
import { TableVirtuoso } from "react-virtuoso";
import { useTranslations } from "next-intl";
import { useDialogs } from "@toolpad/core/useDialogs";
import { useNotifications } from "@toolpad/core/useNotifications";


type UserItem = {
  id: string;
  username: string | null;
  displayUsername: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  createdAt?: string | null;
};

const ROLE_ALL = "__all__";
const ROLE_NONE = "__none__";

function displayUserName(u: UserItem) {
  return u.displayUsername ??  u.username ?? u.name ?? u.email ?? u.id;
}

async function readApiErrorCode(res: Response): Promise<string | null> {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : null;
}

const VirtuosoComponents = {
  Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
    <TableContainer component={Paper} variant="outlined" {...props} ref={ref} />
  )),
  Table: (props: any) => (
    <Table
      {...props}
      size="small"
      sx={{
        borderCollapse: "separate",
        tableLayout: "fixed",
      }}
    />
  ),
  TableHead,
  TableRow: (props: any) => <TableRow {...props} hover />,
  TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableBody {...props} ref={ref} />
  )),
};

export default function Page() {
  const router = useRouter();
  const t = useTranslations("Admin.users");
  const tAccess = useTranslations("Admin.accessControl");
  const tDialog = useTranslations("Common.dialog");
  const dialogs = useDialogs();
  const notifications = useNotifications();

  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = React.useState(true);

  const [busy, setBusy] = React.useState(false);
  const [busyText, setBusyText] = React.useState<string>("");

  const [searchText, setSearchText] = React.useState("");
  const [debouncedSearchText, setDebouncedSearchText] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>(ROLE_ALL);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createUsername, setCreateUsername] = React.useState("");
  const [createPassword, setCreatePassword] = React.useState("");
  const [createRole, setCreateRole] = React.useState<string>("user");

  const [pwOpen, setPwOpen] = React.useState(false);
  const [pwUser, setPwUser] = React.useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const MIN_PASSWORD_LENGTH = 1;

  const [roleOpen, setRoleOpen] = React.useState(false);
  const [roleUser, setRoleUser] = React.useState<UserItem | null>(null);
  const [roleValue, setRoleValue] = React.useState<string>("");

  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [menuUser, setMenuUser] = React.useState<UserItem | null>(null);
  const menuOpen = Boolean(menuAnchor);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchText(searchText), 200);
    return () => clearTimeout(id);
  }, [searchText]);

  const loadUsers = React.useCallback(async () => {
    const r = await fetch("/api/admin/users", { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    const list: UserItem[] = Array.isArray(d?.items) ? d.items : [];
    setUsers(list);
  }, []);

  React.useEffect(() => {
    setIsLoadingUsers(true);
    loadUsers()
      .catch((e) => {
        console.error(e);
        notifications.show(t("notify.load.error"), {
          severity: "error",
          autoHideDuration: 3000,
        });
      })
      .finally(() => setIsLoadingUsers(false));
  }, [loadUsers, notifications, t]);

  const roleOptions = React.useMemo(() => {
    const set = new Set<string>();
    let hasNone = false;
    for (const u of users) {
      const r = (u.role ?? "").trim();
      if (!r) {
        hasNone = true;
        continue;
      }
      set.add(r);
    }
    set.add("user");
    set.add("admin");
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return { list, hasNone };
  }, [users]);

  const filteredUsers = React.useMemo(() => {
    const q = debouncedSearchText.trim().toLowerCase();

    return users.filter((u) => {
      const name = displayUserName(u).toLowerCase();
      const matchText = q.length === 0 ? true : name.includes(q);
      const r = (u.role ?? "").trim();
      const matchRole =
        roleFilter === ROLE_ALL
          ? true
          : roleFilter === ROLE_NONE
            ? r.length === 0
            : r === roleFilter;
      return matchText && matchRole;
    });
  }, [users, debouncedSearchText, roleFilter]);

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

  const onRefresh = React.useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      await loadUsers();
      notifications.show(t("notify.refresh.success"), {
        severity: "success",
        autoHideDuration: 3000,
      });
    } catch (e) {
      console.error(e);
      notifications.show(t("notify.refresh.error"), {
        severity: "error",
        autoHideDuration: 3000,
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [loadUsers, notifications, t]);

  const openCreate = React.useCallback(() => {
    setCreateUsername("");
    setCreatePassword("");
    setCreateRole("user");
    setCreateOpen(true);
  }, []);

  const submitCreate = React.useCallback(async () => {
    if (!createUsername) {
      notifications.show(t("validate.usernameRequired"), {
        severity: "warning",
        autoHideDuration: 3000,
      });
      return;
    }
    if (!createPassword) {
      notifications.show(t("validate.passwordRequired"), {
        severity: "warning",
        autoHideDuration: 3000,
      });
      return;
    }
    if (createPassword.length < MIN_PASSWORD_LENGTH) {
      notifications.show(t("validate.passwordTooShort"), {
        severity: "warning",
        autoHideDuration: 3000,
      });
      return;
    }

    const ok = await dialogs.confirm(
      t("confirm.create.body", { username: createUsername }),
      {
        title: t("confirm.title"),
        okText: t("confirm.create.ok"),
        cancelText: tDialog("cancel"),
      }
    );
    if (!ok) return;

    await withBusy("busy.create", async () => {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: createUsername,
          password: createPassword,
          role: createRole,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      const createdId = d?.user?.id ?? null;

      setCreateOpen(false);

      setIsLoadingUsers(true);
      try {
        await loadUsers();
      } finally {
        setIsLoadingUsers(false);
      }

      notifications.show(t("notify.create.success"), {
        severity: "success",
        autoHideDuration: 3000,
      });

      if (createdId) {
        router.push(`/admin/access-control?userId=${encodeURIComponent(createdId)}`);
      }
    }).catch((e) => {
      console.error(e);
      notifications.show(t("notify.create.error"), {
        severity: "error",
        autoHideDuration: 3000,
      });
    });
  }, [
    createUsername,
    createPassword,
    createRole,
    dialogs,
    loadUsers,
    notifications,
    router,
    t,
    withBusy,
  ]);

  const openMoreMenu = React.useCallback((e: React.MouseEvent<HTMLElement>, u: UserItem) => {
    setMenuAnchor(e.currentTarget);
    setMenuUser(u);
  }, []);

  const closeMoreMenu = React.useCallback(() => {
    setMenuAnchor(null);
    setMenuUser(null);
  }, []);

  const openPasswordDialog = React.useCallback((u: UserItem) => {
    setPwUser(u);
    setNewPassword("");
    setPwOpen(true);
  }, []);

  const submitPassword = React.useCallback(async () => {
    if (!pwUser) return;
    if (!newPassword) {
      notifications.show(t("validate.newPasswordRequired"), {
        severity: "warning",
        autoHideDuration: 3000,
      });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      notifications.show(t("validate.passwordTooShort"), {
        severity: "warning",
        autoHideDuration: 3000,
      });
      return;
    }
    const ok = await dialogs.confirm(
      t("confirm.password.body", { username: displayUserName(pwUser) }),
      {
        title: t("confirm.title"),
        okText: t("confirm.password.ok"),
        cancelText: tDialog("cancel"),
      }
    );
    if (!ok) return;

    await withBusy("busy.password", async () => {
      const r = await fetch("/api/admin/users/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: pwUser.id, newPassword }),
      });
      if (!r.ok) throw new Error(await r.text());
      setPwOpen(false);
      notifications.show(t("notify.password.success"), {
        severity: "success",
        autoHideDuration: 3000,
      });
    }).catch((e) => {
      console.error(e);
      notifications.show(t("notify.password.error"), {
        severity: "error",
        autoHideDuration: 3000,
      });
    });
  }, [pwUser, newPassword, dialogs, notifications, t, withBusy]);

  const openRoleDialog = React.useCallback((u: UserItem) => {
    setRoleUser(u);
    const current = (u.role ?? "").trim();
    setRoleValue(current.length > 0 ? current : "user");
    setRoleOpen(true);
  }, []);

  const submitRoleChange = React.useCallback(async () => {
    if (!roleUser) return;
    const nextRole = roleValue.trim();
    if (!nextRole) {
      notifications.show(t("validate.roleRequired"), {
        severity: "warning",
        autoHideDuration: 3000,
      });
      return;
    }
    const ok = await dialogs.confirm(
      t("confirm.role.body", {
        username: displayUserName(roleUser),
        role: nextRole,
      }),
      {
        title: t("confirm.title"),
        okText: t("confirm.role.ok"),
        cancelText: tDialog("cancel"),
      }
    );
    if (!ok) return;

    await withBusy("busy.role", async () => {
      const r = await fetch("/api/admin/users/set-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: roleUser.id,
          role: nextRole,
        }),
      });
      if (!r.ok) {
        const code = await readApiErrorCode(r);
        if (code === "cannot_change_own_role") {
          notifications.show(t("notify.role.cannotChangeOwn"), {
            severity: "warning",
            autoHideDuration: 3000,
          });
          return;
        }
        throw new Error(code ?? (await r.text()));
      }

      setRoleOpen(false);

      setIsLoadingUsers(true);
      try {
        await loadUsers();
      } finally {
        setIsLoadingUsers(false);
      }

      notifications.show(t("notify.role.success"), {
        severity: "success",
        autoHideDuration: 3000,
      });
    }).catch((e) => {
      console.error(e);
      notifications.show(t("notify.role.error"), {
        severity: "error",
        autoHideDuration: 3000,
      });
    });
  }, [roleUser, roleValue, dialogs, loadUsers, notifications, t, withBusy]);

  const submitDelete = React.useCallback(
    async (u: UserItem) => {
      const ok = await dialogs.confirm(
        t("confirm.delete.body", { username: displayUserName(u) }),
        {
          title: t("confirm.title"),
          okText: t("confirm.delete.ok"),
          cancelText: tDialog("cancel"),
        }
      );
      if (!ok) return;

      await withBusy("busy.delete", async () => {
        const r = await fetch("/api/admin/users/remove", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: u.id }),
        });
        if (!r.ok) {
          const code = await readApiErrorCode(r);
          if (code === "cannot_delete_self") {
            notifications.show(t("notify.delete.cannotDeleteSelf"), {
              severity: "warning",
              autoHideDuration: 3000,
            });
            return;
          }
          throw new Error(code ?? (await r.text()));
        }

        setIsLoadingUsers(true);
        try {
          await loadUsers();
        } finally {
          setIsLoadingUsers(false);
        }

        notifications.show(t("notify.delete.success"), {
          severity: "success",
          autoHideDuration: 3000,
        });
      }).catch((e) => {
        console.error(e);
        notifications.show(t("notify.delete.error"), {
          severity: "error",
          autoHideDuration: 3000,
        });
      });
    },
    [dialogs, loadUsers, notifications, t, withBusy]
  );

  const fixedHeaderContent = React.useCallback(() => {
    const headCellSx = { backgroundColor: "background.paper" };
    const actionColSx = { ...headCellSx, width: 70, minWidth: 70, maxWidth: 70, px: 0.5 };
    return (
      <TableRow>
        <TableCell sx={headCellSx}>{t("table.username")}</TableCell>
        <TableCell sx={headCellSx}>{t("table.role")}</TableCell>
        <TableCell sx={actionColSx} align="center">
          {t("table.actions")}
        </TableCell>
      </TableRow>
    );
  }, [t]);

  const itemContent = React.useCallback(
    (_: number, u: UserItem) => {
      const actionCellSx = { width: 70, minWidth: 70, maxWidth: 70, px: 0.5 };
      return (
        <>
          <TableCell>{displayUserName(u)}</TableCell>
          <TableCell>{(u.role ?? "").trim() ? u.role : t("role.none")}</TableCell>
          <TableCell align="center" sx={actionCellSx}>
            <Tooltip title={t("tooltip.more")}>
              <span>
                <IconButton size="small" onClick={(e) => openMoreMenu(e, u)} disabled={busy || isLoadingUsers}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </TableCell>
        </>
      );
    },
    [openMoreMenu, t, busy, isLoadingUsers]
  );

  const showLoading = isLoadingUsers || busy;

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
        >
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("title")}
          </Typography>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<PersonAddAltIcon />}
              onClick={openCreate}
              disabled={busy || isLoadingUsers}
            >
              {t("buttons.create")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={busy || isLoadingUsers}
            >
              {t("buttons.refresh")}
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
          <TextField
            size="small"
            label={t("labels.search")}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 280 } }}
            disabled={busy}
          />

          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 200 } }} disabled={busy}>
            <InputLabel>{t("labels.role")}</InputLabel>
            <Select
              label={t("labels.role")}
              value={roleFilter}
              onChange={(e) => setRoleFilter(String(e.target.value))}
            >
              <MenuItem value={ROLE_ALL}>{t("role.all")}</MenuItem>
              {roleOptions.hasNone ? <MenuItem value={ROLE_NONE}>{t("role.none")}</MenuItem> : null}
              {roleOptions.list.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: "auto" } }}>
            {t("labels.count", { count: filteredUsers.length })}
          </Typography>
        </Stack>

        <Box sx={{ height: "calc(100vh - 320px)" }}>
          {showLoading ? (
            <Box
              sx={{
                height: "100%",
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
          ) : (
            <TableVirtuoso
              style={{ height: "100%" }}
              data={filteredUsers}
              components={VirtuosoComponents as any}
              computeItemKey={(_, u) => u.id}
              increaseViewportBy={{ top: 300, bottom: 600 }}
              fixedHeaderContent={fixedHeaderContent}
              itemContent={itemContent}
            />
          )}
        </Box>
      </Stack>

      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={closeMoreMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          disabled={busy || isLoadingUsers}
          onClick={() => {
            if (!menuUser) return;
            const uid = menuUser.id;
            closeMoreMenu();
            router.push(`/admin/access-control?userId=${encodeURIComponent(uid)}`);
          }}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tAccess("title")}</ListItemText>
        </MenuItem>

        <MenuItem
          disabled={busy || isLoadingUsers}
          onClick={() => {
            if (!menuUser) return;
            closeMoreMenu();
            openRoleDialog(menuUser);
          }}
        >
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("menu.role")}</ListItemText>
        </MenuItem>

        <MenuItem
          disabled={busy || isLoadingUsers}
          onClick={() => {
            if (!menuUser) return;
            closeMoreMenu();
            openPasswordDialog(menuUser);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("menu.password")}</ListItemText>
        </MenuItem>

        <MenuItem
          disabled={busy || isLoadingUsers}
          onClick={() => {
            if (!menuUser) return;
            const u = menuUser;
            closeMoreMenu();
            submitDelete(u);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("menu.delete")}</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("dialog.create.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("dialog.create.username")}
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              size="small"
              autoComplete="username"
              fullWidth
              disabled={busy}
            />
            <TextField
              label={t("dialog.create.password")}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              size="small"
              type="password"
              autoComplete="new-password"
              fullWidth
              disabled={busy}
            />
            <FormControl size="small" fullWidth disabled={busy}>
              <InputLabel>{t("dialog.create.role")}</InputLabel>
              <Select
                label={t("dialog.create.role")}
                value={createRole}
                onChange={(e) => setCreateRole(String(e.target.value))}
              >
                {roleOptions.list.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={busy}>
            {tDialog("cancel")}
          </Button>
          <Button variant="contained" onClick={submitCreate} disabled={busy}>
            {t("dialog.create.ok")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={roleOpen} onClose={() => setRoleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("dialog.role.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("dialog.role.target")}
              value={roleUser ? displayUserName(roleUser) : ""}
              size="small"
              fullWidth
              disabled
            />
            <FormControl size="small" fullWidth disabled={busy}>
              <InputLabel>{t("dialog.role.role")}</InputLabel>
              <Select
                label={t("dialog.role.role")}
                value={roleValue}
                onChange={(e) => setRoleValue(String(e.target.value))}
              >
                {roleOptions.list.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleOpen(false)} disabled={busy}>
            {tDialog("cancel")}
          </Button>
          <Button variant="contained" onClick={submitRoleChange} disabled={busy || !roleUser}>
            {t("dialog.role.ok")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pwOpen} onClose={() => setPwOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("dialog.password.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("dialog.password.target")}
              value={pwUser ? displayUserName(pwUser) : ""}
              size="small"
              fullWidth
              disabled
            />
            <TextField
              label={t("dialog.password.newPassword")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              size="small"
              type="password"
              autoComplete="new-password"
              fullWidth
              disabled={busy}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwOpen(false)} disabled={busy}>
            {tDialog("cancel")}
          </Button>
          <Button variant="contained" onClick={submitPassword} disabled={busy || !pwUser}>
            {t("dialog.password.ok")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
