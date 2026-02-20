import { useState, useEffect } from "react";
import { ScrollView, Pressable, Image } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, Button, Input, Spinner, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { api } from "@/services/api";

type ConnectionMethod = "qrcode" | "code" | null;
type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface ConnectionState {
  status: ConnectionStatus;
  qrcode?: string;
  pairingCode?: string;
  phone?: string;
}

export default function WhatsAppConnectionScreen() {
  const [method, setMethod] = useState<ConnectionMethod>(null);
  const [phone, setPhone] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [waitingForCode, setWaitingForCode] = useState(false); // Track if user chose code method
  const theme = useTheme();

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check current status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async (preserveCurrentMethod = false) => {
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          status: string;
          hasConnection: boolean;
          phoneNumber?: string;
          displayName?: string;
          qrcode?: string;
          pairingCode?: string;
        };
      }>("/whatsapp/status");

      if (response.data.success) {
        const data = response.data.data;
        const status = data.status?.toLowerCase() as ConnectionStatus;

        setConnectionState((prev) => {
          // If user is waiting for pairing code, only update status, not the codes
          // This prevents switching to QR code screen
          if (preserveCurrentMethod && prev.pairingCode) {
            return {
              ...prev,
              status: status || prev.status,
              phone: data.phoneNumber || prev.phone,
            };
          }

          return {
            status: status || "disconnected",
            phone: data.phoneNumber || prev.phone,
            qrcode: data.qrcode || prev.qrcode,
            pairingCode: data.pairingCode || prev.pairingCode,
          };
        });
      }
    } catch (err: any) {
      console.log("Status check error:", err.response?.data || err.message);
    }
  };

  // Poll for status updates when connecting
  useEffect(() => {
    if (connectionState.status !== "connecting") return;

    const interval = setInterval(async () => {
      // Pass true to preserve current method (don't switch from code to qrcode)
      await checkStatus(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [connectionState.status]);

  const connectWithQRCode = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post<{
        success: boolean;
        data: { qrcode?: string; status: ConnectionStatus };
      }>("/whatsapp/connect/qrcode", {});

      if (response.data.success && response.data.data.qrcode) {
        setConnectionState({
          status: "connecting",
          qrcode: response.data.data.qrcode,
        });
      } else {
        setError("QR Code nao recebido. Verifique a configuracao do Uazapi.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Erro ao gerar QR Code");
    } finally {
      setIsLoading(false);
    }
  };

  const connectWithCode = async () => {
    if (!phone || phone.length < 10) {
      setError("Digite um numero de telefone valido");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const formattedPhone = phone.replace(/\D/g, "");

      const response = await api.post<{
        success: boolean;
        data: { pairingCode?: string; status: ConnectionStatus };
      }>("/whatsapp/connect/code", { phone: formattedPhone });

      if (response.data.success && response.data.data.pairingCode) {
        setConnectionState({
          status: "connecting",
          pairingCode: response.data.data.pairingCode,
        });
      } else {
        setError("Codigo de pareamento nao recebido. Verifique a configuracao do Uazapi.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Erro ao gerar codigo de pareamento");
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    setIsLoading(true);
    try {
      await api.post("/whatsapp/disconnect", {});
      setConnectionState({ status: "disconnected" });
      setMethod(null);
    } catch (err: any) {
      setError(err.message || "Erro ao desconectar");
    } finally {
      setIsLoading(false);
    }
  };

  const resetConnection = () => {
    setMethod(null);
    setConnectionState({ status: "disconnected" });
    setError("");
    setPhone("");
  };

  // Connected state
  if (connectionState.status === "connected") {
    return (
      <>
        <Stack.Screen options={{ title: "WhatsApp" }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          <YStack gap="$4" alignItems="center" paddingTop="$8">
            <YStack
              width={100}
              height={100}
              borderRadius={50}
              backgroundColor="$green10"
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="checkmark" size={50} color="white" />
            </YStack>

            <Text fontSize="$6" fontWeight="bold" color="$color" textAlign="center">
              WhatsApp Conectado!
            </Text>

            {connectionState.phone && (
              <Text color="$gray8" fontSize="$4">
                {connectionState.phone}
              </Text>
            )}

            <Card
              backgroundColor="$backgroundStrong"
              padding="$4"
              borderRadius="$4"
              marginTop="$4"
              width="100%"
            >
              <YStack gap="$2">
                <XStack alignItems="center" gap="$2">
                  <Ionicons name="logo-whatsapp" size={20} color={theme.color.val} />
                  <Text color="$color" fontWeight="600">Status</Text>
                </XStack>
                <Text color="$green10" fontSize="$4">Conectado e funcionando</Text>
                <Text color="$gray8" fontSize="$2" marginTop="$2">
                  O Watson AI esta pronto para responder mensagens do WhatsApp automaticamente.
                </Text>
              </YStack>
            </Card>

            <Button
              onPress={disconnect}
              disabled={isLoading}
              size="$4"
              backgroundColor="$red10"
              marginTop="$6"
              width="100%"
            >
              {isLoading ? <Spinner color="white" /> : <Text color="white" fontWeight="600">Desconectar</Text>}
            </Button>
          </YStack>
        </ScrollView>
      </>
    );
  }

  // Connecting state - QR Code
  if (connectionState.status === "connecting" && connectionState.qrcode) {
    return (
      <>
        <Stack.Screen options={{ title: "Escanear QR Code" }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, alignItems: "center" }}
        >
          <YStack gap="$4" alignItems="center" paddingTop="$4" width="100%">
            <Text fontSize="$5" fontWeight="bold" color="$color" textAlign="center">
              Escaneie o QR Code
            </Text>

            <Card backgroundColor="white" padding="$4" borderRadius="$4">
              <Image
                source={{ uri: connectionState.qrcode }}
                style={{ width: 250, height: 250 }}
                resizeMode="contain"
              />
            </Card>

            <Card
              backgroundColor="$backgroundStrong"
              padding="$4"
              borderRadius="$4"
              width="100%"
            >
              <YStack gap="$3">
                <Text color="$color" fontWeight="600">Como escanear:</Text>
                <YStack gap="$2">
                  <Text color="$gray8" fontSize="$3">1. Abra o WhatsApp no seu celular</Text>
                  <Text color="$gray8" fontSize="$3">2. Toque em Menu ou Configuracoes</Text>
                  <Text color="$gray8" fontSize="$3">3. Selecione "Dispositivos conectados"</Text>
                  <Text color="$gray8" fontSize="$3">4. Toque em "Conectar dispositivo"</Text>
                  <Text color="$gray8" fontSize="$3">5. Aponte a camera para este QR Code</Text>
                </YStack>
              </YStack>
            </Card>

            <XStack gap="$2" alignItems="center" marginTop="$2">
              <Spinner size="small" color="$blue10" />
              <Text color="$gray8">Aguardando conexao...</Text>
            </XStack>

            <Button
              onPress={resetConnection}
              size="$4"
              backgroundColor="$gray5"
              marginTop="$4"
              width="100%"
            >
              <Text color="$color">Cancelar</Text>
            </Button>
          </YStack>
        </ScrollView>
      </>
    );
  }

  // Connecting state - Pairing Code
  if (connectionState.status === "connecting" && connectionState.pairingCode) {
    return (
      <>
        <Stack.Screen options={{ title: "Codigo de Pareamento" }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, alignItems: "center" }}
        >
          <YStack gap="$4" alignItems="center" paddingTop="$4" width="100%">
            <Text fontSize="$5" fontWeight="bold" color="$color" textAlign="center">
              Codigo de Pareamento
            </Text>

            <Pressable onPress={() => copyToClipboard(connectionState.pairingCode || "")}>
              <Card backgroundColor="$blue10" padding="$6" borderRadius="$4">
                <Text fontSize={32} fontWeight="bold" color="white" letterSpacing={8} textAlign="center">
                  {connectionState.pairingCode}
                </Text>
              </Card>
            </Pressable>

            <Button
              onPress={() => copyToClipboard(connectionState.pairingCode || "")}
              size="$4"
              backgroundColor={copied ? "$green10" : "$blue5"}
              marginTop="$2"
            >
              <XStack gap="$2" alignItems="center">
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? "white" : "#2563eb"} />
                <Text color={copied ? "white" : "$blue10"} fontWeight="600">
                  {copied ? "Copiado!" : "Copiar Codigo"}
                </Text>
              </XStack>
            </Button>

            <Card
              backgroundColor="$backgroundStrong"
              padding="$4"
              borderRadius="$4"
              width="100%"
            >
              <YStack gap="$3">
                <Text color="$color" fontWeight="600">Como usar o codigo:</Text>
                <YStack gap="$2">
                  <Text color="$gray8" fontSize="$3">1. Abra o WhatsApp no seu celular</Text>
                  <Text color="$gray8" fontSize="$3">2. Toque em Menu ou Configuracoes</Text>
                  <Text color="$gray8" fontSize="$3">3. Selecione "Dispositivos conectados"</Text>
                  <Text color="$gray8" fontSize="$3">4. Toque em "Conectar dispositivo"</Text>
                  <Text color="$gray8" fontSize="$3">5. Toque em "Conectar com numero"</Text>
                  <Text color="$gray8" fontSize="$3">6. Digite o codigo acima</Text>
                </YStack>
              </YStack>
            </Card>

            <XStack gap="$2" alignItems="center" marginTop="$2">
              <Spinner size="small" color="$blue10" />
              <Text color="$gray8">Aguardando conexao...</Text>
            </XStack>

            <XStack alignItems="center" gap="$1" marginTop="$2">
              <Ionicons name="time-outline" size={14} color="#eab308" />
              <Text color="$yellow10" fontSize="$2">
                O codigo expira em 5 minutos
              </Text>
            </XStack>

            <Button
              onPress={resetConnection}
              size="$4"
              backgroundColor="$gray5"
              marginTop="$4"
              width="100%"
            >
              <Text color="$color">Cancelar</Text>
            </Button>
          </YStack>
        </ScrollView>
      </>
    );
  }

  // Method selection - QR Code selected
  if (method === "qrcode") {
    return (
      <>
        <Stack.Screen options={{ title: "Conectar via QR Code" }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          <YStack gap="$4">
            <Card backgroundColor="$blue5" padding="$4" borderRadius="$4">
              <XStack gap="$3" alignItems="flex-start">
                <Ionicons name="bulb-outline" size={24} color="#2563eb" />
                <YStack flex={1}>
                  <Text color="$blue10" fontWeight="600" fontSize="$4">
                    Use QR Code quando:
                  </Text>
                  <Text color="$color" marginTop="$2" fontSize="$3">
                    Voce quer conectar usando OUTRO celular para escanear o codigo.
                    Ideal para conectar uma conta WhatsApp Business ou um numero diferente.
                  </Text>
                </YStack>
              </XStack>
            </Card>

            {error && (
              <Text color="$red10" textAlign="center">{error}</Text>
            )}

            <Button
              onPress={connectWithQRCode}
              disabled={isLoading}
              size="$5"
              backgroundColor="$blue10"
            >
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <Text color="white" fontWeight="600">Gerar QR Code</Text>
              )}
            </Button>

            <Button
              onPress={() => setMethod(null)}
              size="$4"
              backgroundColor="$gray5"
            >
              <Text color="$color">Voltar</Text>
            </Button>
          </YStack>
        </ScrollView>
      </>
    );
  }

  // Method selection - Code selected
  if (method === "code") {
    return (
      <>
        <Stack.Screen options={{ title: "Conectar via Codigo" }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background.val }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          <YStack gap="$4">
            <Card backgroundColor="$green5" padding="$4" borderRadius="$4">
              <XStack gap="$3" alignItems="flex-start">
                <Ionicons name="bulb-outline" size={24} color="#22c55e" />
                <YStack flex={1}>
                  <Text color="$green10" fontWeight="600" fontSize="$4">
                    Use Codigo quando:
                  </Text>
                  <Text color="$color" marginTop="$2" fontSize="$3">
                    Voce quer conectar usando ESTE MESMO celular.
                    O codigo sera digitado diretamente no WhatsApp deste aparelho.
                  </Text>
                </YStack>
              </XStack>
            </Card>

            <YStack>
              <Text marginBottom="$2" fontSize="$3" color="$gray8">
                Numero do WhatsApp (com DDD)
              </Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="5511999999999"
                placeholderTextColor={theme.gray7.val}
                keyboardType="phone-pad"
                size="$5"
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
                color="$color"
              />
              <Text color="$gray8" fontSize="$2" marginTop="$1">
                Digite o numero com codigo do pais (55) + DDD
              </Text>
            </YStack>

            {error && (
              <Text color="$red10" textAlign="center">{error}</Text>
            )}

            <Button
              onPress={connectWithCode}
              disabled={isLoading || !phone}
              size="$5"
              backgroundColor="$blue10"
            >
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <Text color="white" fontWeight="600">Gerar Codigo</Text>
              )}
            </Button>

            <Button
              onPress={() => setMethod(null)}
              size="$4"
              backgroundColor="$gray5"
            >
              <Text color="$color">Voltar</Text>
            </Button>
          </YStack>
        </ScrollView>
      </>
    );
  }

  // Default - Method selection
  return (
    <>
      <Stack.Screen options={{ title: "Conectar WhatsApp" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <YStack gap="$4">
          <Text fontSize="$5" fontWeight="bold" color="$color">
            Como deseja conectar?
          </Text>
          <Text color="$gray8" marginBottom="$2">
            Escolha o metodo de conexao mais adequado para sua situacao.
          </Text>

          {/* QR Code Option */}
          <Pressable onPress={() => setMethod("qrcode")}>
            <Card
              backgroundColor="$backgroundStrong"
              padding="$4"
              borderRadius="$4"
              borderWidth={2}
              borderColor="$blue10"
            >
              <XStack gap="$4" alignItems="center">
                <YStack
                  width={60}
                  height={60}
                  borderRadius={12}
                  backgroundColor="$blue5"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name="qr-code-outline" size={32} color="#2563eb" />
                </YStack>
                <YStack flex={1}>
                  <Text fontSize="$5" fontWeight="bold" color="$color">
                    QR Code
                  </Text>
                  <Text color="$gray8" fontSize="$3" marginTop="$1">
                    Escaneie com outro celular
                  </Text>
                </YStack>
                <Ionicons name="chevron-forward" size={20} color="#2563eb" />
              </XStack>

              <Card
                backgroundColor="$blue5"
                padding="$3"
                borderRadius="$3"
                marginTop="$3"
              >
                <XStack alignItems="center" gap="$2">
                  <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
                  <Text color="$blue10" fontSize="$2" flex={1}>
                    Recomendado quando voce vai usar OUTRO celular para escanear o QR Code
                  </Text>
                </XStack>
              </Card>
            </Card>
          </Pressable>

          {/* Code Option */}
          <Pressable onPress={() => setMethod("code")}>
            <Card
              backgroundColor="$backgroundStrong"
              padding="$4"
              borderRadius="$4"
              borderWidth={2}
              borderColor="$green10"
            >
              <XStack gap="$4" alignItems="center">
                <YStack
                  width={60}
                  height={60}
                  borderRadius={12}
                  backgroundColor="$green5"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name="keypad-outline" size={32} color="#22c55e" />
                </YStack>
                <YStack flex={1}>
                  <Text fontSize="$5" fontWeight="bold" color="$color">
                    Codigo de Pareamento
                  </Text>
                  <Text color="$gray8" fontSize="$3" marginTop="$1">
                    Digite o codigo no WhatsApp
                  </Text>
                </YStack>
                <Ionicons name="chevron-forward" size={20} color="#22c55e" />
              </XStack>

              <Card
                backgroundColor="$green5"
                padding="$3"
                borderRadius="$3"
                marginTop="$3"
              >
                <XStack alignItems="center" gap="$2">
                  <Ionicons name="information-circle-outline" size={16} color="#22c55e" />
                  <Text color="$green10" fontSize="$2" flex={1}>
                    Recomendado quando voce vai conectar usando ESTE MESMO celular
                  </Text>
                </XStack>
              </Card>
            </Card>
          </Pressable>

          {error && (
            <Text color="$red10" textAlign="center" marginTop="$2">{error}</Text>
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
