/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FormControlLabel, Switch } from "@mui/material";
import { useDialogs } from '@toolpad/core/useDialogs';
import { useNotifications } from '@toolpad/core/useNotifications';
import axios from '@/lib/axios';
import { SwitchCommandResponse } from '@/types/job';
import { useSessionInfo } from '@/providers/SessionContext';
import { CommandProps } from "@/components/job/active/commands";


/** ジョブ実行スイッチコマンド */
export default function SwitchCommand({
  job,
  task,
  command,
  onRefresh,
}: CommandProps<SwitchCommandResponse>) {
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const translate = useTranslations("Node.job.active");
  const translateError = useTranslations("Error");
  const session = useSessionInfo();
  const [checked, setChecked] = useState(command.value);

  useEffect(() => {
    setChecked(command.value);
  }, [command.value]);

  /** スイッチ切替 */
  const handleCommand = async (_event: React.ChangeEvent<HTMLInputElement>, nextChecked: boolean) => {
    const result = await dialogs.confirm(translate("button.content", {cmd: command.value ? command.label_off : command.label_on}), {
      title: job.name,
      okText: translate("button.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.active", {
        domain: { id: job.id },
        func: "exec_command",
        kwargs: {command: nextChecked, id: task.id}
      })
      await onRefresh()
      notifications.show(translate("button.success", {job: job.name, cmd: nextChecked ? command.label_on : command.label_off}), {
        severity: 'success',
        autoHideDuration: 3000,
      })
      setChecked(nextChecked)
    } catch {
      const errorMessage = translate("button.error", {job: job.name, cmd: nextChecked ? command.label_on : command.label_off});
      notifications.show(
        session?.authenticated === false
          ? `${errorMessage} / ${translateError("statusCode.401")}`
          : errorMessage,
        {
          severity: 'error',
          autoHideDuration: 3000,
        },
      )
    }
  };

return (
  <FormControlLabel
    label={command.value ? command.label_on : command.label_off}
    labelPlacement="start"
    control={
      <Switch
        checked={checked}
        onChange={handleCommand}
      />
    }
  />
)}
