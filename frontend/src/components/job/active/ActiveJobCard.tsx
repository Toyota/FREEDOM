/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";
import React, { useMemo } from 'react';
import { useTranslations } from "next-intl";
import { Button, Divider, Stack, Paper, Typography } from '@mui/material';
import { red, lightGreen, yellow } from '@mui/material/colors';
import { useDialogs } from '@toolpad/core/useDialogs';
import { useNotifications } from '@toolpad/core/useNotifications';
import axios from '@/lib/axios';
import { useSessionInfo } from '@/providers/SessionContext';
import { JobActiveResponse, StatementTaskResponse } from '@/types/job';
import TaskCommand from '@/components/job/active/commands/TaskCommand';
import { formatJaKanjiMdHms } from '@/lib/datetime';


/** ジョブ実行カード引数 */
interface ActiveJobCardProps  {
  /** ジョブドメイン */
  job: JobActiveResponse;
  /** 受信更新 */
  onRefresh: () => Promise<void>;
  /** 外側スタイル（高さなど） */
  style?: React.CSSProperties;
  /** タスク一覧用スクロールコンテナ */
  taskContainerRef?: React.Ref<HTMLDivElement>;
}

/** ジョブ実行カードの背景色作成 */
export function makeBGColor(job: JobActiveResponse) {
  if (job.error_msg.length) return red[100]
  if (job.warning_msg.length) return yellow[100]
  return lightGreen[100]
}

function isTaskLike(value: any): value is StatementTaskResponse {
  return (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    'finished' in value
  )
}

/** 現在未完了の最深タスクを探索 */
function findDeepestCurrentTask(
  task: StatementTaskResponse | null
): StatementTaskResponse | null {
  if (!task) return null
  if (task.finished) return findDeepestCurrentTask(task.next)
  const taskIds = task.command.filter((c) => c.type === 'task').map((c) => c.id)
  for (const key of Object.keys(task)) {
    const t: StatementTaskResponse = (task)[key];
    if (t?.id && taskIds.includes(t.id)) {
      return findDeepestCurrentTask(t);
    }
  }
  return task
}

/** ジョブ実行カード */
export default function ActiveJobCard({
  job,
  onRefresh,
  style,
  taskContainerRef,
}: ActiveJobCardProps ) {
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const translate = useTranslations("Node.job.active");
  const translateError = useTranslations("Error");
  const session = useSessionInfo();
  const currentTask = useMemo(
    () => findDeepestCurrentTask(job.task),
    [job.task],
  )

  /** ジョブ停止 */
  const handleStop = async () => {
    const result = await dialogs.confirm(translate("stop.content", {job: job.name}), {
      title: translate("dialog.title"),
      okText: translate("stop.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.active", {
        domain: { id: job.id },
        func: "stop"
      })
      await onRefresh()
      notifications.show(translate("stop.success", {job: job.name}), {
        severity: 'success',
        autoHideDuration: 3000,
      })
    } catch {
      const errorMessage = translate("stop.error", {job: job.name});
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

  /** ジョブ復帰 */
  const handleRecover = async () => {
    const taskName = currentTask?.name ?? ""
    const result = await dialogs.confirm(translate("recover.content", {task: taskName}), {
      title: job.name,
      okText: translate("recover.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.active", {
        domain: { id: job.id },
        func: "recover",
        kwargs: {id: currentTask?.id}
      })
      await onRefresh()
      notifications.show(translate("recover.success", {job: job.name}), {
        severity: 'success',
        autoHideDuration: 3000,
      })
    } catch {
      const errorMessage = translate("recover.error", {job: job.name});
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

  /** ジョブキャンセル */
  const handleCancel = async () => {
    const result = await dialogs.confirm(translate("cancel.content", {job: job.name}), {
      title: translate("dialog.title"),
      okText: translate("cancel.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.active", {
        domain: { id: job.id },
        func: "cancel"
      })
      await onRefresh()
      notifications.show(translate("cancel.success", {job: job.name}), {
        severity: 'success',
        autoHideDuration: 3000,
      })
    } catch {
      const errorMessage = translate("cancel.error", {job: job.name});
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
    <Paper sx={{ bgcolor: makeBGColor(job) }} style={style} elevation={3}>
      <Stack spacing={1} sx={{ p: 2, height: '100%', boxSizing: 'border-box' }}>
        <Stack sx={{ alignItems: "center" }}>
          <Typography>{translate("jobName")}: {job.name}</Typography>
          <Typography>{translate("startDate")}: {formatJaKanjiMdHms(job.created_at)}</Typography>
          {
            job.error_msg.length ? <Typography>{translate("errorName")}: {job.error_msg.join(', ')}</Typography> :
            job.warning_msg.length ? <Typography>{translate("warningName")}: {job.warning_msg.join(', ')}</Typography> :
            undefined
          }
          {!job.error_msg.length ? (
            <Button
              variant="contained"
              color="error"
              onClick={handleStop}
            >
              {translate("stop.label")}
            </Button>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleRecover}
                disabled={!currentTask?.can_recover}
              >
                {translate("recover.label")}
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleCancel}
              >
                {translate("cancel.label")}
              </Button>
            </Stack>
          )}
        </Stack>
        <Divider />
        <Stack
          ref={taskContainerRef}
          sx={{ overflowY: 'auto', alignItems: "stretch", flex: 1 }}>
          <TaskCommand
            job={job}
            task={job.task}
            command={job.command}
            onRefresh={onRefresh}
            currentTaskId={currentTask?.id}
          />
        </Stack>
      </Stack>
    </Paper>
  );
}
