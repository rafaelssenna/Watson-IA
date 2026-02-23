import { useEffect, useState } from "react";
import { Pressable, Alert, ActivityIndicator, Switch, TextInput as RNTextInput } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme, Input, Button } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  isAuto: boolean;
  contactCount?: number;
}

interface TagSuggestion {
  name: string;
  color: string;
  description: string;
  isAuto: boolean;
}

const COLOR_OPTIONS = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export default function TagsScreen() {
  const theme = useTheme();
  const [tags, setTags] = useState<Tag[]>([]);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [isAuto, setIsAuto] = useState(true);

  useEffect(() => {
    fetchTags();
    fetchSuggestions();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await api.get<{ success: boolean; data: Tag[] }>("/tags");
      setTags(response.data.data || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await api.get<{ success: boolean; data: TagSuggestion[] }>("/tags/suggestions");
      setSuggestions(response.data.data || []);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor(COLOR_OPTIONS[0]);
    setIsAuto(true);
    setEditingTag(null);
    setShowForm(false);
  };

  const openEditForm = (tag: Tag) => {
    setEditingTag(tag);
    setName(tag.name);
    setDescription(tag.description || "");
    setColor(tag.color);
    setIsAuto(tag.isAuto);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Nome da tag obrigatorio");
      return;
    }

    setSaving(true);
    try {
      if (editingTag) {
        // Update
        const response = await api.patch<{ success: boolean; data: Tag }>(
          `/tags/${editingTag.id}`,
          { name: name.trim(), description: description.trim(), color, isAuto }
        );
        if (response.data.success) {
          setTags((prev) =>
            prev.map((t) => (t.id === editingTag.id ? { ...t, name: name.trim(), description: description.trim(), color, isAuto } : t))
          );
        }
      } else {
        // Create
        const response = await api.post<{ success: boolean; data: Tag }>("/tags", {
          name: name.trim(),
          description: description.trim(),
          color,
          isAuto,
        });
        if (response.data.success) {
          setTags((prev) => [...prev, response.data.data]);
        }
      }
      resetForm();
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Nao foi possivel salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (tag: Tag) => {
    Alert.alert(
      "Deletar Tag",
      `Tem certeza que deseja deletar "${tag.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/tags/${tag.id}`);
              setTags((prev) => prev.filter((t) => t.id !== tag.id));
            } catch (error: any) {
              Alert.alert("Erro", error?.message || "Nao foi possivel deletar");
            }
          },
        },
      ]
    );
  };

  const handleAddSuggestion = async (suggestion: TagSuggestion) => {
    // Check if tag already exists
    if (tags.some((t) => t.name.toLowerCase() === suggestion.name.toLowerCase())) {
      Alert.alert("Aviso", "Esta tag ja existe");
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<{ success: boolean; data: Tag }>("/tags", {
        name: suggestion.name,
        description: suggestion.description,
        color: suggestion.color,
        isAuto: suggestion.isAuto,
      });
      if (response.data.success) {
        setTags((prev) => [...prev, response.data.data]);
      }
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Nao foi possivel criar");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tags Automaticas" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <YStack gap="$4">
          {/* Header */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$3">
              <YStack
                width={48}
                height={48}
                borderRadius={24}
                backgroundColor="$blue5"
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="pricetags-outline" size={24} color="#3b82f6" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize="$4" fontWeight="600" color="$color">
                  Tags Automaticas
                </Text>
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  A IA aplica tags automaticamente baseado nas conversas
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* Form */}
          {showForm && (
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <YStack gap="$3">
                <Text fontSize="$3" fontWeight="600" color="$color">
                  {editingTag ? "Editar Tag" : "Nova Tag"}
                </Text>

                <YStack gap="$2">
                  <Text fontSize="$2" color="$gray8">Nome</Text>
                  <Input
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex: Cliente VIP"
                    backgroundColor="$background"
                  />
                </YStack>

                <YStack gap="$2">
                  <Text fontSize="$2" color="$gray8">Descricao (para a IA entender)</Text>
                  <Input
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Ex: Cliente que compra com frequencia"
                    backgroundColor="$background"
                    multiline
                    numberOfLines={2}
                  />
                </YStack>

                <YStack gap="$2">
                  <Text fontSize="$2" color="$gray8">Cor</Text>
                  <XStack gap="$2" flexWrap="wrap">
                    {COLOR_OPTIONS.map((c) => (
                      <Pressable key={c} onPress={() => setColor(c)}>
                        <YStack
                          width={36}
                          height={36}
                          borderRadius={18}
                          backgroundColor={c}
                          alignItems="center"
                          justifyContent="center"
                          borderWidth={color === c ? 3 : 0}
                          borderColor="white"
                        >
                          {color === c && (
                            <Ionicons name="checkmark" size={20} color="white" />
                          )}
                        </YStack>
                      </Pressable>
                    ))}
                  </XStack>
                </YStack>

                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1}>
                    <Text fontSize="$3" color="$color">Tag Automatica</Text>
                    <Text fontSize="$2" color="$gray8">IA aplica baseado na conversa</Text>
                  </YStack>
                  <Switch
                    value={isAuto}
                    onValueChange={setIsAuto}
                    trackColor={{ false: theme.gray6.val, true: WATSON_TEAL }}
                    thumbColor="white"
                  />
                </XStack>

                <XStack gap="$2" marginTop="$2">
                  <Button
                    flex={1}
                    backgroundColor="$gray5"
                    onPress={resetForm}
                  >
                    Cancelar
                  </Button>
                  <Button
                    flex={1}
                    backgroundColor={WATSON_TEAL}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? <ActivityIndicator size="small" color="white" /> : "Salvar"}
                  </Button>
                </XStack>
              </YStack>
            </Card>
          )}

          {/* Tags List */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$color">
                Suas Tags ({tags.length})
              </Text>
              {!showForm && (
                <Pressable onPress={() => setShowForm(true)}>
                  <XStack alignItems="center" gap="$1">
                    <Ionicons name="add-circle-outline" size={20} color={WATSON_TEAL} />
                    <Text fontSize="$3" color={WATSON_TEAL}>Nova</Text>
                  </XStack>
                </Pressable>
              )}
            </XStack>

            {tags.length === 0 ? (
              <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <YStack alignItems="center" gap="$3">
                  <ActivityIndicator size="large" color={WATSON_TEAL} />
                  <Text fontSize="$3" color="$gray8" textAlign="center">
                    Carregando tags...
                  </Text>
                </YStack>
              </Card>
            ) : (
              tags.map((tag) => (
                <Card
                  key={tag.id}
                  padding="$3"
                  backgroundColor="$backgroundStrong"
                  borderRadius="$4"
                  borderLeftWidth={4}
                  borderLeftColor={tag.color}
                >
                  <XStack alignItems="center" gap="$3">
                    <YStack
                      width={40}
                      height={40}
                      borderRadius={20}
                      backgroundColor={tag.color + "20"}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons name="pricetag" size={20} color={tag.color} />
                    </YStack>

                    <YStack flex={1}>
                      <XStack alignItems="center" gap="$2">
                        <Text fontSize="$3" fontWeight="600" color="$color">
                          {tag.name}
                        </Text>
                        {tag.isAuto && (
                          <YStack backgroundColor="$blue3" paddingHorizontal="$2" paddingVertical={2} borderRadius="$2">
                            <Text fontSize={10} color="$blue10">AUTO</Text>
                          </YStack>
                        )}
                      </XStack>
                      {tag.description && (
                        <Text fontSize="$2" color="$gray8" numberOfLines={1}>
                          {tag.description}
                        </Text>
                      )}
                      {tag.contactCount !== undefined && tag.contactCount > 0 && (
                        <Text fontSize="$1" color="$gray7" marginTop="$1">
                          {tag.contactCount} contato{tag.contactCount !== 1 ? "s" : ""}
                        </Text>
                      )}
                    </YStack>

                    <XStack gap="$2">
                      <Pressable onPress={() => openEditForm(tag)}>
                        <Ionicons name="pencil-outline" size={20} color={theme.gray8.val} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(tag)}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </Pressable>
                    </XStack>
                  </XStack>
                </Card>
              ))
            )}
          </YStack>

          {/* Suggestions */}
          {tags.length > 0 && suggestions.length > 0 && (
            <YStack gap="$3">
              <Text fontSize="$3" fontWeight="600" color="$color">
                Sugestoes
              </Text>
              <XStack flexWrap="wrap" gap="$2">
                {suggestions
                  .filter((s) => !tags.some((t) => t.name.toLowerCase() === s.name.toLowerCase()))
                  .slice(0, 4)
                  .map((suggestion) => (
                    <Pressable key={suggestion.name} onPress={() => handleAddSuggestion(suggestion)}>
                      <XStack
                        backgroundColor={suggestion.color + "20"}
                        paddingHorizontal="$3"
                        paddingVertical="$2"
                        borderRadius="$3"
                        alignItems="center"
                        gap="$2"
                      >
                        <Ionicons name="add" size={16} color={suggestion.color} />
                        <Text fontSize="$2" color={suggestion.color}>
                          {suggestion.name}
                        </Text>
                      </XStack>
                    </Pressable>
                  ))}
              </XStack>
            </YStack>
          )}

          {/* Info */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <YStack gap="$3">
              <XStack alignItems="flex-start" gap="$2">
                <Ionicons name="sparkles-outline" size={18} color={WATSON_TEAL} />
                <Text fontSize="$2" color="$gray8" flex={1}>
                  Tags automaticas sao aplicadas pela IA baseado no conteudo das conversas
                </Text>
              </XStack>
              <XStack alignItems="flex-start" gap="$2">
                <Ionicons name="information-circle-outline" size={18} color="#3b82f6" />
                <Text fontSize="$2" color="$gray8" flex={1}>
                  A descricao ajuda a IA entender quando aplicar cada tag
                </Text>
              </XStack>
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </>
  );
}
