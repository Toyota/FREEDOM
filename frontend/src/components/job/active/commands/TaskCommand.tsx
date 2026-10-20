/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";
import React from 'react'
import { useTranslations } from "next-intl";
import { Button, Paper, Stack } from '@mui/material';
import axios from '@/lib/axios';
import { blue } from '@mui/material/colors';
import { useDialogs } from '@toolpad/core/useDialogs';
import { useNotifications } from '@toolpad/core/useNotifications';
import { StatementTaskResponse, TaskCommandResponse } from '@/types/job';
import { useSessionInfo } from '@/providers/SessionContext';
import { CommandProps, CommandMap } from "@/components/job/active/commands";


/** ジョブ実行タスクコマンド */
export default function TaskCommand({
  job,
  task,
  command,
  onRefresh,
  finished = true,
  currentTaskId,
}: CommandProps<TaskCommandResponse>) {
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const translate = useTranslations("Node.job.active");
  const translateError = useTranslations("Error");
  const session = useSessionInfo();

  /** タスク復帰 */
  const handleRecover = async (id: string, taskName: string) => {
    const result = await dialogs.confirm(translate("recover.content", {job: job.name, task: taskName}), {
      title: job.name,
      okText: translate("recover.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.active", {
        domain: { id: job.id },
        func: "recover",
        kwargs: {id}
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

  /** タスク表示 */
  const showTaskBox = (task:StatementTaskResponse|null, prevFinished:boolean): React.ReactNode => {
    if (!task) return null;
    const boxBg = task.finished ? 'grey.300'
      : prevFinished ? blue[50]
      : 'background.paper'

    if (!task.should_show) return (
      <React.Fragment key={`${job.id}-${task.id}`}>
        {task.command.filter(v => v.type === 'task').map((v, i) => {
          const CommandComponent = CommandMap[v.type]
          return (
            <CommandComponent
              key={`${job.id}-${task.id}-${i}`}
              job={job}
              task={task}
              command={v}
              onRefresh={onRefresh}
              finished={prevFinished}
              currentTaskId={currentTaskId}
            />
          )
        })}
        {showTaskBox(task.next, task.finished)}
      </React.Fragment>
    )

    return (
      <React.Fragment key={`${job.id}-${task.id}`}>
        <Paper
          data-current={currentTaskId === task.id ? 'true' : undefined}
          data-task-id={task.id}
          variant="outlined"
          sx={{
            width: '100%',
            bgcolor: boxBg,
            p: 0.75,
          }}
        >
          <Stack sx={{ alignItems: "center", mx: { xs: 1, md: 2 }}}>
            <Button
              type="button"
              variant="text"
              size="large"
              disabled={!job.error_msg.length || !task.can_recover}
              sx={{
                minWidth: '100%',
                userSelect: 'text',
                '&.Mui-disabled': {
                  color: job.error_msg.length ? undefined : 'black',
                },
              }}
              onClick={() => handleRecover(task.id, task.name)}
            >
              {task.name}
            </Button>
            {task.command.map((v, i) => {
              const CommandComponent = CommandMap[v.type]
              return (
                <CommandComponent
                  key={`${job.id}-${task.id}-${i}`}
                  job={job}
                  task={task}
                  command={v}
                  onRefresh={onRefresh}
                  finished={prevFinished}
                  currentTaskId={currentTaskId}
                />
              )
            })}
          </Stack>
        </Paper>
        {showTaskBox(task.next, task.finished)}
      </React.Fragment>
    )
  }

  /** 表示タスク探索 */
  const findTask = (id:string) => {
    if (task.id === id) return task;
    for (const key of Object.keys(task)) {
      if (key === "next") continue;
      const t: any = (task as any)[key];
      if (t?.id === id) {
        return t as StatementTaskResponse;
      }
    }
    return null
  }

  return showTaskBox(findTask(command.id), finished)
}
