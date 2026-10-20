# Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
# SPDX-License-Identifier: Apache-2.0

import dataclasses

from src.job.task import abstract


@dataclasses.dataclass
class Domain(abstract.statement.Domain):
    """controls_whileUntil_manualタスク ドメイン
    Attributes:
        type (str): タスク種類
        id (str): タスクID
        name (str): タスク名
            UIにタスク名として表示される内容
        next (Domain): 次タスク
        can_recover (bool): 復帰可能判定
            ジョブ停止時に復帰できる判定
        finished (bool): 終了フラグ
        command (list): コマンド内容
        should_log (bool): ログ出力判定
        label_on (str): ONでの表示内容
        label_off (str): OFFでの表示内容
        DO (abstract.statement.Domain): タスク内容
        DO_copy (dict): タスク内容のコピー
    """
    name: str = "手動繰り返し"
    should_log: bool = True
    label_on: str = ""
    label_off: str = ""
    DO: abstract.statement.Domain = None
    DO_copy: dict = None

    def __post_init__(self):
        """初期化後処理"""
        super().__post_init__()
        if self.DO and self.DO_copy is None:
            self.DO_copy = dataclasses.asdict(self.DO)

    @classmethod
    def define_block(cls) -> list[dict]:
        """ブロック定義
        カスタムブロックの形状を定義する
        https://developers.google.com/blockly/guides/create-custom-blocks/define/block-definitions?hl=ja
        Returns:
            list[dict]: ブロック定義
        """
        return [{
            'type': 'controls_whileUntil_manual',
            "tooltip": "スイッチがONの間、タスクを繰り返し実行する",
            "helpUrl": "",
            'message0': '%1 %2 ログ出力 %3',
            'args0': [
                {
                    "type": "field_input",
                    "name": "name",
                    "text": cls.name
                },
                {"type": "input_dummy"},
                {
                    "type": "field_checkbox",
                    "name": "should_log",
                    "checked": cls.should_log
                },
            ],
            'message1': 'ON表示 : %1 %2 OFF表示: %3 %4 %{BKY_CONTROLS_REPEAT_INPUT_DO} %5',
            'args1': [
                {
                    "type": "field_input",
                    "name": "label_on",
                    "text": "繰り返す"
                },
                {"type": "input_dummy"},
                {
                    "type": "field_input",
                    "name": "label_off",
                    "text": "この周で終了"
                },
                {"type": "input_dummy"},
                {
                    'type': 'input_statement',
                    'name': 'DO',
                },
            ],
            'previousStatement': None,
            'nextStatement': None,
            'style': 'loop_blocks',
            "inputsInline": False,
        }]

    @classmethod
    def define_toolbox(cls) -> list[dict]:
        """ツールボックス定義
        フィールド値や出力ブロックの初期値を定義する
        https://developers.google.com/blockly/guides/configure/web/toolboxes/category?hl=ja
        Returns:
            list[dict]: ツールボックス定義
        """
        return [{
            "kind": "block",
            "type": "controls_whileUntil_manual",
        }]
