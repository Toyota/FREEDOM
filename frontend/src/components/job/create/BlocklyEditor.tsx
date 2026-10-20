/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Box } from '@mui/material';
import * as Blockly from "blockly/core";
import "blockly/blocks";
import "blockly/javascript";
import {loops} from 'blockly/blocks';
import { extensions } from "./extension";


/**
 * ローカライズ テーブルの紐づけ
 */
const localeLoaders: Record<string, () => Promise<{ default: any }>> = {
  en: () => import('blockly/msg/en'),
  ja: () => import('blockly/msg/ja'),
};

/** Blockly表示コンポーネント引数 */
interface BlocklyEditorProps {
  /** ブロック定義リスト */
  blockList: any[];
  /** ツールボックス定義 */
  toolbox: Blockly.utils.toolbox.ToolboxInfo;
  /** ジョブ内容 */
  workspace?: {[key:string]: any};
  /** 現在のジョブ内容更新関数 */
  setCurrentWorkspace: React.Dispatch<React.SetStateAction<{[key:string]: any}>>;
}


/** Blockly表示コンポーネント */
export default function BlocklyEditor ({
  blockList,
  toolbox,
  workspace,
  setCurrentWorkspace,
}: BlocklyEditorProps ) {
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg>(null);
  const translate = useTranslations("Node");
  const locale = useLocale();

  /** 先頭ツリー以外を無効化 */
  const enforceOnlyFirstTree = () => {
    if (!workspaceRef.current) return;
    if (!workspaceRef.current.getAllBlocks().length) return;

    const json = Blockly.serialization.workspaces.save(workspaceRef.current);
    const validTreeRootId = (json as any)?.blocks?.blocks?.[0]?.id ?? null;
    const rootBlocks = workspaceRef.current.getTopBlocks(false);

    rootBlocks.forEach((rBlock) => {
      const descendants = rBlock.getDescendants(false);
      if (rBlock.id === validTreeRootId) {
        descendants.forEach((block) => {
          block.setDisabledReason(false, "");
        });
      } else {
        descendants.forEach((block) => {
          block.setDisabledReason(true, "");
        });
      }
    });
  };

  /** ツールボックス整形 */
  const adjustToolbox = (toolbox: Blockly.utils.toolbox.ToolboxInfo) => {
    if (toolbox.kind === "category") {
      const category:Blockly.utils.toolbox.StaticCategoryInfo = toolbox as any
      const style: Record<string, string> = {
        'common.list': 'list_category',
        'common.logic': 'logic_category',
        'common.loop': 'loop_category',
        'common.math': 'math_category',
        'common.text': 'text_category',
      }
      if (category.name in style) {
        category.categorystyle = style[category.name]
        category.colour = undefined
      }
      category.name =
        translate.has(`${category.name}.name`) ? translate(`${category.name}.name`) :
        translate.has(`job.create.${category.name}`) ? translate(`job.create.${category.name}`) :
        category.name
    }
    else if (toolbox.kind === "button") {
      const button = toolbox as any
      if (button.callbackKey.includes("createVariable")) {
        const variable = button.callbackKey.split('_')[1]
        workspaceRef.current?.registerButtonCallback(button.callbackKey, (b: Blockly.FlyoutButton) =>{
          Blockly.Variables.createVariableButtonHandler(b.getTargetWorkspace(), undefined, variable);
        })
      }
    }
    if (toolbox.contents && toolbox.contents.length) {
      toolbox.contents.map((content) => adjustToolbox(content as any))
    }
  }

  /** 初期化処理 */
  useEffect(() => {
    /** 内容変更イベント */
    const onChange = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return;
      enforceOnlyFirstTree();
      setCurrentWorkspace(Blockly.serialization.workspaces.save(workspaceRef.current!));
    };

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspaceRef.current!);
    });

    const init = async() => {
      if (!blocklyDivRef.current || workspaceRef.current) return;

      Blockly.setLocale(await localeLoaders[locale]() ?? import('blockly/msg/ja'))
      // controls_flow_statements_customタスク(break, continue)の有効化範囲にカスタムループタスクを追加
      loops.loopTypes.add('controls_for_custom')
      loops.loopTypes.add('controls_forEach_custom')
      loops.loopTypes.add('controls_forEach_dict')
      loops.loopTypes.add('controls_repeat_ext_custom')
      loops.loopTypes.add('controls_whileUntil_custom')
      loops.loopTypes.add('controls_whileUntil_manual')
      workspaceRef.current = Blockly.inject(blocklyDivRef.current, {
        toolbox: toolbox,
        trashcan: true,
        zoom: { controls: true },
        move: { wheel: true }
      });
      adjustToolbox(toolbox)
      setCurrentWorkspace(Blockly.serialization.workspaces.save(workspaceRef.current));
      enforceOnlyFirstTree();
      workspaceRef.current.addChangeListener(onChange);
      resizeObserver.observe(blocklyDivRef.current);
    }

    init()

    return () => {
      resizeObserver.disconnect();
      if (workspaceRef.current) {
        workspaceRef.current.removeChangeListener(onChange);
        workspaceRef.current.dispose();
      }
    };
  }, []);

  /** ブロック定義更新 */
  useEffect(() => {
    blockList.filter(
      (block) => delete Blockly.Blocks[block.type]
    );
    Blockly.defineBlocksWithJsonArray(blockList);
  }, [blockList])

  /** ツールボックス定義更新 */
  useEffect(() => {
    adjustToolbox(toolbox)
  }, [toolbox])

  /** ジョブ読込 */
  useEffect(() => {
    if (workspace && workspaceRef.current) {
      Blockly.serialization.workspaces.load(workspace, workspaceRef.current);
    }
  }, [workspace])

  return (
    <Box ref={blocklyDivRef} sx={{ position: 'absolute', inset: 0, }}>
      {extensions.map((Extension, index) => ( <Extension key={index} />))}
    </Box>
  );
};
