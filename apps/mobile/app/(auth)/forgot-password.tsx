import { useState } from "react";
import { Link } from "expo-router";
import { YStack, H1, Text, Input, Button, Spinner, useTheme } from "tamagui";

// Watson IA brand colors
const WATSON_TEAL = "#0d9488";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const theme = useTheme();

  const handleSubmit = async () => {
    if (!email) return;

    setIsLoading(true);
    // TODO: Implement password reset
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <YStack flex={1} padding="$6" justifyContent="center" alignItems="center" backgroundColor="$background">
        <Text fontSize={64}>📧</Text>
        <H1 marginTop="$4" textAlign="center" color="$color">Email Enviado!</H1>
        <Text color="$colorSubtle" textAlign="center" marginTop="$2">
          Verifique sua caixa de entrada para redefinir sua senha.
        </Text>
        <Link href="/(auth)/login" asChild>
          <Button marginTop="$6" size="$4" backgroundColor={WATSON_TEAL}>
            <Text color="white" fontWeight="600">Voltar ao Login</Text>
          </Button>
        </Link>
      </YStack>
    );
  }

  return (
    <YStack flex={1} padding="$6" justifyContent="center" backgroundColor="$background">
      <H1 color="$color">Esqueceu a Senha?</H1>
      <Text color="$colorSubtle" marginTop="$2" marginBottom="$6">
        Digite seu email e enviaremos um link para redefinir sua senha.
      </Text>

      <YStack gap="$4">
        <YStack>
          <Text marginBottom="$1" fontSize="$3" color="$gray8">
            Email
          </Text>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={theme.gray7.val}
            keyboardType="email-address"
            autoCapitalize="none"
            size="$4"
            backgroundColor="$backgroundStrong"
            borderColor="$gray6"
            color="$color"
          />
        </YStack>

        <Button
          onPress={handleSubmit}
          disabled={isLoading || !email}
          size="$5"
          backgroundColor={WATSON_TEAL}
          pressStyle={{ opacity: 0.9 }}
        >
          {isLoading ? <Spinner color="white" /> : <Text color="white" fontWeight="600">Enviar Link</Text>}
        </Button>

        <Link href="/(auth)/login" asChild>
          <Text color={WATSON_TEAL} textAlign="center" marginTop="$4" fontWeight="600">
            Voltar ao Login
          </Text>
        </Link>
      </YStack>
    </YStack>
  );
}
