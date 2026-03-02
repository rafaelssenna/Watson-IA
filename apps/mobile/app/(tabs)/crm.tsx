import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";

type IoniconsName = keyof typeof Ionicons.glyphMap;
type ScoreFilter = "all" | "qualified" | "interested" | "new_lead";

interface Lead {
  id: string;
  customerPhone: string;
  customerName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  score: string;
  scoreLabel: { label: string; color: string };
  confidence: number;
  needsClassification: boolean;
}

interface Stats {
  total: number;
  qualified: number;
  interested: number;
  newLead: number;
  conversionRate: string;
}

interface Counts {
  total: number;
  qualified: number;
  interested: number;
  new_lead: number;
}

const SCORE_COLORS: Record<string, string> = {
  qualified: "#22c55e",
  interested: "#eab308",
  new_lead: "#3b82f6",
};

const SCORE_ICONS: Record<string, IoniconsName> = {
  qualified: "checkmark-circle",
  interested: "star",
  new_lead: "person-add",
};

export default function CRMScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const theme = useTheme();
  const { primary } = useAppColors();
  const isDark = theme.background.val === "#020617" || theme.background.val === "#000000" || theme.background.val?.startsWith("#0");

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const loadLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (scoreFilter !== "all") params.set("score", scoreFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await api.get<{
        success: boolean;
        data: Lead[];
        counts: Counts;
        pagination: { totalPages: number };
      }>(`/crm/leads?${params.toString()}`);

      if (response.data.success) {
        setLeads(response.data.data);
        setCounts(response.data.counts);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error loading leads:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, scoreFilter, debouncedSearch]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Stats }>("/crm/stats");
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, []);

  useEffect(() => {
    loadLeads();
    loadStats();
  }, [loadLeads, loadStats]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadLeads();
    loadStats();
  }, [loadLeads, loadStats]);

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Text color="$gray8">Carregando CRM...</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2" gap="$3">
        <Text fontSize="$7" fontWeight="bold" color="$color">
          CRM
        </Text>

        {/* Stats Cards */}
        {stats && (
          <XStack gap="$2" flexWrap="wrap">
            <MiniStat label="Total" value={stats.total} color="$gray8" icon="people-outline" />
            <MiniStat label="Qualificados" value={stats.qualified} color="#22c55e" icon="checkmark-circle-outline" />
            <MiniStat label="Interessados" value={stats.interested} color="#eab308" icon="star-outline" />
            <MiniStat label="Novos" value={stats.newLead} color="#3b82f6" icon="person-add-outline" />
            <MiniStat label="Conversao" value={`${stats.conversionRate}%`} color={primary} icon="trending-up-outline" />
          </XStack>
        )}

        {/* Filter Chips */}
        <XStack gap="$2" flexWrap="wrap">
          <FilterChip
            label="Todos"
            count={counts?.total}
            active={scoreFilter === "all"}
            onPress={() => { setScoreFilter("all"); setPage(1); }}
            primary={primary}
          />
          <FilterChip
            label="Qualificado"
            count={counts?.qualified}
            active={scoreFilter === "qualified"}
            onPress={() => { setScoreFilter("qualified"); setPage(1); }}
            primary={primary}
            dotColor="#22c55e"
          />
          <FilterChip
            label="Interessado"
            count={counts?.interested}
            active={scoreFilter === "interested"}
            onPress={() => { setScoreFilter("interested"); setPage(1); }}
            primary={primary}
            dotColor="#eab308"
          />
          <FilterChip
            label="Novo Lead"
            count={counts?.new_lead}
            active={scoreFilter === "new_lead"}
            onPress={() => { setScoreFilter("new_lead"); setPage(1); }}
            primary={primary}
            dotColor="#3b82f6"
          />
        </XStack>

        {/* Search */}
        <XStack
          backgroundColor={isDark ? "#1e293b" : "#f1f5f9"}
          borderRadius={12}
          paddingHorizontal="$3"
          alignItems="center"
          gap="$2"
        >
          <Ionicons name="search" size={18} color="#94a3b8" />
          <Input
            unstyled
            flex={1}
            placeholder="Buscar por nome ou telefone..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            fontSize={15}
            color="$color"
            paddingVertical={10}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </XStack>
      </YStack>

      {/* Leads List */}
      <FlatList
        data={leads}
        renderItem={({ item }) => (
          <LeadRow
            lead={item}
            onPress={() => router.push(`/crm/${item.id}`)}
            isDark={isDark}
            primary={primary}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => (
          <YStack height={1} backgroundColor="$borderColor" marginLeft={76} />
        )}
        ListEmptyComponent={
          <YStack alignItems="center" padding="$8">
            <Ionicons name="analytics-outline" size={48} color="#71717a" />
            <Text marginTop="$4" color="$gray8">
              Nenhum lead encontrado
            </Text>
          </YStack>
        }
        onEndReached={() => {
          if (page < totalPages) setPage((p) => p + 1);
        }}
        onEndReachedThreshold={0.5}
      />
    </YStack>
  );
}

function MiniStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: IoniconsName;
}) {
  return (
    <Card flex={1} minWidth={100} padding="$2" backgroundColor="$backgroundStrong" borderRadius="$3">
      <YStack alignItems="center" gap={2}>
        <Ionicons name={icon} size={14} color={color} />
        <Text fontSize="$5" fontWeight="bold" color={color}>
          {value}
        </Text>
        <Text fontSize={10} color="$gray8" numberOfLines={1}>
          {label}
        </Text>
      </YStack>
    </Card>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
  primary,
  dotColor,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
  primary: string;
  dotColor?: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius={20}
        backgroundColor={active ? primary : "$backgroundStrong"}
        alignItems="center"
        gap="$1"
      >
        {dotColor && !active && (
          <YStack width={8} height={8} borderRadius={4} backgroundColor={dotColor} />
        )}
        <Text
          fontSize="$2"
          color={active ? "white" : "$color"}
          fontWeight={active ? "600" : "400"}
        >
          {label}
        </Text>
        {count !== undefined && count > 0 && (
          <YStack
            backgroundColor={active ? "white" : primary}
            paddingHorizontal={6}
            borderRadius={8}
            minWidth={18}
            alignItems="center"
          >
            <Text fontSize={10} color={active ? primary : "white"} fontWeight="bold">
              {count}
            </Text>
          </YStack>
        )}
      </XStack>
    </Pressable>
  );
}

function LeadRow({
  lead,
  onPress,
  isDark,
  primary,
}: {
  lead: Lead;
  onPress: () => void;
  isDark: boolean;
  primary: string;
}) {
  const scoreColor = SCORE_COLORS[lead.score] || "#6b7280";
  const scoreIcon = SCORE_ICONS[lead.score] || "person-outline";

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? (isDark ? "#1e293b" : "#f8fafc") : "transparent",
      })}
    >
      <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
        {/* Avatar */}
        <YStack
          width={50}
          height={50}
          borderRadius={25}
          backgroundColor={scoreColor}
          alignItems="center"
          justifyContent="center"
        >
          <Text color="white" fontSize="$5" fontWeight="bold">
            {lead.customerName?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </YStack>

        {/* Content */}
        <YStack flex={1} gap={2}>
          <XStack justifyContent="space-between" alignItems="center">
            <XStack flex={1} alignItems="center" gap="$2">
              <Text fontWeight="600" fontSize={16} numberOfLines={1} color="$color">
                {lead.customerName}
              </Text>
            </XStack>
            {lead.lastMessageAt && (
              <Text fontSize={12} color="$gray8">
                {formatTime(lead.lastMessageAt)}
              </Text>
            )}
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <Text
              color="$gray8"
              fontSize={14}
              numberOfLines={1}
              flex={1}
              marginRight="$2"
            >
              {lead.lastMessage || "Sem mensagens"}
            </Text>
            {/* Score Badge */}
            <XStack
              backgroundColor={`${scoreColor}20`}
              paddingHorizontal={8}
              paddingVertical={2}
              borderRadius={10}
              alignItems="center"
              gap={4}
            >
              <Ionicons name={scoreIcon} size={10} color={scoreColor} />
              <Text fontSize={10} fontWeight="600" color={scoreColor}>
                {lead.scoreLabel?.label || "Novo"}
              </Text>
            </XStack>
          </XStack>

          {/* Meta info */}
          <XStack gap="$3" marginTop={2}>
            <XStack alignItems="center" gap={3}>
              <Ionicons name="chatbubble-outline" size={10} color="#94a3b8" />
              <Text fontSize={11} color="$gray8">
                {lead.messageCount} conv
              </Text>
            </XStack>
            {lead.confidence > 0 && (
              <XStack alignItems="center" gap={3}>
                <Ionicons name="analytics-outline" size={10} color="#94a3b8" />
                <Text fontSize={11} color="$gray8">
                  {lead.confidence}% conf
                </Text>
              </XStack>
            )}
          </XStack>
        </YStack>
      </XStack>
    </Pressable>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "Agora";
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Ontem";
  if (days < 7) {
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    return weekDays[date.getDay()];
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
