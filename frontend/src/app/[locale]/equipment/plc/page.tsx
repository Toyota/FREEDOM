/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useNotifications } from "@toolpad/core/useNotifications";
import { PageContainer } from "@toolpad/core/PageContainer";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Grid,
  Paper,
  Typography,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";
import axios from "@/lib/axios";
import DetailCard from "@/components/node/DetailCard";
import InfoCard from "@/components/node/InfoCard";
import StatusChip from "@/components/map/StatusChip";
import type { NodeStatus } from "@/types/node";
import type { NodeMarkerItem } from "@/types/map";
import PlcAddressTable, { type PlcAddressRow } from "./AddressStatusTable";
import { useSessionInfo } from "@/providers/SessionContext";

const NodeMarkers = dynamic(() => import("@/components/map/NodeMarkers"), {
  ssr: false,
});

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
});

type AddressesByNode = Record<string, PlcAddressRow[]>;

type PlcAddressResponse = {
  name?: string;
  interface?: string;
  bit_addresses?: Array<{
    name: string;
    address: string;
    bit: number;
    data: boolean | null;
    default: boolean | null;
    enable?: boolean;
  }>;
  word_addresses?: Array<{
    name: string;
    address: string;
    data: number | null;
    enable?: boolean;
  }>;
};

export default function PlcDetailPage() {
  const translate = useTranslations("Node.equipment.plc");
  const translateError = useTranslations("Error");
  const notifications = useNotifications();
  const session = useSessionInfo();

  const [items, setItems] = useState<NodeStatus[]>([]);
  const [addressesByNode, setAddressesByNode] = useState<AddressesByNode>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [centerOnSelect, setCenterOnSelect] = useState<boolean>(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.post("/node/freedom.map", {
        func: "fetch_status",
        kwargs: {
          node_name: "equipment.plc",
        },
      });

      const list: NodeStatus[] = Array.isArray(res.data) ? res.data : [];
      setItems(list);
      return list;
    } catch (e) {
      console.error(e);
      setItems([]);
      return [];
    }
  }, []);

  const normalizePlcAddressRows = (
    rawData: unknown,
    nodeName: string,
  ): PlcAddressRow[] => {
    let source: PlcAddressResponse | undefined;

    if (Array.isArray(rawData)) {
      source =
        rawData.find((item) => item?.name === nodeName) ??
        rawData[0];
    } else if (rawData && typeof rawData === "object") {
      source = rawData as PlcAddressResponse;
    }

    if (!source) {
      return [];
    }

    const bitRows: PlcAddressRow[] = (source.bit_addresses ?? []).map((row) => ({
      id: `bit:${row.name}`,
      type: "bit",
      name: row.name,
      address: row.address,
      bit: row.bit,
      data: row.data,
      default: source.interface === "Dummy" && row.default === null ? false : row.default,
    }));

    const wordRows: PlcAddressRow[] = (source.word_addresses ?? []).map((row) => ({
      id: `word:${row.name}`,
      type: "word",
      name: row.name,
      address: row.address,
      data: row.data,
    }));

    return [...bitRows, ...wordRows];
  };

  const fetchAddresses = useCallback(async (nodeName: string) => {
    try {
      const res = await axios.post("domain/equipment.plc");
      const list = normalizePlcAddressRows(res.data, nodeName);

      setAddressesByNode((prev) => ({
        ...prev,
        [nodeName]: list,
      }));

      return list;
    } catch (e) {
      console.error(e);

      setAddressesByNode((prev) => ({
        ...prev,
        [nodeName]: [],
      }));

      return [];
    }
  }, []);

  const fetchAllAddresses = useCallback(
    async (targetItems: NodeStatus[]) => {
      await Promise.all(targetItems.map((item) => fetchAddresses(item.name)));
    },
    [fetchAddresses],
  );

  const writeAddress = useCallback(
    async (nodeName: string, addressName: string, data: boolean | number) => {
      try {
        const res = await axios.post("/node/equipment.plc", {
          domain: {
            name: nodeName,
          },
          func: "write",
          kwargs: {
            name: addressName,
            data,
          },
        });
        notifications.show(
          translate("dialog.success", {
            node: nodeName ?? "",
            command:
              typeof data === "boolean"
                ? data
                  ? translate("button.on")
                  : translate("button.off")
                : translate("button.writeWord", {value: data}),
          }),
          { severity: "success", autoHideDuration: 3000 },
        );
        return res.data;
      } catch (error) {
        const errorMessage = translate("dialog.error", {
          node: nodeName ?? "",
          command:
            typeof data === "boolean"
              ? data
                ? translate("button.on")
                : translate("button.off")
              : translate("button.writeWord", {value: data}),
        });
        notifications.show(
          session?.authenticated === false
            ? `${errorMessage} / ${translateError("statusCode.401")}`
            : errorMessage,
          { severity: "error", autoHideDuration: 3000 },
        );
      }
    },
    [],
  );

  const handleWriteAddress = useCallback(
    async (nodeName: string, row: PlcAddressRow, data: boolean | number) => {
      const sendingKey = `${nodeName}:${row.id}`;

      setSending((prev) => ({
        ...prev,
        [sendingKey]: true,
      }));

      try {
        await writeAddress(nodeName, row.name, data);
        await fetchAddresses(nodeName);
      } catch (e) {
        console.error(e);
      } finally {
        setSending((prev) => ({
          ...prev,
          [sendingKey]: false,
        }));
      }
    },
    [writeAddress, fetchAddresses],
  );

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const list = await fetchData();

      if (!alive) return;

      await fetchAllAddresses(list);
    };

    tick();

    const id = setInterval(() => {
      tick();
    }, 1000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [fetchData, fetchAllAddresses]);

  const handleToggleOpen = useCallback((name: string) => {
    setOpenRows((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  }, []);

  const handleSelectName = useCallback((name: string | null) => {
    setSelectedName(name);

    if (name) {
      setOpenRows((prev) => ({
        ...prev,
        [name]: true,
      }));
    }
  }, []);

  useEffect(() => {
    if (selectedName && !openRows[selectedName]) {
      setSelectedName(null);
    }
  }, [openRows, selectedName]);

  const handleMarkerClick = useCallback(
    (name: string) => {
      setCenterOnSelect(false);
      handleSelectName(name);
    },
    [handleSelectName],
  );

  const nodes: NodeMarkerItem[] = useMemo(
    () =>
      items.map((s) => ({
        id: s.name,
        name: s.name,
        location: (s.location ?? [0, 0]) as [number, number],
        state: typeof s.state === "number" ? s.state : 0,
        domain: s.domain ?? s.node ?? "equipment.plc",
        info: s.info,
      })),
    [items],
  );

  const nodeVisibility = useMemo(() => {
    const vis: Record<string, boolean> = {};

    items.forEach((s) => {
      vis[s.name] = true;
    });

    return vis;
  }, [items]);

  const handleToggleRow = useCallback(
    (name: string) => {
      const willOpen = !openRows[name];

      handleToggleOpen(name);

      if (willOpen) {
        handleSelectName(name);
      }
    },
    [openRows, handleToggleOpen, handleSelectName],
  );

  const TOP_OFFSET_PX = 120;

  return (
    <PageContainer title={translate("name")}>
      <Grid container spacing={2} sx={{ width: "100%", height: { xs: "auto", md: `calc(100vh - ${TOP_OFFSET_PX}px)`}}}>
        <Grid size={{ xs: 12, md: 8 }} sx={{ display: "flex", flexDirection: "column", height: { xs: "auto", md: "100%" }}}
        >
          <Paper sx={{ height: { xs: "auto", md: "100%" }, overflow: { xs: "visible", md: "auto" }}}>
            <Box>
              {items.map((row) => {
                const open = !!openRows[row.name];
                const detailsId = `equipment-plc-${row.name}`;
                const addressRows = addressesByNode[row.name] ?? [];

                return (
                  <Accordion
                    key={row.name}
                    expanded={open}
                    onChange={() => handleToggleRow(row.name)}
                    disableGutters
                    square
                    slotProps={{
                      transition: {
                        unmountOnExit: true,
                      },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMore />}
                      aria-controls={detailsId}
                      id={`${detailsId}-summary`}
                      sx={{
                        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                        backgroundColor: selectedName === row.name ? "rgba(25, 118, 210, 0.06)" : "inherit",
                        "&:hover": {
                          backgroundColor: selectedName === row.name ? "rgba(25, 118, 210, 0.10)" : "action.hover",
                        },
                      }}
                    >
                      <Typography component="span" sx={{ width: "70%", flexShrink: 0, fontWeight: "bold"}}>
                        {row.name}
                      </Typography>
                      <Typography component="span">
                        <StatusChip
                          label={translate(`state.${String(row.state)}`)}
                          status={typeof row.state === "number" ? row.state : 0}
                          size="small"
                        />
                      </Typography>
                    </AccordionSummary>

                    <AccordionDetails id={detailsId}>
                      <Box sx={{ m: 1 }}>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <InfoCard info={row.info} />
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <DetailCard detail={row.detail} />
                          </Grid>
                        </Grid>
                      </Box>

                      <PlcAddressTable
                        nodeName={row.name}
                        rows={addressRows}
                        sending={sending}
                        onWrite={(targetRow, data) =>
                          handleWriteAddress(row.name, targetRow, data)
                        }
                      />
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", flexDirection: "column", height: { xs: "auto", md: "100%" }}}>
          <Paper
            sx={{ height: { md: "100%"}, display: "flex", flexDirection: "column", minHeight: 280 }}
            elevation={3}
          >
            <Box sx={{ position: { xs: "relative", md: "sticky" }, top: { md: TOP_OFFSET_PX }, height: { xs: 360, md: "100%" }, width: "100%", minHeight: 300 }}>
              <MapView style={{ width: "100%", height: "100%" }}>
                <NodeMarkers
                  nodes={nodes}
                  nodeVisibility={nodeVisibility}
                  selectedName={selectedName}
                  onMarkerClick={handleMarkerClick}
                  centerOnSelect={centerOnSelect}
                />
              </MapView>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}