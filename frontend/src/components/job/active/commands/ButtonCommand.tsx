/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";
import { useTranslations } from "next-intl";
import { Button } from '@mui/material';
import axios from '@/lib/axios';
import { useDialogs } from '@toolpad/core/useDialogs';
import { useNotifications } from '@toolpad/core/useNotifications';
import { ButtonCommandResponse } from '@/types/job';
import { useSessionInfo } from '@/providers/SessionContext';
import { CommandProps } from "@/components/job/active/commands";


/** ジョブ実行ボタンコマンド */
export default function ButtonCommand({
  job,
  task,
  command,
  onRefresh,
}: CommandProps<ButtonCommandResponse>) {
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const translate = useTranslations("Node.job.active");
  const translateError = useTranslations("Error");
  const session = useSessionInfo();

  /** ボタン押下 */
  const handleCommand = async (e: React.MouseEvent<Element>) => {
    e.stopPropagation()
    const result = await dialogs.confirm(translate("button.content", {cmd: command.label}), {
      title: job.name,
      okText: translate("button.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.active", {
        domain: { id: job.id },
        func: "exec_command",
        kwargs: {command: command.value, id: task.id}
      })
      await onRefresh()
      notifications.show(translate("button.success", {job: job.name, cmd: command.label}), {
        severity: 'success',
        autoHideDuration: 3000,
      })
    } catch {
      const errorMessage = translate("button.error", {job: job.name, cmd: command.label});
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
    <Button
      type="button"
      variant="contained"
      sx={{
        my: 0.25,
        minWidth: { xs: '100%', sm: 'fit-content' },
      }}
      onClick={handleCommand}
    >
      {command.label}
    </Button>
  )
}
