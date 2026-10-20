# Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
# SPDX-License-Identifier: Apache-2.0

import asyncio
import sys

from src import abstract, freedom, job
from src.repository import repository
from src.job.active import NodeDomain


class Node(abstract.Node):
    def __init__(self, config:dict):
        """ジョブ実行ノード
        Args:
            config (dict): 設定
        """
        self.domain = NodeDomain(**config)
        self._logger = repository.retrieve(freedom.log.Node)[0].make_logger(
            __package__,
            f"[{self.domain.created_at}-{self.domain.name}]"
        )
        self._task_logic:job.task.abstract.statement.Logic = None
        self._task = asyncio.create_task(self._loop())
        self._logger.info(f"launch: {self.domain}")

    async def _loop(self):
        """処理ループ
        Returns:
            typing.Any: タスク実行結果
        """
        task:asyncio.Task = None
        prev_warning_msg = set(self.domain.warning_msg)
        try:
            self._task_logic = await self.domain.task.make_logic(self.domain.id, self._logger)
        except Exception as e:
            self._logger.error(f"Failed to init: {type(e)} - {e}")
            self.domain.error_msg.add(str(e))
        try:
            while sys.getrefcount(self) > 2:
                await asyncio.sleep(0)
                if self.domain.warning_msg and self.domain.warning_msg != prev_warning_msg:
                    self._logger.warning(f"job warning: {self.domain.warning_msg}")
                prev_warning_msg = set(self.domain.warning_msg)
                # タスク異常判定
                if task and task.done() and not task.cancelled() and task.exception():
                    exception = task.exception()
                    if isinstance(exception, job.task.job.active.exception.Result):
                        return exception.args[0]
                    self.domain.error_msg.add(str(task.exception()))
                    self._logger.error(f"task error: {type(task.exception())} - {task.exception()}")
                if self.domain.error_msg:
                    if task:
                        if not task.done() and not task.cancelling():
                            task.cancel()
                        t = self._task_logic.retrieve_task()
                        self._logger.error(f"job error: task={t.domain.name if t else None}, msg={self.domain.error_msg}")
                    task = None
                    continue
                # タスク終了判定
                if task:
                    if not task.done():
                        continue
                    elif not task.cancelled():
                        break
                task = asyncio.create_task(self.domain.command.exec(self._task_logic, self._logger))
        finally:
            task and task.cancel()
            self._task_logic = None
            repository.retrieve(job.active.Repository)[0].remove(self)
            self._logger.info("finish")

    def stop(self):
        """ジョブ停止"""
        self.domain.error_msg.add("ジョブ停止操作")

    async def recover(self, id:str):
        """ジョブ復帰
        Args:
            id (str): タスクID
        """
        if not self.domain.error_msg:
            raise Exception(f"{self.domain.id}-{self.domain.name} has already recover")
        self.domain.command.recover(self.domain.task, id)
        task = self._task_logic.retrieve_task()
        self._logger.info(f"recover task={task.domain.name if task else None}")
        self.domain.warning_msg.clear()
        error_msg = set()
        try:
            self._task_logic = await self.domain.task.make_logic(self.domain.id, self._logger)
        except Exception as e:
            self._logger.error(f"_reset_task_list: {type(e)} - {e}")
            error_msg.add(str(e))
        self.domain.error_msg = error_msg

    def cancel(self):
        """ジョブキャンセル"""
        self._task.cancel()
        self._logger.info("cancel")

    async def exec_command(self, command, id:str|None=None):
        """コマンド実行
        Args:
            command (Any): コマンド内容
            id (str): タスクID
                Noneで実行中タスクに実行
        Returns:
            Any: 実行結果
        """
        task = self._task_logic.retrieve_task(id)
        if task is None:
            raise Exception(f"Failed to exec_command: {id=} does not exist")
        ret = await task.exec_command(command)
        self._logger.info(f"exec_command: {command=} {id=}")
        return ret

    def retrieve_variables(self, **kwargs):
        """変数ブロック探索
        Args:
            id (str): ブロックID
            name (str): 名前
            type (str): 型
            value (typing.Any): 内容
        Returns:
            Generator[Variable, Any, None]: 一致する変数ブロック
        """
        for var in self.domain.variables:
            if all(v==getattr(var,k,None) for k,v in kwargs.items()):
                yield var

    async def accept_infrastructure(self, task:job.task.abstract.statement.Logic|None=None) -> bool|None:
        """インフラ連携結果取得
        Args:
            task (job.task.abstract.statement.Logic|None): タスク 再帰呼び出し用
        Returns:
            bool|None: インフラ連携結果
        """
        if self._task_logic is None or self.domain.error_msg:
            return False
        if task is None:
            task = self._task_logic
        if task.domain.finished:
            if task.next is None:
                return None
            return await self.accept_infrastructure(task.next)
        result = None
        if isinstance(task, job.task.infrastructure.accept.Logic):
            ret = await task.exec_command("accept_infrastructure")
            if ret is False:
                return False
            result = result or ret
        for cmd in task.domain.command:
            if not isinstance(cmd, job.command.Task):
                continue
            for logic in vars(task).values():
                if not isinstance(logic, job.task.abstract.statement.Logic):
                    continue
                if logic.domain.id != cmd.id:
                    continue
                ret = await self.accept_infrastructure(logic)
                if ret is False:
                    return False
                result = result or ret
        return result
