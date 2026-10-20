# Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
# SPDX-License-Identifier: Apache-2.0

import abc
import typing

from src.job import command
from src.job.task import abstract
if typing.TYPE_CHECKING:
    from src.job.task.abstract.statement import Domain


class Logic[D:Domain](abstract.value.Logic[D], abc.ABC):
    """抽象ステートメントタスク処理
    Args:
        domain (D): 設定
        job_id (int): ジョブID
        logger (logging.Logger): ロガー
    """
    async def init(self):
        """ジョブ開始・復帰時処理"""
        await super().init()
        if self.domain.next:
            self.next = await self.domain.next.make_logic(self._job_id, self._logger)
        else:
            self.next = None

    async def exec_command(self, command:typing.Any) -> typing.Any:
        """コマンド実行
        Args:
            command (typing.Any): コマンド内容
        Returns:
            typing.Any: 実行結果
        """
        self._logger.info(f"Failed to exec_command: name={self.domain.name} {command=}")
        raise Exception(f"Failed to command")

    def retrieve_task(self, id:str|None=None) -> typing.Optional["Logic[Domain]"]:
        """タスク探索
        Args:
            id (str|None): ブロックID
                Noneで実行中タスク取得
        Returns:
            Logic: タスク
        """
        if self.domain.id == id:
            return self
        for cmd in self.domain.command:
            if not isinstance(cmd, command.Task):
                continue
            for logic in vars(self).values():
                if not isinstance(logic, abstract.statement.Logic):
                    continue
                if logic.domain.id != cmd.id:
                    continue
                if ret := logic.retrieve_task(id):
                    return ret
        if id is None and not self.domain.finished:
            return self
        if self.next is None:
            return None
        return self.next.retrieve_task(id)
