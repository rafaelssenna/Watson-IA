import { useEffect, useState, useRef } from "react";
import { Pressable, Alert, ActivityIndicator, TextInput } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { usePersonaStore, type PersonaKnowledgeFile } from "@/stores/personaStore";

// Watson IA brand colors
const WATSON_TEAL = "#0d9488";

export default function KnowledgeBaseScreen() {
  const theme = useTheme();

  const {
    selectedPersona,
    knowledgeFiles,
    isLoading,
    isUploading,
    fetchDefaultPersona,
    fetchKnowledgeFiles,
    uploadKnowledgeFile,
    deleteKnowledgeFile,
    updatePersona,
  } = usePersonaStore();

  const [customInstructions, setCustomInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Load custom instructions when persona is loaded
  useEffect(() => {
    if (selectedPersona && !formInitialized) {
      setCustomInstructions(selectedPersona.customInstructions || "");
      setFormInitialized(true);
    }
  }, [selectedPersona, formInitialized]);

  const loadData = async () => {
    const persona = await fetchDefaultPersona();
    if (persona) {
      fetchKnowledgeFiles(persona.id);
    }
  };

  const handleSaveInstructions = async () => {
    if (!selectedPersona?.id) return;

    setSaving(true);
    try {
      await updatePersona(selectedPersona.id, {
        customInstructions: customInstructions.trim() || undefined,
      });
      Alert.alert("Sucesso", "Instrucoes salvas com sucesso");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao salvar instrucoes");
    }
    setSaving(false);
  };

  const handlePickFile = async () => {
    if (!selectedPersona?.id) {
      Alert.alert("Erro", "Nenhuma persona encontrada. Crie uma persona primeiro.");
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "text/plain",
          "text/csv",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        await uploadKnowledgeFile(selectedPersona.id, {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || "application/octet-stream",
        });
        Alert.alert("Sucesso", "Arquivo enviado com sucesso! O Watson IA agora pode usar estas informacoes.");
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Erro ao enviar arquivo");
    }
  };

  const handleDeleteFile = (file: PersonaKnowledgeFile) => {
    if (!selectedPersona?.id) return;

    Alert.alert("Confirmar", `Remover arquivo "${file.fileName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => deleteKnowledgeFile(selectedPersona.id, file.id),
      },
    ]);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") return "document-text";
    if (mimeType.includes("word")) return "document";
    if (mimeType.includes("text")) return "document-text-outline";
    return "document-outline";
  };

  const getFileColor = (mimeType: string) => {
    if (mimeType === "application/pdf") return "#ef4444";
    if (mimeType.includes("word")) return "#3b82f6";
    if (mimeType.includes("text")) return "#22c55e";
    return theme.gray8.val;
  };

  if (isLoading && !selectedPersona) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
        <Text color="$gray8" marginTop="$3">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Base de Conhecimento",
          headerRight: () => (
            <Pressable onPress={handleSaveInstructions} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={WATSON_TEAL} />
              ) : (
                <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
                  Salvar
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <YStack gap="$4">
          {/* Info Card */}
          <Card padding="$4" backgroundColor="$teal5" borderRadius="$4">
            <XStack gap="$3" alignItems="flex-start">
              <Ionicons name="bulb-outline" size={24} color={WATSON_TEAL} />
              <YStack flex={1}>
                <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
                  Como funciona?
                </Text>
                <Text color="$color" marginTop="$2" fontSize="$3">
                  Adicione documentos com informacoes sobre seu negocio. O Watson IA vai usar esses arquivos para responder perguntas dos clientes com mais precisao.
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* Custom Instructions */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <Ionicons name="create-outline" size={20} color={WATSON_TEAL} />
              <Text fontSize="$3" fontWeight="600" color="$color">
                Instrucoes Adicionais
              </Text>
            </XStack>
            <Text fontSize="$2" color="$gray8" marginBottom="$3">
              Regras especificas do seu negocio que a IA deve seguir
            </Text>
            <TextInput
              value={customInstructions}
              onChangeText={setCustomInstructions}
              placeholder="Ex: Nosso prazo de entrega e de 3-5 dias uteis. Temos frete gratis acima de R$200..."
              placeholderTextColor={theme.gray8.val}
              multiline
              numberOfLines={5}
              style={{
                backgroundColor: theme.background.val,
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: theme.color.val,
                minHeight: 120,
                textAlignVertical: "top",
              }}
            />
          </Card>

          {/* Supported Formats */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
              Formatos Aceitos
            </Text>
            <XStack flexWrap="wrap" gap="$2">
              <FormatBadge label="PDF" color="#ef4444" />
              <FormatBadge label="Word" color="#3b82f6" />
              <FormatBadge label="TXT" color="#22c55e" />
              <FormatBadge label="CSV" color="#f59e0b" />
            </XStack>
            <Text fontSize="$2" color="$gray7" marginTop="$3">
              Tamanho maximo: 10 MB por arquivo
            </Text>
          </Card>

          {/* Files Section */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
              <YStack>
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Arquivos ({knowledgeFiles.length})
                </Text>
              </YStack>
              <Pressable onPress={handlePickFile} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator size="small" color={WATSON_TEAL} />
                ) : (
                  <XStack
                    backgroundColor={WATSON_TEAL}
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderRadius="$3"
                    gap="$1"
                    alignItems="center"
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color="white" />
                    <Text color="white" fontWeight="600" fontSize="$3">Enviar</Text>
                  </XStack>
                )}
              </Pressable>
            </XStack>

            {knowledgeFiles.length === 0 ? (
              <YStack
                padding="$6"
                backgroundColor="$background"
                borderRadius="$3"
                alignItems="center"
              >
                <Ionicons name="folder-open-outline" size={48} color={theme.gray6.val} />
                <Text color="$gray8" marginTop="$3" textAlign="center" fontSize="$4">
                  Nenhum arquivo adicionado
                </Text>
                <Text color="$gray7" fontSize="$2" marginTop="$2" textAlign="center">
                  Envie PDFs, documentos ou arquivos de texto para o Watson aprender sobre seu negocio
                </Text>
                <Pressable onPress={handlePickFile} disabled={isUploading}>
                  <XStack
                    backgroundColor={WATSON_TEAL}
                    paddingHorizontal="$4"
                    paddingVertical="$3"
                    borderRadius="$3"
                    gap="$2"
                    alignItems="center"
                    marginTop="$4"
                  >
                    <Ionicons name="add" size={20} color="white" />
                    <Text color="white" fontWeight="600" fontSize="$4">Adicionar Arquivo</Text>
                  </XStack>
                </Pressable>
              </YStack>
            ) : (
              <YStack gap="$3">
                {knowledgeFiles.map((file) => (
                  <XStack
                    key={file.id}
                    padding="$3"
                    backgroundColor="$background"
                    borderRadius="$3"
                    alignItems="center"
                    gap="$3"
                  >
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={8}
                      backgroundColor="$backgroundHover"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons
                        name={getFileIcon(file.mimeType) as any}
                        size={24}
                        color={getFileColor(file.mimeType)}
                      />
                    </YStack>
                    <YStack flex={1}>
                      <Text color="$color" fontSize="$3" fontWeight="500" numberOfLines={1}>
                        {file.fileName}
                      </Text>
                      <Text color="$gray8" fontSize="$2">
                        Enviado em {new Date(file.createdAt).toLocaleDateString("pt-BR")}
                      </Text>
                    </YStack>
                    <Pressable onPress={() => handleDeleteFile(file)}>
                      <YStack
                        width={36}
                        height={36}
                        borderRadius={18}
                        backgroundColor="$red5"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </YStack>
                    </Pressable>
                  </XStack>
                ))}
              </YStack>
            )}
          </Card>

          {/* Tips */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
              Dicas para melhores resultados
            </Text>
            <YStack gap="$3">
              <TipItem
                icon="checkmark-circle"
                text="Envie catalogos de produtos com precos e descricoes"
              />
              <TipItem
                icon="checkmark-circle"
                text="Inclua FAQs com perguntas frequentes dos clientes"
              />
              <TipItem
                icon="checkmark-circle"
                text="Adicione politicas de entrega, troca e garantia"
              />
              <TipItem
                icon="checkmark-circle"
                text="Mantenha os arquivos atualizados"
              />
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </>
  );
}

function FormatBadge({ label, color }: { label: string; color: string }) {
  return (
    <YStack
      backgroundColor={color}
      paddingHorizontal="$3"
      paddingVertical="$1"
      borderRadius="$2"
    >
      <Text color="white" fontSize="$2" fontWeight="600">
        {label}
      </Text>
    </YStack>
  );
}

function TipItem({ icon, text }: { icon: string; text: string }) {
  return (
    <XStack alignItems="flex-start" gap="$2">
      <Ionicons name={icon as any} size={18} color={WATSON_TEAL} style={{ marginTop: 2 }} />
      <Text color="$gray8" fontSize="$3" flex={1}>
        {text}
      </Text>
    </XStack>
  );
}
