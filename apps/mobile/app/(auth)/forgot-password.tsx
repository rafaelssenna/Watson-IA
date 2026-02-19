import { useState } from "react";
import { Link } from "expo-router";
import { YStack, H1, Text, Input, Button, Spinner } from "tamagui";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

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
      <YStack flex={1} padding="$6" justifyContent="center" alignItems="center">
        <Text fontSize={64}>📧</Text>
        <H1 marginTop="$4" textAlign="center">Email Enviado!</H1>
        <Text color="$colorSubtle" textAlign="center" marginTop="$2">
          Verifique sua caixa de entrada para redefinir sua senha.
        </Text>
        <Link href="/(auth)/login" asChild>
          <Button marginTop="$6" size="$4">
            Voltar ao Login
          </Button>
        </Link>
      </YStack>
    );
  }

  return (
    <YStack flex={1} padding="$6" justifyContent="center">
      <H1>Esqueceu a Senha?</H1>
      <Text color="$colorSubtle" marginTop="$2" marginBottom="$6">
        Digite seu email e enviaremos um link para redefinir sua senha.
      </Text>

      <YStack gap="$4">
        <YStack>
          <Text marginBottom="$1" fontSize="$3" color="$colorSubtle">
            Email
          </Text>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            size="$4"
          />
        </YStack>

        <Button
          onPress={handleSubmit}
          disabled={isLoading || !email}
          size="$5"
          backgroundColor="$blue10"
          color="white"
        >
          {isLoading ? <Spinner color="white" /> : "Enviar Link"}
        </Button>

        <Link href="/(auth)/login" asChild>
          <Text color="$blue10" textAlign="center" marginTop="$4">
            Voltar ao Login
          </Text>
        </Link>
      </YStack>
    </YStack>
  );
}
