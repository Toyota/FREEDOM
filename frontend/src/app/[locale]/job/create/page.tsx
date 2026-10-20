/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Autocomplete,
  Box,
  Button,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { Download, Delete, Save } from "@mui/icons-material";
import { PageContainer } from "@toolpad/core/PageContainer";
import axios from "@/lib/axios";
import BlocklyEditor from "@/components/job/create/BlocklyEditor";
import { useDialogs } from '@toolpad/core/useDialogs';
import { useNotifications } from '@toolpad/core/useNotifications';
import * as Blockly from "blockly/core";


/** ブロック定義受信内容 */
export interface BlockResponse {
  type: string;
  colour: number;
  category: string;
  [key: string]: any;
};


/** ジョブ作成ページ */
export default function JobCreatePage() {
  const [blockList, setBlockList] = useState<any[]>();
  const [toolbox, setToolbox] = useState<Blockly.utils.toolbox.ToolboxInfo>();
  const [jobNameList, setJobNameList] = useState<string[]>();
  const [jobName, setJobName] = useState<string>("");
  const [savedJobName, setSavedJobName] = useState<string>("");
  const [workspace, setWorkspace] = useState<{[key:string]: any}>();
  const [currentWorkspace, setCurrentWorkspace] = useState<{[key:string]: any}>();
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const translate = useTranslations("Node.job.create");

  /** Block定義とジョブ名リストを取得 */
  const loadList = async () => Promise.all([
    axios.post<[any[], Blockly.utils.toolbox.ToolboxInfo]>("/node/job.create", { func: "fetch_define" })
      .then((res) => {
        setBlockList(res.data[0] ?? {})
        setToolbox(res.data[1] ?? {})
      }),
    (async () => {
      const r = await fetch("/api/job-names", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setJobNameList(d?.items ?? []);
    })()
  ])

  /** 初期処理 */
  useEffect(() => {
    const run = () => {
      loadList().catch(() => {
        setTimeout(() => {
          run();
        }, 5000)
      })
    }
    run();
  }, []);

  /** ジョブ内容取得 */
  const handleFetch = () => {
    if (!jobNameList?.includes(jobName)) return;
    axios
      .post<{[key:string]: any}>("/node/job.create", {
        func: "fetch_workspace",
        kwargs: { name: jobName }
      })
      .then((res) => {
        setWorkspace(res.data ?? {});
        setSavedJobName(jobName);
      })
      .catch(() => {});
  };

  /** ジョブ保存 */
  const handleUpdate = async () => {
    if (!jobName) return;
    const result = await dialogs.confirm(translate("save.content", {job: jobName}), {
      title: translate("dialog.title"),
      okText: translate("save.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.create", {
        func: "update",
        kwargs: { name: jobName, workspace: currentWorkspace }
      })
      await loadList()
      setWorkspace(currentWorkspace)
      setSavedJobName(jobName)
      notifications.show(translate("save.success", {job: jobName}), {
        severity: 'success',
        autoHideDuration: 3000,
      })
    } catch {
      notifications.show(translate("save.error", {job: jobName}), {
        severity: 'error',
        autoHideDuration: 3000,
      })
    }
  };

  /** ジョブ削除 */
  const handleDelete = async () => {
    if (!jobNameList?.includes(jobName)) return;
    const result = await dialogs.confirm(translate("delete.content", {job: jobName}), {
      title: translate("dialog.title"),
      okText: translate("delete.ok"),
      cancelText: translate("dialog.cancel"),
    })
    if (!result) return;
    try {
      await axios.post("/node/job.create", {
        func: "delete",
        kwargs: { name: jobName }
      })
      await loadList()
      notifications.show(translate("delete.success", {job: jobName}), {
        severity: 'success',
        autoHideDuration: 3000,
      })
    } catch {
      notifications.show(translate("delete.error", {job: jobName}), {
        severity: 'error',
        autoHideDuration: 3000,
      })
    }
  };

  return (
    <PageContainer
      title={translate("name")}
      maxWidth={false}
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {(!blockList || !toolbox || !jobNameList) ? (
        <Typography>Loading...</Typography>
       ) : (
        <Stack
          spacing={2}
          sx={{
            flex: 1,
            minHeight: 0,
          }}
        >
          <Stack direction={{xs: "column", sm: "row"}} spacing={2} sx={{ flexShrink: 0, }}>
            {/* ジョブ名選択 */}
            <Autocomplete
              freeSolo
              inputValue={jobName}
              onInputChange={(event, value) => {
                setJobName(value);
              }}
              options={jobNameList ?? []}
              sx={{ width: '100%' }}
              renderInput={(params) => <TextField {...params} label={translate("jobName")}/>}
            />

            {/* ジョブ読込ボタン */}
            <Button
              variant="text"
              onClick={handleFetch}
              disabled={!jobNameList?.includes(jobName)}
              startIcon={<Download />}
              sx={{minWidth: {xs: '100%', sm: 'fit-content'}}}
            >
              {translate("load")}
            </Button>

            {/* ジョブ削除ボタン */}
            <Button
              color="error"
              variant="outlined"
              onClick={handleDelete}
              disabled={!jobNameList?.includes(jobName)}
              startIcon={<Delete />}
              sx={{minWidth: {xs: '100%', sm: 'fit-content'}}}
            >
              {translate("delete.button")}
            </Button>

            {/* ジョブ保存ボタン */}
            <Button
              variant="contained"
              onClick={handleUpdate}
              disabled={!jobName || jobName === savedJobName && JSON.stringify(currentWorkspace) === JSON.stringify(workspace)}
              startIcon={<Save />}
              sx={{minWidth: {xs: '100%', sm: 'fit-content'}}}
            >
              {translate("save.button")}
            </Button>
          </Stack>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <BlocklyEditor
              blockList={blockList}
              toolbox={toolbox}
              workspace={workspace}
              setCurrentWorkspace={setCurrentWorkspace}
            />
          </Box>
        </Stack>
      )}
    </PageContainer>
  );
}
