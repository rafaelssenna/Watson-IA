import { useEffect, useState, useRef } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme, Switch } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { usePersonaStore, type CreatePersonaData } from "@/stores/personaStore";

export default function PersonaEditScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const { selectedPersona, isLoading, fetchPersona, createPersona, updatePersona, setSelectedPersona } = usePersonaStore();

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [formalityLevel, setFormalityLevel] = useState(50);
  const [persuasiveness, setPersuasiveness] = useState(50);
  const [energyLevel, setEnergyLevel] = useState(50);
  const [empathyLevel, setEmpathyLevel] = useState(70);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);
  const loadedPersonaId = useRef<string | null>(null);

  useEffect(() => {
    // Reset when navigating to a different persona or creating new
    if (id !== loadedPersonaId.current) {
      setFormInitialized(false);
      loadedPersonaId.current = id || null;
    }

    if (isEditing && id) {
      fetchPersona(id);
    } else {
      // Clear and reset for new persona
      setSelectedPersona(null);
      setName("");
      setSystemPrompt("");
      setFormalityLevel(50);
      setPersuasiveness(50);
      setEnergyLevel(50);
      setEmpathyLevel(70);
      setCustomInstructions("");
      setIsDefault(false);
      setFormInitialized(true);
    }
  }, [id]);

  useEffect(() => {
    // Only populate form once when persona is first loaded
    if (isEditing && selectedPersona && selectedPersona.id === id && !formInitialized) {
      setName(selectedPersona.name);
      setSystemPrompt(selectedPersona.systemPrompt || "");
      setFormalityLevel(selectedPersona.formalityLevel ?? 50);
      setPersuasiveness(selectedPersona.persuasiveness ?? 50);
      setEnergyLevel(selectedPersona.energyLevel ?? 50);
      setEmpathyLevel(selectedPersona.empathyLevel ?? 70);
      setCustomInstructions(selectedPersona.customInstructions || "");
      setIsDefault(selectedPersona.isDefault);
      setFormInitialized(true);
    }
  }, [selectedPersona, formInitialized, id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "Nome da persona e obrigatorio");
      return;
    }

    setSaving(true);

    const data: CreatePersonaData = {
      name: name.trim(),
      systemPrompt: systemPrompt.trim() || undefined,
      formalityLevel,
      persuasiveness,
      energyLevel,
      empathyLevel,
      customInstructions: customInstructions.trim() || undefined,
      isDefault,
    };

    try {
      if (isEditing && id) {
        await updatePersona(id, data);
        Alert.alert("Sucesso", "Persona atualizada com sucesso", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        await createPersona(data);
        Alert.alert("Sucesso", "Persona criada com sucesso", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao salvar persona");
    }

    setSaving(false);
  };

  const getLevelDescription = (level: number, type: string): string => {
    const descriptions: Record<string, Record<string, string>> = {
      formality: {
        low: "Casual e amigavel, usa girias e emojis",
        medium: "Equilibrado, profissional mas acessivel",
        high: "Formal e profissional, linguagem corporativa",
      },
      persuasiveness: {
        low: "Informativo, sem pressao de vendas",
        medium: "Gentilmente sugestivo",
        high: "Persuasivo, focado em conversao",
      },
      energy: {
        low: "Calmo e tranquilo",
        medium: "Equilibrado e neutro",
        high: "Energetico e entusiasmado",
      },
      empathy: {
        low: "Direto ao ponto, objetivo",
        medium: "Atencioso e educado",
        high: "Muito empatico e acolhedor",
      },
    };

    const category = level <= 33 ? "low" : level <= 66 ? "medium" : "high";
    return descriptions[type]?.[category] || "";
  };

  if (isEditing && isLoading && !selectedPersona) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={theme.blue10.val} />
        <Text color="$gray8" marginTop="$3">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? "Editar Persona" : "Nova Persona",
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.blue10.val} />
              ) : (
                <Text color="$blue10" fontWeight="600" fontSize="$4">
                  Salvar
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <YStack gap="$4">
            {/* Name */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                Nome da Persona
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: Assistente de Vendas"
                placeholderTextColor={theme.gray8.val}
                style={{
                  backgroundColor: theme.background.val,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: theme.color.val,
                }}
              />
            </Card>

            {/* System Prompt */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                System Prompt (Opcional)
              </Text>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                Instrucoes detalhadas para a IA. Se preenchido, substitui as configuracoes abaixo.
              </Text>
              <TextInput
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder="Voce e um assistente..."
                placeholderTextColor={theme.gray8.val}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: theme.background.val,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: theme.color.val,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
              />
            </Card>

            {/* Personality Sliders */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$4">
                Personalidade
              </Text>

              {/* Formality */}
              <YStack marginBottom="$4">
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Formalidade</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{formalityLevel}%</Text>
                </XStack>
                <Slider
                  value={formalityLevel}
                  onValueChange={setFormalityLevel}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(formalityLevel, "formality")}
                </Text>
              </YStack>

              {/* Persuasiveness */}
              <YStack marginBottom="$4">
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Persuasao</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{persuasiveness}%</Text>
                </XStack>
                <Slider
                  value={persuasiveness}
                  onValueChange={setPersuasiveness}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(persuasiveness, "persuasiveness")}
                </Text>
              </YStack>

              {/* Energy */}
              <YStack marginBottom="$4">
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Energia</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{energyLevel}%</Text>
                </XStack>
                <Slider
                  value={energyLevel}
                  onValueChange={setEnergyLevel}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(energyLevel, "energy")}
                </Text>
              </YStack>

              {/* Empathy */}
              <YStack>
                <XStack justifyContent="space-between" marginBottom="$1">
                  <Text fontSize="$3" color="$color">Empatia</Text>
                  <Text fontSize="$3" color="$blue10" fontWeight="600">{empathyLevel}%</Text>
                </XStack>
                <Slider
                  value={empathyLevel}
                  onValueChange={setEmpathyLevel}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  minimumTrackTintColor={theme.blue10.val}
                  maximumTrackTintColor={theme.gray6.val}
                  thumbTintColor={theme.blue10.val}
                />
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  {getLevelDescription(empathyLevel, "empathy")}
                </Text>
              </YStack>
            </Card>

            {/* Custom Instructions */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$2">
                Instrucoes Adicionais (Opcional)
              </Text>
              <Text fontSize="$2" color="$gray8" marginBottom="$3">
                Regras especificas do seu negocio, como horarios, produtos, etc.
              </Text>
              <TextInput
                value={customInstructions}
                onChangeText={setCustomInstructions}
                placeholder="Ex: Nosso horario de atendimento e das 9h as 18h..."
                placeholderTextColor={theme.gray8.val}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: theme.background.val,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: theme.color.val,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
              />
            </Card>

            {/* Default Toggle */}
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <YStack flex={1}>
                  <Text fontSize="$3" fontWeight="600" color="$color">
                    Persona Padrao
                  </Text>
                  <Text fontSize="$2" color="$gray8" marginTop="$1">
                    Usar esta persona para novas conversas
                  </Text>
                </YStack>
                <Switch
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                  backgroundColor={isDefault ? "$blue10" : "$gray6"}
                >
                  <Switch.Thumb animation="quick" backgroundColor="white" />
                </Switch>
              </XStack>
            </Card>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
