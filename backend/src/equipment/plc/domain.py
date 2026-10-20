# Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
# SPDX-License-Identifier: Apache-2.0

import dataclasses
import inspect

from src import abstract, equipment


@dataclasses.dataclass
class Address(abstract.Domain):
    """アドレス設定 基底クラス
    Attributes:
        enable (bool): 有効
        name (str): 名前
        address (str): アドレス
    """
    enable: bool = True
    name:str =""
    address: str = ""

    @classmethod
    def make_form(cls):
        """設定フォーム作成
        Returns:
            dict: 設定フォーム
        """
        return {
            "enable": {
                "type": "switch",
                "label": "有効",
            },
            "name": {
                "type": "text",
                "label": "名前",
            },
            "address": {
                "type": "text",
                "label": "アドレス",
            }
        }


@dataclasses.dataclass
class BitAddress(Address):
    """ビットアドレス設定
    Attributes:
        enable (bool): 有効
        name (str): 名前
        address (str): アドレス
        bit (int): ビット
        default (bool|None): 既定値
        data (bool): データ
    """
    bit: int = 0
    default: bool|None = None

    def __post_init__(self):
        """初期化後処理"""
        self.data = bool(self.default)

    @classmethod
    def make_form(cls):
        """設定フォーム作成
        Returns:
            dict: 設定フォーム
        """
        return super().make_form() | {
            "bit": {
                "type": "number",
                "label": "ビット",
                "integer": True,
                "min": 0,
                "max": 15,
            },
            "default": {
                "type": "select",
                "label": "既定値",
                "items": {"読取り専用": None, "0": False, "1": True},
                "required": False,
            }
        }


@dataclasses.dataclass
class WordAddress(Address):
    """ワードアドレス設定
    Attributes:
        enable (bool): 有効
        name (str): 名前
        address (str): アドレス
        data (int): データ
    """
    def __post_init__(self):
        """初期化後処理"""
        self.data = 0


@dataclasses.dataclass
class HeartbeatAddress(Address):
    """ハートビートアドレス設定
    Attributes:
        enable (bool): 有効
        name (str): 名前
        address (str): アドレス
        bit (int): ビット
        interval (float): 更新周期秒
    """
    bit: int = 0
    interval: float = 1.0

    def __post_init__(self):
        """初期化後処理"""
        self.data = False

    @classmethod
    def make_form(cls):
        """設定フォーム作成
        Returns:
            dict: 設定フォーム
        """
        return super().make_form() | {
            "bit": {
                "type": "number",
                "label": "ビット",
                "integer": True,
                "min": 0,
                "max": 15,
            },
            "interval": {
                "type": "number",
                "label": "更新周期",
                "suffix": "秒",
            },
        }


@dataclasses.dataclass
class NodeDomain(abstract.Domain):
    """PLC ノードドメイン
    Attributes:
        enable (bool): 有効
        name (str): 名前
        location (list[float]): 位置
        interface (str): インターフェース
        ip (str): IPアドレス
        port (int): ポート番号
        timeout (float): 通信タイムアウト
        update_cycle (float): 更新周期
        retry_count (int): リトライ回数
        bit_addresses: (list[BitAddress]): ビットアドレス設定リスト
        word_addresses: (list[WordAddress]): ワードアドレス設定リスト
        heartbeat_addresses: (list[HeartbeatAddress]): ハートビートアドレス設定リスト
    """
    enable: bool = True
    name: str = ""
    location: list[float] = dataclasses.field(default_factory=lambda: [0.0, 0.0])
    interface: str = "Dummy"
    ip: str = "0.0.0.0"
    port: int = 80
    timeout: float = 1.0
    update_cycle: float = 1.0
    retry_count: int = 0
    bit_addresses: list[BitAddress] = dataclasses.field(default_factory=list)
    word_addresses: list[WordAddress] = dataclasses.field(default_factory=list)
    heartbeat_addresses: list[HeartbeatAddress] = dataclasses.field(default_factory=list)

    @classmethod
    def make_form(cls):
        """設定フォーム作成
        Returns:
            dict: 設定フォーム
        """
        return {
            "enable": {
                "type": "switch",
                "label": "有効",
            },
            "name": {
                "type": "text",
                "label": "名前",
            },
            "location": {
                "type": "location",
                "label": "位置",
            },
            "interface": {
                "type": "select",
                "label": "インターフェース",
                "items": {name: name for name, _ in inspect.getmembers(equipment.plc.access, inspect.isclass)},
            },
            "ip": {
                "type": "text",
                "label": "IPアドレス",
            },
            "port": {
                "type": "number",
                "label": "ポート番号",
                "integer": True,
                "min": 0,
                "max": 65535,
            },
            "timeout": {
                "type": "number",
                "label": "通信タイムアウト",
                "suffix": "秒",
                "min": 0,
            },
            "update_cycle": {
                "type": "number",
                "label": "更新周期",
                "suffix": "秒",
                "min": 0,
            },
            "retry_count": {
                "type": "number",
                "label": "リトライ回数",
                "integer": True,
                "min": 0,
            },
            "bit_addresses": {
                "type": "table",
                "label": "ビットアドレス設定",
                "default": dataclasses.asdict(BitAddress()),
                "forms": BitAddress.make_form(),
                "width": 800,
            },
            "word_addresses": {
                "type": "table",
                "label": "ワードアドレス設定",
                "default": dataclasses.asdict(WordAddress()),
                "forms": WordAddress.make_form(),
                "width": 800,
            },
            "heartbeat_addresses": {
                "type": "table",
                "label": "ハートビート設定",
                "default": dataclasses.asdict(HeartbeatAddress()),
                "forms": HeartbeatAddress.make_form(),
                "width": 800,
            },
        }

    def __post_init__(self):
        """初期化後処理"""
        self.bit_addresses = [BitAddress(**address) for address in self.bit_addresses if address.get("enable", False)]
        self.word_addresses = [WordAddress(**address) for address in self.word_addresses if address.get("enable", False)]
        self.heartbeat_addresses = [HeartbeatAddress(**address) for address in self.heartbeat_addresses if address.get("enable", False)]


@dataclasses.dataclass
class Domain(abstract.Domain):
    """PLC ドメイン
    Attributes:
        node_domain (list[NodeDomain]): ノード設定リスト
    """
    node_domain:list[NodeDomain] = dataclasses.field(default_factory=list)

    @classmethod
    def make_form(cls):
        """設定フォーム作成
        Returns:
            dict: 設定フォーム
        """
        return {
            "node_domain": {
                "type": "node",
                "label": "ノード設定",
                "default": dataclasses.asdict(NodeDomain()),
                "forms": NodeDomain.make_form(),
                "unique": ["name"],
                "columns": 1
            }
        }

    def __post_init__(self):
        """初期化後処理"""
        self.node_domain = [NodeDomain(**node_domain) for node_domain in self.node_domain if node_domain.get("enable", False)]
