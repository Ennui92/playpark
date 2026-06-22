import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { LanguagePicker } from "@/components/LanguagePicker";
import { signInOrCreate } from "@/services/auth";
import { useT } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

export function SignInScreen() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.includes("@") || password.length < 6) return;
    setLoading(true);
    try {
      await signInOrCreate(email, password);
      // SessionContext picks up the new session automatically.
    } catch (e: any) {
      showDialog(t("signin.signinFailed"), e?.message ?? t("signin.checkEmail"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.logo}>🌤️</Text>
          <Text style={styles.title}>Outside</Text>
          <Text style={styles.tagline}>{t("signin.tagline")}</Text>

          <TextInput
            style={styles.input}
            placeholder={t("signin.emailPlaceholder")}
            placeholderTextColor={COLORS.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={[styles.input, { marginTop: SPACING.sm }]}
            placeholder={t("signin.passwordPlaceholder")}
            placeholderTextColor={COLORS.textTertiary}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            autoComplete="password"
          />
          <Text style={styles.hint}>{t("signin.passwordHint")}</Text>
          <Button
            title={t("signin.continue")}
            onPress={submit}
            loading={loading}
            disabled={!email.includes("@") || password.length < 6}
            style={{ marginTop: SPACING.md }}
          />
          <View style={{ marginTop: SPACING.xl }}>
            <LanguagePicker />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flexGrow: 1, padding: SPACING.xl, justifyContent: "center" },
  logo: { fontSize: 72, textAlign: "center", marginBottom: SPACING.md },
  title: {
    fontSize: FONT_SIZE.display,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
    marginBottom: SPACING.xxl,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
});
