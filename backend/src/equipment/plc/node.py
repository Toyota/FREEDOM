# Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
# SPDX-License-Identifier: Apache-2.0

import asyncio

from src import abstract, freedom, job, util
from src.repository import repository
from src.equipment.plc import NodeDomain, BitAddress, WordAddress, HeartbeatAddress, Interface, access


class Node(abstract.Node):
    """PLC ノード
    Attributes:
        domain (NodeDomain): ドメイン
        _state (util.status.State): 状態
        _address_map (dict[str, set[str]]): アドレスとジョブIDのマッピング
        _logger (freedom.log.Logger): ロガー
        _access (Interface): インターフェース
        _task (asyncio.Task): 定期処理タスク
        _heartbeat_task (list[asyncio.Task]): ハートビート処理タスク
    """
    def __init__(self, domain:NodeDomain):
        """インスタンス化
        Args:
            domain (NodeDomain): ドメイン
        """
        self.domain = domain
        self._state = util.status.State.WAITING
        self._address_map:dict[str, set[str]] = {address.name: set() for address in self.domain.bit_addresses if address.default is not None}
        self._logger = repository.retrieve(freedom.log.Node)[0].make_logger(__package__, f"[{self.domain.name}]")
        self._access:Interface = getattr(access, self.domain.interface)(self.domain)
        self._task = asyncio.create_task(self._loop())
        self._heartbeat_task = [asyncio.create_task(self._heartbeat_loop(address)) for address in self.domain.heartbeat_addresses]
        self._logger.info(f"launch: {self.domain=}")

    def close(self):
        """切断"""
        self._task.cancel()

    def fetch_status(self) -> util.status.Status:
        """状態取得
        Returns:
            util.status.Status: 状態
        """
        if self._state == util.status.State.DISCONNECT:
            state = util.status.State.ERROR
            info = ["通信異常"]
        else:
            state = self._state
            info = []
        return util.status.Status(
            name=self.domain.name,
            state=state,
            location=self.domain.location,
            info=info,
        )

    async def read(self, name:str) -> bool|int:
        """読込み
        Args:
            name (str): アドレス名
        Returns:
            bool|int: 読込み結果
        """
        for address in self.domain.bit_addresses + self.domain.word_addresses:
            if address.name == name:
                if isinstance(address, BitAddress):
                    ret = await self._read_bit(address)
                else:
                    ret = await self._read_word(address)
                if address.data != ret:
                    self._logger.info(f"read: {name=} data={ret}")
                    address.data = ret
                return ret
        else:
            raise ValueError(f"Address not found: {name=}")

    async def write(self, name:str, data:bool|int, job_id:str|None=None):
        """書込み
        Args:
            name (str): アドレス名
            data (bool|int): 書込み内容
            job_id (str|None): ジョブID
        """
        for address in self.domain.bit_addresses + self.domain.word_addresses:
            if address.name == name:
                if isinstance(address, BitAddress):
                    if type(self._access) is not access.Dummy and address.default is None:
                        raise RuntimeError(f"BitAddress {name=} is read-only")
                    elif job_id is None and address.default == data:
                        self._address_map[address.name].clear()
                    elif job_id and address.default is not None:
                        job_ids = self._address_map[address.name]
                        if address.default == data:
                            job_ids.discard(job_id)
                            if job_ids:
                                return
                        else:
                            job_ids.add(job_id)
                    await self._write_bit(address, data)
                else:
                    await self._write_word(address, data)
                address.data = data
                self._logger.info(f"write: {name=} {data=} {job_id=}")
                return
        else:
            raise ValueError(f"Address not found: {name=}")

    async def _loop(self):
        """定期処理"""
        try:
            while True:
                await asyncio.gather(
                    self._update(),
                    asyncio.sleep(self.domain.update_cycle)
                )
        finally:
            for task in self._heartbeat_task:
                task.cancel()
            await self._access.close()
            self._logger.info("end")

    async def _update(self):
        """状態更新"""
        try:
            for bit_address in self.domain.bit_addresses:
                data = await self._read_bit(bit_address)
                if bit_address.data != data:
                    self._logger.info(f"update read: {bit_address.name=} {data=}")
                    bit_address.data = data
            for word_address in self.domain.word_addresses:
                data = await self._read_word(word_address)
                if word_address.data != data:
                    self._logger.info(f"update read: {word_address.name=} {data=}")
                    word_address.data = data
            for name, job_ids in self._address_map.items():
                if not job_ids:
                    continue
                for address in self.domain.bit_addresses:
                    if address.default is None:
                        continue
                    if address.name == name:
                        job_ids = {job_id for job_id in job_ids if repository.retrieve(job.active.Node, id=job_id)}
                        self._address_map[name] = job_ids
                        if not job_ids:
                            await self._write_bit(address, address.default)
                            address.data = address.default
                            self._logger.info(f"update write: {address.name=} {address.data=}")
                        elif address.data == address.default:
                            await self._write_bit(address, not address.default)
                            address.data = not address.default
                            self._logger.info(f"update write: {address.name=} {address.data=}")
            is_waiting = all(address.data == address.default for address in self.domain.bit_addresses if address.default is not None)
            self._state = util.status.State.WAITING if is_waiting else util.status.State.ACTIVE
        except Exception as e:
            if self._state != util.status.State.DISCONNECT:
                self._logger.error(f"Failed to update: {type(e)} - {e}")
            self._state = util.status.State.DISCONNECT

    async def _heartbeat_loop(self, address:HeartbeatAddress):
        """ハートビート処理"""
        while True:
            try:
                data = await self._read_bit(address)
                await self._write_bit(address, not data)
            except Exception as e:
                if self._state != util.status.State.DISCONNECT:
                    self._logger.error(f"Failed to update: {type(e)} - {e}")
                self._state = util.status.State.DISCONNECT
            await asyncio.sleep(address.interval)

    async def _read_bit(self, address:BitAddress) -> bool:
        """ビットアドレス読込み
        Args:
            address (BitAddress): アドレス
        Returns:
            bool: 読込み値
        """
        for cnt in range(self.domain.retry_count):
            try:
                return await self._access.read_bit(address.address, address.bit)
            except Exception as e:
                if self._state != util.status.State.DISCONNECT:
                    self._logger.warning(f"Attempt {cnt+1} failed to read bit: {type(e)} - {e}, name={address.name}")
        return await self._access.read_bit(address.address, address.bit)

    async def _write_bit(self, address:BitAddress, data:bool):
        """ビットアドレス書込み
        Args:
            address (BitAddress): アドレス
            data (bool): 書込み値
        """
        for cnt in range(self.domain.retry_count):
            try:
                await self._access.write_bit(address.address, address.bit, data)
                return
            except Exception as e:
                if self._state != util.status.State.DISCONNECT:
                    self._logger.warning(f"Attempt {cnt+1} failed to write bit: {type(e)} - {e}, name={address.name} {data=}")
        await self._access.write_bit(address.address, address.bit, data)

    async def _read_word(self, address:WordAddress) -> int:
        """ワードアドレス読込み
        Args:
            address (WordAddress): アドレス
        Returns:
            int: 読込み値
        """
        for cnt in range(self.domain.retry_count):
            try:
                return await self._access.read_word(address.address)
            except Exception as e:
                if self._state != util.status.State.DISCONNECT:
                    self._logger.warning(f"Attempt {cnt+1} failed to read word: {type(e)} - {e}, name={address.name}")
        return await self._access.read_word(address.address)

    async def _write_word(self, address:WordAddress, data:int):
        """ワードアドレス書込み
        Args:
            address (WordAddress): アドレス
            data (int): 書込み値
        """
        for cnt in range(self.domain.retry_count):
            try:
                await self._access.write_word(address.address, data)
                return
            except Exception as e:
                if self._state != util.status.State.DISCONNECT:
                    self._logger.warning(f"Attempt {cnt+1} failed to write word: {type(e)} - {e}, name={address.name} {data=}")
        await self._access.write_word(address.address, data)
