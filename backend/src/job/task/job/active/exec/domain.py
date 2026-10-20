# Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
# SPDX-License-Identifier: Apache-2.0

import dataclasses
import typing

from src.repository import repository
from src.job.task import abstract
from src import job


@dataclasses.dataclass
class Domain(abstract.statement.Domain):
    """controls_job_execタスク
    Args:
        type (str): タスク種類
        id (str): タスクID
        name (str): タスク名
            UIにタスク名として表示される内容
        next (Domain): 次タスク
        should_show (bool): 表示判定
            ジョブ実行時に表示する判定
        can_recover (bool): 復帰可能判定
            ジョブ停止時に復帰できる判定
        finished (bool): 終了フラグ
        command (list): コマンド内容
        job (str): ジョブ名
        kwargs (abstract.value.Domain): 引数
        var (dict[typing.Literal["id"], str]): 戻り値変数名
    """
    can_recover: bool|str = "OK"
    name: str = "ジョブ実行"
    job: str = "none"
    kwargs: abstract.value.Domain = dataclasses.field(default_factory=abstract.value.Domain)
    var: dict[typing.Literal["id"], str] = dataclasses.field(default_factory=dict)

    def __post_init__(self):
        """インスタンス後処理"""
        super().__post_init__()
        self.can_recover = self.can_recover if type(self.can_recover) is bool else self.can_recover == "OK"

    @classmethod
    async def define_block(cls) -> list[dict]:
        """ブロック定義
        自作ブロックの形状を定義する
        https://developers.google.com/blockly/guides/create-custom-blocks/define/block-definitions?hl=ja
        Returns:
            list[dict]: ブロック定義
        """
        option = [[name, name] for name in await repository.retrieve(job.create.Node)[0].fetch_name_list(is_admin=True)]
        return [{
            "type": "job.active.exec",
            "tooltip": "任意のジョブを実行する",
            "helpUrl": "",
            "message0": "%1 %2 タスク表示 %3",
            "args0": [
                {
                    "type": "field_input",
                    "name": "name",
                    "text": cls.name
                },
                {"type": "input_dummy"},
                {
                    "type": "field_checkbox",
                    "name": "should_show",
                    "checked": cls.should_show
                },
            ],
            "message1": "%1 を実行する %2 ここから復帰 %3 %4 引数 (変数名：値) %5 戻り値を %6 にセット",
            "args1": [
                {
                    "type": "field_dropdown",
                    "name": "job",
                    "options": option if option else [["設定なし", "設定なし"]]
                },
                {"type": "input_dummy", "align": "RIGHT"},
                {
                    "type": "field_dropdown",
                    "name": "can_recover",
                    "options": [
                        ["できる", "OK"],
                        ["できない", "NG"]
                    ]
                },
                {"type": "input_dummy", "align": "RIGHT"},
                {
                    "type": "input_value",
                    "name": "kwargs",
                    "align": "RIGHT",
                    "check": "Dict"
                },
                {
                    "type": "field_variable",
                    "name": "var",
                    "variable": "result"
                }
            ],
            "previousStatement": None,
            "nextStatement": None,
            "colour": 360
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
            "type": "job.active.exec",
            "inputs": {
                "kwargs": {
                    "shadow": {
                        "type": "_dict_get",
                    }
                }
            }
        }]
