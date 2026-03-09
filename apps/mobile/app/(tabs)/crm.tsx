import { useEffect, useState, useCallback } from "react";
import { FlatList, RefreshControl, Pressable } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";
import { FilterChip } from "@/components/shared/FilterChip";
import { MiniStat } from "@/components/shared/MiniStat";
import { SearchBar } from "@/components/shared/SearchBar";
import { formatTime } from "@/utils/formatters";
import { statusColors, watsonColors } from "@/theme/colors";

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
  qualified: statusColors.qualified,
  interested: statusColors.interested,
  new_lead: statusColors.blue,
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
            <MiniStat label="Total" value={stats.total} color={watsonColors.gray[500]} icon="people-outline" />
            <MiniStat label="Qualificados" value={stats.qualified} color={statusColors.qualified} icon="checkmark-circle-outline" />
            <MiniStat label="Interessados" value={stats.interested} color={statusColors.interested} icon="star-outline" />
            <MiniStat label="Novos" value={stats.newLead} color={statusColors.blue} icon="person-add-outline" />
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
            dotColor={statusColors.qualified}
          />
          <FilterChip
            label="Interessado"
            count={counts?.interested}
            active={scoreFilter === "interested"}
            onPress={() => { setScoreFilter("interested"); setPage(1); }}
            primary={primary}
            dotColor={statusColors.interested}
          />
          <FilterChip
            label="Novo Lead"
            count={counts?.new_lead}
            active={scoreFilter === "new_lead"}
            onPress={() => { setScoreFilter("new_lead"); setPage(1); }}
            primary={primary}
            dotColor={statusColors.blue}
          />
        </XStack>

        {/* Search */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou telefone..."
          isDark={isDark}
        />
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
          <YStack alignItems="center" padding="$4">
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
  const scoreColor = SCORE_COLORS[lead.score] || watsonColors.gray[500];
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
              <Ionicons name="chatbubble-outline" size={10} color={watsonColors.gray[400]} />
              <Text fontSize={11} color="$gray8">
                {lead.messageCount} conv
              </Text>
            </XStack>
            {lead.confidence > 0 && (
              <XStack alignItems="center" gap={3}>
                <Ionicons name="analytics-outline" size={10} color={watsonColors.gray[400]} />
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
